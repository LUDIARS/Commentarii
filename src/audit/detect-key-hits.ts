// key-hit: a forbidden key name (`audit.forbidden_keys[]`) appears as an identifier: a JSON /
// YAML key, a type or proto field, a property. Written snake_case in the manifest, it is also
// matched in its camelCase and PascalCase spellings (`rng_seed`, `rngSeed`, `RngSeed`).

import type { Finding } from './audit-report.ts';
import { splitLines, type ScanText } from './scan-source.ts';
import { findTokenColumns, IDENTIFIER_CHAR } from './token-match.ts';

interface Spelling {
  readonly text: string;
  readonly style: string;
}

export function keySpellings(key: string): Spelling[] {
  const camel = key.replace(/_([a-z0-9])/g, (_, next: string) => next.toUpperCase());
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  const spellings: Spelling[] = [{ text: key, style: 'そのまま' }];
  if (camel !== key) spellings.push({ text: camel, style: 'camelCase' });
  if (pascal !== camel) spellings.push({ text: pascal, style: 'PascalCase' });
  return spellings;
}

export function detectKeyHits(file: ScanText, forbiddenKeys: readonly string[]): Finding[] {
  const spellings = forbiddenKeys.map((key) => ({ key, spellings: keySpellings(key) }));
  const findings: Finding[] = [];
  splitLines(file.text).forEach((text, index) => {
    for (const { key, spellings: forms } of spellings) {
      for (const form of forms) {
        for (const column of findTokenColumns(text, form.text, IDENTIFIER_CHAR)) {
          findings.push({
            kind: 'key-hit',
            file: file.path,
            line: index + 1,
            column,
            ref: `forbidden_keys:${key}`,
            reason: `露出禁止キー名が識別子として出現 (表記: ${form.style})`,
          });
        }
      }
    }
  });
  return findings;
}
