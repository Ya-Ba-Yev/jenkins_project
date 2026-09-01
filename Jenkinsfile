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
        }
    }
}
