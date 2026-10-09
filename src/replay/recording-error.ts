// Raised when the recorder refuses a line. Nothing is appended for a refused line.

import type { TickProblem } from './tick-invariants.ts';

export class RecordingError extends Error {
  override readonly name = 'RecordingError';

  constructor(readonly problems: readonly TickProblem[]) {
    super(`recording refused: ${problems.map((problem) => `${problem.pointer} ${problem.message}`).join('; ')}`);
  }

  /** True when the refusal is the player-mode masked ban (principle 2). */
  get isMaskedInPlayer(): boolean {
    return this.problems.some((problem) => problem.code === 'masked-in-player');
  }
}
