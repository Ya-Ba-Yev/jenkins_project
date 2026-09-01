import express from 'express';

const DEFAULT_API_BASE_URL = 'http://api:3000';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function validateApiBaseUrl(value) {
  const apiBaseUrl = value || DEFAULT_API_BASE_URL;
  const url = new URL(apiBaseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('API_BASE_URL must use http or https.');
  }
  return url.toString().replace(/\/$/, '');
}

function getBuildMetadata({
  buildNumber = process.env.BUILD_NUMBER ?? 'local',
  gitCommit = process.env.GIT_COMMIT ?? 'local'
} = {}) {
  return {
    build: String(buildNumber),
    commit: String(gitCommit).slice(0, 7)
  };
}

export function createApp({
  apiBaseUrl = process.env.API_BASE_URL,
  fetchImpl = fetch,
  buildNumber,
  gitCommit
} = {}) {
  const baseUrl = validateApiBaseUrl(apiBaseUrl);
  const metadata = getBuildMetadata({ buildNumber, gitCommit });
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function.');
  }

  const app = express();
  app.disable('x-powered-by');

  app.get('/', async (_request, response) => {
    try {
      const apiResponse = await fetchImpl(`${baseUrl}/api/message`);
      if (!apiResponse.ok) {
        throw new Error(`API returned HTTP ${apiResponse.status}`);
      }

      const { message } = await apiResponse.json();
      if (typeof message !== 'string') {
        throw new Error('API response did not contain a string message.');
      }

      response.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Message Web</title></head>
<body><main><h1>Message Web</h1><p>${escapeHtml(message)}</p></main></body></html>`);
    } catch (error) {
      console.error('Unable to retrieve API message:', error.message);
      response.status(502).type('html').send('<!doctype html><html lang="en"><body><p>Unable to retrieve the API message.</p></body></html>');
    }
  });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', ...metadata });
  });

  return app;
}

export { DEFAULT_API_BASE_URL };
