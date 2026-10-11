// Runs `guide export`: loads the bundle, writes <out>/bundle.json (target runtime) or
// <out>/ingame.json (target ingame, design 14.G). Schema-invalid files are left out of the
// export (as render does) and reported on stderr; the exit code is still OK.

import { EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import { buildExport, exportFiles } from './build-export.ts';
import { buildIngameExport, INGAME_FILE_NAME } from './build-ingame-export.ts';
import type { ExportCommand } from './export-command.ts';

type ExportIo = Pick<CliIo, 'stderr' | 'openBundle' | 'writeFiles' | 'importIo'>;

/** The value refs the player has unlocked: {"unlocked": [refs]} (none without --unlocked). */
async function readUnlocked(io: ExportIo, path: string | undefined): Promise<Set<string>> {
  if (path === undefined) return new Set();
  const parsed = JSON.parse(await io.importIo.readText(path)) as { unlocked?: unknown };
  if (!Array.isArray(parsed.unlocked) || !parsed.unlocked.every((ref) => typeof ref === 'string')) throw new Error(`${path}: expected {"unlocked": [value refs]}`);
  return new Set(parsed.unlocked as string[]);
}

export async function runExportCommand(command: ExportCommand, io: ExportIo): Promise<number> {
  const load = await io.openBundle(command.bundleDir);
  if (load.issues.length > 0) {
    io.stderr(`guide export: ${load.issues.length} schema issue(s); invalid files are left out (run guide validate)\n`);
  }
  if (command.target === 'ingame') {
    const ingame = buildIngameExport(load, await readUnlocked(io, command.unlockedPath));
    await io.writeFiles(command.outDir, new Map([[INGAME_FILE_NAME, `${JSON.stringify(ingame, null, 2)}\n`]]));
    io.stderr(`guide export: wrote ${INGAME_FILE_NAME} to ${command.outDir} (player view: shown + unlocked discoverable)\n`);
    return EXIT_OK;
  }
  const exported = buildExport(load, { knowledge: command.knowledge, target: command.target });
  await io.writeFiles(command.outDir, exportFiles(exported));
  io.stderr(`guide export: wrote bundle.json to ${command.outDir} (knowledge=${command.knowledge}, target=${command.target})\n`);
  return EXIT_OK;
}
