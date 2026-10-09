// 地図: grid as ASCII, navgraph as a Mermaid graph, zones as an adjacency table.

import type { AnnotationKind, GuideMap } from '../domain/documents.ts';
import { localize } from '../domain/localize.ts';
import { codeBlock, document, table } from '../markdown/markdown.ts';

const WALL = '#';
const FLOOR = '.';
const ANNOTATION_GLYPH: Readonly<Record<AnnotationKind, string>> = {
  hazard: '!',
  resource: '$',
  shortcut: '>',
  spawn: 'S',
  wanted: '+',
  unwanted: 'x',
};

function nodeLabel(map: GuideMap, id: string): string {
  const node = map.nodes.find((candidate) => candidate.id === id);
  return node?.label ? localize(node.label) : id;
}

function renderGrid(map: GuideMap): string {
  const [width, height] = map.size ?? [0, 0];
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => WALL));
  const cellOf = new Map<string, readonly [number, number]>();
  for (const node of map.nodes) {
    if (node.cell === undefined) continue;
    const [x, y] = node.cell;
    const row = rows[y];
    if (row === undefined || x >= width) continue;
    row[x] = FLOOR;
    cellOf.set(node.id, node.cell);
  }
  for (const annotation of map.annotations) {
    const cell = cellOf.get(annotation.target);
    const row = cell ? rows[cell[1]] : undefined;
    if (cell && row) row[cell[0]] = ANNOTATION_GLYPH[annotation.kind];
  }
  const legend = `${WALL} 壁 / ${FLOOR} 通路 / ${Object.entries(ANNOTATION_GLYPH)
    .map(([kind, glyph]) => `${glyph} ${kind}`)
    .join(' / ')}`;
  return document([codeBlock('text', rows.map((row) => row.join('')).join('\n')), legend]).trimEnd();
}

function mermaidId(id: string): string {
  return id.replaceAll(/[^A-Za-z0-9_]/g, '_');
}

function renderNavgraph(map: GuideMap): string {
  const lines = ['graph LR'];
  for (const node of map.nodes) lines.push(`  ${mermaidId(node.id)}["${nodeLabel(map, node.id).replaceAll('"', "'")}"]`);
  for (const edge of map.edges) {
    const arrow = edge.directed ? '-->' : '---';
    const cost = edge.cost === undefined ? '' : `|${edge.cost}|`;
    lines.push(`  ${mermaidId(edge.from)} ${arrow}${cost} ${mermaidId(edge.to)}`);
  }
  return codeBlock('mermaid', lines.join('\n'));
}

function renderZones(map: GuideMap): string {
  const rows = map.nodes.map((node) => {
    const adjacent = map.edges
      .flatMap((edge) => {
        if (edge.from === node.id) return [edge.to];
        if (edge.to === node.id && !edge.directed) return [edge.from];
        return [];
      })
      .map((id) => nodeLabel(map, id));
    return [nodeLabel(map, node.id), adjacent.join(', ') || '-'];
  });
  return table(['ゾーン', '隣接'], rows);
}

function renderAnnotations(map: GuideMap): string {
  if (map.annotations.length === 0) return '';
  return table(
    ['場所', '種別', '参照', '注記'],
    map.annotations.map((annotation) => [nodeLabel(map, annotation.target), annotation.kind, annotation.ref ?? '-', localize(annotation.note) || '-']),
  );
}

export function renderMap(map: GuideMap): string {
  const body = map.kind === 'grid' ? renderGrid(map) : map.kind === 'navgraph' ? renderNavgraph(map) : renderZones(map);
  return document([`### 地図 (${map.kind})`, body, renderAnnotations(map)]).trimEnd();
}
