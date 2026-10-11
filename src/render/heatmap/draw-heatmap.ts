// Route / death heatmap of one stage as SVG (design 14.H, spec/feature/intent-verify.md 8): one
// panel per group (all runs, each persona, humans) side by side. Nodes are shaded by visits,
// moves are lines as thick as their count (run-path), deaths are red marks, and the intent's
// route (dashed, intent-route) and forbid areas (red frame, forbid) are drawn over every panel.

import type { GuideMap } from '../../domain/documents.ts';
import { layoutMap, type NodeShape, type PanelBox } from './map-layout.ts';
import { element, escapeXml, heatColor, svgDocument, text } from './svg.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:7b6c9196 */
import augurContract_1e13cc6f from '../../contracts/draw-heatmap.contract.ts'; /* augur-inject:contract-predicate:eb329d6f */

export interface HeatmapNodeTally {
  readonly visits: number;
  readonly dwellSec: number;
  readonly deaths: number;
}

export interface HeatmapPanel {
  readonly group: string;
  readonly runs: number;
  readonly nodes: Readonly<Record<string, HeatmapNodeTally>>;
  readonly moves: readonly { readonly from: string; readonly to: string; readonly count: number }[];
}

export interface HeatmapOverlay {
  /** Paths of the stage's route intents. */
  readonly routes: readonly (readonly string[])[];
  /** Areas of the stage's forbid intents. */
  readonly forbid: readonly string[];
}

export interface HeatmapInput {
  readonly title: string;
  readonly map: GuideMap;
  readonly panels: readonly HeatmapPanel[];
  readonly overlay: HeatmapOverlay;
}

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 220;
const GAP = 20;
const HEADER = 28;
const FOOTER = 34;

function nodeShape(id: string, shape: NodeShape, attrs: Record<string, string | number>): string {
  if (shape.rect !== undefined) return element('rect', { ...attrs, ...shape.rect, rx: 3 });
  return element('circle', { ...attrs, cx: shape.cx, cy: shape.cy, r: shape.radius ?? 10, 'data-node': id });
}

function drawNodes(map: GuideMap, shapes: ReadonlyMap<string, NodeShape>, panel: HeatmapPanel, maxVisits: number): string[] {
  return map.nodes.flatMap((node) => {
    const shape = shapes.get(node.id);
    if (shape === undefined) return [];
    const tally = panel.nodes[node.id] ?? { visits: 0, dwellSec: 0, deaths: 0 };
    const fill = heatColor(maxVisits === 0 ? 0 : tally.visits / maxVisits);
    return [
      element('g', { class: 'node', 'data-node': node.id, 'data-visits': tally.visits, 'data-deaths': tally.deaths, 'data-dwell-sec': tally.dwellSec }, [
        element('title', {}, escapeXml(`${node.id}: visits ${tally.visits}, deaths ${tally.deaths}, dwell ${tally.dwellSec}s`)),
        nodeShape(node.id, shape, { fill, stroke: '#888888', 'stroke-width': 1 }),
        text({ x: shape.cx, y: shape.cy - 2, 'text-anchor': 'middle', fill: '#333333' }, node.id.replace(/^node:/, '')),
        text({ x: shape.cx, y: shape.cy + 11, 'text-anchor': 'middle', fill: '#555555', 'font-size': 9 }, `${tally.visits}`),
      ]),
    ];
  });
}

function drawEdges(map: GuideMap, shapes: ReadonlyMap<string, NodeShape>): string[] {
  if (map.kind !== 'navgraph') return [];
  return map.edges.flatMap((edge) => {
    const [from, to] = [shapes.get(edge.from), shapes.get(edge.to)];
    if (from === undefined || to === undefined) return [];
    return [element('line', { class: 'edge', x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, stroke: '#cccccc', 'stroke-width': 1 })];
  });
}

function drawMoves(panel: HeatmapPanel, shapes: ReadonlyMap<string, NodeShape>): string[] {
  const max = Math.max(1, ...panel.moves.map((move) => move.count));
  return panel.moves.flatMap((move) => {
    const [from, to] = [shapes.get(move.from), shapes.get(move.to)];
    if (from === undefined || to === undefined) return [];
    return [
      element('line', {
        class: 'run-path',
        'data-from': move.from,
        'data-to': move.to,
        'data-count': move.count,
        x1: from.cx,
        y1: from.cy + 6,
        x2: to.cx,
        y2: to.cy + 6,
        stroke: '#2b6cb0',
        'stroke-opacity': 0.7,
        'stroke-width': 1 + (5 * move.count) / max,
      }),
    ];
  });
}

function drawOverlay(overlay: HeatmapOverlay, shapes: ReadonlyMap<string, NodeShape>): string[] {
  const routes = overlay.routes.flatMap((path) => {
    const points = path.flatMap((node) => {
      const shape = shapes.get(node);
      return shape === undefined ? [] : [`${Math.round(shape.cx * 100) / 100},${Math.round((shape.cy - 8) * 100) / 100}`];
    });
    if (points.length < 2) return [];
    return [element('polyline', { class: 'intent-route', points: points.join(' '), fill: 'none', stroke: '#2f855a', 'stroke-width': 2, 'stroke-dasharray': '6 4' })];
  });
  const forbid = overlay.forbid.flatMap((area) => {
    const shape = shapes.get(area);
    if (shape === undefined) return [];
    return [element('g', { class: 'forbid', 'data-node': area }, [nodeShape(area, shape, { fill: 'none', stroke: '#c53030', 'stroke-width': 3 })])];
  });
  return [...routes, ...forbid];
}

function drawDeaths(panel: HeatmapPanel, shapes: ReadonlyMap<string, NodeShape>): string[] {
  return Object.entries(panel.nodes).flatMap(([node, tally]) => {
    const shape = shapes.get(node);
    if (shape === undefined || tally.deaths === 0) return [];
    const x = shape.cx + (shape.rect === undefined ? (shape.radius ?? 10) : Math.min(18, shape.rect.width / 3));
    const y = shape.cy - 12;
    return [element('g', { class: 'death', 'data-node': node, 'data-deaths': tally.deaths }, [element('circle', { cx: x, cy: y, r: 6, fill: '#e53e3e' }), text({ x, y: y + 3, 'text-anchor': 'middle', fill: '#ffffff', 'font-size': 8 }, `${tally.deaths}`)])];
  });
}

function drawPanel(input: HeatmapInput, panel: HeatmapPanel, index: number): string {
  const left = GAP + index * (PANEL_WIDTH + GAP);
  const box: PanelBox = { x: left + 8, y: HEADER + 8, width: PANEL_WIDTH - 16, height: PANEL_HEIGHT - 16 };
  const shapes = layoutMap(input.map, box);
  const maxVisits = Math.max(0, ...Object.values(panel.nodes).map((tally) => tally.visits));
  return element('g', { class: 'panel', 'data-group': panel.group }, [
    element('rect', { x: left, y: HEADER, width: PANEL_WIDTH, height: PANEL_HEIGHT, fill: 'none', stroke: '#dddddd' }),
    text({ x: left, y: HEADER - 8, 'font-size': 12, 'font-weight': 'bold' }, `${panel.group} (${panel.runs} run)`),
    ...drawEdges(input.map, shapes),
    ...drawNodes(input.map, shapes, panel, maxVisits),
    ...drawMoves(panel, shapes),
    ...drawOverlay(input.overlay, shapes),
    ...drawDeaths(panel, shapes),
  ]);
}

export function drawHeatmap(input: HeatmapInput): string {
  const panels = input.panels.length === 0 ? [{ group: 'all', runs: 0, nodes: {}, moves: [] }] : input.panels;
  const width = GAP + panels.length * (PANEL_WIDTH + GAP);
  const height = HEADER + PANEL_HEIGHT + FOOTER;
  const legend = text({ x: GAP, y: HEADER + PANEL_HEIGHT + 22, fill: '#555555' }, '濃さ = 到達回数 / 青線 = 移動 (太さ = 回数) / 赤丸 = 死亡 / 緑破線 = 意図の経路 / 赤枠 = 入ってほしくない場所 (forbid)');
  return svgDocument(width, height, input.title, [...panels.map((panel, index) => drawPanel(input, panel, index)), legend]);
}
// @ts-expect-error augur-inject
drawHeatmap = contract(drawHeatmap, { ...augurContract_1e13cc6f, contractId: 'C-55', mode: 'observe', sample: 1, where: 'src/render/heatmap/draw-heatmap.ts:140', rule: 'contract-wrap', id: '1e13cc6f' }); /* augur-inject:contract-wrap:1e13cc6f */
