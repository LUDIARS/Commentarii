// What guide learn (and the engine's overlay read at start-up) needs from the outside world
// beyond CliIo. main.ts wires the file system; tests pass in-memory ones.

import type { SchemaRegistry } from '../../schema/schema-registry.ts';

export interface LearnIo {
  /** UTF-8 text of a file, or undefined when it does not exist (any other failure throws). */
  readText(path: string): Promise<string | undefined>;
  schemaRegistry(): Promise<SchemaRegistry>;
}
