// Test helpers for replay: fixture paths, the compiled replay schema, observation frames and
// an in-memory line writer.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readReplaySchemaDocuments } from '../../src/adapters/fs/replay-schema-documents.ts';
import type { ObservationFrame, ObservationMode } from '../../src/replay/observation-frame.ts';
import { parseReplay, type ReplayLoad } from '../../src/replay/parse-replay.ts';
import type { ReplayLineWriter } from '../../src/replay/recording-sink.ts';
import type { ReplayHeader, ReplayRun } from '../../src/replay/replay-record.ts';
import { createReplaySchema, type ReplaySchema } from '../../src/replay/replay-schema.ts';
import { REPO_ROOT } from '../support/bundles.ts';

export const REPLAY_FIXTURE_DIR = join(REPO_ROOT, 'tests', 'fixtures', 'replay');
export const BASE_RUN = join(REPLAY_FIXTURE_DIR, 'dome-arena-base.jsonl');
export const BRANCH_RUN = join(REPLAY_FIXTURE_DIR, 'dome-arena-branch.jsonl');

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

export interface MemoryWriter extends ReplayLineWriter {
  readonly lines: string[];
  text(): string;
}

export function memoryWriter(): MemoryWriter {
  const lines: string[] = [];
  return {
    lines,
    async append(line) {
      lines.push(line);
    },
    text: () => lines.map((line) => `${line}\n`).join(''),
  };
}
