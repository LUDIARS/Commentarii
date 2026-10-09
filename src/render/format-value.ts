// How a guide value appears in generated Markdown: value, unit, boundary marker, draft flag.

import type { GuideValue, LocalizedText } from '../domain/documents.ts';
import { localize } from '../domain/localize.ts';

const KNOWLEDGE_MARK = { shown: '', discoverable: ' ※推定', masked: ' ※masked' } as const;

export const KNOWLEDGE_LEGEND = '※推定 = discoverable (表示は無いがプレイで推定できる)。印なし = shown (画面に表示される)。';

function payloadText(payload: unknown): string {
  if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) return localize(payload as LocalizedText);
  return JSON.stringify(payload);
}

export function formatValue(value: GuideValue | undefined): string {
  if (value === undefined) return '-';
  const unit = value.unit === undefined ? '' : ` ${value.unit}`;
  const draft = value.draft === true ? ' (draft)' : '';
  return `${payloadText(value.value)}${unit}${KNOWLEDGE_MARK[value.knowledge]}${draft}`;
}

export function formatValues(values: readonly GuideValue[] | undefined): string {
  if (values === undefined || values.length === 0) return '-';
  return values.map(formatValue).join(', ');
}
