// Lookup tables of bundle.json: ID -> position, render signature -> entity, stage adjacency.
// Built from the documents that are being exported, so a player export never indexes a
// record the player view dropped.

import type { GuideMap } from '../domain/documents.ts';
import type { ExportedDocuments, ExportIndex, IndexEntry } from './exported-bundle.ts';

function adjacencyOf(map: GuideMap): Record<string, string[]> {
  const neighbours = new Map<string, Set<string>>(map.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of map.edges) {
    neighbours.get(edge.from)?.add(edge.to);
    if (edge.directed !== true) neighbours.get(edge.to)?.add(edge.from);
  }
  const table: Record<string, string[]> = {};
  for (const [node, set] of [...neighbours].sort(([a], [b]) => a.localeCompare(b))) table[node] = [...set].sort();
  return table;
}

export function buildExportIndex(documents: ExportedDocuments): ExportIndex {
  const ids: Record<string, IndexEntry> = {};
  const add = (id: string, entry: IndexEntry): void => {
    // The first document wins, as in the loader's own index (duplicates are a validate error).
    if (!Object.hasOwn(ids, id)) ids[id] = entry;
  };
  documents.entities.forEach(({ path, doc }, i) => add(doc.id, { kind: 'entity', path, pointer: `/documents/entities/${i}` }));
  documents.stages.forEach((stage, i) => {
    if (stage.stage) add(stage.stage.doc.id, { kind: 'stage', path: stage.stage.path, pointer: `/documents/stages/${i}/stage` });
  });
  documents.rules.forEach(({ path, doc }, i) => add(doc.id, { kind: 'rule', path, pointer: `/documents/rules/${i}` }));
  documents.states.forEach(({ path, doc }, i) => add(doc.id, { kind: 'state', path, pointer: `/documents/states/${i}` }));
  documents.tactics.forEach(({ path, doc }, i) => add(doc.id, { kind: 'tactic', path, pointer: `/documents/tactics/${i}` }));
  documents.intents.forEach(({ path, doc }, i) => {
    doc.intended.forEach((item, j) => add(item.id, { kind: 'intent', path, pointer: `/documents/intents/${i}/doc/intended/${j}` }));
  });

  const renderSignatures: Record<string, string> = {};
  for (const { doc } of documents.entities) {
    for (const key of [doc.render_signature?.mesh, doc.render_signature?.sprite]) {
      if (key !== undefined && !Object.hasOwn(renderSignatures, key)) renderSignatures[key] = doc.id;
    }
  }

  const adjacency: Record<string, Record<string, string[]>> = {};
  for (const stage of documents.stages) {
    if (stage.map) adjacency[stage.map.doc.stage] = adjacencyOf(stage.map.doc);
  }
  return { ids, render_signatures: renderSignatures, adjacency };
}
