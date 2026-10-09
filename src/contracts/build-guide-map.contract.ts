// C-13 buildGuideMap(request): the requested kind and stage, unique node IDs, and every edge
// end and annotation target is a node of the map.

import type { GuideMap } from '../domain/documents.ts';
import type { MapImportRequest } from '../import/map/map-request.ts';

export default {
  post: (map: GuideMap, request: MapImportRequest) => {
    if (map.kind !== request.kind) return `kind ${map.kind} differs from the request ${request.kind}`;
    if (map.stage !== request.stageId) return `stage ${map.stage} differs from the request ${request.stageId}`;
    const ids = new Set(map.nodes.map((node) => node.id));
    if (ids.size !== map.nodes.length) return 'node IDs are not unique';
    if (map.edges.some((edge) => !ids.has(edge.from) || !ids.has(edge.to))) return 'an edge points at a missing node';
    return map.annotations.every((annotation) => ids.has(annotation.target)) || 'an annotation targets a missing node';
  },
};
