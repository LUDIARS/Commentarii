// Shared reading of the engine outputs next to a bundle (SDK 0.5.0) for V21-V26: the outputs of
// one schema that did follow it (V21 reports the others, the content checks skip them).

import type { EngineOutputFile, EngineOutputSchema, LoadResult } from '@ludiars/commentarii-sdk/types';

export interface ValidOutput<T> {
  readonly path: string;
  readonly doc: T;
}

export function validOutputs<T>(load: LoadResult, schema: EngineOutputSchema): ValidOutput<T>[] {
  return (load.outputs ?? []).filter((output: EngineOutputFile) => output.schema === schema && output.violations.length === 0).map((output) => ({ path: output.path, doc: output.data as T }));
}
