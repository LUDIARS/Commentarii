// `npm run dev`: the HTTP server bound to 127.0.0.1. /health always; with COMMENTARII_BUNDLE set
// to a bundle directory, the Web editor too (stage 7, spec/feature/web-editor.md).

import { createServer } from 'node:http';
import { handleEditorRequest } from '../web/editor-api.ts';
import { createFsEditorDeps } from '../web/fs-editor-deps.ts';
import { BodyError, toEditorRequest } from '../web/node-editor-request.ts';
import { healthResponse } from './health-response.ts';
import { resolvePort } from './resolve-port.ts';

const HOST = '127.0.0.1';

const port = resolvePort(process.env.COMMENTARII_PORT);
const bundleDir = process.env.COMMENTARII_BUNDLE;
const editor = bundleDir === undefined || bundleDir === '' ? undefined : createFsEditorDeps(bundleDir, port);

const server = createServer((request, response) => {
  const pathname = (request.url ?? '').split('?')[0];
  if (editor === undefined || pathname === '/health') {
    const result = healthResponse(request.method, request.url);
    response.writeHead(result.status, { 'content-type': result.contentType });
    response.end(request.method === 'HEAD' ? undefined : result.body);
    return;
  }
  toEditorRequest(request)
    .then((parsed) => handleEditorRequest(parsed, editor))
    .then((result) => {
      response.writeHead(result.status, { 'content-type': result.contentType, 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : result.body);
    })
    .catch((cause: unknown) => {
      const status = cause instanceof BodyError ? 400 : 500;
      if (status === 500) process.stderr.write(`commentarii: editor error: ${(cause as Error).message}\n`);
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: (cause as Error).message }));
    });
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
  process.stderr.write(`commentarii: listening on http://${HOST}:${port}/health${editor === undefined ? '' : ` (editor for ${bundleDir} at /)`}\n`);
});
