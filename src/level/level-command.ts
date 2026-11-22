
import { parseArgs } from 'node:util';

export const LEVEL_USAGE = `  guide level check --game <bundle-dir> [--principles <upstream.json>]
  guide level verify --game <bundle-dir> --probe <level.json>
  guide level propose --game <bundle-dir> --probe <level.json> --stage <id> [--challenge <id> | --rule <id>] --finding <id> --edit <edits.json>
  guide level prepare --game <bundle-dir> --proposal <id> --out <new-dir>
  guide level review --game <bundle-dir> --proposal <id> --base <level.json> --head <level.json> --gate <gate.json>
`;

export type LevelCommand = { readonly name: 'level'; readonly game: string } & (
  | { readonly verb: 'check'; readonly principles?: string }
  | { readonly verb: 'verify'; readonly probe: string }
  | { readonly verb: 'propose'; readonly probe: string; readonly stage: string; readonly challenge?: string; readonly rule?: string; readonly finding: string; readonly edit: string }
  | { readonly verb: 'prepare'; readonly proposal: string; readonly out: string }
  | { readonly verb: 'review'; readonly proposal: string; readonly base: string; readonly head: string; readonly gate: string }
);

const FLAGS = {
  check: ['principles'],
  verify: ['probe'],
  propose: ['probe', 'stage', 'challenge', 'rule', 'finding', 'edit'],
  prepare: ['proposal', 'out'],
  review: ['proposal', 'base', 'head', 'gate'],
} as const;

export function parseLevelCommand([verb, ...args]: readonly string[]): LevelCommand {
  if (verb !== 'check' && verb !== 'verify' && verb !== 'propose' && verb !== 'prepare' && verb !== 'review') {
    throw new Error('level supports check, verify, propose, prepare and review');
  }
  const options = Object.fromEntries(['game', ...FLAGS[verb]].map((flag) => [flag, { type: 'string' as const }]));
  const { values } = parseArgs({ args, options });
  const required = (flag: string): string => {
    const value = values[flag];
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`level ${verb} needs --${flag}`);
    return value;
  };
  const optional = (flag: string): string | undefined => values[flag] === undefined ? undefined : required(flag);
  const command = { name: 'level' as const, game: required('game') };
  if (verb === 'check') {
    const principles = optional('principles');
    return { ...command, verb, ...(principles === undefined ? {} : { principles }) };
  }
  if (verb === 'verify') return { ...command, verb, probe: required('probe') };
  if (verb === 'propose') {
    const challenge = optional('challenge');
    const rule = optional('rule');
    if (challenge !== undefined && rule !== undefined) throw new Error('use either --challenge or --rule');
    return { ...command, verb, probe: required('probe'), stage: required('stage'), finding: required('finding'),
      edit: required('edit'), ...(challenge === undefined ? {} : { challenge }), ...(rule === undefined ? {} : { rule }) };
  }
  const proposal = required('proposal');
  if (verb === 'prepare') return { ...command, verb, proposal, out: required('out') };
  return { ...command, verb, proposal, base: required('base'), head: required('head'), gate: required('gate') };
}
