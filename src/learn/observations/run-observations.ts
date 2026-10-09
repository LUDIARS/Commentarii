// One run's observation file (observations/runs/<slug>.jsonl, written by reflect) -> its lines,
// each checked against observation.schema.json. The run ID is run:<file name without .jsonl>.
// A run counts as player only when every line is player: one omniscient line makes the whole
// run omniscient (the safe side: it is then ignored for learning, principle 2).

import type { OverlayLine } from '../../engine/reflect/overlay-line.ts';
import type { ObservationMode } from '../../replay/observation-frame.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import { LearnError } from '../learn-error.ts';

export interface RunObservations {
  readonly run: string;
  readonly mode: ObservationMode;
  readonly lines: readonly OverlayLine[];
}

const RUN_SLUG = /^[a-z0-9][a-z0-9_-]*$/;

export function runIdOfPath(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const slug = name.endsWith('.jsonl') ? name.slice(0, -'.jsonl'.length) : '';
  if (!RUN_SLUG.test(slug)) throw new LearnError(`${path}: a run file must be named <run-slug>.jsonl (a-z, 0-9, _ and -)`);
  return `run:${slug}`;
}

function parseLine(path: string, number: number, text: string, registry: SchemaRegistry): OverlayLine {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new LearnError(`${path}:${number}: invalid JSON: ${(error as Error).message}`);
  }
  const violations = registry.validate('observation', data);
  if (violations.length > 0) throw new LearnError(`${path}:${number}: ${violations.map((v) => `${v.pointer || '/'} ${v.message}`).join('; ')}`);
  return data as OverlayLine;
}

export function parseRunObservations(path: string, text: string, registry: SchemaRegistry): RunObservations {
  const run = runIdOfPath(path);
  const lines: OverlayLine[] = [];
  text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (line.trim() !== '') lines.push(parseLine(path, index + 1, line, registry));
    });
  const mode: ObservationMode = lines.some((line) => line.mode === 'omniscient') ? 'omniscient' : 'player';
  return { run, mode, lines };
}
