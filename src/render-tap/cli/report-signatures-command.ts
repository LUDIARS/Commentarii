// `guide report signatures <frames.jsonl> --game <bundle-dir> [--json] [--out <file>]`: the maker
// channel for appearances the guide cannot name (spec/feature/render-tap-contract.md §6).

import { parseArgs } from 'node:util';

export interface ReportSignaturesCommand {
  readonly name: 'report-signatures';
  readonly framesPath: string;
  readonly gameDir: string;
  readonly json: boolean;
  readonly outFile?: string;
}

export const REPORT_SIGNATURES_USAGE = `  guide report signatures <frames.jsonl> --game <bundle-dir> [--json] [--out <file>]
`;

export function parseReportSignaturesCommand(args: readonly string[]): ReportSignaturesCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { game: { type: 'string' }, json: { type: 'boolean' }, out: { type: 'string' } },
  });
  const [framesPath, ...extra] = positionals;
  if (framesPath === undefined || extra.length > 0) throw new Error('report signatures needs exactly one <frames.jsonl>');
  if (values.game === undefined || values.game === '') throw new Error('report signatures needs --game <bundle-dir>');
  if (values.out === '') throw new Error('--out needs a file');
  return { name: 'report-signatures', framesPath, gameDir: values.game, json: values.json === true, ...(values.out === undefined ? {} : { outFile: values.out }) };
}
