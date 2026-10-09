// Grid -> map.json: one node per walkable cell (cell = [x, y], y counts rows from the top),
// one undirected edge per pair of walkable 4-neighbours, and with 8 neighbours also the
// diagonals whose two orthogonal cells are walkable (no corner cutting). Legend annotations
// attach to their cell.

import type { GuideMap, MapAnnotation, MapEdge, MapNode } from '../../domain/documents.ts';
import { ImportError } from '../import-error.ts';
import { DEFAULT_KNOWLEDGE, type GridLegendEntry } from '../mapping.ts';
import { assertGridUnit } from './check-coordinates.ts';
import type { MapImportRequest } from './map-request.ts';

type GridRequest = Extract<MapImportRequest, { kind: 'grid' }>;

const ORTHOGONAL_COST = 1;
const DIAGONAL_COST = Math.SQRT2;

function cellNodeId(x: number, y: number): string {
  return `node:x${x}-y${y}`;
}

function legendGrid(request: GridRequest): (GridLegendEntry | undefined)[][] {
  return request.cells.map((row, y) =>
    row.map((cell, x) => {
      const entry = request.grid.legend[cell];
      if (entry === undefined) throw new ImportError(`${request.sourceName} row ${y + 1} column ${x + 1}: '${cell}' is not in the grid legend`);
      return entry;
    }),
  );
}

export function gridToMap(request: GridRequest): GuideMap {
  assertGridUnit(request.coordinates, request.grid.unit, request.sourceName);
  const entries = legendGrid(request);
  const width = Math.max(...entries.map((row) => row.length));
  const height = entries.length;
  const walkable = (x: number, y: number): boolean => entries[y]?.[x]?.walkable === true;
  const knowledge = request.grid.knowledge ?? DEFAULT_KNOWLEDGE;

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const annotations: MapAnnotation[] = [];
  const link = (x: number, y: number, toX: number, toY: number, cost: number): void => {
    if (walkable(toX, toY)) edges.push({ from: cellNodeId(x, y), to: cellNodeId(toX, toY), cost, knowledge });
  };
  entries.forEach((row, y) =>
    row.forEach((entry, x) => {
      if (entry === undefined) return;
      if (!entry.walkable) {
        if (entry.annotation !== undefined) throw new ImportError(`${request.sourceName}: annotation '${entry.annotation}' is on a cell that is not walkable`);
        return;
      }
      const id = cellNodeId(x, y);
      nodes.push({ id, cell: [x, y], knowledge });
      if (entry.annotation !== undefined) {
        annotations.push({
          target: id,
          kind: entry.annotation,
          ...(entry.note !== undefined ? { note: entry.note } : {}),
          knowledge: entry.knowledge ?? knowledge,
        });
      }
      link(x, y, x + 1, y, ORTHOGONAL_COST);
      link(x, y, x, y + 1, ORTHOGONAL_COST);
      if (request.neighbors === 8) {
        if (walkable(x + 1, y) && walkable(x, y + 1)) link(x, y, x + 1, y + 1, DIAGONAL_COST);
        if (walkable(x - 1, y) && walkable(x, y + 1)) link(x, y, x - 1, y + 1, DIAGONAL_COST);
      }
    }),
  );
  if (nodes.length === 0) throw new ImportError(`${request.sourceName} has no walkable cell`);
  return {
    stage: request.stageId,
    kind: 'grid',
    size: [width, height],
    source: { kind: 'master', ref: request.sourceName },
    nodes,
    edges,
    annotations,
  };
}
