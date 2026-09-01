import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function startApp(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test('GET /api/message returns the expected JSON message', async (t) => {
  const { server, url } = await startApp(createApp());
  t.after(() => server.close());

  const response = await fetch(`${url}/api/message`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), { message: 'Hello from the API' });
});

test('GET /health returns JSON health status and build metadata', async (t) => {
  const { server, url } = await startApp(createApp({
    buildNumber: '42',
    gitCommit: 'abcdef0123456789'
  }));
  t.after(() => server.close());

  const response = await fetch(`${url}/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    build: '42',
    commit: 'abcdef0'
  });
});

test('unknown routes return the API JSON 404 response', async (t) => {
  const { server, url } = await startApp(createApp());
  t.after(() => server.close());

  const response = await fetch(`${url}/missing`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});
