// Node IDs, edges and annotations of navgraph / zones inputs -> map.json shape. Every boundary
// left out becomes masked (principle 1).

import type { MapAnnotation, MapEdge } from '../../domain/documents.ts';
import type { Knowledge } from '../../domain/knowledge.ts';
import { DEFAULT_KNOWLEDGE } from '../mapping.ts';
import type { InputAnnotation, InputEdge } from './map-request.ts';

/** `entrance` and `node:entrance` both name node:entrance (map nodes are stage-local). */
export function toNodeId(name: string): string {
  return name.startsWith('node:') ? name : `node:${name}`;
}

export function knowledgeOr(knowledge: Knowledge | undefined): Knowledge {
  return knowledge ?? DEFAULT_KNOWLEDGE;
}

export function convertEdges(edges: readonly InputEdge[]): MapEdge[] {
  return edges.map((edge) => ({
    from: toNodeId(edge.from),
    to: toNodeId(edge.to),
    ...(edge.directed !== undefined ? { directed: edge.directed } : {}),
    ...(edge.cost !== undefined ? { cost: edge.cost } : {}),
    knowledge: knowledgeOr(edge.knowledge),
  }));
}

export function convertAnnotations(annotations: readonly InputAnnotation[] | undefined): MapAnnotation[] {
  return (annotations ?? []).map((annotation) => ({
    target: toNodeId(annotation.target),
    kind: annotation.kind,
    ...(annotation.ref !== undefined ? { ref: annotation.ref } : {}),
    ...(annotation.note !== undefined ? { note: annotation.note } : {}),
    knowledge: knowledgeOr(annotation.knowledge),
  }));
}
