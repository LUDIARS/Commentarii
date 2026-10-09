// C-30 reflectTick(state, input): every line is one of the four kinds and carries the frame's
// t / tick / source / mode / purpose; in player mode no line carries knowledge: masked; a
// success / failure verdict only ends an episode that was open; the state remembers the frame.

import type { ReflectInput, ReflectResult, ReflectState } from '../engine/reflect/reflect-tick.ts';
import { OVERLAY_LINE_KINDS } from '../engine/reflect/overlay-line.ts';
import { findMaskedPointers } from '../replay/find-masked-pointers.ts';

export default {
  post: (result: ReflectResult, state: ReflectState, input: ReflectInput) => {
    const frame = input.observation;
    for (const line of result.lines) {
      if (!(OVERLAY_LINE_KINDS as readonly string[]).includes(line.kind)) return `unknown line kind ${line.kind}`;
      if (line.t !== frame.t || line.tick !== frame.tick) return `${line.kind} line is not stamped with the frame's tick`;
      if (line.mode !== frame.mode || line.purpose !== frame.purpose || line.source !== frame.source) return `${line.kind} line differs from the frame's mode / purpose / source`;
    }
    if (frame.mode === 'player' && findMaskedPointers(result.lines).length > 0) return 'a player-mode line carries knowledge: masked';
    const open = new Set([...state.episodes.values()].map((episode) => episode.tactic));
    for (const line of result.lines) {
      const outcome = line.observed?.outcome;
      if (line.kind === 'tactic-outcome' && (outcome === 'success' || outcome === 'failure') && !open.has(line.tactic ?? '')) {
        return `${line.tactic} got a verdict without an open episode`;
      }
    }
    return result.state.last === frame || 'the state does not remember the reflected frame';
  },
};
