
import { loadBundleFromTexts } from '@ludiars/commentarii-sdk/bundle';
import type { SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import { contentHash } from '../learn/approval/proposal-hash.ts';
import type { FileChange } from '../import/plan/file-change.ts';
import { runValidation } from '../validate/run-validation.ts';

export function requireLevelBundle(load: LoadResult): void {
  if (load.issues.length > 0 || load.bundle.manifest === undefined) {
    throw new Error('invalid bundle; run guide validate');
  }
}

export function levelBundleHash(load: LoadResult): string {
  // level-quality/1 uses the evaluator's bundle digest. Glossary and overlays are excluded.
  return contentHash(load.files.filter(({ kind }) => kind !== 'glossary')
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(({ path, data }) => [path, data]));
}

export function trialBundle(load: LoadResult, changes: readonly FileChange[], registry: SchemaRegistry): {
  readonly load: LoadResult;
  readonly files: ReadonlyMap<string, string>;
} {
  const files = new Map(load.files.map(({ path, data }) => [path, `${JSON.stringify(data, null, 2)}\n`]));
  for (const { path, after } of changes) files.set(path, `${JSON.stringify(after, null, 2)}\n`);
  const candidate = loadBundleFromTexts([...files].map(([path, text]) => ({ path, text })), registry);
  const report = runValidation(candidate);
  if (!report.ok) {
    const errors = report.checks.flatMap(({ id, findings }) => findings
      .filter(({ severity }) => severity === 'error')
      .map(({ path, pointer, message }) => `${id} ${path}${pointer}: ${message}`));
    throw new Error(`proposal makes the guide invalid\n${errors.join('\n')}`);
  }
  return { load: candidate, files };
}
