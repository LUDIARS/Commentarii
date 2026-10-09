#!/usr/bin/env node
// `guide` entry point: wires the file system, SQLite and LLM adapters into the CLI.

import { readFile } from 'node:fs/promises';
import { openBundleDir } from '../adapters/fs/open-bundle-dir.ts';
import { readSchemaDocuments } from '../adapters/fs/read-schema-documents.ts';
import { removeBundleFiles } from '../adapters/fs/remove-bundle-files.ts';
import { openReplayFile } from '../adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../adapters/fs/write-output-files.ts';
import { createClaudeCliLlm } from '../adapters/llm/claude-cli-llm.ts';
import { readPromptTemplate } from '../adapters/llm/read-prompt-template.ts';
import { createSchemaRegistry } from '../schema/schema-registry.ts';
import { runCli } from './run-cli.ts';

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    openBundle: openBundleDir,
    writeFiles: writeOutputFiles,
    importIo: {
      readText: (path) => readFile(path, 'utf8'),
      // Loaded on demand: node:sqlite prints an experimental warning, which only SQLite imports should see.
      readSqliteTables: async (path, tables) => (await import('../adapters/sqlite/read-sqlite-tables.ts')).readSqliteTables(path, tables),
      removeFiles: removeBundleFiles,
      schemaRegistry: async () => createSchemaRegistry(await readSchemaDocuments()),
      readPrompt: readPromptTemplate,
      llm: createClaudeCliLlm(),
    },
    openReplay: openReplayFile,
  });
} catch (cause) {
  process.stderr.write(`guide: ${(cause as Error).message}\n`);
  process.exitCode = 1;
}
