// The editor's HTTP surface as plain data (spec/feature/web-editor.md): the server turns node's
// request into an EditorRequest and an EditorResponse back, so every route is testable without
// a socket.

export interface EditorRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  /** Parsed JSON body (undefined when there is none). */
  readonly body?: unknown;
  /** Origin header, when the browser sent one. */
  readonly origin?: string;
  readonly contentType?: string;
}

export interface EditorResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

const JSON_TYPE = 'application/json; charset=utf-8';

export function json(status: number, value: unknown): EditorResponse {
  return { status, contentType: JSON_TYPE, body: `${JSON.stringify(value, null, 2)}\n` };
}

export function html(body: string): EditorResponse {
  return { status: 200, contentType: 'text/html; charset=utf-8', body };
}
