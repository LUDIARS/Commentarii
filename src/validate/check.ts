// Contract of one validate check (design 6: a fixed list, one item one test).

import type { BundleIndex } from '../bundle/bundle-index.ts';
import type { LoadResult } from '../bundle/bundle.ts';

export type CheckId = 'V01' | 'V02' | 'V03' | 'V04' | 'V05' | 'V06' | 'V07' | 'V08' | 'V09' | 'V10' | 'V11' | 'V12';

export type Severity = 'error' | 'warning';

export interface Finding {
  readonly severity: Severity;
  readonly path: string;
  /** JSON pointer inside the file, '' for the whole file. */
  readonly pointer: string;
  readonly message: string;
}

export interface CheckContext {
  readonly load: LoadResult;
  readonly index: BundleIndex;
}

export interface Check {
  readonly id: CheckId;
  readonly title: string;
  run(context: CheckContext): Finding[];
}

export function error(path: string, pointer: string, message: string): Finding {
  return { severity: 'error', path, pointer, message };
}

export function warning(path: string, pointer: string, message: string): Finding {
  return { severity: 'warning', path, pointer, message };
}
