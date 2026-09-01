// CI-only Jenkins Multibranch Pipeline.
// Requires a Linux Jenkins agent with Node.js 24+, Docker CLI, Docker Compose v2,
// Bash, and permission to communicate with the Docker daemon.
pipeline {
    agent {
        label 'linux-docker-node24'
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // This is the exact revision checked out by the Multibranch SCM source.
                    env.GIT_COMMIT = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    env.GIT_SHORT_COMMIT = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
                }
                sh '''#!/usr/bin/env bash
                    set -Eeuo pipefail
                    mkdir -p ci-artifacts
                    printf 'BUILD_NUMBER=%s\nGIT_COMMIT=%s\nGIT_SHORT_COMMIT=%s\n' \
                        "$BUILD_NUMBER" "$GIT_COMMIT" "$GIT_SHORT_COMMIT" > ci-artifacts/build-metadata.env
                    git status --short --branch > ci-artifacts/git-status.txt
                    git log -1 --format=fuller > ci-artifacts/git-revision.txt
                '''
            }
        }

        stage('Preflight') {
            steps {
                sh '''#!/usr/bin/env bash
                    set -Eeuo pipefail

                    node_version="$(node --version)"
                    node_major="${node_version#v}"
                    node_major="${node_major%%.*}"
                    if ! [[ "$node_major" =~ ^[0-9]+$ ]] || (( node_major < 24 )); then
                        echo "ERROR: Node.js 24 or later is required; found ${node_version}." >&2
                        exit 1
                    fi

                    command -v docker >/dev/null || { echo 'ERROR: Docker CLI is required.' >&2; exit 1; }
                    docker --version
                    docker compose version

                    required_files=(
                        api/package.json api/package-lock.json api/Dockerfile
                        web/package.json web/package-lock.json web/Dockerfile
                        integration-tests/Dockerfile integration-tests/test-web.mjs
                        docker-compose.yml
                    )
                    for expected_file in "${required_files[@]}"; do
                        [[ -f "$expected_file" ]] || { echo "ERROR: Missing expected file: $expected_file" >&2; exit 1; }
                    done

                    docker compose -f docker-compose.yml config --quiet
                    {
                        echo "node=${node_version}"
                        docker --version
                        docker compose version
                    } > ci-artifacts/tool-versions.txt
                '''
            }
        }

        stage('Install dependencies') {
            steps {
                dir('api') {
                    sh '''#!/usr/bin/env bash
                        set -Eeuo pipefail
                        npm ci
                    '''
                }
                dir('web') {
                    sh '''#!/usr/bin/env bash
                        set -Eeuo pipefail
                        npm ci
                    '''
                }
            }
        }

        stage('Coverage') {
            steps {
                dir('api') {
                    sh '''#!/usr/bin/env bash
                        set -Eeuo pipefail
                        npm run coverage
                    '''
                }
                dir('web') {
                    sh '''#!/usr/bin/env bash
                        set -Eeuo pipefail
                        npm run coverage
                    '''
                }
            }
        }

        stage('Compose integration test') {
            steps {
                sh '''#!/usr/bin/env bash
                    set -Eeuo pipefail
                    # The integration profile is test-only; this does not deploy a runtime stack.
                    docker compose --profile test up --build --abort-on-container-exit --exit-code-from integration \
                        2>&1 | tee ci-artifacts/compose-up.log
                '''
            }
        }

        stage('Build local CI images') {
            steps {
                sh '''#!/usr/bin/env bash
                    set -Eeuo pipefail
                    api_tag="message-api:ci-${BUILD_NUMBER}-${GIT_SHORT_COMMIT}"
                    web_tag="message-web:ci-${BUILD_NUMBER}-${GIT_SHORT_COMMIT}"

                    docker build --build-arg "BUILD_NUMBER=${BUILD_NUMBER}" --build-arg "GIT_COMMIT=${GIT_COMMIT}" \
                        --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
                        --label "org.opencontainers.image.version=${BUILD_NUMBER}" \
                        --tag "$api_tag" api
                    docker build --build-arg "BUILD_NUMBER=${BUILD_NUMBER}" --build-arg "GIT_COMMIT=${GIT_COMMIT}" \
                        --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
                        --label "org.opencontainers.image.version=${BUILD_NUMBER}" \
                        --tag "$web_tag" web

                    printf 'api_image=%s\nweb_image=%s\n' "$api_tag" "$web_tag" > ci-artifacts/image-tags.env
                    docker image inspect "$api_tag" "$web_tag" > ci-artifacts/image-inspect.json
                '''
            }
        }
    }

    post {
        always {
            script {
                // Capture diagnostics before teardown. The command is harmless when no stack was created.
                if (fileExists('docker-compose.yml')) {
                    sh '''#!/usr/bin/env bash
                        set -u
                        mkdir -p ci-artifacts
                        if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
                            logs_status=0
                            down_status=0
                            docker compose --profile test logs --no-color > ci-artifacts/compose.log 2>&1 || logs_status=$?
                            docker compose --profile test down --volumes --remove-orphans \
                                > ci-artifacts/compose-down.log 2>&1 || down_status=$?
                            printf 'compose_logs_exit_code=%s\ncompose_down_exit_code=%s\n' \
                                "$logs_status" "$down_status" > ci-artifacts/compose-cleanup-status.env
                            if (( logs_status != 0 || down_status != 0 )); then
                                echo 'ERROR: Compose diagnostics collection or cleanup failed; see archived Compose logs.' >&2
                                exit 1
                            fi
                        else
                            echo 'Docker Compose unavailable; no Compose diagnostics or cleanup could run.' \
                                > ci-artifacts/compose-cleanup-skipped.txt
                        fi
                    '''
                }
            }
            archiveArtifacts artifacts: 'api/coverage/lcov.info,web/coverage/lcov.info,ci-artifacts/**', allowEmptyArchive: true
        }
    }
}
