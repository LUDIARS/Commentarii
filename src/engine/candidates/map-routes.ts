// Breadth-first search over a stage's node adjacency: the nearest node (by hops) that
// satisfies a predicate. Ties go to adjacency order (sorted IDs), so the result is stable.

import type { StageView } from '../world/engine-world.ts';

export function nearestNode(stage: StageView, from: string | undefined, accept: (node: string) => boolean): string | undefined {
  if (from === undefined || !stage.adjacency.has(from)) return stage.nodes.find(accept);
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of frontier) {
      if (accept(node)) return node;
      for (const neighbour of stage.adjacency.get(node) ?? []) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return undefined;
}
