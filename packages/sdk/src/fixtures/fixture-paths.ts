// Where the SDK fixtures (packages/sdk/fixtures/) are on disk: the samples/bestia bundle.json
// exports, the recorded replays and the observation lines. Commentarii and Ingenium tests read
// the same files, so neither repository keeps its own copy of the bundle.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExportKnowledge } from '../export/exported-bundle.ts';

/** samples/bestia exported with each knowledge (`guide export --knowledge <k>`). */
export const FIXTURE_BUNDLES = ['player', 'full'] as const satisfies readonly ExportKnowledge[];
/** Recorded replays of the dome arena: a base run and a branch that decides differently. */
export const FIXTURE_REPLAYS = ['dome-arena-base', 'dome-arena-branch'] as const;
export type FixtureReplay = (typeof FIXTURE_REPLAYS)[number];

/** Absolute path of packages/sdk/fixtures (src/ and dist/ sit at the same depth). */
export function fixturesDirectory(): string {
  return fileURLToPath(new URL('../../fixtures', import.meta.url));
}

export function fixtureBundlePath(knowledge: ExportKnowledge): string {
  return join(fixturesDirectory(), 'bestia', `bundle.${knowledge}.json`);
}

export function fixtureReplayDirectory(): string {
  return join(fixturesDirectory(), 'replay');
}

export function fixtureReplayPath(name: FixtureReplay): string {
  return join(fixtureReplayDirectory(), `${name}.jsonl`);
}

/** Observation lines (observation.schema.json, one per line) as `observations/runs/` holds them. */
export function fixtureObservationRunsDirectory(): string {
  return join(fixturesDirectory(), 'observations', 'runs');
}
