// What `guide import plays` / `guide report plays` need from the outside world beyond CliIo.
// main.ts wires the real adapters; tests pass their own salt and clock.

import type { ReplaySchema } from '../../replay/replay-schema.ts';
import type { PlayRunFile } from './classify-play-runs.ts';

export interface PlaysIo {
  /** Every .jsonl file under <bundle>/<directory> (bundle-relative paths); none when it is absent. */
  readRunFiles(bundleDir: string, directory: string): Promise<PlayRunFile[]>;
  replaySchema(): Promise<ReplaySchema>;
  /** COMMENTARII_PLAYER_SALT, if set. */
  playerSaltFromEnv(): string | undefined;
  now(): Date;
}
