// A running tactic's `expect` (design 4.4) against the current observation:
//   met      every entity_state holds (each bound instance shows the expected state).
//   broken   within_sec has passed since the tactic started and it is still not met.
//   pending  otherwise (including states the observation cannot show: unknown is not broken).
// A reflex expect ({ reflex: true }) waits for no outcome and is met at once, so a reflex tactic
// (attack what is in reach, chase what is not) can be proposed again on the next tick (stage 6F,
// the engine as an enemy).
// A tactic whose expectation breaks is dropped at once and re-evaluated (design 7.4).

import { isJsonObject } from '@ludiars/commentarii-sdk/types';
import type { ObservationFrame } from '@ludiars/commentarii-sdk/types';
import type { Bindings } from '@ludiars/commentarii-sdk/knowledge';
import { findInstance } from '@ludiars/commentarii-sdk/knowledge';

export type ExpectStatus = 'pending' | 'met' | 'broken';

function entityStatesMet(expected: unknown, bindings: Bindings, observation: ObservationFrame): boolean | undefined {
  if (!isJsonObject(expected)) return undefined;
  const entries = Object.entries(expected);
  if (entries.length === 0) return undefined;
  return entries.every(([name, state]) => {
    const instance = bindings[name];
    const entity = instance === undefined ? undefined : findInstance(observation, instance);
    return entity?.state_guess !== undefined && entity.state_guess === state;
  });
}

export function checkExpect(
  expect: Readonly<Record<string, unknown>> | undefined,
  bindings: Bindings,
  startedT: number,
  observation: ObservationFrame,
): ExpectStatus {
  if (expect === undefined) return 'pending';
  if (expect.reflex === true) return 'met';
  if (entityStatesMet(expect.entity_state, bindings, observation) === true) return 'met';
  const within = expect.within_sec;
  if (typeof within === 'number' && observation.t - startedT > within) return 'broken';
  return 'pending';
}
