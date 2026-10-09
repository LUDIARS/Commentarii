#!/usr/bin/env node
// `guide` entry point: wires the file system, SQLite, LLM and stdio adapters into the CLI.

import { readFile } from 'node:fs/promises';
import { loadPersona } from '../adapters/fs/load-persona.ts';
import { openBundleDir } from '../adapters/fs/open-bundle-dir.ts';
import { readPlayRunFiles } from '../adapters/fs/plays-read-runs.ts';
import { readSchemaDocuments } from '../adapters/fs/read-schema-documents.ts';
import { removeBundleFiles } from '../adapters/fs/remove-bundle-files.ts';
import { createReplayFileWriter } from '../adapters/fs/replay-file-writer.ts';
import { openReplayFile, replaySchema } from '../adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../adapters/fs/write-output-files.ts';
import { createClaudeCliLlm } from '../adapters/llm/claude-cli-llm.ts';
import { createStreamLineChannel } from '../adapters/stdio/line-channel.ts';
import { readPromptTemplate } from '../adapters/llm/read-prompt-template.ts';
import { createSchemaRegistry } from '../schema/schema-registry.ts';
import { fsScanSource } from '../audit/fs-scan-source.ts';
import { createFsLearnIo } from '../learn/io/fs-learn-io.ts';
import { createFsVerifyIo } from '../adapters/fs/verify-io-fs.ts';
import { PLAYER_SALT_ENV } from '../import/plays/player-salt.ts';
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
    scanSource: fsScanSource,
    engineIo: {
      loadPersona,
      createReplayWriter: createReplayFileWriter,
      // guide run --adapter stdio: the game process owns guide's stdin / stdout (protocol only).
      openStdioChannel: () => createStreamLineChannel(process.stdin, process.stdout),
      now: () => new Date(),
    },
    learnIo: createFsLearnIo(),
    playsIo: {
      readRunFiles: readPlayRunFiles,
      replaySchema,
      playerSaltFromEnv: () => process.env[PLAYER_SALT_ENV],
      now: () => new Date(),
    },
    verifyIo: createFsVerifyIo(),
  });
} catch (cause) {
  process.stderr.write(`guide: ${(cause as Error).message}\n`);
  process.exitCode = 1;
}
