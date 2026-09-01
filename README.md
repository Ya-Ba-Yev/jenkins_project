# Jenkins Assignment — Step 5 CI-only Jenkins Multibranch Support

This repository contains a JSON-only API and a server-rendered web service. Both
services expose `GET /health`, returning exactly `status`, `build`, and `commit`.
`commit` is the first seven characters of `GIT_COMMIT`.

## Prerequisites

- Node.js 24 or later
- npm

## API service

```powershell
Set-Location .\api
npm install
npm test
npm run coverage
npm start
```

The API listens on port `3000` by default. Override it with `PORT` when needed:

```powershell
$env:PORT = 3001
npm start
```

Endpoints: `GET /api/message` and `GET /health`.

`npm run coverage` uses Node's built-in test coverage support, enforces at
least 80% line coverage for production code in `src/`, and writes
`api/coverage/lcov.info`. Test files, dependencies, and the process startup
file are deliberately excluded from this coverage scope.

## Web service

In another terminal:

```powershell
Set-Location .\web
npm install
npm test
npm run coverage
npm start
```

The web service listens on port `3000` by default. It fetches its message
server-side from `API_BASE_URL`, which defaults to `http://api:3000` for the
intended service-to-service environment. For a local API running on port 3001:

```powershell
$env:API_BASE_URL = 'http://127.0.0.1:3001'
$env:PORT = 3002
npm start
```

Browse to `http://127.0.0.1:3002/`. Its health endpoint is `GET /health`.
The web coverage result is written to `web/coverage/lcov.info` and applies the
same 80% line threshold to `web/src/` only.

## Docker Compose

Docker Compose builds both services with `BUILD_NUMBER` and `GIT_COMMIT` build
arguments. The Dockerfiles persist these values as runtime environment variables.
They default to `local`; no secrets are required or passed as build arguments.

```powershell
# From the repository root
$env:BUILD_NUMBER = '42'
$env:GIT_COMMIT = 'abcdef0123456789'
docker compose build
docker compose up -d
```

The API is available only on the internal Compose network. The web service is
published on `http://127.0.0.1:8080/` and uses `http://api:3000` internally.

Check the running web service and its build metadata:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
docker compose ps
docker compose logs api web
```

Expected health JSON for the example above:

```json
{"status":"ok","build":"42","commit":"abcdef0"}
```

Stop the local stack when finished:

```powershell
docker compose down
```

## Compose integration test

Run the real service-to-service test from the repository root:

```powershell
docker compose --profile test up --build --abort-on-container-exit --exit-code-from integration
```

The profile-only `integration` container waits for the healthy web service,
requests it over the Compose network, and verifies that the rendered page
contains `Hello from the API`. It exits nonzero if the request, timeout, or
assertion fails. The API remains private; only the web service publishes port
`8080`.

After the command completes, remove this temporary test stack:

```powershell
docker compose --profile test down
```

## Jenkins Multibranch CI (Step 5)

The root `Jenkinsfile` is a **CI-only** declarative Pipeline. It runs the same
validation on both `dev` and `main`: Node/npm dependency installation, coverage,
the Compose integration profile, and local Docker image builds. It does not
deploy containers or modify application runtime behavior.

### Prerequisites

- Jenkins with the Pipeline, Multibranch Pipeline, and Git/SCM support already
  available in the Jenkins installation. No plugins are introduced by this
  repository.
- A Linux Jenkins agent labelled `linux-docker-node24` with Bash, Git, Node.js
  **24 or later**, npm, Docker CLI, and Docker Compose v2 (`docker compose`).
- The agent identity must be allowed to communicate with the Docker daemon.
  **Security warning:** granting an agent access to `/var/run/docker.sock`
  effectively grants root-equivalent control of the Docker host. Use an isolated,
  disposable CI worker where possible; do not expose a production Docker socket
  to untrusted branches or pull requests.
- SCM access sufficient for Jenkins to check out the repository. The Pipeline
  uses the checked-out SCM revision (`git rev-parse HEAD`), not a user-supplied
  commit value. No repository credentials are referenced in the Jenkinsfile.

### Jenkins setup

1. Create a **Multibranch Pipeline** job and configure the repository as its
   branch source.
2. Set the Script Path to `Jenkinsfile` and ensure the selected agent label is
   available.
3. For this assignment, enable branch discovery and include `main` and `dev`.
   Recommended discovery is to build named branches (or apply an include filter
   of `main dev`) and disable pull-request discovery unless it is intentionally
   supported by an isolated Docker worker.
4. Run *Scan Multibranch Pipeline Now*. Jenkins should create child jobs for
   `main` and `dev` and execute the same CI-only pipeline for each.

### What the Pipeline does

1. Checks out the SCM revision and records its full and 12-character short SHA.
2. Preflights Node.js major version (must be at least 24), Docker, Docker
   Compose, and the expected package, Dockerfile, Compose, and integration-test
   files.
3. Runs `npm ci` independently in `api` and `web`, then runs each package's
   `npm run coverage` script.
4. Runs `docker compose --profile test up --build --abort-on-container-exit
   --exit-code-from integration`. Diagnostics are captured before the always-run
   `docker compose --profile test down --volumes --remove-orphans` cleanup.
5. Builds, but does not push, local images tagged
   `message-api:ci-<BUILD_NUMBER>-<short-sha>` and
   `message-web:ci-<BUILD_NUMBER>-<short-sha>`. Both builds receive the Jenkins
   build number and checked-out full commit through `BUILD_NUMBER` and
   `GIT_COMMIT` build arguments.
6. Archives LCOV reports when present and CI metadata/Compose logs even when a
   preceding stage fails. `node_modules` is never archived.

There is intentionally **no deployment, runtime `docker compose up` deployment,
registry login, image push, approval gate, Jenkins credential binding, or secret
handling** in this Pipeline. The only Compose `up` command uses the `test`
profile and exits with the integration container's status.

### Validation

After a branch scan, validate `dev` first and then `main`:

1. Confirm each child job ran the `Checkout`, `Preflight`, `Install
   dependencies`, `Coverage`, `Compose integration test`, and `Build local CI
   images` stages.
2. Confirm the console output shows Node major version 24 or higher and a
   successful `docker compose version`.
3. In each build's archived artifacts, verify `api/coverage/lcov.info`,
   `web/coverage/lcov.info`, `ci-artifacts/build-metadata.env`,
   `ci-artifacts/image-tags.env`, and Compose logs. The recorded short SHA must
   match the branch's checked-out revision and the image tags must include that
   SHA and Jenkins build number.
4. Confirm the integration command exits using `integration` and that cleanup
   ran. On a deliberately failing integration test, confirm `compose-up.log`
   and `compose.log` are archived and no Compose resources remain.
5. Confirm neither `dev` nor `main` has a deployment stage, registry activity,
   approval prompt, credential use, or a persistent application stack.

## Local Jenkins course environment

`jenkins/` contains an isolated local-only Jenkins LTS (JDK 21) controller for
this course. It includes Git, curl/CA certificates, Node.js 24, and Docker CLI
with the Compose plugin; it does not install Jenkins plugins or configure jobs.

```powershell
Set-Location .\jenkins
docker compose config
docker compose up -d --build
docker compose ps
```

Open `http://127.0.0.1:9090/`. To display the one-time initial administrator
password only in your local terminal, run:

```powershell
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

The controller is bound to loopback only on `http://127.0.0.1:9090/`; no inbound
agent port is exposed. It persists state in the named `jenkins_course_home`
volume. It mounts the host Docker socket for course CI.
That socket grants root-equivalent control of the Docker host; do not use this
environment for untrusted jobs, branches, or production. Docker Desktop exposes
the mounted socket as root-only, so this local Compose service deliberately runs
as root solely for socket compatibility (the image itself defaults back to the
unprivileged `jenkins` user after package installation). Do not enable
`privileged` mode.
