// Everything a CLI command needs from the outside world. main.ts wires the real adapters;
// tests pass in-memory ones.

import type { LoadResult } from '../bundle/bundle.ts';
import type { ReplayLoad } from '../replay/parse-replay.ts';
import type { ImportIo } from './import-io.ts';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  openBundle(directory: string): Promise<LoadResult>;
  writeFiles(outDir: string, files: ReadonlyMap<string, string>): Promise<void>;
  openReplay(path: string): Promise<ReplayLoad>;
  /** guide import / guide intent import only. */
  readonly importIo: ImportIo;
}

export const EXIT_OK = 0;
/** validate found errors. */
export const EXIT_INVALID = 1;
export const EXIT_USAGE = 2;
