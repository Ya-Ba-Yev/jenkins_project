import express from 'express';

function getBuildMetadata({
  buildNumber = process.env.BUILD_NUMBER ?? 'local',
  gitCommit = process.env.GIT_COMMIT ?? 'local'
} = {}) {
  return {
    build: String(buildNumber),
    commit: String(gitCommit).slice(0, 7)
  };
}

/**
 * Creates the API application without binding a network port, so routes can be
 * tested independently from process startup.
 */
export function createApp(buildMetadata) {
  const metadata = getBuildMetadata(buildMetadata);
  const app = express();

  app.disable('x-powered-by');

  app.get('/api/message', (_request, response) => {
    response.json({ message: 'Hello from the API' });
  });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', ...metadata });
  });

  // Keep this service JSON-only, including unknown routes and unexpected errors.
  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  app.use((error, _request, response, _next) => {
    console.error('Unhandled API error:', error);
    response.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
