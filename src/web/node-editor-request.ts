// node's IncomingMessage -> EditorRequest: path and query from the URL, the Origin and
// Content-Type headers, and the body parsed as JSON (at most 2 MB; an unparseable body is
// refused before any route sees it).

import type { IncomingMessage } from 'node:http';
import type { EditorRequest } from './editor-http.ts';

const MAX_BODY = 2 * 1024 * 1024;

export class BodyError extends Error {
  override readonly name = 'BodyError';
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buffer.length;
    if (size > MAX_BODY) throw new BodyError('the body is larger than 2 MB');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function toEditorRequest(request: IncomingMessage): Promise<EditorRequest> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await readBody(request);
  let body: unknown;
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text);
    } catch {
      throw new BodyError('the body is not JSON');
    }
  }
  const origin = request.headers.origin;
  const contentType = request.headers['content-type'];
  return {
    method: request.method ?? 'GET',
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    ...(body === undefined ? {} : { body }),
    ...(typeof origin === 'string' ? { origin } : {}),
    ...(typeof contentType === 'string' ? { contentType } : {}),
  };
}
