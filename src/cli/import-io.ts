// What the import commands need from the outside world beyond CliIo. main.ts wires the real
// adapters (file system, node:sqlite, claude -p); tests pass a fake LLM.

import type { MasterTable } from '../import/masters/master-table.ts';
import type { DraftLlm } from '../import/spec/draft-llm.ts';
import type { SchemaRegistry } from '../schema/schema-registry.ts';

export interface ImportIo {
  /** UTF-8 text of an input file (master CSV / JSON, mapping, map, specification). */
  readText(path: string): Promise<string>;
  readSqliteTables(path: string, tables: readonly string[]): Promise<MasterTable[]>;
  /** Removes bundle-relative paths under the bundle directory. */
  removeFiles(bundleDir: string, paths: readonly string[]): Promise<void>;
  schemaRegistry(): Promise<SchemaRegistry>;
  /** Text of prompts/<name>.md. */
  readPrompt(name: string): Promise<string>;
  readonly llm: DraftLlm;
}
