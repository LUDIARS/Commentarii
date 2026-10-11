// Test helpers for replay: fixture paths, the compiled replay schema and observation frames.

import { readFile } from 'node:fs/promises';
import { readReplaySchemaDocuments } from '../../src/adapters/fs/replay-schema-documents.ts';
import type { ObservationFrame, ObservationMode, ReplayHeader, ReplayRun } from '@ludiars/commentarii-sdk/types';
import { fixtureReplayDirectory, fixtureReplayPath } from '@ludiars/commentarii-sdk/fixtures';
import { createReplaySchema, parseReplay, type ReplayLoad, type ReplaySchema } from '@ludiars/commentarii-sdk/replay';

export const REPLAY_FIXTURE_DIR = fixtureReplayDirectory();
export const BASE_RUN = fixtureReplayPath('dome-arena-base');
export const BRANCH_RUN = fixtureReplayPath('dome-arena-branch');

let schema: ReplaySchema | undefined;

export async function replaySchema(): Promise<ReplaySchema> {
  schema ??= createReplaySchema(await readReplaySchemaDocuments());
  return schema;
}

export async function parseText(text: string): Promise<ReplayLoad> {
  return parseReplay(text, await replaySchema());
}

export async function fixtureText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export async function loadRun(path: string): Promise<ReplayRun> {
  const loaded = await parseText(await fixtureText(path));
  if (loaded.run === undefined) throw new Error(`${path} did not load: ${JSON.stringify(loaded.issues)}`);
  return loaded.run;
}

export function headerFields(mode: ObservationMode = 'player'): Omit<ReplayHeader, 'type'> {
  return {
    run_id: 'run:test-recording',
    seed: 7,
    game_id: 'bestia',
    manifest_version: '0.1.0',
    adapter_id: 'bestia-render-tap',
    mode,
    purpose: 'efficiency',
    observation_fields: [{ path: 'self.resources.boost', knowledge: 'shown', origin: 'boost gauge on the HUD' }],
    started_at: '2026-10-09T00:00:00.000Z',
  };
}

export function observation(tick: number, mode: ObservationMode = 'player'): ObservationFrame {
  const t = tick / 10;
  return {
    tick,
    t,
    source: mode === 'player' ? 'render-tap' : 'game-api',
    mode,
    purpose: 'efficiency',
    self: { pos: [0, 0, 20 - tick], hp: { value: 1, knowledge: 'shown' }, resources: { boost: 100 } },
    entities: [{ entity: 'enemy:bestia:wire-spider', instance: 2, pos: [0, 0, 4], confidence: 0.9 }],
    stage: { id: 'stage:bestia:dome-arena', elapsed: t, node: 'node:mid-ring' },
    events: [],
  };
}
