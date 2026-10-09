// Runs one import command. Input problems (ImportError) become a message and exit code 1;
// nothing is written in that case.

import { ImportError } from '../import/import-error.ts';
import { EXIT_INVALID, type CliIo } from './cli-io.ts';
import type { ImportCommand } from './parse-import-command.ts';
import { runImportDrafts } from './run-import-drafts.ts';
import { runImportMap } from './run-import-map.ts';
import { runImportMasters } from './run-import-masters.ts';

const LABELS: Readonly<Record<ImportCommand['name'], string>> = {
  'import-masters': 'import masters',
  'import-map': 'import map',
  'import-spec': 'import spec',
  'intent-import': 'intent import',
};

function run(command: ImportCommand, io: CliIo): Promise<number> {
  switch (command.name) {
    case 'import-masters':
      return runImportMasters(command, io);
    case 'import-map':
      return runImportMap(command, io);
    case 'import-spec':
    case 'intent-import':
      return runImportDrafts(command, io);
  }
}

export async function runImportCommand(command: ImportCommand, io: CliIo): Promise<number> {
  try {
    return await run(command, io);
  } catch (cause) {
    if (!(cause instanceof ImportError)) throw cause;
    io.stderr(`guide ${LABELS[command.name]}: ${cause.message}\n`);
    return EXIT_INVALID;
  }
}
