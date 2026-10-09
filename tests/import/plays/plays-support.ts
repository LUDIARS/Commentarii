// Test helpers for guide import plays / guide report plays: fixture paths, a CLI with plays I/O
// (fixed salt and clock), and the files a bundle holds under observations/human/.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openBundleDir } from '../../../src/adapters/fs/open-bundle-dir.ts';
import { readPlayRunFiles } from '../../../src/adapters/fs/plays-read-runs.ts';
import { openReplayFile } from '../../../src/adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../../../src/adapters/fs/write-output-files.ts';
import { fsScanSource } from '../../../src/audit/fs-scan-source.ts';
import type { CliIo } from '../../../src/cli/cli-io.ts';
import { runCli } from '../../../src/cli/run-cli.ts';
import { REPO_ROOT } from '../../support/bundles.ts';
import { testImportIo } from '../../support/import-io.ts';
import { replaySchema } from '../../replay/replay-fixtures.ts';

export const PLAYS_FIXTURE_DIR = join(REPO_ROOT, 'tests', 'fixtures', 'plays');
export const TELEMETRY_JSONL = join(PLAYS_FIXTURE_DIR, 'telemetry.jsonl');
export const TELEMETRY_CSV = join(PLAYS_FIXTURE_DIR, 'telemetry.csv');
export const PLAYS_MAPPING = join(PLAYS_FIXTURE_DIR, 'plays-mapping.json');
export const MASKED_MAPPING = join(PLAYS_FIXTURE_DIR, 'masked-mapping.json');

export const TEST_SALT = 'test-salt-not-a-real-secret';
export const FIXED_NOW = new Date('2026-10-09T12:00:00.000Z');

/** Every raw identifier and proper name the fixture telemetry carries. */
export const RAW_STRINGS = [
  'player-7781',
  'player-9902',
  'Taro Yamada',
  'Hanako Suzuki',
  'taro.yamada@example.com',
  'hanako.suzuki@example.com',
  'DEV-7F3A-99C1',
  'DEV-11B2-40AA',
  '203.0.113.45',
  '198.51.100.23',
  's-1001',
  's-1002',
  'warming up',
  'first try',
  'SPIDER_W',
  'MYSTERY_X',
  'ARENA_01',
  'Z_CENTER',
];

export interface GuideRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** salt: COMMENTARII_PLAYER_SALT as the CLI sees it; null = not set. */
export async function guide(argv: string[], salt: string | null = TEST_SALT): Promise<GuideRun> {
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    openBundle: openBundleDir,
    writeFiles: writeOutputFiles,
    openReplay: openReplayFile,
    importIo: testImportIo(),
    scanSource: fsScanSource,
    playsIo: { readRunFiles: readPlayRunFiles, replaySchema, playerSaltFromEnv: () => salt ?? undefined, now: () => FIXED_NOW },
  };
  const code = await runCli(argv, io);
  return { code, stdout, stderr };
}

/** observations/human/** of a bundle: relative path -> text (empty when absent). */
export async function humanFiles(bundle: string): Promise<Map<string, string>> {
  const root = join(bundle, 'observations', 'human');
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(path.slice(root.length + 1).split(/[\\/]/).join('/'), await readFile(path, 'utf8'));
  }
  return files;
}
