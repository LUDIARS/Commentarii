// Where map nodes are on the sim's ground plane, and which node a position belongs to.
//   grid      node cell [col, row] * gridCell
//   navgraph  node pos ([x, y] or [x, y, z] -> ground x / z)
//   zones     concentric rings around the first node, one ring per breadth-first depth
//             (nodeSpacing apart): a position belongs to the ring nearest its radius. This
//             fits arena-like zone maps (center / mid ring / outer ring / outside).
// A map without usable positions is laid out as rings too.

import type { GuideMap, MapNode } from '../../domain/documents.ts';

export type Point = readonly [number, number];

export interface SimLayout {
  /** The node a position is in (undefined on a map without nodes). */
  nodeOf(pos: Point): string | undefined;
  /** Where to walk to reach `node` from `from`. */
  pointOf(node: string, from: Point): Point | undefined;
  /** Spawn position of the k-th of n things spawning at `node`. */
  spawnPoint(node: string | undefined, k: number, n: number): Point;
}

const SPAWN_SPREAD = 2;

function angleOf(k: number, n: number): number {
  return (2 * Math.PI * k) / Math.max(n, 1);
}

function ringDepths(map: GuideMap): Map<string, number> {
  const neighbours = new Map<string, string[]>(map.nodes.map((node) => [node.id, []]));
  for (const edge of map.edges) {
    neighbours.get(edge.from)?.push(edge.to);
    if (edge.directed !== true) neighbours.get(edge.to)?.push(edge.from);
  }
  const depths = new Map<string, number>();
  const first = map.nodes[0]?.id;
  if (first === undefined) return depths;
  depths.set(first, 0);
  let frontier = [first];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const neighbour of neighbours.get(node) ?? []) {
        if (depths.has(neighbour)) continue;
        depths.set(neighbour, (depths.get(node) ?? 0) + 1);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  // Nodes unreachable from the first one go one ring further out than the deepest.
  const deepest = Math.max(0, ...depths.values());
  for (const node of map.nodes) if (!depths.has(node.id)) depths.set(node.id, deepest + 1);
  return depths;
}

function ringLayout(radii: ReadonlyMap<string, number>): SimLayout {
  const order = [...radii];
  return {
    nodeOf(pos) {
      const radius = Math.hypot(pos[0], pos[1]);
      let best: string | undefined;
      let bestGap = Number.POSITIVE_INFINITY;
      for (const [node, ring] of order) {
        const gap = Math.abs(radius - ring);
        if (gap < bestGap) [best, bestGap] = [node, gap];
      }
      return best;
    },
    pointOf(node, from) {
      const ring = radii.get(node);
      if (ring === undefined) return undefined;
      const length = Math.hypot(from[0], from[1]);
      return length === 0 ? [ring, 0] : [(from[0] / length) * ring, (from[1] / length) * ring];
    },
    spawnPoint(node, k, n) {
      const ring = node === undefined ? 0 : (radii.get(node) ?? 0);
      const radius = ring > 0 ? ring : SPAWN_SPREAD;
      const angle = angleOf(k, n);
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    },
  };
}

function pointLayout(points: ReadonlyMap<string, Point>): SimLayout {
  return {
    nodeOf(pos) {
      let best: string | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const [node, point] of points) {
        const d = Math.hypot(pos[0] - point[0], pos[1] - point[1]);
        if (d < bestDistance) [best, bestDistance] = [node, d];
      }
      return best;
    },
    pointOf: (node) => points.get(node),
    spawnPoint(node, k, n) {
      const base = (node === undefined ? undefined : points.get(node)) ?? [0, 0];
      const angle = angleOf(k, n);
      return [base[0] + SPAWN_SPREAD * Math.cos(angle), base[1] + SPAWN_SPREAD * Math.sin(angle)];
    },
  };
}

function positionOf(node: MapNode, map: GuideMap, gridCell: number): Point | undefined {
  if (map.kind === 'grid' && node.cell !== undefined) return [node.cell[0] * gridCell, node.cell[1] * gridCell];
  const pos = node.pos;
  if (pos === undefined || pos.length < 2) return undefined;
  return pos.length >= 3 ? [pos[0] ?? 0, pos[2] ?? 0] : [pos[0] ?? 0, pos[1] ?? 0];
}

export function createSimLayout(map: GuideMap | undefined, nodeSpacing: number, gridCell: number): SimLayout {
  if (map === undefined || map.nodes.length === 0) return ringLayout(new Map());
  if (map.kind !== 'zones') {
    const points = new Map<string, Point>();
    for (const node of map.nodes) {
      const point = positionOf(node, map, gridCell);
      if (point !== undefined) points.set(node.id, point);
    }
    if (points.size === map.nodes.length) return pointLayout(points);
  }
  return ringLayout(new Map([...ringDepths(map)].map(([node, depth]) => [node, depth * nodeSpacing])));
}
