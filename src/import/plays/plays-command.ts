// `guide import plays ...` and `guide report plays ...` arguments. Errors are thrown as plain
// Errors; parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';

export interface ImportPlaysCommand {
  readonly name: 'import-plays';
  readonly bundleDir: string;
  readonly from: string;
  readonly mapPath: string;
  /** --player-salt; when absent the salt comes from COMMENTARII_PLAYER_SALT. */
  readonly playerSalt?: string;
}

export interface ReportPlaysCommand {
  readonly name: 'report-plays';
  readonly bundleDir: string;
  readonly json: boolean;
}

export type PlaysCommand = ImportPlaysCommand | ReportPlaysCommand;

export const PLAYS_USAGE = `  guide import plays --game <bundle-dir> --from <jsonl|csv|json> --map <plays-mapping.json> [--player-salt <secret>]   (salt default: $COMMENTARII_PLAYER_SALT)
  guide report plays --game <bundle-dir> [--json]
`;

function required(value: string | undefined, option: string, command: string): string {
  if (value === undefined || value === '') throw new Error(`${command} needs --${option}`);
  return value;
}

export function parseImportPlaysCommand(args: readonly string[]): ImportPlaysCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { game: { type: 'string' }, from: { type: 'string' }, map: { type: 'string' }, 'player-salt': { type: 'string' } },
  });
  const command = 'import plays';
  if (positionals.length > 0) throw new Error(`${command} takes no positional arguments`);
  if (values['player-salt'] === '') throw new Error('--player-salt needs a value');
  return {
    name: 'import-plays',
    bundleDir: required(values.game, 'game', command),
    from: required(values.from, 'from', command),
    mapPath: required(values.map, 'map', command),
    ...(values['player-salt'] === undefined ? {} : { playerSalt: values['player-salt'] }),
  };
}

export function parseReportPlaysCommand(args: readonly string[]): ReportPlaysCommand {
  const { values, positionals } = parseArgs({ args: [...args], allowPositionals: true, options: { game: { type: 'string' }, json: { type: 'boolean' } } });
  if (positionals.length > 0) throw new Error('report plays takes no positional arguments');
  return { name: 'report-plays', bundleDir: required(values.game, 'game', 'report plays'), json: values.json === true };
}
