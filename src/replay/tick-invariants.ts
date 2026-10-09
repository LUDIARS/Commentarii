// Invariants of a tick line relative to its run header and the previous tick. Shared by the
// recorder (rejects before appending) and the parser (rejects a file), so a file the recorder
// wrote always loads and a file that loads could have been recorded.

import type { ObservationFrame } from './observation-frame.ts';
import type { ReplayHeader, ReplayTick } from './replay-record.ts';
import { findMaskedPointers } from './find-masked-pointers.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:1e5f4490 */
import augurContract_d1bc47f3 from '../contracts/check-tick-record.contract.ts'; /* augur-inject:contract-predicate:b8f4c335 */

export type TickProblemCode =
  | 'tick-order'
  | 't-order'
  | 'frame-mismatch'
  | 'mode-mismatch'
  | 'purpose-mismatch'
  | 'decision'
  | 'masked-in-player';

export interface TickProblem {
  readonly code: TickProblemCode;
  /** JSON pointer inside the tick line. */
  readonly pointer: string;
  readonly message: string;
}

/** Problems of `value` (at `pointer`) under the player condition: any masked value is one. */
export function maskedProblems(header: ReplayHeader, value: unknown, pointer: string): TickProblem[] {
  if (header.mode !== 'player') return [];
  return findMaskedPointers(value, pointer).map((at) => ({
    code: 'masked-in-player',
    pointer: at,
    message: 'player mode must not record a masked value (principle 2)',
  }));
}

/** Checks an observation before it reaches the decider (pointers are inside the tick line). */
export function checkObservation(header: ReplayHeader, previous: ReplayTick | undefined, observation: ObservationFrame): TickProblem[] {
  const problems: TickProblem[] = [];
  if (previous !== undefined && observation.tick <= previous.tick) {
    problems.push({ code: 'tick-order', pointer: '/observation/tick', message: `tick ${observation.tick} does not follow tick ${previous.tick}` });
  }
  if (previous !== undefined && observation.t < previous.t) {
    problems.push({ code: 't-order', pointer: '/observation/t', message: `t ${observation.t} goes back from ${previous.t}` });
  }
  if (observation.mode !== header.mode) {
    problems.push({ code: 'mode-mismatch', pointer: '/observation/mode', message: `observation mode ${observation.mode} differs from run mode ${header.mode}` });
  }
  if (observation.purpose !== header.purpose) {
    problems.push({ code: 'purpose-mismatch', pointer: '/observation/purpose', message: `observation purpose ${observation.purpose} differs from run purpose ${header.purpose}` });
  }
  problems.push(...maskedProblems(header, observation, '/observation'));
  return problems;
}

function decisionProblems(record: ReplayTick): TickProblem[] {
  const problems: TickProblem[] = [];
  const seen = new Set<string>();
  record.decision.forEach((entry, index) => {
    if (seen.has(entry.candidate)) {
      problems.push({ code: 'decision', pointer: `/decision/${index}/candidate`, message: `candidate ${entry.candidate} is listed twice` });
    }
    seen.add(entry.candidate);
  });
  if (record.decision.filter((entry) => entry.chosen).length > 1) {
    problems.push({ code: 'decision', pointer: '/decision', message: 'more than one candidate is chosen' });
  }
  return problems;
}

/** Checks a whole tick line: its observation, the frame header fields and the decision log. */
export function checkTickRecord(header: ReplayHeader, previous: ReplayTick | undefined, record: ReplayTick): TickProblem[] {
  const problems: TickProblem[] = [];
  if (record.observation.tick !== record.tick || record.observation.t !== record.t) {
    problems.push({ code: 'frame-mismatch', pointer: '/tick', message: 'tick and t must equal the observation tick and t' });
  }
  problems.push(...checkObservation(header, previous, record.observation));
  problems.push(...decisionProblems(record));
  for (const key of ['decision', 'action'] as const) problems.push(...maskedProblems(header, record[key], `/${key}`));
  return problems;
}
// @ts-expect-error augur-inject
checkTickRecord = contract(checkTickRecord, { ...augurContract_d1bc47f3, contractId: 'C-9', mode: 'observe', sample: 1, where: 'src/replay/tick-invariants.ts:70', rule: 'contract-wrap', id: 'd1bc47f3' }); /* augur-inject:contract-wrap:d1bc47f3 */
