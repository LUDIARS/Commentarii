// V01: every file matches its JSON Schema (and is parseable, and sits in the bundle layout).

import { error, type Check } from '../check.ts';

export const v01Schema: Check = {
  id: 'V01',
  title: 'スキーマ違反',
  run: ({ load }) => load.issues.map((issue) => error(issue.path, issue.pointer, issue.message)),
};
