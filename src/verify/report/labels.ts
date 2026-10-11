// Japanese labels of the verification classes, divergence reasons, decisions and bands used by
// the Markdown reports. Labels state facts; none of them recommends a design direction.

import type { DivergenceReason } from '../../domain/documents.ts';
import type { Band } from '../feasibility/feasibility-document.ts';
import type { IntentClass } from '../intent/classify-intents.ts';
import type { DivergenceDecision } from '../intent/divergence-store.ts';

export const CLASS_LABEL: Readonly<Record<IntentClass, string>> = {
  match: '一致',
  interesting: '面白いズレ (候補)',
  undesirable: '望ましくないズレ',
  impossible: '不可能 (証明あり)',
  'not-reproduced': '再現されず (証明なし・実測)',
  unverified: '未検証',
};

export const REASON_LABEL: Readonly<Record<DivergenceReason, string>> = {
  'alt-route': '別の経路',
  shortcut: 'ショートカット',
  'teach-skipped': '学習意図の飛ばし',
  'over-time': '時間超過',
  'forbid-entered': 'forbid 侵入',
};

export const DECISION_LABEL: Readonly<Record<DivergenceDecision, string>> = {
  pending: '未判定',
  allow: '許容',
  reject: '却下',
};

export const BAND_LABEL: Readonly<Record<Band, string>> = {
  feasible: 'feasible (やってやれそう)',
  'skill-gated': 'skill-gated (上手い人ならできる)',
  extreme: 'extreme (超頑張ればできる)',
  illusory: 'illusory (出来そうで出来ない)',
  impossible: 'impossible (地図上で到達できない)',
  'insufficient-evidence': '判定保留 (成功 0 だが根拠不足)',
  'not-observed': '未観測 (完了した試行なし)',
};

/** Fact-only wording for convergence (design 8.5: no verdict, no direction). */
export const CONVERGENCE_TEXT = '成功した解法は 1 つに収束している';

export function rateText(rate: number | null): string {
  return rate === null ? '-' : `${(rate * 100).toFixed(1)}%`;
}
