#!/usr/bin/env bash
# Minimal blue/green Docker deployment.
# Usage: BUILD_NUMBER=42 GIT_COMMIT=<commit-sha> bash deploy.sh
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NETWORK=bluegreen
PROXY=nginx-proxy

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
remove_candidate() { docker rm -f "api-$NEW" "web-$NEW" >/dev/null 2>&1 || true; }
CANDIDATE_STARTED=0
TEMP_CONFIG=''
cleanup() {
    local rc=$?
    if (( rc != 0 && CANDIDATE_STARTED )); then
        remove_candidate
    fi
    [[ -z "$TEMP_CONFIG" ]] || rm -f "$TEMP_CONFIG"
    exit "$rc"
}
trap cleanup EXIT

[[ -n "${BUILD_NUMBER:-}" ]] || fail 'BUILD_NUMBER is required.'
[[ -n "${GIT_COMMIT:-}" ]] || fail 'GIT_COMMIT is required.'
command -v docker >/dev/null || fail 'Docker CLI is required.'
docker info >/dev/null || fail 'Docker daemon is unavailable.'

SHORT_COMMIT="${GIT_COMMIT:0:12}"
API_IMAGE="message-api:ci-${BUILD_NUMBER}-${SHORT_COMMIT}"
WEB_IMAGE="message-web:ci-${BUILD_NUMBER}-${SHORT_COMMIT}"

# Jenkins has already built these tags. The fallback also makes local use simple.
if ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
    docker build --build-arg "BUILD_NUMBER=$BUILD_NUMBER" --build-arg "GIT_COMMIT=$GIT_COMMIT" -t "$API_IMAGE" "$ROOT/api"
fi
if ! docker image inspect "$WEB_IMAGE" >/dev/null 2>&1; then
    docker build --build-arg "BUILD_NUMBER=$BUILD_NUMBER" --build-arg "GIT_COMMIT=$GIT_COMMIT" -t "$WEB_IMAGE" "$ROOT/web"
fi

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

if docker container inspect api-blue >/dev/null 2>&1 || docker container inspect web-blue >/dev/null 2>&1; then
    ACTIVE=blue
    NEW=green
elif docker container inspect api-green >/dev/null 2>&1 || docker container inspect web-green >/dev/null 2>&1; then
    ACTIVE=green
    NEW=blue
else
    ACTIVE=''
    NEW=blue
fi

log "Starting $NEW candidate."
remove_candidate
CANDIDATE_STARTED=1
docker run -d --name "api-$NEW" --network "$NETWORK" "$API_IMAGE" >/dev/null
docker run -d --name "web-$NEW" --network "$NETWORK" -e "API_BASE_URL=http://api-$NEW:3000" "$WEB_IMAGE" >/dev/null

if ! docker container inspect "$PROXY" >/dev/null 2>&1; then
    log 'Starting Nginx on host port 8080.'
    docker run -d --name "$PROXY" --network "$NETWORK" -p 8080:80 nginx:alpine >/dev/null
    docker cp "$ROOT/nginx/default.conf" "$PROXY:/etc/nginx/conf.d/default.conf"
    docker exec "$PROXY" nginx -t
    docker kill -s HUP "$PROXY" >/dev/null
fi

candidate_is_healthy() {
    docker exec "api-$NEW" node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" &&
    docker exec "web-$NEW" node -e "fetch('http://127.0.0.1:3000//health-rollback-demo').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" &&
    docker exec "web-$NEW" node -e "fetch('http://127.0.0.1:3000/').then(async r=>{if(!r.ok || !(await r.text()).includes('Hello from the API'))process.exit(1)}).catch(()=>process.exit(1))"
}

for _ in {1..30}; do candidate_is_healthy && break; sleep 1; done
if ! candidate_is_healthy; then
    remove_candidate
    fail "Candidate $NEW failed health checks; existing deployment is unchanged."
fi

switch_proxy() {
    sed "s/web-blue:3000/web-$1:3000/" "$ROOT/nginx/default.conf" > "$TEMP_CONFIG"
    docker cp "$TEMP_CONFIG" "$PROXY:/etc/nginx/conf.d/default.conf" &&
        docker exec "$PROXY" nginx -t &&
        docker kill -s HUP "$PROXY"
}

TEMP_CONFIG="$(mktemp)"
if ! switch_proxy "$NEW"; then
    if [[ -n "$ACTIVE" ]]; then
        switch_proxy "$ACTIVE" >/dev/null 2>&1 || true
    fi
    remove_candidate
    fail "Nginx switch to $NEW failed; existing deployment remains live."
fi

if [[ -n "$ACTIVE" ]]; then
    docker rm -f "api-$ACTIVE" "web-$ACTIVE" >/dev/null
fi
CANDIDATE_STARTED=0
log "Promoted $NEW."
