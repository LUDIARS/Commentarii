// C-55 drawHeatmap(input): the SVG is well-formed and has one panel per input panel, a forbid
// element per forbid area on the map in every panel, an intent-route element per route intent
// with two nodes on the map in every panel, and a run-path element per move between map nodes.

import type { HeatmapInput } from '../render/heatmap/draw-heatmap.ts';
import { wellFormedProblems } from '../render/heatmap/well-formed.ts';

function count(svg: string, needle: string): number {
  return svg.split(needle).length - 1;
}

export default {
  post: (svg: string, input: HeatmapInput) => {
    const problems = wellFormedProblems(svg);
    if (problems.length > 0) return `not well-formed: ${problems.join('; ')}`;
    const nodes = new Set(input.map.nodes.map((node) => node.id));
    const panels = Math.max(1, input.panels.length);
    if (count(svg, 'class="panel"') !== panels) return `expected ${panels} panel(s)`;
    const forbid = input.overlay.forbid.filter((area) => nodes.has(area)).length;
    if (count(svg, 'class="forbid"') !== forbid * panels) return `expected ${forbid * panels} forbid element(s)`;
    const routes = input.overlay.routes.filter((path) => path.filter((node) => nodes.has(node)).length >= 2).length;
    if (count(svg, 'class="intent-route"') !== routes * panels) return `expected ${routes * panels} intent-route element(s)`;
    const moves = input.panels.reduce((sum, panel) => sum + panel.moves.filter((move) => nodes.has(move.from) && nodes.has(move.to)).length, 0);
    if (count(svg, 'class="run-path"') !== moves) return `expected ${moves} run-path element(s)`;
    return true;
  },
};
