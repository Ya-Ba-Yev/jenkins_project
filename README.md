# Jenkins Course Assignment

This project has a small API and web app. They are separate Docker images. The
API is on an internal Docker network; the web app calls it at `http://api:3000`.
Both `/health` endpoints return exactly `status`, `build`, and `commit`.

## Run tests locally

Node.js 24+ and Docker Compose are required.

```powershell
Set-Location api; npm ci; npm run coverage
Set-Location ..\web; npm ci; npm run coverage
Set-Location ..
docker compose --profile test up --build --abort-on-container-exit --exit-code-from integration
docker compose --profile test down
```

Coverage must be at least 80%. The integration test makes a real request from
the web service to the API and checks for `Hello from the API`.

To run the application stack:

```powershell
$env:BUILD_NUMBER = '42'
$env:GIT_COMMIT = 'abcdef0123456789'
docker compose up -d --build
Invoke-RestMethod http://127.0.0.1:8080/health
docker compose down
```

Expected health response: `{"status":"ok","build":"42","commit":"abcdef0"}`.
The web host port defaults to `8080`; set `WEB_HOST_PORT` (for example,
`$env:WEB_HOST_PORT = '18080'`) before running Compose to use another local port.

## Jenkins

Start the supplied local Jenkins environment:

```powershell
Set-Location jenkins
docker compose up -d --build
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open `http://127.0.0.1:9090/`, create a Multibranch Pipeline, select this
repository, and scan branches. Jenkins uses the `linux-docker-node24` label.

Both `dev` and `main` run checkout, `npm ci`, coverage, the Compose integration
test, and separate API/web image builds. Only `main` runs `deploy.sh`. Coverage
reports are archived when available.

## Blue-green deployment

On the Docker host, run:

```bash
BUILD_NUMBER=42 GIT_COMMIT=abcdef0123456789 bash deploy.sh
curl http://127.0.0.1:8080/
```

The first deployment starts the blue pair. Later deployments start the other
color beside the live pair, check API health, web health, and web-to-API output,
then update Nginx and gracefully reload it. Only after that switch succeeds is
the old pair removed. A failed candidate is removed, the old pair remains live,
and the Jenkins build fails.

### Rollback demonstration

Deploy a working build and keep its browser/curl result. Then make a temporary
change that makes a candidate health check fail, run `deploy.sh`, and confirm it
exits nonzero while `curl http://127.0.0.1:8080/` still shows the working version.
Undo the temporary change and deploy again.

## Submission screenshots

- Jenkins `dev` build: test, integration, and image stages; no deploy stage.
- Jenkins `main` build: all stages including `Deploy`.
- Successful API or web `/health` JSON with build and commit values.
- Browser or curl output containing `Hello from the API`.
- Failed-candidate build plus the still-working endpoint for the rollback demo.
