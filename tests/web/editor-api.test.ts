import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { handleEditorRequest, type EditorDeps } from '../../src/web/editor-api.ts';
import type { EditorRequest } from '../../src/web/editor-http.ts';
import { createFsEditorDeps } from '../../src/web/fs-editor-deps.ts';
import { MAIN_RUNS, withSampleCopy } from '../support/verify.ts';

const ORIGIN = 'http://127.0.0.1:4410';

function request(method: string, path: string, options: { query?: Record<string, string>; body?: unknown; origin?: string; contentType?: string } = {}): EditorRequest {
  return {
    method,
    path,
    query: options.query ?? {},
    ...(options.body === undefined ? {} : { body: options.body }),
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(method === 'GET' ? {} : { contentType: options.contentType ?? 'application/json' }),
  };
}

async function call(deps: EditorDeps, method: string, path: string, options: Parameters<typeof request>[2] = {}) {
  const response = await handleEditorRequest(request(method, path, options), deps);
  return { status: response.status, data: response.contentType.startsWith('application/json') ? (JSON.parse(response.body) as Record<string, unknown>) : response.body };
}

test('the page and the bundle summary: documents listed, validation attached', async () => {
  await withSampleCopy(async (directory) => {
    const deps = createFsEditorDeps(directory, 4410);
    const page = await call(deps, 'GET', '/');
    assert.match(String(page.data), /攻略本エディタ/);
    const summary = await call(deps, 'GET', '/api/bundle');
    const data = summary.data as { game_id: string; files: string[]; validation: { ok: boolean } };
    assert.equal(data.game_id, 'bestia');
    assert.ok(data.files.includes('tactics/kite-wire-spider.json'));
    assert.ok(data.files.includes('stages/dome-arena/map.json'));
    assert.equal(data.validation.ok, true);
  });
});

test('a saved document is exactly what the canonical file holds, and reads back the same', async () => {
  await withSampleCopy(async (directory) => {
    const deps = createFsEditorDeps(directory, 4410);
    const path = 'tactics/kite-wire-spider.json';
    const before = (await call(deps, 'GET', '/api/doc', { query: { path } })).data as { doc: Record<string, unknown> };
    const doc = { ...before.doc, name: { ja: 'スパイダーの射程外へ下がる (編集)', en: 'Kite the wire spider (edited)' } };
    const saved = await call(deps, 'PUT', '/api/doc', { query: { path }, body: { doc }, origin: ORIGIN });
    assert.equal(saved.status, 200);
    assert.equal((saved.data as { validation: { ok: boolean } }).validation.ok, true);
    assert.equal(await readFile(join(directory, 'tactics', 'kite-wire-spider.json'), 'utf8'), `${JSON.stringify(doc, null, 2)}\n`);
    assert.deepEqual(((await call(deps, 'GET', '/api/doc', { query: { path } })).data as { doc: unknown }).doc, doc);
  });
});

test('a document breaking its schema is not written; map annotations save through the same route', async () => {
  await withSampleCopy(async (directory) => {
    const deps = createFsEditorDeps(directory, 4410);
    const path = 'tactics/kite-wire-spider.json';
    const original = await readFile(join(directory, ...path.split('/')), 'utf8');
    const broken = await call(deps, 'PUT', '/api/doc', { query: { path }, body: { doc: { id: 'tactic:bestia:kite-wire-spider' } } });
    assert.equal(broken.status, 422);
    assert.equal(await readFile(join(directory, ...path.split('/')), 'utf8'), original);
    const mapPath = 'stages/dome-arena/map.json';
    const map = ((await call(deps, 'GET', '/api/doc', { query: { path: mapPath } })).data as { doc: { annotations: unknown[]; nodes: { id: string }[] } }).doc;
    const annotated = { ...map, annotations: [...map.annotations, { target: map.nodes[0]?.id, kind: 'resource', note: { ja: '回復地点 (編集)' }, knowledge: 'shown' }] };
    const saved = await call(deps, 'PUT', '/api/doc', { query: { path: mapPath }, body: { doc: annotated } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(JSON.parse(await readFile(join(directory, 'stages', 'dome-arena', 'map.json'), 'utf8')).annotations.length, map.annotations.length + 1);
  });
});

test('paths outside the bundle documents, cross-origin writes and non-JSON writes are refused', async () => {
  await withSampleCopy(async (directory) => {
    const deps = createFsEditorDeps(directory, 4410);
    for (const path of ['../package.json', '/etc/passwd', 'C:/Windows/win.ini', 'observations/overlay.json', 'tactics/../manifest.json', 'notes.md']) {
      assert.equal((await call(deps, 'GET', '/api/doc', { query: { path } })).status, 400, path);
    }
    assert.equal((await call(deps, 'GET', '/api/doc', { query: { path: 'tactics/none.json' } })).status, 404);
    const doc = { id: 'x' };
    assert.equal((await call(deps, 'PUT', '/api/doc', { query: { path: 'tactics/kite-wire-spider.json' }, body: { doc }, origin: 'http://evil.example' })).status, 403);
    assert.equal((await call(deps, 'PUT', '/api/doc', { query: { path: 'tactics/kite-wire-spider.json' }, body: { doc }, contentType: 'text/plain' })).status, 415);
    assert.equal((await call(deps, 'GET', '/api/nothing')).status, 404);
  });
});

test('divergence judgment goes through the CLI: reject records the decision only, accept adds an allowed divergence', async () => {
  await withSampleCopy(async (directory) => {
    const deps = createFsEditorDeps(directory, 4410);
    assert.equal((await deps.runCli(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS])).code, 0);
    const listed = (await call(deps, 'GET', '/api/divergences')).data as { divergences: { id: string; kind: string }[] };
    const [first, second] = listed.divergences;
    assert.ok(first && second);
    assert.equal((await call(deps, 'POST', '/api/divergences/reject', { body: { id: first.id } })).status, 400, 'a decision needs who decides');
    const rejected = await call(deps, 'POST', '/api/divergences/reject', { body: { id: first.id, by: 'neco', note: '詰みにつながる' } });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
    const after = (await call(deps, 'GET', '/api/divergences')).data as { divergences: { id: string; decision: string; decided_by?: string }[] };
    assert.deepEqual(after.divergences.find((entry) => entry.id === first.id)?.decision, 'reject');
    const accepted = await call(deps, 'POST', '/api/divergences/accept', { body: { id: second.id, by: 'neco' } });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    const intent = JSON.parse(await readFile(join(directory, 'intent', 'dome-arena.json'), 'utf8')) as { allowed_divergences: { divergence?: string; manifest_version?: string }[] };
    assert.ok(intent.allowed_divergences.some((entry) => entry.divergence === second.id && entry.manifest_version === '0.1.0'));
  });
});

test('proposals without an overlay are reported as such, not as an empty success', async () => {
  await withSampleCopy(async (directory) => {
    const proposals = await call(createFsEditorDeps(directory, 4410), 'GET', '/api/proposals');
    assert.equal(proposals.status, 422);
    assert.match(String((proposals.data as { stderr: string }).stderr), /guide learn ingest first/);
  });
});
