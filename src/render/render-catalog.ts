// アイテム / スキル / アクター表.

import type { Bundle } from '../bundle/bundle.ts';
import type { Entity } from '../domain/documents.ts';
import { localize } from '../domain/localize.ts';
import { document, table } from '../markdown/markdown.ts';
import { formatValue, KNOWLEDGE_LEGEND } from './format-value.ts';

function statsText(entity: Entity): string {
  const entries = Object.entries(entity.stats ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? '-' : entries.map(([name, value]) => `${name}: ${formatValue(value)}`).join(', ');
}

function section(title: string, entities: readonly Entity[], headers: readonly string[], row: (entity: Entity) => string[]): string {
  return document([`## ${title}`, entities.length === 0 ? 'なし。' : table(headers, entities.map(row))]).trimEnd();
}

export function renderCatalog(bundle: Bundle): string {
  const of = (kind: string): Entity[] => bundle.entities.map(({ doc }) => doc).filter((entity) => entity.id.startsWith(`${kind}:`));
  return document([
    '# アイテム / スキル',
    KNOWLEDGE_LEGEND,
    section('アイテム', of('item'), ['ID', '名前', '種別', '効果', '数値'], (item) => [
      item.id,
      localize(item.name),
      formatValue(item.category),
      formatValue(item.effect),
      statsText(item),
    ]),
    section('スキル', of('skill'), ['ID', '名前', '効果', '数値', 'ルール'], (skill) => [
      skill.id,
      localize(skill.name),
      formatValue(skill.effect),
      statsText(skill),
      (skill.rules ?? []).join(', ') || '-',
    ]),
    section('アクター', of('actor'), ['ID', '名前', '数値', 'スキル', '行動'], (actor) => [
      actor.id,
      localize(actor.name),
      statsText(actor),
      (actor.skills ?? []).join(', ') || '-',
      actor.behavior ?? '-',
    ]),
  ]);
}
