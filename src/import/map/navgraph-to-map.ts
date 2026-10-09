// Navgraph -> map.json: nodes keep their positions, edges and annotations are normalized.

import type { GuideMap } from '../../domain/documents.ts';
import { assertDeclaredCoordinates, assertPoint } from './check-coordinates.ts';
import { convertAnnotations, convertEdges, knowledgeOr, toNodeId } from './convert-links.ts';
import type { MapImportRequest } from './map-request.ts';

type NavgraphRequest = Extract<MapImportRequest, { kind: 'navgraph' }>;

export function navgraphToMap(request: NavgraphRequest): GuideMap {
  const { input, coordinates, sourceName } = request;
  assertDeclaredCoordinates(coordinates, input.coordinates, sourceName);
  const nodes = input.nodes.map((node) => {
    const id = toNodeId(node.id);
    assertPoint(coordinates, node.pos, `${sourceName} ${id}`);
    return { id, ...(node.label !== undefined ? { label: node.label } : {}), pos: [...node.pos], knowledge: knowledgeOr(node.knowledge) };
  });
  return {
    stage: request.stageId,
    kind: 'navgraph',
    source: { kind: 'master', ref: sourceName },
    nodes,
    edges: convertEdges(input.edges),
    annotations: convertAnnotations(input.annotations),
  };
}
