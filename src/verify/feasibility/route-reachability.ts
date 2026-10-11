// A proof that a route cannot be walked on the stage map (Astra review P1-3): "impossible" is
// reserved for a structural reason, never for "no run succeeded". A route is unwalkable when it
// names a node the map does not have, or when the map has no path (edges, honouring directed)
// from one route node to the next. The full map is used: what the player is not shown can still
// be walked, and only the map itself can prove it cannot.

import type { GuideMap } from '../../domain/documents.ts';

function adjacency(map: GuideMap): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>();
  const link = (from: string, to: string): void => {
    const targets = next.get(from) ?? new Set<string>();
    targets.add(to);
    next.set(from, targets);
  };
  for (const edge of map.edges) {
    link(edge.from, edge.to);
    if (edge.directed !== true) link(edge.to, edge.from);
  }
  return next;
}

function connected(next: ReadonlyMap<string, ReadonlySet<string>>, from: string, to: string): boolean {
  if (from === to) return true;
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const node = queue.shift() as string;
    for (const target of next.get(node) ?? []) {
      if (target === to) return true;
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return false;
}

/** Why the route cannot be walked on the map, or undefined when nothing proves it. */
export function unwalkableRoute(route: readonly string[], map: GuideMap | undefined): string | undefined {
  if (map === undefined || route.length === 0) return undefined;
  const nodes = new Set(map.nodes.map((node) => node.id));
  const missing = route.find((node) => !nodes.has(node));
  if (missing !== undefined) return `${missing} is not on the stage map`;
  const next = adjacency(map);
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1] as string;
    const to = route[index] as string;
    if (!connected(next, from, to)) return `the map has no path from ${from} to ${to}`;
  }
  return undefined;
}
