// A divergence: runs that departed from one intended item in the same way (same reason, same
// tactic sequence, same route; spec/feature/intent-verify.md 4.1). Its ID depends on that
// signature only, so it stays the same however many runs show it.

import { createHash } from 'node:crypto';
import type { DivergenceReason, DivergenceSignature, LevelDivergenceEvidence } from '@ludiars/commentarii-sdk/types';

export type DivergenceKind = 'interesting' | 'undesirable';

export const KIND_OF_REASON: Readonly<Record<DivergenceReason, DivergenceKind>> = {
  'alt-route': 'interesting',
  shortcut: 'interesting',
  'teach-skipped': 'undesirable',
  'over-time': 'undesirable',
  'forbid-entered': 'undesirable',
  'blocked-solution': 'undesirable',
  'unexpected-solution': 'interesting',
  'skill-mismatch': 'undesirable',
  'disclosure-mismatch': 'undesirable',
  'choice-count-mismatch': 'undesirable',
  'feel-mismatch': 'undesirable',
};

export interface Divergence {
  readonly id: string;
  readonly stage: string;
  readonly intent: string;
  readonly kind: DivergenceKind;
  readonly reason: DivergenceReason;
  readonly summary: string;
  readonly runs: readonly string[];
  readonly personas: readonly string[];
  readonly signature: DivergenceSignature;
  readonly level?: LevelDivergenceEvidence;
  /** Set when an acceptance exists but no longer binds (loose entry or another guide version): re-evaluate. */
  readonly recheck?: string;
}

export function divergenceId(intent: string, reason: DivergenceReason, signature: DivergenceSignature, level?: LevelDivergenceEvidence): string {
  const identity = [intent, reason, signature.tactics, signature.route];
  const digest = createHash('sha256').update(JSON.stringify(level === undefined ? identity : [...identity, level.challenge, level.subject])).digest('hex');
  return `div-${digest.slice(0, 12)}`;
}

export function sameSignature(a: DivergenceSignature, b: DivergenceSignature): boolean {
  return JSON.stringify([a.tactics, a.route]) === JSON.stringify([b.tactics, b.route]);
}

const SUMMARY: Readonly<Record<DivergenceReason, string>> = {
  'alt-route': '想定と違う経路で到達した (別解)',
  shortcut: '想定より速く到達した (ショートカット)',
  'teach-skipped': '覚えてほしい定石を使わずに到達した (学習意図の飛ばし)',
  'over-time': '想定より時間がかかった',
  'forbid-entered': '入ってほしくない場所に入った',
  'blocked-solution': '想定の解法が通らない',
  'unexpected-solution': '想定外の解法が通った',
  'skill-mismatch': '想定の腕前と食い違う',
  'disclosure-mismatch': '想定の開示と食い違う',
  'choice-count-mismatch': '想定の選択肢の数と食い違う',
  'feel-mismatch': '想定の手触りと食い違う',
};

export function summaryOf(reason: DivergenceReason, signature: DivergenceSignature): string {
  const route = signature.route.length === 0 ? '-' : signature.route.join(' → ');
  const tactics = signature.tactics.length === 0 ? '定石なし' : signature.tactics.join(', ');
  return `${SUMMARY[reason]}: 経路 ${route} / ${tactics}`;
}
