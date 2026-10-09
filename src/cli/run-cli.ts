// Runs one CLI command and returns the process exit code.

import { runAuditMask } from '../audit/run-audit-mask.ts';
import { runAutoplayCommand } from '../autoplay/run-autoplay-command.ts';
import { runExportCommand } from '../export/run-export-command.ts';
import { runLearnCommand } from '../learn/cli/run-learn-command.ts';
import { runPlaysCommand } from '../import/plays/run-plays-command.ts';
import { buildKnowledgeReport } from '../report/build-knowledge-report.ts';
import { formatKnowledgeMarkdown } from '../report/format-knowledge-markdown.ts';
import { renderBundle } from '../render/render-bundle.ts';
import { runReplayCommand } from '../replay/run-replay-command.ts';
import { formatValidationText } from '../validate/format-validation-text.ts';
import { runValidation } from '../validate/run-validation.ts';
import { EXIT_INVALID, EXIT_OK, EXIT_USAGE, type CliIo } from './cli-io.ts';
import { parseCommand, USAGE, UsageError, type Command } from './parse-command.ts';
import { runImportCommand } from './run-import-command.ts';

async function execute(command: Command, io: CliIo): Promise<number> {
  switch (command.name) {
    case 'help':
      io.stdout(USAGE);
      return EXIT_OK;
    case 'validate': {
      const report = runValidation(await io.openBundle(command.bundleDir));
      io.stdout(command.json ? `${JSON.stringify(report, null, 2)}\n` : formatValidationText(report));
      return report.ok ? EXIT_OK : EXIT_INVALID;
    }
    case 'render': {
      const load = await io.openBundle(command.bundleDir);
      if (load.issues.length > 0) {
        io.stderr(`guide render: ${load.issues.length} schema issue(s); invalid files are left out (run guide validate)\n`);
      }
      const files = renderBundle(load, { knowledge: command.knowledge });
      await io.writeFiles(command.outDir, files);
      io.stderr(`guide render: wrote ${files.size} file(s) to ${command.outDir} (knowledge=${command.knowledge})\n`);
      return EXIT_OK;
    }
    case 'report-knowledge': {
      const report = buildKnowledgeReport(await io.openBundle(command.bundleDir));
      io.stdout(command.json ? `${JSON.stringify(report, null, 2)}\n` : formatKnowledgeMarkdown(report));
      return EXIT_OK;
    }
    case 'replay-play':
    case 'replay-diff':
      return runReplayCommand(command, io);
    case 'import-masters':
    case 'import-map':
    case 'import-spec':
    case 'intent-import':
      return runImportCommand(command, io);
    case 'audit-mask':
      return runAuditMask(command, io);
    case 'export':
      return runExportCommand(command, io);
    case 'run':
    case 'bench':
      return runAutoplayCommand(command, io);
    case 'learn-ingest':
    case 'learn-consolidate':
      return runLearnCommand(command, io);
    case 'import-plays':
    case 'report-plays':
      return runPlaysCommand(command, io);
  }
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  let command: Command;
  try {
    command = parseCommand(argv);
  } catch (cause) {
    if (!(cause instanceof UsageError)) throw cause;
    io.stderr(`guide: ${cause.message}\n${USAGE}`);
    return EXIT_USAGE;
  }
  return execute(command, io);
}
