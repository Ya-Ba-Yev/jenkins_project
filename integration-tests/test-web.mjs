import assert from 'node:assert/strict';
import test from 'node:test';

const webUrl = process.env.WEB_URL ?? 'http://web:3000';
const retryIntervalMs = 500;
const timeoutMs = 30_000;

async function fetchPageWithRetry() {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(webUrl, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) {
        throw new Error(`Web returned HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }

  throw new Error(`Web did not become reachable at ${webUrl} within ${timeoutMs}ms: ${lastError?.message}`);
}

test('web renders the message retrieved from the API', async () => {
  const response = await fetchPageWithRetry();
  const page = await response.text();

  assert.match(page, /<p>Hello from the API<\/p>/);
});
