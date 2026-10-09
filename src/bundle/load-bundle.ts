// Loader: read every bundle file through a BundleSource, parse it, validate it against its
// schema and assemble the in-memory bundle. Problems become LoadIssues (validate V01).

import type { SchemaRegistry } from '../schema/schema-registry.ts';
import { assembleBundle } from './assemble-bundle.ts';
import type { LoadedFile, LoadIssue, LoadResult } from './bundle.ts';
import type { BundleSource } from './bundle-source.ts';
import { classifyPath, SCHEMA_OF_KIND } from './classify-path.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:b084a744 */
import augurContract_cd99ed03 from '../contracts/load-bundle.contract.ts'; /* augur-inject:contract-predicate:98297ab3 */

export interface BundleText {
  readonly path: string;
  readonly text: string;
}

const BYTE_ORDER_MARK = '\uFEFF';

function parseJson(text: string): { ok: true; data: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, data: JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text) };
  } catch (error) {
    return { ok: false, message: `invalid JSON: ${(error as Error).message}` };
  }
}

/** Pure part of the loader: classify, parse and schema-validate already-read texts. */
export function loadBundleFromTexts(texts: readonly BundleText[], registry: SchemaRegistry): LoadResult {
  const files: LoadedFile[] = [];
  const issues: LoadIssue[] = [];
  const ordered = [...texts].sort((a, b) => a.path.localeCompare(b.path));
  for (const { path, text } of ordered) {
    const pathClass = classifyPath(path);
    if (pathClass.type === 'ignored') continue;
    if (pathClass.type === 'unknown') {
      issues.push({ path, pointer: '', message: 'file is not part of the bundle layout (design 4.2)' });
      continue;
    }
    const parsed = parseJson(text);
    if (!parsed.ok) {
      issues.push({ path, pointer: '', message: parsed.message });
      continue;
    }
    const violations = registry.validate(SCHEMA_OF_KIND[pathClass.kind], parsed.data);
    for (const violation of violations) issues.push({ path, pointer: violation.pointer, message: violation.message });
    files.push({ path, kind: pathClass.kind, data: parsed.data, schemaValid: violations.length === 0 });
  }
  if (!ordered.some(({ path }) => path === 'manifest.json')) {
    issues.push({ path: 'manifest.json', pointer: '', message: 'manifest.json is required' });
  }
  return { bundle: assembleBundle(files), files, issues };
}
// @ts-expect-error augur-inject
loadBundleFromTexts = contract(loadBundleFromTexts, { ...augurContract_cd99ed03, contractId: 'C-4', mode: 'observe', sample: 1, where: 'src/bundle/load-bundle.ts:26', rule: 'contract-wrap', id: 'cd99ed03' }); /* augur-inject:contract-wrap:cd99ed03 */

export async function loadBundle(source: BundleSource, registry: SchemaRegistry): Promise<LoadResult> {
  const paths = await source.listFiles();
  const texts: BundleText[] = [];
  for (const path of paths) {
    if (classifyPath(path).type === 'ignored') continue;
    texts.push({ path, text: await source.readText(path) });
  }
  return loadBundleFromTexts(texts, registry);
}
