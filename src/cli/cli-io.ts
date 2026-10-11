// Everything a CLI command needs from the outside world. main.ts wires the real adapters;
// tests pass in-memory ones.

import type { ScanSource } from '../audit/scan-source.ts';
import type { PlaysIo } from '../import/plays/plays-io.ts';
import type { LoadResult } from '../bundle/bundle.ts';
import type { ReplayLoad } from '../replay/parse-replay.ts';
import type { EngineIo } from './engine-io.ts';
import type { ImportIo } from './import-io.ts';
import type { LearnIo } from '../learn/cli/learn-io.ts';
import type { VerifyIo } from '../verify/cli/verify-io.ts';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  openBundle(directory: string): Promise<LoadResult>;
  writeFiles(outDir: string, files: ReadonlyMap<string, string>): Promise<void>;
  openReplay(path: string): Promise<ReplayLoad>;
  /** guide import / guide intent import only. */
  readonly importIo: ImportIo;
  /** Game repository files for `guide audit mask`. */
  readonly scanSource: ScanSource;
  /** guide run / guide bench / replay play --decider utility-bt only. */
  readonly engineIo?: EngineIo;
  /** guide learn, and the overlay guide run / guide bench read at start-up. */
  readonly learnIo?: LearnIo;
  /** guide import plays / guide report plays only. */
  readonly playsIo?: PlaysIo;
  /** guide verify intent / guide report feasibility, and the verification report guide render embeds. */
  readonly verifyIo?: VerifyIo;
}

export const EXIT_OK = 0;
/** validate found errors. */
export const EXIT_INVALID = 1;
export const EXIT_USAGE = 2;
