// One stage: objectives, clear conditions, spawn table, events and map.

import type { StageFiles } from '../bundle/bundle.ts';
import type { Spawn } from '../domain/documents.ts';
import { localize } from '../domain/localize.ts';
import { document, table } from '../markdown/markdown.ts';
import { formatValue, KNOWLEDGE_LEGEND } from './format-value.ts';
import { renderMap } from './render-map.ts';

function spawnRows(spawns: readonly Spawn[], origin: string): string[][] {
  return spawns.map((spawn) => [origin, spawn.entity, formatValue(spawn.count), spawn.at ?? '-', spawn.wave === undefined ? '-' : String(spawn.wave)]);
}

export function renderStage(stage: StageFiles): string {
  const doc = stage.stage?.doc;
  const title = doc ? `# ${localize(doc.name)} (${doc.id})` : `# stages/${stage.slug}`;
  const objectives = doc ? doc.objectives.map((objective) => `- ${formatValue(objective)}`).join('\n') : '';
  const conditions = doc?.clear_conditions?.map((condition) => `- ${formatValue(condition)}`).join('\n') ?? '';
  const events = stage.events?.doc.events ?? [];
  const spawns = [
    ...spawnRows(doc?.spawns ?? [], '開始時'),
    ...events.flatMap((event) => spawnRows(event.spawns ?? [], `イベント ${event.id}`)),
  ];
  const eventRows = events.map((event) => [
    event.id,
    event.trigger.kind === 'time' ? `${formatValue(event.trigger.at_sec)} 経過` : formatValue(event.trigger.condition),
    formatValue(event.description),
  ]);
  return document([
    title,
    KNOWLEDGE_LEGEND,
    objectives === '' ? '' : `## 目標\n\n${objectives}`,
    conditions === '' ? '' : `## クリア条件\n\n${conditions}`,
    doc?.time_limit ? `制限時間: ${formatValue(doc.time_limit)}` : '',
    spawns.length === 0 ? '' : `## 出現表\n\n${table(['契機', 'エンティティ', '数', '場所', 'ウェーブ'], spawns)}`,
    eventRows.length === 0 ? '' : `## イベント\n\n${table(['ID', '契機', '内容'], eventRows)}`,
    stage.map ? renderMap(stage.map.doc) : '',
  ]);
}
