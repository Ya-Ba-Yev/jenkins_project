FROM node:24-alpine

WORKDIR /app

ARG BUILD_NUMBER=local
ARG GIT_COMMIT=local
ENV NODE_ENV=production \
    PORT=3000 \
    BUILD_NUMBER=${BUILD_NUMBER} \
    GIT_COMMIT=${GIT_COMMIT}

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src

USER node
EXPOSE 3000

CMD ["node", "src/server.js"]
