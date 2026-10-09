// value-hit: a masked value shows up in a scanned file.
// - number: a literal with the same value; with a unit, the literal is bare or carries the same unit.
// - string: the same text as a whole token. - ID: the slug of `<kind>:<game-id>:<slug>`.
// Numbers with fewer significant digits than `minNumericLength` are not compared.

import type { Finding } from './audit-report.ts';
import type { MaskedNeedle } from './masked-needles.ts';
import { findNumericLiterals, sameUnit, type NumericLiteral } from './numeric-literal.ts';
import { splitLines, type ScanText } from './scan-source.ts';
import { findTokenColumns, IDENTIFIER_CHAR, SLUG_CHAR } from './token-match.ts';

type NumberNeedle = Extract<MaskedNeedle, { kind: 'number' }>;
type TokenNeedle = Exclude<MaskedNeedle, { kind: 'number' }>;

function numberReason(needle: NumberNeedle, literal: NumericLiteral): string {
  if (needle.unit === undefined) return '数値リテラルが masked の数値と同じ値';
  return literal.unit === undefined ? '数値リテラルが masked の数値と同じ値 (単位の記述なし)' : '数値リテラルが masked の数値と同じ値・同じ単位';
}

function numberMatches(needle: NumberNeedle, literal: NumericLiteral): boolean {
  if (literal.value !== needle.value) return false;
  return needle.unit === undefined || literal.unit === undefined || sameUnit(literal.unit, needle.unit);
}

export function detectValueHits(file: ScanText, needles: readonly MaskedNeedle[], minNumericLength: number): Finding[] {
  const numbers = needles.filter((needle): needle is NumberNeedle => needle.kind === 'number' && needle.digits >= minNumericLength);
  const tokens = needles.filter((needle): needle is TokenNeedle => needle.kind !== 'number');
  const findings: Finding[] = [];
  splitLines(file.text).forEach((text, index) => {
    const line = index + 1;
    if (numbers.length > 0) {
      for (const literal of findNumericLiterals(text)) {
        for (const needle of numbers) {
          if (numberMatches(needle, literal)) {
            findings.push({ kind: 'value-hit', file: file.path, line, column: literal.column, ref: needle.ref, reason: numberReason(needle, literal) });
          }
        }
      }
    }
    for (const needle of tokens) {
      const boundary = needle.kind === 'id-slug' ? SLUG_CHAR : IDENTIFIER_CHAR;
      const reason = needle.kind === 'id-slug' ? 'masked の ID 値の slug と一致' : 'masked の文字列値と完全一致';
      for (const column of findTokenColumns(text, needle.text, boundary)) {
        findings.push({ kind: 'value-hit', file: file.path, line, column, ref: needle.ref, reason });
      }
    }
  });
  return findings;
}
