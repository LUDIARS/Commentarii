// RecordingSink: wraps any decider and appends header / tick / footer lines of
// replay/<run-id>.jsonl. Every line is checked before it is written (tick-invariants.ts);
// in player mode a masked value in the observation is refused before the decider sees it,
// and one in the decision or action before it is written (principle 2).

import type { Decider } from './decider.ts';
import type { ObservationFrame } from './observation-frame.ts';
import type { ReplayAction } from './replay-action.ts';
import { RecordingError } from './recording-error.ts';
import type { ReplayFooter, ReplayHeader, ReplayLine, ReplayResult, ReplayTick } from './replay-record.ts';
import { checkObservation, checkTickRecord, maskedProblems } from './tick-invariants.ts';

/** Where lines go. One call per line, without the trailing newline. */
export interface ReplayLineWriter {
  append(line: string): Promise<void>;
}

export interface RecordingOptions {
  readonly header: Omit<ReplayHeader, 'type'>;
  readonly decider: Decider;
  readonly writer: ReplayLineWriter;
  /** Injected for deterministic tests (coding conventions 16). */
  readonly now?: () => Date;
}

export interface RecordingEnd {
  readonly result: ReplayResult;
  readonly summary?: Readonly<Record<string, unknown>>;
}

export interface RecordingSink {
  readonly header: ReplayHeader;
  /** Decides on one observation, records the tick line and returns the action to perform. */
  step(observation: ObservationFrame): Promise<ReplayAction>;
  /** Writes the footer. The sink accepts nothing afterwards. */
  finish(end: RecordingEnd): Promise<void>;
}

function serialize(line: ReplayLine): string {
  // JSON.stringify escapes newlines inside strings, so one record is always one line.
  return JSON.stringify(line);
}

export async function openRecording(options: RecordingOptions): Promise<RecordingSink> {
  const { decider, writer } = options;
  const now = options.now ?? (() => new Date());
  const header: ReplayHeader = { type: 'header', ...options.header };
  const headerProblems = maskedProblems(header, header, '');
  if (headerProblems.length > 0) throw new RecordingError(headerProblems);
  await writer.append(serialize(header));
  let previous: ReplayTick | undefined;
  let finished = false;
  const ensureOpen = (): void => {
    if (finished) throw new Error(`recording ${header.run_id} is already finished`);
  };

  return {
    header,
    async step(observation) {
      ensureOpen();
      const observationProblems = checkObservation(header, previous, observation);
      if (observationProblems.length > 0) throw new RecordingError(observationProblems);
      const outcome = decider.decide(observation);
      const record: ReplayTick = { type: 'tick', tick: observation.tick, t: observation.t, observation, decision: outcome.decision, action: outcome.action };
      const problems = checkTickRecord(header, previous, record);
      if (problems.length > 0) throw new RecordingError(problems);
      await writer.append(serialize(record));
      previous = record;
      return outcome.action;
    },
    async finish(end) {
      ensureOpen();
      const footer: ReplayFooter = { type: 'footer', ended_at: now().toISOString(), result: end.result, summary: end.summary ?? {} };
      const problems = maskedProblems(header, footer, '');
      if (problems.length > 0) throw new RecordingError(problems);
      finished = true;
      await writer.append(serialize(footer));
    },
  };
}
