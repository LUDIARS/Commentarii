// Whole-token occurrences of a literal string in a line: a match must not continue a longer
// word on either side (the boundary characters decide what "word" means).

/** Identifier characters: a key or string must not be the middle of a longer identifier. */
export const IDENTIFIER_CHAR = /[A-Za-z0-9_]/;
/** Slug characters (`[a-z0-9_-]`): an ID slug must not be the middle of a longer slug. */
export const SLUG_CHAR = /[A-Za-z0-9_-]/;

/** 1-based columns where `needle` occurs in `line` as a whole token. */
export function findTokenColumns(line: string, needle: string, boundary: RegExp): number[] {
  const columns: number[] = [];
  if (needle === '') return columns;
  const checkStart = boundary.test(needle[0] ?? '');
  const checkEnd = boundary.test(needle.at(-1) ?? '');
  let from = 0;
  for (;;) {
    const index = line.indexOf(needle, from);
    if (index < 0) return columns;
    const before = line[index - 1];
    const after = line[index + needle.length];
    const startOk = !checkStart || before === undefined || !boundary.test(before);
    const endOk = !checkEnd || after === undefined || !boundary.test(after);
    if (startOk && endOk) columns.push(index + 1);
    from = index + 1;
  }
}
