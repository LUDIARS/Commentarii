// The Web editor's routes (design 6 "Web 画面はファイルを書くだけで独自 DB を持たない", stage 7,
// spec/feature/web-editor.md). The editor holds no state: every read loads the bundle files,
// every save writes one document file after its schema check and answers with the bundle's
// validation (V01-V12), and every decision (approve / apply proposals, accept / reject
// divergences) goes through the very CLI command a person would type, so the Web and the CLI
// cannot drift apart. Writes need a JSON body and, when the browser sends an Origin, the editor's
// own origin (no cross-site writes to a local tool).

import type { LoadResult } from '../bundle/bundle.ts';
import type { SchemaRegistry } from '../schema/schema-registry.ts';
import { runValidation } from '../validate/run-validation.ts';
import { DIVERGENCES_PATH } from '../verify/intent/divergence-store.ts';
import { editablePath } from './doc-path.ts';
import { html, json, type EditorRequest, type EditorResponse } from './editor-http.ts';
import { EDITOR_PAGE } from './editor-page.ts';

export interface CliOutcome {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface EditorDeps {
  readonly bundleDir: string;
  /** Origins allowed to write (http://127.0.0.1:<port>, http://localhost:<port>). */
  readonly origins: readonly string[];
  openBundle(): Promise<LoadResult>;
  /** UTF-8 text of a bundle-relative file, undefined when absent. */
  readText(relativePath: string): Promise<string | undefined>;
  writeFile(relativePath: string, text: string): Promise<void>;
  registry(): Promise<SchemaRegistry>;
  /** The guide CLI (same process), with the editor's bundle directory already in the arguments. */
  runCli(args: readonly string[]): Promise<CliOutcome>;
}

const MAX_FINDINGS = 200;

function text(value: unknown, name: string): string | undefined {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[name] === 'string' ? ((value as Record<string, string>)[name] as string).trim() || undefined : undefined;
}

async function validation(deps: EditorDeps) {
  const load = await deps.openBundle();
  const report = runValidation(load);
  const findings = report.checks.flatMap((check) => check.findings.map((finding) => ({ check: check.id, ...finding })));
  return { ok: report.ok, issues: load.issues.length, findings: findings.slice(0, MAX_FINDINGS), more: Math.max(0, findings.length - MAX_FINDINGS) };
}

async function bundleSummary(deps: EditorDeps): Promise<EditorResponse> {
  const load = await deps.openBundle();
  const manifest = load.bundle.manifest?.doc;
  const files = load.files.map((file) => file.path).filter((path) => editablePath(path) !== undefined).sort();
  return json(200, { game_id: manifest?.game_id ?? null, version: manifest?.version ?? null, files, validation: await validation(deps) });
}

async function readDoc(request: EditorRequest, deps: EditorDeps): Promise<EditorResponse> {
  const target = editablePath(request.query.path);
  if (target === undefined) return json(400, { error: 'not an editable bundle document path' });
  const content = await deps.readText(target.path);
  if (content === undefined) return json(404, { error: 'no such document' });
  return json(200, { path: target.path, schema: target.schema, doc: JSON.parse(content) as unknown });
}

async function saveDoc(request: EditorRequest, deps: EditorDeps): Promise<EditorResponse> {
  const target = editablePath(request.query.path);
  if (target === undefined) return json(400, { error: 'not an editable bundle document path' });
  const doc = typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, unknown>).doc : undefined;
  if (doc === undefined) return json(400, { error: 'the body needs {"doc": <document>}' });
  const violations = (await deps.registry()).validate(target.schema, doc);
  if (violations.length > 0) return json(422, { saved: false, path: target.path, violations });
  await deps.writeFile(target.path, `${JSON.stringify(doc, null, 2)}\n`);
  return json(200, { saved: true, path: target.path, validation: await validation(deps) });
}

function cliResponse(outcome: CliOutcome, parse: boolean): EditorResponse {
  let result: unknown = outcome.stdout;
  if (parse) {
    try {
      result = JSON.parse(outcome.stdout);
    } catch {
      result = outcome.stdout;
    }
  }
  return json(outcome.code === 0 ? 200 : 422, { ok: outcome.code === 0, result, stderr: outcome.stderr });
}

async function decide(request: EditorRequest, deps: EditorDeps, verb: 'approve' | 'accept' | 'reject'): Promise<EditorResponse> {
  const by = text(request.body, 'by');
  if (by === undefined) return json(400, { error: 'a decision needs "by" (who decides)' });
  if (verb === 'approve') {
    const proposal = text(request.body, 'proposal');
    const reason = text(request.body, 'reason');
    if (proposal === undefined || reason === undefined) return json(400, { error: 'approve needs "proposal" and "reason"' });
    return cliResponse(await deps.runCli(['learn', 'approve', '--game', deps.bundleDir, '--proposal', proposal, '--by', by, '--reason', reason]), true);
  }
  const id = text(request.body, 'id');
  if (id === undefined) return json(400, { error: `${verb} needs the divergence "id"` });
  const note = text(request.body, 'note');
  return cliResponse(await deps.runCli(['verify', 'intent', '--game', deps.bundleDir, `--${verb}`, id, '--by', by, ...(note === undefined ? [] : ['--note', note]), '--json']), true);
}

function writeRefusal(request: EditorRequest, deps: EditorDeps): EditorResponse | undefined {
  if (request.origin !== undefined && !deps.origins.includes(request.origin)) return json(403, { error: 'cross-origin writes are refused' });
  if (!(request.contentType ?? '').startsWith('application/json')) return json(415, { error: 'writes need a JSON body' });
  return undefined;
}

export async function handleEditorRequest(request: EditorRequest, deps: EditorDeps): Promise<EditorResponse> {
  const route = `${request.method} ${request.path}`;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const refused = writeRefusal(request, deps);
    if (refused !== undefined) return refused;
  }
  switch (route) {
    case 'GET /':
      return html(EDITOR_PAGE);
    case 'GET /api/bundle':
      return bundleSummary(deps);
    case 'GET /api/doc':
      return readDoc(request, deps);
    case 'PUT /api/doc':
      return saveDoc(request, deps);
    case 'GET /api/proposals':
      return cliResponse(await deps.runCli(['learn', 'consolidate', '--game', deps.bundleDir, '--json']), true);
    case 'POST /api/proposals/approve':
      return decide(request, deps, 'approve');
    case 'POST /api/proposals/apply':
      return cliResponse(await deps.runCli(['learn', 'consolidate', '--game', deps.bundleDir, '--apply', '--json']), true);
    case 'GET /api/divergences': {
      const content = await deps.readText(DIVERGENCES_PATH);
      return json(200, content === undefined ? { divergences: [] } : (JSON.parse(content) as unknown));
    }
    case 'POST /api/divergences/accept':
      return decide(request, deps, 'accept');
    case 'POST /api/divergences/reject':
      return decide(request, deps, 'reject');
    default:
      return json(404, { error: 'not_found' });
  }
}
