import { createApp } from './app.js';

function getPort(value) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

try {
  const port = getPort(process.env.PORT);
  const server = createApp().listen(port, () => {
    console.log(`Web listening on port ${port}`);
  });

  server.on('error', (error) => {
    console.error('Web failed to start:', error.message);
    process.exitCode = 1;
  });
} catch (error) {
  console.error(`Web configuration error: ${error.message}`);
  process.exitCode = 1;
}
