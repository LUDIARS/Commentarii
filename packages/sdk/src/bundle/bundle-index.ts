// Lookup tables over a loaded bundle: which IDs exist, which knowledge each referable thing
// carries, which sub-states and map nodes exist. Shared by reference checks, knowledge
// propagation and the knowledge report.

import type { Knowledge } from '../domain/knowledge.ts';
import { findValueNodes, pointerToFieldPath } from '../domain/value-node.ts';
import type { Bundle } from './bundle.ts';

export interface IndexedRecord {
  readonly path: string;
  /** Record-level boundary (rules, state machines, tactics, intent items). Entities have none. */
  readonly knowledge?: Knowledge;
}

export interface BundleIndex {
  readonly gameId: string | undefined;
  readonly records: ReadonlyMap<string, IndexedRecord>;
  /** Public and masked documents of each entity, for field-path lookups. */
  readonly entityDocuments: ReadonlyMap<string, readonly unknown[]>;
  /** `<entity id>.<field path>` -> knowledge of every value stored there. */
  readonly valueKnowledge: ReadonlyMap<string, readonly Knowledge[]>;
  readonly subStates: ReadonlyMap<string, ReadonlySet<string>>;
  /** stage id -> node id -> knowledge. */
  readonly stageNodes: ReadonlyMap<string, ReadonlyMap<string, Knowledge>>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildBundleIndex(bundle: Bundle): BundleIndex {
  const records = new Map<string, IndexedRecord>();
  const register = (id: string, record: IndexedRecord): void => {
    if (!records.has(id)) records.set(id, record);
  };
  const entityDocuments = new Map<string, unknown[]>();
  const valueKnowledge = new Map<string, Knowledge[]>();
  const subStates = new Map<string, Set<string>>();
  const stageNodes = new Map<string, Map<string, Knowledge>>();

  for (const { path, doc } of [...bundle.entities, ...bundle.maskedEntities]) {
    if (!path.endsWith('.masked.json')) register(doc.id, { path });
    push(entityDocuments, doc.id, doc as unknown);
    for (const { node, pointer } of findValueNodes(doc)) {
      push(valueKnowledge, `${doc.id}.${pointerToFieldPath(pointer)}`, node.knowledge as Knowledge);
    }
  }
  for (const { path, doc } of bundle.stages.flatMap((stage) => (stage.stage ? [stage.stage] : []))) register(doc.id, { path });
  for (const { path, doc } of bundle.rules) register(doc.id, { path, knowledge: doc.knowledge });
  for (const { path, doc } of bundle.states) {
    register(doc.id, { path, knowledge: doc.knowledge });
    subStates.set(doc.id, new Set(doc.states.map((state) => state.id)));
  }
  for (const { path, doc } of bundle.tactics) register(doc.id, { path, knowledge: doc.knowledge });
  for (const { path, doc } of bundle.intents) {
    for (const item of doc.intended) register(item.id, item.knowledge ? { path, knowledge: item.knowledge } : { path });
  }
  for (const stage of bundle.stages) {
    if (!stage.map) continue;
    const nodes = new Map<string, Knowledge>();
    for (const node of stage.map.doc.nodes) nodes.set(node.id, node.knowledge);
    stageNodes.set(stage.map.doc.stage, nodes);
  }

  return {
    gameId: bundle.manifest?.doc.game_id,
    records,
    entityDocuments,
    valueKnowledge,
    subStates,
    stageNodes,
  };
}
