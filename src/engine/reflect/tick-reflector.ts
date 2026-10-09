// The reflect step as the driver sees it (design 7.5): called once at the end of every tick,
// after the action was performed, and once when the run ends.

import type { ObservationFrame } from '../../replay/observation-frame.ts';

export interface TickReflector {
  /** Reflects on the tick just decided and acted on (`frame` is what was observed). */
  afterTick(frame: ObservationFrame): Promise<void>;
  /** Closes the run: episodes still open are written as unresolved. */
  finish(): Promise<void>;
}
