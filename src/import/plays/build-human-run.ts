// One player's run of telemetry rows -> a replay run (spec/feature/replay.md) of a human play:
// header source human, mode player, purpose human; one tick per row; footer with the outcome.
// Identifiers become salted hashes (run:human-<hash>, summary.player); time is relative to the
// first row; a masked value in any observation is a mapping error and fails the import.

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { findMaskedPointers } from '../../replay/find-masked-pointers.ts';
import type { ReplayFooter, ReplayHeader, ReplayResult, ReplayRun, ReplayTick } from '../../replay/replay-record.ts';
import { ImportError } from '../import-error.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { readNumber, readText } from '../masters/read-cell.ts';
import type { RowGroup } from './group-runs.ts';
import { playerHash, runHash } from './hash-identifier.ts';
import type { Identify } from './identify.ts';
import { countIn, type ImportTally } from './import-tally.ts';
import type { PlaysContext } from './plays-context.ts';
import type { PlaysMapping } from './plays-mapping.ts';
import { readAction, type ResolveOperand } from './read-action.ts';
import { readEntities } from './read-entities.ts';
import { readEvents } from './read-events.ts';
import { humanRunDeclarations } from './observation-declarations.ts';
import { readExtra } from './read-extra.ts';
import { readCount, readTimestamp } from './read-row-values.ts';
import { readSelf } from './read-self.ts';
import { resolveNode, resolveStage } from './resolve-place.ts';

/** adapter_id of imported human plays: they come from the game's telemetry, not an adapter. */
export const TELEMETRY_ADAPTER_ID = 'telemetry';
/** A human play has no engine seed. */
export const HUMAN_SEED = 'human';

export interface HumanRunInput {
  readonly group: RowGroup;
  readonly mapping: PlaysMapping;
  readonly context: PlaysContext;
  readonly identify: Identify;
  readonly salt: string;
  /** Import time, used when the mapping has no started_at column. */
  readonly now: Date;
  readonly tally: ImportTally;
}

export interface HumanRun {
  readonly playerHash: string;
  readonly run: ReplayRun;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function timeOf(row: MasterRow, mapping: PlaysMapping): number {
  const value = readNumber(row, mapping.t.column);
  if (value === undefined) throw new ImportError(`${row.ref}: no time in column '${mapping.t.column}'`);
  return value * (mapping.t.scale ?? 1);
}

function stageOf(row: MasterRow, input: HumanRunInput): string {
  const { mapping, context } = input;
  const cell = readText(row, mapping.stage.column);
  if (cell === undefined) throw new ImportError(`${row.ref}: no stage in column '${mapping.stage.column}'`);
  const stage = resolveStage(context, mapping.stage, cell);
  if (stage === undefined) throw new ImportError(`${row.ref}: stage '${cell}' is not a stage of ${context.gameId}; add it to stage.values in the mapping`);
  return stage;
}

function nodeOf(row: MasterRow, input: HumanRunInput, stage: string): string | undefined {
  const { mapping, context, tally } = input;
  if (mapping.node === undefined) return undefined;
  const cell = readText(row, mapping.node.column);
  if (cell === undefined) return undefined;
  const node = resolveNode(context, stage, mapping.node, cell);
  if (node === undefined) countIn(tally, 'unresolved nodes');
  return node;
}

function operandResolver(input: HumanRunInput, stage: string): ResolveOperand {
  const { identify, context, mapping } = input;
  return (cell) => identify(cell) ?? resolveNode(context, stage, mapping.node, cell) ?? (context.entityIds.has(cell) ? cell : undefined);
}

function assertNoMasked(row: MasterRow, frame: ObservationFrame): void {
  const masked = findMaskedPointers(frame);
  if (masked.length === 0) return;
  throw new ImportError(
    `${row.ref}: ${masked.join(', ')} would record a masked value in a human observation (player mode, principle 2); ` +
      'declare the shown or discoverable boundary of that column in the mapping, or leave the column out',
  );
}

function resultOf(input: HumanRunInput): ReplayResult {
  const { mapping, group, tally } = input;
  if (mapping.result === undefined) return 'abort';
  for (const row of [...group.rows].reverse()) {
    const cell = readText(row, mapping.result.column);
    if (cell === undefined) continue;
    const result = mapping.result.values[cell];
    if (result === undefined) countIn(tally, 'unmapped results');
    return result ?? 'abort';
  }
  return 'abort';
}

function buildTicks(input: HumanRunInput): ReplayTick[] {
  const { group, mapping, identify, tally } = input;
  const first = group.rows[0];
  const t0 = first === undefined ? 0 : timeOf(first, mapping);
  const ticks: ReplayTick[] = [];
  let stageEntry: { stage: string; t: number } | undefined;
  for (const [index, row] of group.rows.entries()) {
    const tick = mapping.tick === undefined ? index : readCount(row, mapping.tick.column);
    if (tick === undefined) throw new ImportError(`${row.ref}: no tick in column '${mapping.tick?.column ?? ''}'`);
    const t = round(timeOf(row, mapping) - t0);
    const previous = ticks.at(-1);
    if (previous !== undefined && tick <= previous.tick) throw new ImportError(`${row.ref}: tick ${tick} repeats or goes back within the run`);
    if (previous !== undefined && t < previous.t) throw new ImportError(`${row.ref}: time goes back within the run`);
    const stage = stageOf(row, input);
    if (stageEntry?.stage !== stage) stageEntry = { stage, t };
    const node = nodeOf(row, input, stage);
    const extra = readExtra(row, mapping.extra);
    const observation: ObservationFrame = {
      tick,
      t,
      source: 'telemetry',
      mode: 'player',
      purpose: 'human',
      self: readSelf(row, mapping.self),
      entities: readEntities(row, mapping.entities, identify, tally),
      stage: { id: stage, elapsed: round(t - stageEntry.t), ...(node === undefined ? {} : { node }) },
      events: readEvents(row, mapping.events, tally),
      ...(extra === undefined ? {} : { extra }),
    };
    assertNoMasked(row, observation);
    const action = readAction(row, mapping.action, operandResolver(input, stage), tally);
    ticks.push({ type: 'tick', tick, t, observation, decision: [], action });
  }
  return ticks;
}

export function buildHumanRun(input: HumanRunInput): HumanRun {
  const { group, mapping, context, salt, now } = input;
  const first = group.rows[0];
  if (first === undefined) throw new ImportError('a run without rows cannot be imported');
  const player = playerHash(salt, group.player);
  const ticks = buildTicks(input);
  const started = mapping.started_at === undefined ? undefined : readTimestamp(first, mapping.started_at.column);
  const time = ticks.at(-1)?.t ?? 0;
  const header: ReplayHeader = {
    type: 'header',
    run_id: `run:human-${runHash(salt, group.player, group.run)}`,
    seed: HUMAN_SEED,
    game_id: context.gameId,
    manifest_version: context.manifestVersion,
    adapter_id: TELEMETRY_ADAPTER_ID,
    mode: 'player',
    purpose: 'human',
    source: 'human',
    observation_fields: humanRunDeclarations(context.observationFields, mapping),
    started_at: (started ?? now).toISOString(),
  };
  const footer: ReplayFooter = {
    type: 'footer',
    ended_at: (started === undefined ? now : new Date(started.getTime() + time * 1000)).toISOString(),
    result: resultOf(input),
    summary: { player, ticks: ticks.length, time_sec: time },
  };
  return { playerHash: player, run: { header, ticks, footer } };
}
