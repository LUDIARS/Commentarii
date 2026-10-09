// Principle 3: an LLM draft carries only numbers written in its source document; anything the
// model estimated is thrown away. "Numbers" are JSON numbers and the numeric literals of rule
// expressions. A number is documented when its absolute value appears in the text (the sign
// is often written in words); full-width digits count after NFKC normalization.

import { tokenize } from '../../domain/expression/tokenize.ts';
import { isJsonObject } from '../../domain/value-node.ts';

export interface DocumentedNumbers {
  has(value: number): boolean;
}

export function documentedNumbers(text: string): DocumentedNumbers {
  const values = new Set<number>();
  for (const match of text.normalize('NFKC').matchAll(/\d+(?:\.\d+)?/g)) values.add(Number(match[0]));
  return { has: (value) => values.has(Math.abs(value)) };
}

/** Every JSON number anywhere in the value. */
export function collectNumbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(collectNumbers);
  if (isJsonObject(value)) return Object.values(value).flatMap(collectNumbers);
  return [];
}

/** Numeric literals of a rule expression; undefined when the expression cannot be tokenized. */
export function expressionNumbers(expression: string): number[] | undefined {
  try {
    return tokenize(expression).flatMap((token) => (token.type === 'number' ? [token.value] : []));
  } catch {
    // An expression the tokenizer rejects cannot be screened, so the caller drops it.
    return undefined;
  }
}

/** Numbers of the value that the document does not contain, without duplicates. */
export function undocumented(numbers: readonly number[], documented: DocumentedNumbers): number[] {
  return [...new Set(numbers.filter((number) => !documented.has(number)))];
}
