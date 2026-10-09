// Where reflect's lines go: observations/runs/<run-id>.jsonl, one JSON object per line. In a
// player run every line is checked for knowledge: masked before it is written (principle 2,
// the same find-masked-pointers check the driver applies to frames): a line carrying one is
// refused and nothing of it is written. Lines are built only from player frames already
// checked by the driver, so this is the structural second gate, not the expected path.

import { findMaskedPointers } from '../../replay/find-masked-pointers.ts';
import type { ObservationMode } from '../../replay/observation-frame.ts';
import type { ReplayLineWriter } from '../../replay/recording-sink.ts';
import type { OverlayLine } from './overlay-line.ts';

export class MaskedObservationError extends Error {
  readonly pointers: readonly string[];

  constructor(pointers: readonly string[]) {
    super(`a player-mode observation line carries masked values at ${pointers.join(', ')}`);
    this.name = 'MaskedObservationError';
    this.pointers = pointers;
  }
}

export interface ObservationSink {
  write(lines: readonly OverlayLine[]): Promise<void>;
}

export function createObservationSink(writer: ReplayLineWriter, mode: ObservationMode): ObservationSink {
  return {
    async write(lines) {
      for (const line of lines) {
        const masked = mode === 'player' || line.mode === 'player' ? findMaskedPointers(line) : [];
        if (masked.length > 0) throw new MaskedObservationError(masked);
        await writer.append(JSON.stringify(line));
      }
    },
  };
}
