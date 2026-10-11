// Contract of one validate check (design 6: a fixed list, one item one test).

import type { BundleIndex } from '@ludiars/commentarii-sdk/bundle';
import type { LoadResult } from '@ludiars/commentarii-sdk/types';

export type CheckId =
  | 'V01'
  | 'V02'
  | 'V03'
  | 'V04'
  | 'V05'
  | 'V06'
  | 'V07'
  | 'V08'
  | 'V09'
  | 'V10'
  | 'V11'
  | 'V12'
  | 'V13'
  | 'V14'
  | 'V15'
  | 'V16'
  | 'V17'
  | 'V18'
  | 'V19'
  | 'V20';

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
