
import type { LevelRuleKey } from '@ludiars/commentarii-sdk/types';
import { contentHash } from '../learn/approval/proposal-hash.ts';

/** Wire ID of the probe's action, visible-target signature and condition outcomes. */
export function levelRuleId({ action, targets, conditions }: LevelRuleKey): string {
  const ordered = [...targets].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  return `rule:${contentHash([action, JSON.stringify(ordered), conditions])}`;
}
