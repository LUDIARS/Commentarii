// undefined-exposure (warning): a number written into UI text or a localization table that the
// guide does not know at all, so nobody has decided whether players may see it. In `.json`
// files only string values count (plain JSON numbers are data, not UI text).

import type { Finding } from './audit-report.ts';
import { findNumericLiterals } from './numeric-literal.ts';
import { isJsonFile, isLocalizationFile } from './scan-targets.ts';
import { splitLines, type ScanText } from './scan-source.ts';

interface Segment {
  readonly text: string;
  /** 0-based offset of the segment in its line. */
  readonly offset: number;
}

const JSON_STRING = /"(?:[^"\\]|\\.)*"/g;

function segmentsOf(line: string, json: boolean): Segment[] {
  if (!json) return [{ text: line, offset: 0 }];
  return [...line.matchAll(JSON_STRING)].map((match) => ({ text: match[0], offset: match.index ?? 0 }));
}

export function detectUndefinedExposure(file: ScanText, guideNumbers: ReadonlySet<number>, minNumericLength: number): Finding[] {
  if (!isLocalizationFile(file.path)) return [];
  const json = isJsonFile(file.path);
  const findings: Finding[] = [];
  splitLines(file.text).forEach((line, index) => {
    for (const segment of segmentsOf(line, json)) {
      for (const literal of findNumericLiterals(segment.text)) {
        if (literal.digits < minNumericLength || guideNumbers.has(literal.value)) continue;
        findings.push({
          kind: 'undefined-exposure',
          file: file.path,
          line: index + 1,
          column: segment.offset + literal.column,
          ref: `literal:${literal.text}`,
          reason: '攻略本に無い数値が UI 文字列・ローカライズ表に直書きされている (境界が未定義の露出候補)',
        });
      }
    }
  });
  return findings;
}
