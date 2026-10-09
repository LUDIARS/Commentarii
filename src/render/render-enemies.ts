// 敵図鑑: one row per enemy, one column per stat name used by any enemy.

import type { Bundle } from '../bundle/bundle.ts';
import { localize } from '../domain/localize.ts';
import { document, table } from '../markdown/markdown.ts';
import { formatValue, formatValues, KNOWLEDGE_LEGEND } from './format-value.ts';

export function renderEnemies(bundle: Bundle): string {
  const enemies = bundle.entities.map(({ doc }) => doc).filter((entity) => entity.id.startsWith('enemy:'));
  const statNames = [...new Set(enemies.flatMap((enemy) => Object.keys(enemy.stats ?? {})))].sort();
  const rows = enemies.map((enemy) => [
    enemy.id,
    localize(enemy.name),
    ...statNames.map((name) => formatValue(enemy.stats?.[name])),
    formatValues(enemy.weak_to),
    formatValues(enemy.drops),
    enemy.behavior ?? '-',
  ]);
  return document([
    '# 敵図鑑',
    KNOWLEDGE_LEGEND,
    enemies.length === 0 ? '敵はいません。' : table(['ID', '名前', ...statNames, '弱点', 'ドロップ', '行動 (状態機械)'], rows),
  ]);
}
