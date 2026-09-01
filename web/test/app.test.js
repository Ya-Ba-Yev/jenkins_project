import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp, DEFAULT_API_BASE_URL } from '../src/app.js';

async function startApp(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test('uses the required service-network API URL by default', () => {
  assert.equal(DEFAULT_API_BASE_URL, 'http://api:3000');
});

test('GET / renders the message returned by the API server-side', async (t) => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({ message: 'Hello & <operator> "\'' }), { status: 200 });
  };
  const { server, url } = await startApp(createApp({ apiBaseUrl: 'http://api:3000', fetchImpl }));
  t.after(() => server.close());

  const response = await fetch(`${url}/`);
  assert.equal(response.status, 200);
  assert.equal(requestedUrl, 'http://api:3000/api/message');
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(await response.text(), /Hello &amp; &lt;operator&gt; &quot;&#39;/);
});

test('GET /health returns JSON health status and build metadata', async (t) => {
  const { server, url } = await startApp(createApp({
    fetchImpl: fetch,
    buildNumber: '42',
    gitCommit: 'abcdef0123456789'
  }));
  t.after(() => server.close());

  const response = await fetch(`${url}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    build: '42',
    commit: 'abcdef0'
  });
});

test('GET / returns 502 when the API response is unsuccessful', async (t) => {
  const fetchImpl = async () => new Response('', { status: 503 });
  const { server, url } = await startApp(createApp({ fetchImpl }));
  t.after(() => server.close());

  const response = await fetch(`${url}/`);
  assert.equal(response.status, 502);
  assert.match(await response.text(), /Unable to retrieve the API message/);
});

test('validates API configuration and fetch implementation at startup', () => {
  assert.throws(
    () => createApp({ apiBaseUrl: 'ftp://api:3000' }),
    /API_BASE_URL must use http or https/
  );
  assert.throws(
    () => createApp({ fetchImpl: null }),
    /fetchImpl must be a function/
  );
});
