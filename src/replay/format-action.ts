// One-line, stable text for an action in human output (key order as recorded).

import type { ReplayAction } from './replay-action.ts';

export function formatAction(action: ReplayAction | null): string {
  return action === null ? '(なし)' : JSON.stringify(action);
}
