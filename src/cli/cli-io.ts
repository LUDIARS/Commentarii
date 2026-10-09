// Everything a CLI command needs from the outside world. main.ts wires the real adapters;
// tests pass in-memory ones.

import type { LoadResult } from '../bundle/bundle.ts';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  openBundle(directory: string): Promise<LoadResult>;
  writeFiles(outDir: string, files: ReadonlyMap<string, string>): Promise<void>;
}

export const EXIT_OK = 0;
/** validate found errors. */
export const EXIT_INVALID = 1;
export const EXIT_USAGE = 2;
