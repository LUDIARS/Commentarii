// What guide verify intent / guide report feasibility need from the outside world beyond CliIo.
// main.ts wires the file system; tests pass their own.

import type { ReplaySchema } from '@ludiars/commentarii-sdk/replay';
import type { SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';

export interface ListedFiles {
  /** Files found (directories expanded recursively), sorted. */
  readonly files: readonly string[];
  /** Given paths that do not exist. */
  readonly missing: readonly string[];
}

export interface VerifyIo {
  /** Each path as a file, or the files with this extension under it when it is a directory. */
  listFiles(paths: readonly string[], extension: string): Promise<ListedFiles>;
  /** UTF-8 text, or undefined when the file does not exist. */
  readText(path: string): Promise<string | undefined>;
  schemaRegistry(): Promise<SchemaRegistry>;
  replaySchema(): Promise<ReplaySchema>;
}
