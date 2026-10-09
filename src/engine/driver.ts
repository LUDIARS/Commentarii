// The tick driver (design 7.5): observe -> decide -> act -> reflect until the game ends or the
// tick limit is reached, optionally recording a replay and reflecting into the overlay. The adapter only observes and acts; this loop is
// the engine's. In player mode every observation is checked for masked values before the
// decider sees it, independently of the adapter's own duty (principle 2): one masked value
// stops the run (result abort) and nothing of that observation is decided on or recorded. A place
// outside the observation field registry counts as masked (undeclared = masked, principle 1;
// spec/feature/observation-boundary.md).

import type { GameAdapter } from '../adapter/game-adapter.ts';
import type { Decider } from '../replay/decider.ts';
import { observationBoundaryProblems } from '../observation/check-observation-boundary.ts';
import type { ObservationFieldDeclaration } from '../observation/observation-fields.ts';
import { findMaskedPointers } from '../replay/find-masked-pointers.ts';
import type { ObservationFrame, ObservationMode } from '../replay/observation-frame.ts';
import type { ReplayAction } from '../replay/replay-action.ts';
import type { ReplayResult } from '../replay/replay-record.ts';
import type { ReplayHeader } from '../replay/replay-record.ts';
import { openRecording, type RecordingSink, type ReplayLineWriter } from '../replay/recording-sink.ts';
import type { TickReflector } from './reflect/tick-reflector.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:18a2c66d */
import augurContract_85802f43 from '../contracts/run-driver.contract.ts'; /* augur-inject:contract-predicate:09321758 */

export interface DriverRecording {
  readonly writer: ReplayLineWriter;
  /** Header fields the adapter's hello does not give (game_id, adapter_id come from hello). */
  readonly header: Pick<ReplayHeader, 'run_id' | 'seed' | 'manifest_version' | 'purpose' | 'persona'>;
  /** Injected for deterministic tests (coding conventions 16). */
  readonly now?: () => Date;
}

export interface DriverOptions {
  readonly adapter: GameAdapter;
  readonly decider: Decider;
  readonly mode: ObservationMode;
  /** The game's observation field declarations (manifest observation.fields); none = base registry only. */
  readonly observationFields?: readonly ObservationFieldDeclaration[];
  readonly maxTicks: number;
  /** When given, the run is recorded (header, one line per tick, footer) through RecordingSink. */
  readonly record?: DriverRecording;
  /** When given, reflect runs at the end of every tick and once when the run ends (design 7.5). */
  readonly reflect?: TickReflector;
}

export type DriverStop =
  | { readonly reason: 'game-ended' }
  | { readonly reason: 'tick-limit' }
  | { readonly reason: 'mode-mismatch'; readonly expected: ObservationMode; readonly got: ObservationMode }
  /** Pointers only: the masked values themselves are never copied anywhere. */
  | { readonly reason: 'masked-in-player'; readonly tick: number; readonly pointers: readonly string[] };

export interface DriverReport {
  readonly result: ReplayResult;
  readonly stop: DriverStop;
  /** Ticks decided and acted on. */
  readonly ticks: number;
  /** Candidate ID -> ticks on which it was the chosen candidate. */
  readonly chosen: Readonly<Record<string, number>>;
  /** The game's own summary when it ended the run, else why the engine stopped. */
  readonly summary: Readonly<Record<string, unknown>>;
}

/** Wraps the decider to count the chosen candidate of every tick. */
function countingDecider(decider: Decider, chosen: Record<string, number>): Decider {
  return {
    id: decider.id,
    decide(observation) {
      const outcome = decider.decide(observation);
      const pick = outcome.decision.find((entry) => entry.chosen)?.candidate;
      if (pick !== undefined) chosen[pick] = (chosen[pick] ?? 0) + 1;
      return outcome;
    },
  };
}

function engineSummary(stop: DriverStop): Readonly<Record<string, unknown>> {
  return stop.reason === 'masked-in-player' ? { stopped: stop.reason, tick: stop.tick, pointers: stop.pointers } : { stopped: stop.reason };
}

/** Why the frame cannot be decided on, or undefined when it can. */
function refusal(frame: ObservationFrame, mode: ObservationMode, fields: readonly ObservationFieldDeclaration[]): DriverStop | undefined {
  if (frame.mode !== mode) return { reason: 'mode-mismatch', expected: mode, got: frame.mode };
  // An unregistered place is masked by principle 1, so it stops the run the same way.
  const masked = mode === 'player' ? [...findMaskedPointers(frame), ...observationBoundaryProblems(frame, fields).map((problem) => problem.pointer)] : [];
  return masked.length > 0 ? { reason: 'masked-in-player', tick: frame.tick, pointers: masked } : undefined;
}

export async function runDriver(options: DriverOptions): Promise<DriverReport> {
  const { adapter, mode, maxTicks } = options;
  if (!Number.isInteger(maxTicks) || maxTicks < 0) throw new Error(`maxTicks must be a non-negative integer, got ${maxTicks}`);
  const chosen: Record<string, number> = {};
  const decider = countingDecider(options.decider, chosen);
  let recording: RecordingSink | undefined;
  let ticks = 0;
  let stop: DriverStop = { reason: 'tick-limit' };
  let end: { result: ReplayResult; summary: Readonly<Record<string, unknown>> } | undefined;
  try {
    const hello = await adapter.hello();
    const record = options.record;
    if (record !== undefined) {
      const now = record.now ?? (() => new Date());
      const fields = options.observationFields === undefined ? {} : { observation_fields: options.observationFields };
      const header = { ...record.header, game_id: hello.game_id, adapter_id: hello.adapter_id, mode, ...fields, started_at: now().toISOString() };
      recording = await openRecording({ header, decider, writer: record.writer, now });
    }
    if (hello.mode !== mode) stop = { reason: 'mode-mismatch', expected: mode, got: hello.mode };
    while (stop.reason === 'tick-limit' && ticks < maxTicks) {
      const observed = await adapter.observe();
      if (observed.type === 'end') {
        stop = { reason: 'game-ended' };
        end = observed.end;
        break;
      }
      const refused = refusal(observed.frame, mode, options.observationFields ?? []);
      if (refused !== undefined) {
        stop = refused;
        break;
      }
      const action: ReplayAction = recording === undefined ? decider.decide(observed.frame).action : await recording.step(observed.frame);
      await adapter.act(action);
      await options.reflect?.afterTick(observed.frame);
      ticks += 1;
    }
  } catch (cause) {
    // Leave a complete file behind (footer abort) before the error propagates.
    await recording?.finish({ result: 'abort', summary: { stopped: 'error', ticks } });
    await adapter.close('error');
    throw cause;
  }
  await adapter.close(stop.reason);
  await options.reflect?.finish();
  const result: ReplayResult = end?.result ?? 'abort';
  const summary = end?.summary ?? engineSummary(stop);
  await recording?.finish({ result, summary: { ...summary, ticks } });
  return { result, stop, ticks, chosen, summary };
}
// @ts-expect-error augur-inject
runDriver = contract(runDriver, { ...augurContract_85802f43, contractId: 'C-21', mode: 'observe', sample: 1, where: 'src/engine/driver.ts:75', rule: 'contract-wrap', id: '85802f43' }); /* augur-inject:contract-wrap:85802f43 */
