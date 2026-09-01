# Local-course Jenkins controller image.
# Based on the explicit Jenkins LTS JDK 21 release tag documented by Jenkins;
# update this tag deliberately as part of maintenance, never use `latest`.
FROM jenkins/jenkins:2.568.2-jdk21

USER root

# Install the Docker client from Docker's signed official Debian repository,
# Node.js 24 from the signed NodeSource repository, and baseline build tools.
# The controller itself still runs as the unprivileged `jenkins` user.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl git gnupg; \
    install -m 0755 -d /etc/apt/keyrings; \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc; \
    chmod a+r /etc/apt/keyrings/docker.asc; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" > /etc/apt/sources.list.d/docker.list; \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /etc/apt/keyrings/nodesource.asc; \
    chmod a+r /etc/apt/keyrings/nodesource.asc; \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.asc] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin nodejs; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

USER jenkins
