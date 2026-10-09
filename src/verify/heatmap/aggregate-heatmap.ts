// Stage traces -> heatmap panels (design 14.H, spec/feature/intent-verify.md 8): per map node the
// visits, deaths and dwell seconds, and the node-to-node moves, summed per group: all runs, each
// autoplay persona, and the human runs (side by side in one picture).

import { HUMAN_PERSONA } from '../runs/select-runs.ts';
import type { NodeMove, NodeTally, StageTrace } from '../runs/stage-trace.ts';

export interface HeatPanel {
  /** all | persona:<slug> | human */
  readonly group: string;
  readonly runs: number;
  readonly nodes: Readonly<Record<string, NodeTally>>;
  readonly moves: readonly NodeMove[];
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function sum(group: string, traces: readonly StageTrace[]): HeatPanel {
  const nodes: Record<string, { visits: number; dwellSec: number; deaths: number }> = {};
  const moves = new Map<string, { from: string; to: string; count: number }>();
  for (const trace of traces) {
    for (const [node, tally] of Object.entries(trace.nodes)) {
      const entry = (nodes[node] ??= { visits: 0, dwellSec: 0, deaths: 0 });
      entry.visits += tally.visits;
      entry.dwellSec = round(entry.dwellSec + tally.dwellSec);
      entry.deaths += tally.deaths;
    }
    for (const move of trace.moves) {
      const key = JSON.stringify([move.from, move.to]);
      const entry = moves.get(key) ?? { from: move.from, to: move.to, count: 0 };
      entry.count += move.count;
      moves.set(key, entry);
    }
  }
  const sortedNodes = Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const sortedMoves = [...moves.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, move]) => move);
  return { group, runs: traces.length, nodes: sortedNodes, moves: sortedMoves };
}

export function aggregateHeatmap(traces: readonly StageTrace[]): HeatPanel[] {
  const personas = [...new Set(traces.filter((trace) => trace.side === 'autoplay').map((trace) => trace.persona))].sort();
  const human = traces.filter((trace) => trace.side === 'human');
  return [
    sum('all', traces),
    ...personas.map((persona) => sum(`persona:${persona}`, traces.filter((trace) => trace.side === 'autoplay' && trace.persona === persona))),
    ...(human.length === 0 ? [] : [sum(HUMAN_PERSONA, human)]),
  ];
}
