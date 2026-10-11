// The real outside world of the guide CLI: file system, SQLite, LLM and clock adapters, and the
// hand-over of the moved auto player commands to `ingenium` on PATH.
// Shared by the `guide` entry point and the Web editor server (which runs the same commands).

import { readFile } from 'node:fs/promises';
import { openBundleDir } from '../adapters/fs/open-bundle-dir.ts';
import { readPlayRunFiles } from '../adapters/fs/plays-read-runs.ts';
import { readSchemaDocuments } from '../adapters/fs/read-schema-documents.ts';
import { removeBundleFiles } from '../adapters/fs/remove-bundle-files.ts';
import { openReplayFile, replaySchema } from '../adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../adapters/fs/write-output-files.ts';
import { createClaudeCliLlm } from '../adapters/llm/claude-cli-llm.ts';
import { findOnPath } from '../delegate/find-on-path.ts';
import { spawnInherited } from '../delegate/spawn-inherited.ts';
import { readPromptTemplate } from '../adapters/llm/read-prompt-template.ts';
import { createSchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import { fsScanSource } from '../audit/fs-scan-source.ts';
import { createFsLearnIo } from '../learn/io/fs-learn-io.ts';
import { createFsVerifyIo } from '../adapters/fs/verify-io-fs.ts';
import { PLAYER_SALT_ENV } from '../import/plays/player-salt.ts';
import type { CliIo } from './cli-io.ts';

export function createMainIo(output: Pick<CliIo, 'stdout' | 'stderr'>): CliIo {
  return {
    stdout: output.stdout,
    stderr: output.stderr,
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
    delegationIo: {
      findIngenium: () => findOnPath('ingenium', process.env),
      runIngenium: (executable, args) => spawnInherited(executable, args),
    },
    learnIo: createFsLearnIo(),
    playsIo: {
      readRunFiles: readPlayRunFiles,
      replaySchema,
      playerSaltFromEnv: () => process.env[PLAYER_SALT_ENV],
      now: () => new Date(),
    },
    verifyIo: createFsVerifyIo(),
  };
}
