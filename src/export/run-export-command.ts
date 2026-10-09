// Runs `guide export`: loads the bundle, writes <out>/bundle.json. Schema-invalid files are
// left out of the export (as render does) and reported on stderr; the exit code is still OK.

import { EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import { buildExport, exportFiles } from './build-export.ts';
import type { ExportCommand } from './export-command.ts';

type ExportIo = Pick<CliIo, 'stderr' | 'openBundle' | 'writeFiles'>;

export async function runExportCommand(command: ExportCommand, io: ExportIo): Promise<number> {
  const load = await io.openBundle(command.bundleDir);
  if (load.issues.length > 0) {
    io.stderr(`guide export: ${load.issues.length} schema issue(s); invalid files are left out (run guide validate)\n`);
  }
  const exported = buildExport(load, { knowledge: command.knowledge, target: command.target });
  await io.writeFiles(command.outDir, exportFiles(exported));
  io.stderr(`guide export: wrote bundle.json to ${command.outDir} (knowledge=${command.knowledge}, target=${command.target})\n`);
  return EXIT_OK;
}
