// `guide audit mask --game <bundle-dir> --scan <path>... [--format json|md] [--fail-on hit|none]`
// Errors are thrown as plain Errors; parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';
import type { FailOn } from './audit-exit-code.ts';

export type AuditFormat = 'json' | 'md';

export interface AuditMaskCommand {
  readonly name: 'audit-mask';
  readonly bundleDir: string;
  readonly scanPaths: readonly string[];
  readonly format: AuditFormat;
  readonly failOn: FailOn;
}

export const AUDIT_USAGE = '  guide audit mask --game <bundle-dir> --scan <path>... [--format json|md] [--fail-on hit|none]\n';

export function parseAuditArgs(args: readonly string[]): AuditMaskCommand {
  const [topic, ...options] = args;
  if (topic !== 'mask') throw new Error('audit supports only: audit mask');
  const { values, positionals } = parseArgs({
    args: options,
    allowPositionals: true,
    options: {
      game: { type: 'string' },
      scan: { type: 'string', multiple: true },
      format: { type: 'string', default: 'md' },
      'fail-on': { type: 'string', default: 'hit' },
    },
  });
  // `--scan a b c` style: extra positionals are further scan roots.
  const scanPaths = [...(values.scan ?? []), ...positionals].filter((path) => path !== '');
  if (values.game === undefined || values.game === '') throw new Error('audit mask needs --game <bundle-dir>');
  if (scanPaths.length === 0) throw new Error('audit mask needs at least one --scan <path>');
  if (values.format !== 'json' && values.format !== 'md') throw new Error('--format must be json or md');
  const failOn = values['fail-on'];
  if (failOn !== 'hit' && failOn !== 'none') throw new Error('--fail-on must be hit or none');
  return { name: 'audit-mask', bundleDir: values.game, scanPaths, format: values.format, failOn };
}
