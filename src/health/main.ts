// `npm run dev`: minimal HTTP server bound to 127.0.0.1 that answers /health.

import { createServer } from 'node:http';
import { healthResponse } from './health-response.ts';
import { resolvePort } from './resolve-port.ts';

const HOST = '127.0.0.1';

const port = resolvePort(process.env.COMMENTARII_PORT);
const server = createServer((request, response) => {
  const result = healthResponse(request.method, request.url);
  response.writeHead(result.status, { 'content-type': result.contentType });
  response.end(request.method === 'HEAD' ? undefined : result.body);
});

server.on('error', (error) => {
  process.stderr.write(`commentarii: server error: ${error.message}\n`);
  process.exitCode = 1;
  server.close();
});

const shutdown = (): void => {
  server.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.listen(port, HOST, () => {
  process.stderr.write(`commentarii: listening on http://${HOST}:${port}/health\n`);
});
