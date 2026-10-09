// Runs guide verify intent (verification or --accept) and guide report feasibility. Input
// problems (VerifyError) are printed and exit 1 with nothing written.

import { EXIT_INVALID, EXIT_OK, type CliIo } from '../../cli/cli-io.ts';
import { formatFeasibilityMarkdown } from '../report/format-feasibility-markdown.ts';
import { VerifyError } from '../verify-error.ts';
import { readFeasibilityDocuments } from './read-documents.ts';
import { runVerifyAccept } from './run-verify-accept.ts';
import { runVerifyIntent } from './run-verify-intent.ts';
import type { ReportFeasibilityCommand, VerifyCommand } from './verify-command.ts';
import type { VerifyIo } from './verify-io.ts';

type VerifyCommandIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'writeFiles' | 'verifyIo'>;

async function reportFeasibility(command: ReportFeasibilityCommand, io: VerifyCommandIo, verifyIo: VerifyIo): Promise<number> {
  const documents = await readFeasibilityDocuments(verifyIo, command.gameDir, await verifyIo.schemaRegistry());
  io.stdout(command.json ? `${JSON.stringify(documents, null, 2)}\n` : formatFeasibilityMarkdown(documents));
  return EXIT_OK;
}

export async function runVerifyCommand(command: VerifyCommand, io: VerifyCommandIo): Promise<number> {
  const verifyIo = io.verifyIo;
  if (verifyIo === undefined) throw new Error('guide verify: no verify I/O is wired (main.ts must provide verifyIo)');
  try {
    switch (command.name) {
      case 'verify-intent':
        return await runVerifyIntent(command, io, verifyIo);
      case 'verify-accept':
        return await runVerifyAccept(command, io, verifyIo);
      case 'report-feasibility':
        return await reportFeasibility(command, io, verifyIo);
    }
  } catch (cause) {
    if (!(cause instanceof VerifyError)) throw cause;
    io.stderr(`guide verify: ${cause.message}\n`);
    return EXIT_INVALID;
  }
}
