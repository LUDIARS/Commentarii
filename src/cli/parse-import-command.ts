// Command line of the import commands (guide import masters|map|spec, guide intent import).

import { parseArgs } from 'node:util';
import type { MapKind } from '../domain/documents.ts';
import { UsageError } from './usage-error.ts';

export type ImportCommand =
  | { readonly name: 'import-masters'; readonly bundleDir: string; readonly from: string; readonly mapPath: string; readonly dryRun: boolean }
  | {
      readonly name: 'import-map';
      readonly bundleDir: string;
      readonly stage: string;
      readonly from: string;
      readonly kind: MapKind;
      readonly mapPath: string | undefined;
      readonly neighbors: 4 | 8;
    }
  | { readonly name: 'import-spec'; readonly bundleDir: string; readonly from: string; readonly kind: 'rules' | 'states' }
  | { readonly name: 'intent-import'; readonly bundleDir: string; readonly stage: string; readonly from: string };

export const IMPORT_USAGE = `  guide import masters --game <bundle-dir> --from <csv|json|sqlite> --map <mapping.json> [--dry-run]
  guide import map --game <bundle-dir> --stage <slug> --from <path> --kind grid|navgraph|zones [--map <mapping.json>] [--neighbors 4|8]
  guide import spec --game <bundle-dir> --from <md> --kind rules|states
  guide intent import --game <bundle-dir> --stage <slug> --from <md>
`;

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

type Values = Record<string, string | boolean | undefined>;

function required(values: Values, option: string, command: string): string {
  const value = values[option];
  if (typeof value !== 'string' || value === '') throw new UsageError(`${command} needs --${option}`);
  return value;
}

function stageSlug(values: Values, command: string): string {
  const stage = required(values, 'stage', command);
  if (!SLUG.test(stage)) throw new UsageError(`--stage must be a slug ([a-z0-9][a-z0-9_-]*)`);
  return stage;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], option: string): T {
  if (!(allowed as readonly string[]).includes(value)) throw new UsageError(`--${option} must be ${allowed.join('|')}`);
  return value as T;
}

function parseMasters(args: string[]): ImportCommand {
  const { values } = parseArgs({
    args,
    options: { game: { type: 'string' }, from: { type: 'string' }, map: { type: 'string' }, 'dry-run': { type: 'boolean' } },
  });
  const command = 'import masters';
  return {
    name: 'import-masters',
    bundleDir: required(values, 'game', command),
    from: required(values, 'from', command),
    mapPath: required(values, 'map', command),
    dryRun: values['dry-run'] === true,
  };
}

function parseMap(args: string[]): ImportCommand {
  const { values } = parseArgs({
    args,
    options: {
      game: { type: 'string' },
      stage: { type: 'string' },
      from: { type: 'string' },
      kind: { type: 'string' },
      map: { type: 'string' },
      neighbors: { type: 'string', default: '4' },
    },
  });
  const command = 'import map';
  return {
    name: 'import-map',
    bundleDir: required(values, 'game', command),
    stage: stageSlug(values, command),
    from: required(values, 'from', command),
    kind: oneOf(required(values, 'kind', command), ['grid', 'navgraph', 'zones'] as const, 'kind'),
    mapPath: values.map,
    neighbors: oneOf(values.neighbors, ['4', '8'] as const, 'neighbors') === '8' ? 8 : 4,
  };
}

function parseSpec(args: string[]): ImportCommand {
  const { values } = parseArgs({ args, options: { game: { type: 'string' }, from: { type: 'string' }, kind: { type: 'string' } } });
  const command = 'import spec';
  return {
    name: 'import-spec',
    bundleDir: required(values, 'game', command),
    from: required(values, 'from', command),
    kind: oneOf(required(values, 'kind', command), ['rules', 'states'] as const, 'kind'),
  };
}

function parseIntentImport(args: string[]): ImportCommand {
  const { values } = parseArgs({ args, options: { game: { type: 'string' }, stage: { type: 'string' }, from: { type: 'string' } } });
  const command = 'intent import';
  return {
    name: 'intent-import',
    bundleDir: required(values, 'game', command),
    stage: stageSlug(values, command),
    from: required(values, 'from', command),
  };
}

export function parseImportCommand(name: 'import' | 'intent', argv: readonly string[]): ImportCommand {
  const [topic, ...rest] = argv;
  if (name === 'intent') {
    if (topic !== 'import') throw new UsageError('intent supports only: intent import');
    return parseIntentImport(rest);
  }
  switch (topic) {
    case 'masters':
      return parseMasters(rest);
    case 'map':
      return parseMap(rest);
    case 'spec':
      return parseSpec(rest);
    default:
      throw new UsageError('import supports: import masters | import map | import spec');
  }
}
