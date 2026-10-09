// Runs `guide import plays` / `guide report plays`. Input problems (ImportError) become a
// message and exit code 1, with nothing written; a CLI without plays I/O wired fails loudly.

import { EXIT_INVALID, type CliIo } from '../../cli/cli-io.ts';
import { ImportError } from '../import-error.ts';
import type { PlaysCommand } from './plays-command.ts';
import { runImportPlays } from './run-import-plays.ts';
import { runReportPlays } from './run-report-plays.ts';

const LABELS: Readonly<Record<PlaysCommand['name'], string>> = { 'import-plays': 'import plays', 'report-plays': 'report plays' };

export async function runPlaysCommand(command: PlaysCommand, io: CliIo): Promise<number> {
  const playsIo = io.playsIo;
  if (playsIo === undefined) throw new Error(`guide ${LABELS[command.name]}: no plays I/O is wired (main.ts must provide playsIo)`);
  try {
    return command.name === 'import-plays' ? await runImportPlays(command, { ...io, playsIo }) : await runReportPlays(command, { ...io, playsIo });
  } catch (cause) {
    if (!(cause instanceof ImportError)) throw cause;
    io.stderr(`guide ${LABELS[command.name]}: ${cause.message}\n`);
    return EXIT_INVALID;
  }
}
