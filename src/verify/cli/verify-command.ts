// `guide verify intent ...` and `guide report feasibility ...` arguments
// (spec/feature/intent-verify.md 1). Errors are thrown as plain Errors; parse-command.ts turns
// them into usage errors.

import { parseArgs } from 'node:util';

export interface VerifyIntentCommand {
  readonly name: 'verify-intent';
  readonly gameDir: string;
  /** Replay files or directories holding them. */
  readonly runs: readonly string[];
  readonly persona?: string;
  readonly json: boolean;
}

export interface VerifyAcceptCommand {
  readonly name: 'verify-accept';
  readonly gameDir: string;
  readonly id: string;
  readonly by: string;
  readonly note?: string;
  readonly json: boolean;
}

export interface ReportFeasibilityCommand {
  readonly name: 'report-feasibility';
  readonly gameDir: string;
  readonly json: boolean;
}

export type VerifyCommand = VerifyIntentCommand | VerifyAcceptCommand | ReportFeasibilityCommand;

export const VERIFY_USAGE = `  guide verify intent --game <bundle-dir> --runs <dir|file> [--runs ...] [--persona <slug>] [--json]
  guide verify intent --game <bundle-dir> --accept <divergence-id> --by <name> [--note <text>] [--json]
  guide report feasibility --game <bundle-dir> [--json]
`;

function nonEmpty(value: string | undefined, what: string): string {
  if (value === undefined || value === '') throw new Error(`${what} needs a value`);
  return value;
}

export function parseVerifyCommand(args: readonly string[]): VerifyCommand {
  const [topic, ...rest] = args;
  if (topic !== 'intent') throw new Error('verify supports: verify intent');
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      game: { type: 'string' },
      runs: { type: 'string', multiple: true },
      persona: { type: 'string' },
      accept: { type: 'string' },
      by: { type: 'string' },
      note: { type: 'string' },
      json: { type: 'boolean' },
    },
  });
  const gameDir = nonEmpty(values.game, 'verify intent --game');
  const json = values.json === true;
  if (values.accept !== undefined) {
    if ((values.runs ?? []).length > 0 || positionals.length > 0 || values.persona !== undefined) throw new Error('verify intent --accept takes no runs and no --persona');
    return {
      name: 'verify-accept',
      gameDir,
      id: nonEmpty(values.accept, '--accept'),
      by: nonEmpty(values.by, 'verify intent --accept --by'),
      ...(values.note === undefined ? {} : { note: nonEmpty(values.note, '--note') }),
      json,
    };
  }
  if (values.by !== undefined || values.note !== undefined) throw new Error('--by / --note go with --accept');
  const runs = [...(values.runs ?? []), ...positionals];
  if (runs.length === 0) throw new Error('verify intent needs --runs <dir|file>');
  return { name: 'verify-intent', gameDir, runs, ...(values.persona === undefined ? {} : { persona: nonEmpty(values.persona, '--persona') }), json };
}

export function parseReportFeasibilityCommand(args: readonly string[]): ReportFeasibilityCommand {
  const { values, positionals } = parseArgs({ args: [...args], allowPositionals: true, options: { game: { type: 'string' }, json: { type: 'boolean' } } });
  if (positionals.length > 0) throw new Error('report feasibility takes no positional arguments');
  return { name: 'report-feasibility', gameDir: nonEmpty(values.game, 'report feasibility --game'), json: values.json === true };
}
