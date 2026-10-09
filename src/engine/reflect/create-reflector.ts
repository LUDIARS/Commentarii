// TickReflector over the pure reflectTick: holds the reflect state of one run, asks the engine
// which plan acted (TickOutcome.acted of the utility-bt decider) and writes the lines.

import type { RunningPlan } from '../engine-state.ts';
import type { ObservationSink } from './observation-sink.ts';
import { INITIAL_REFLECT_STATE, reflectEnd, reflectTick, type ReflectState } from './reflect-tick.ts';
import type { ReflectWorld } from './reflect-world.ts';
import type { TickReflector } from './tick-reflector.ts';

export interface ReflectorOptions {
  readonly world: ReflectWorld;
  readonly sink: ObservationSink;
  /** The plan that acted on the last decided tick (e.g. () => decider.lastOutcome?.acted). */
  readonly acted: () => RunningPlan | undefined;
}

export function createReflector(options: ReflectorOptions): TickReflector {
  let state: ReflectState = INITIAL_REFLECT_STATE;
  let finished = false;
  return {
    async afterTick(frame) {
      if (finished) throw new Error('the reflector has already finished');
      const acted = options.acted();
      const result = reflectTick(state, { world: options.world, observation: frame, ...(acted ? { acted } : {}) });
      state = result.state;
      await options.sink.write(result.lines);
    },
    async finish() {
      if (finished) return;
      finished = true;
      await options.sink.write(reflectEnd(state));
    },
  };
}
