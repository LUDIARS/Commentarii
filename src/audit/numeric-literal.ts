// Numeric literals in a line of scanned text, with an optional unit right after them.
// Signs are ignored on purpose: `-32` still exposes 32 (safe side).

export interface NumericLiteral {
  readonly text: string;
  readonly value: number;
  /** Letters directly after the number (`18kg`, `18 kg`, `7 m/s`), if any. */
  readonly unit?: string;
  /** 1-based column of the first digit. */
  readonly column: number;
  readonly digits: number;
}

// Not part of an identifier or a dotted run (version strings such as 1.2.3 are skipped).
const LITERAL = /(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)(?!\d|\.\d)(?: ?([A-Za-z%][A-Za-z0-9%/]*))?/g;

/** Significant digits of a decimal text: sign, decimal point and leading zeros do not count. */
export function significantDigits(text: string): number {
  return text.replace(/^[-+]/, '').replace('.', '').replace(/^0+/, '').length;
}

/** Significant digits of a number as written in the guide (`0.24` -> 2, `180` -> 3). */
export function significantDigitsOfNumber(value: number): number {
  const text = String(Math.abs(value));
  const mantissa = text.split(/e/i)[0] ?? text;
  return significantDigits(mantissa);
}

export function findNumericLiterals(line: string): NumericLiteral[] {
  const literals: NumericLiteral[] = [];
  for (const match of line.matchAll(LITERAL)) {
    const text = match[1] ?? '';
    const unit = match[2];
    literals.push({
      text,
      value: Number(text),
      ...(unit === undefined ? {} : { unit }),
      column: (match.index ?? 0) + 1,
      digits: significantDigits(text),
    });
  }
  return literals;
}

export function sameUnit(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
