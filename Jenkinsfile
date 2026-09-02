// Course CI pipeline. The agent needs Node.js, Docker, Docker Compose, and Bash.
pipeline {
    agent { label 'linux-docker-node24' }
    options { skipDefaultCheckout(true) }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    env.GIT_SHORT_COMMIT = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
                }
            }
        }
        stage('Install & Test') {
            steps {
                sh '''#!/usr/bin/env bash
                    set -euo pipefail
                    (cd api && npm ci && npm run coverage)
                    (cd web && npm ci && npm run coverage)
                '''
            }
        }
        stage('Node Version Test Matrix') {
            parallel {
                stage('API - Node 22') {
                    steps {
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            container_id=''
                            cleanup() {
                                if [[ -n "$container_id" ]]; then
                                    docker rm -f "$container_id" >/dev/null 2>&1 || true
                                fi
                            }
                            trap cleanup EXIT
                            container_id="$(docker create node:22 sh -c 'tail -f /dev/null')"
                            docker cp "$PWD/api/." "$container_id:/app"
                            docker start "$container_id" >/dev/null
                            docker exec "$container_id" sh -c 'cd /app && npm ci && npm test'
                        '''
                    }
                }
                stage('API - Node 24') {
                    steps {
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            container_id=''
                            cleanup() {
                                if [[ -n "$container_id" ]]; then
                                    docker rm -f "$container_id" >/dev/null 2>&1 || true
                                fi
                            }
                            trap cleanup EXIT
                            container_id="$(docker create node:24 sh -c 'tail -f /dev/null')"
                            docker cp "$PWD/api/." "$container_id:/app"
                            docker start "$container_id" >/dev/null
                            docker exec "$container_id" sh -c 'cd /app && npm ci && npm test'
                        '''
                    }
                }
                stage('Web - Node 22') {
                    steps {
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            container_id=''
                            cleanup() {
                                if [[ -n "$container_id" ]]; then
                                    docker rm -f "$container_id" >/dev/null 2>&1 || true
                                fi
                            }
                            trap cleanup EXIT
                            container_id="$(docker create node:22 sh -c 'tail -f /dev/null')"
                            docker cp "$PWD/web/." "$container_id:/app"
                            docker start "$container_id" >/dev/null
                            docker exec "$container_id" sh -c 'cd /app && npm ci && npm test'
                        '''
                    }
                }
                stage('Web - Node 24') {
                    steps {
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            container_id=''
                            cleanup() {
                                if [[ -n "$container_id" ]]; then
                                    docker rm -f "$container_id" >/dev/null 2>&1 || true
                                fi
                            }
                            trap cleanup EXIT
                            container_id="$(docker create node:24 sh -c 'tail -f /dev/null')"
                            docker cp "$PWD/web/." "$container_id:/app"
                            docker start "$container_id" >/dev/null
                            docker exec "$container_id" sh -c 'cd /app && npm ci && npm test'
                        '''
                    }
                }
            }
        }
        stage('Integration Test') {
            steps {
                sh '''#!/usr/bin/env bash
                    set -euo pipefail
                    WEB_HOST_PORT=18080 docker compose -p jenkins-integration --profile test up --build --abort-on-container-exit --exit-code-from integration
                '''
            }
        }
        stage('Build Images') {
            steps {
                sh '''#!/usr/bin/env bash
                    set -euo pipefail
                    docker build --build-arg "BUILD_NUMBER=$BUILD_NUMBER" --build-arg "GIT_COMMIT=$GIT_COMMIT" -t "message-api:ci-$BUILD_NUMBER-$GIT_SHORT_COMMIT" api
                    docker build --build-arg "BUILD_NUMBER=$BUILD_NUMBER" --build-arg "GIT_COMMIT=$GIT_COMMIT" -t "message-web:ci-$BUILD_NUMBER-$GIT_SHORT_COMMIT" web
                '''
            }
        }
        stage('Deploy') {
            when { branch 'main' }
            steps { sh 'bash deploy.sh' }
        }
    }
    post {
        always {
            sh 'WEB_HOST_PORT=18080 docker compose -p jenkins-integration --profile test down || true'
            archiveArtifacts artifacts: 'api/coverage/lcov.info,web/coverage/lcov.info', allowEmptyArchive: true
            junit testResults: 'api/coverage/junit.xml,web/coverage/junit.xml', allowEmptyResults: true
        }
    }
}
