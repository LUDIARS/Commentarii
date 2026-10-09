// Zones -> map.json: each area becomes a node at its centroid (mean of the polygon vertices,
// or the rectangle centre); each adjacency becomes an edge. The area outline itself is not
// part of map.json (design 4.5 keeps nodes + edges + annotations only).

import type { GuideMap } from '../../domain/documents.ts';
import { ImportError } from '../import-error.ts';
import { assertDeclaredCoordinates, assertPoint } from './check-coordinates.ts';
import { convertAnnotations, convertEdges, knowledgeOr, toNodeId } from './convert-links.ts';
import type { Coordinates, InputZone, MapImportRequest } from './map-request.ts';

type ZonesRequest = Extract<MapImportRequest, { kind: 'zones' }>;

function mean(points: readonly (readonly number[])[]): number[] {
  const axes = points[0]?.length ?? 0;
  return Array.from({ length: axes }, (_, axis) => points.reduce((sum, point) => sum + (point[axis] ?? 0), 0) / points.length);
}

function centroid(zone: InputZone, coordinates: Coordinates, where: string): number[] {
  const points = zone.polygon ?? (zone.rect ? [zone.rect.min, zone.rect.max] : undefined);
  if (points === undefined) throw new ImportError(`${where} has neither polygon nor rect`);
  points.forEach((point, position) => assertPoint(coordinates, point, `${where} point ${position + 1}`));
  return mean(points);
}

export function zonesToMap(request: ZonesRequest): GuideMap {
  const { input, coordinates, sourceName } = request;
  assertDeclaredCoordinates(coordinates, input.coordinates, sourceName);
  const nodes = input.zones.map((zone) => {
    const id = toNodeId(zone.id);
    const pos = centroid(zone, coordinates, `${sourceName} ${id}`);
    return { id, ...(zone.label !== undefined ? { label: zone.label } : {}), pos, knowledge: knowledgeOr(zone.knowledge) };
  });
  return {
    stage: request.stageId,
    kind: 'zones',
    source: { kind: 'master', ref: sourceName },
    nodes,
    edges: convertEdges(input.adjacency),
    annotations: convertAnnotations(input.annotations),
  };
}
