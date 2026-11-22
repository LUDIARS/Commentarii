
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { LevelRegime } from '@ludiars/commentarii-sdk/types';

export interface LevelPrinciples {
  readonly schema: 'level-principles/1';
  readonly measure: {
    readonly choice: { readonly bands: Readonly<Record<LevelRegime, { readonly warning: number }>> };
  };
  readonly moves: Readonly<Record<string, string>>;
}

const snapshot = new URL('principles/level-design.json', import.meta.resolve('@ludiars/commentarii-sdk/package.json'));
const provenance = new URL('principles/level-design.source.json', import.meta.resolve('@ludiars/commentarii-sdk/package.json'));

function digest(text: string): string {
  return createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
}

export async function readLevelPrinciples(upstream?: string): Promise<LevelPrinciples> {
  const source = JSON.parse(await readFile(provenance, 'utf8')) as { readonly sha256: string };
  const text = await readFile(snapshot, 'utf8');
  if (digest(text) !== source.sha256) throw new Error('SDK level-principles snapshot differs from its recorded source');
  if (upstream !== undefined && digest(await readFile(upstream, 'utf8')) !== source.sha256) {
    throw new Error('SDK level-principles snapshot differs from the supplied upstream file');
  }
  const principles = JSON.parse(text) as LevelPrinciples;
  if (principles.schema !== 'level-principles/1') throw new Error('expected level-principles/1');
  return principles;
}
