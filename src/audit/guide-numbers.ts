// Every number the guide knows about, in any file and at any knowledge level. A number in UI
// text that is not in this set has no boundary yet (undefined-exposure).

import type { LoadedFile } from '../bundle/bundle.ts';

function walk(value: unknown, out: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) out.add(Math.abs(value));
  else if (Array.isArray(value)) for (const item of value) walk(item, out);
  else if (typeof value === 'object' && value !== null) for (const item of Object.values(value)) walk(item, out);
}

export function collectGuideNumbers(files: readonly LoadedFile[]): ReadonlySet<number> {
  const numbers = new Set<number>();
  for (const file of files) walk(file.data, numbers);
  return numbers;
}
