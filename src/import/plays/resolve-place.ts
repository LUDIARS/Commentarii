// Stage and map node cells -> guide IDs: the mapping's values table first, else the cell as an
// ID or slug that exists in the bundle. Raw game names never pass through unresolved.

import { isNodeId } from '../../domain/id.ts';
import type { LookupMapping } from './plays-mapping.ts';
import type { PlaysContext } from './plays-context.ts';

export function resolveStage(context: PlaysContext, lookup: LookupMapping, cell: string): string | undefined {
  const mapped = lookup.values?.[cell];
  if (mapped !== undefined) return mapped;
  if (context.stages.has(cell)) return cell;
  const bySlug = `stage:${context.gameId}:${cell}`;
  return context.stages.has(bySlug) ? bySlug : undefined;
}

export function resolveNode(context: PlaysContext, stageId: string, lookup: LookupMapping | undefined, cell: string): string | undefined {
  const mapped = lookup?.values?.[cell];
  if (mapped !== undefined) return isNodeId(mapped) ? mapped : undefined;
  const nodes = context.stages.get(stageId);
  if (nodes === undefined) return undefined;
  if (nodes.has(cell)) return cell;
  const bySlug = `node:${cell}`;
  return nodes.has(bySlug) ? bySlug : undefined;
}
