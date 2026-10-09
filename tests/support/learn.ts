// Test helpers for the learning loop: the drifted bundle (the sample with values moved on
// purpose, tests/fixtures/learn/drifted), its hand-written run observations, and temp copies.

import { cp, mkdtemp, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFsBundleSource } from '../../src/adapters/fs/fs-bundle-source.ts';
import type { LoadResult } from '../../src/bundle/bundle.ts';
import { loadBundle } from '../../src/bundle/load-bundle.ts';
import { parseRunObservations, type RunObservations } from '../../src/learn/observations/run-observations.ts';
import { learningPolicyOf, type LearningPolicy } from '../../src/learn/policy/learning-policy.ts';
import { overlaySource, REPO_ROOT, SAMPLE_DIR, schemaRegistry } from './bundles.ts';

export const LEARN_FIXTURES = join(REPO_ROOT, 'tests', 'fixtures', 'learn');
export const DRIFTED_DIR = join(LEARN_FIXTURES, 'drifted');
export const RUNS_DIR = join(LEARN_FIXTURES, 'runs');

export const CLOSE = 'tactic:bestia:close-in-dragonfly';
export const KITE = 'tactic:bestia:kite-wire-spider';
export const SPIDER_ID = 'enemy:bestia:wire-spider';
export const BEETLE_ID = 'enemy:bestia:bazooka-beetle';

export async function loadDrifted(): Promise<LoadResult> {
  const source = overlaySource(await createFsBundleSource(SAMPLE_DIR), await createFsBundleSource(DRIFTED_DIR));
  return loadBundle(source, await schemaRegistry());
}

export function driftedPolicy(load: LoadResult, overrides: { rewrite?: Partial<LearningPolicy['rewrite']> } = {}): LearningPolicy {
  const policy = learningPolicyOf(load.bundle.manifest?.doc);
  return { ...policy, rewrite: { ...policy.rewrite, ...overrides.rewrite } };
}

export function runPath(name: string): string {
  return join(RUNS_DIR, `${name}.jsonl`);
}

export async function readRuns(...names: string[]): Promise<RunObservations[]> {
  const registry = await schemaRegistry();
  return Promise.all(names.map(async (name) => parseRunObservations(runPath(name), await readFile(runPath(name), 'utf8'), registry)));
}

/** A temp directory holding the drifted bundle as plain files (the sample + the fixture on top). */
export async function withDriftedCopy(body: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'cm-learn-'));
  try {
    await cp(SAMPLE_DIR, directory, { recursive: true });
    await cp(DRIFTED_DIR, directory, { recursive: true, force: true });
    await body(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
