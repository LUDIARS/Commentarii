// `guide diff --explain` (design 14.I, stage 7I): what changed between two guides, by meaning.
// Records are matched by ID (entities, tactics, rules, states, stages; intent items by stage + item
// ID), so a moved file is not a change. Each change is mechanical: the numbers come from the two
// exports, never from prose. Both sides are exported with the same knowledge, so a player diff
// (the public one) is computed on player views and cannot carry a masked value.

import type { ExportedBundle, ExportedDocument, ExportKnowledge } from '../export/exported-bundle.ts';
import { isKnowledge, type Knowledge } from '../domain/knowledge.ts';
import { flattenDocument, type Leaf } from './flatten-document.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:d60f7c3e */
import augurContract_e5312268 from '../contracts/semantic-diff.contract.ts'; /* augur-inject:contract-predicate:9dd10bf8 */

export type RecordKind = 'entity' | 'masked-entity' | 'stage' | 'rule' | 'state' | 'tactic' | 'intent-item';

export type FieldChange =
  | { readonly kind: 'value'; readonly pointer: string; readonly before: unknown; readonly after: unknown; readonly delta?: number }
  | { readonly kind: 'boundary'; readonly pointer: string; readonly before: Knowledge; readonly after: Knowledge; readonly direction: 'promoted' | 'demoted' }
  | { readonly kind: 'added-field'; readonly pointer: string; readonly after: unknown }
  | { readonly kind: 'removed-field'; readonly pointer: string; readonly before: unknown };

export type RecordChange =
  | { readonly kind: 'added'; readonly record: RecordKind; readonly id: string }
  | { readonly kind: 'removed'; readonly record: RecordKind; readonly id: string }
  | { readonly kind: 'replaced'; readonly record: 'tactic'; readonly id: string; readonly by: string }
  | { readonly kind: 'changed'; readonly record: RecordKind; readonly id: string; readonly fields: readonly FieldChange[] };

export interface SemanticDiff {
  readonly knowledge: ExportKnowledge;
  readonly before: { readonly game_id: string | null; readonly version: string | null };
  readonly after: { readonly game_id: string | null; readonly version: string | null };
  readonly changes: readonly RecordChange[];
}

const STRICTNESS: Readonly<Record<Knowledge, number>> = { shown: 0, discoverable: 1, masked: 2 };

type Keyed = ReadonlyMap<string, unknown>;

function byId<T extends { readonly id: string }>(docs: readonly ExportedDocument<T>[]): Keyed {
  return new Map(docs.map(({ doc }) => [doc.id, doc]));
}

function stagesOf(bundle: ExportedBundle): Keyed {
  const stages = new Map<string, unknown>();
  for (const stage of bundle.documents.stages) if (stage.stage !== undefined) stages.set(stage.stage.doc.id, stage.stage.doc);
  return stages;
}

function intentItemsOf(bundle: ExportedBundle): Keyed {
  const items = new Map<string, unknown>();
  for (const { doc } of bundle.documents.intents) for (const item of doc.intended) items.set(`${doc.stage}#${item.id}`, item);
  return items;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function leafChange(pointer: string, before: Leaf, after: Leaf): FieldChange[] {
  const changes: FieldChange[] = [];
  const boundaryBefore = before.knowledge ?? (pointer.endsWith('/knowledge') && isKnowledge(before.value) ? before.value : undefined);
  const boundaryAfter = after.knowledge ?? (pointer.endsWith('/knowledge') && isKnowledge(after.value) ? after.value : undefined);
  if (boundaryBefore !== undefined && boundaryAfter !== undefined && boundaryBefore !== boundaryAfter) {
    const direction = STRICTNESS[boundaryAfter] < STRICTNESS[boundaryBefore] ? 'promoted' : 'demoted';
    changes.push({ kind: 'boundary', pointer, before: boundaryBefore, after: boundaryAfter, direction });
  }
  const isLabelLeaf = before.knowledge === undefined && pointer.endsWith('/knowledge') && boundaryBefore !== undefined;
  if (!isLabelLeaf && !same(before.value, after.value)) {
    const delta = typeof before.value === 'number' && typeof after.value === 'number' ? after.value - before.value : undefined;
    changes.push({ kind: 'value', pointer, before: before.value, after: after.value, ...(delta === undefined ? {} : { delta }) });
  }
  return changes;
}

export function diffRecord(before: unknown, after: unknown): FieldChange[] {
  const a = flattenDocument(before);
  const b = flattenDocument(after);
  const changes: FieldChange[] = [];
  for (const [pointer, leaf] of a) {
    const other = b.get(pointer);
    if (other === undefined) changes.push({ kind: 'removed-field', pointer, before: leaf.value });
    else changes.push(...leafChange(pointer, leaf, other));
  }
  for (const [pointer, leaf] of b) if (!a.has(pointer)) changes.push({ kind: 'added-field', pointer, after: leaf.value });
  return changes;
}

function supersededBy(record: unknown): string | null {
  const value = (record as { superseded_by?: unknown } | undefined)?.superseded_by;
  return typeof value === 'string' ? value : null;
}

function diffKind(record: RecordKind, before: Keyed, after: Keyed): RecordChange[] {
  const changes: RecordChange[] = [];
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const id of ids) {
    const a = before.get(id);
    const b = after.get(id);
    if (a === undefined) {
      changes.push({ kind: 'added', record, id });
      continue;
    }
    if (b === undefined) {
      changes.push({ kind: 'removed', record, id });
      continue;
    }
    const by = record === 'tactic' ? supersededBy(b) : null;
    if (by !== null && supersededBy(a) !== by) changes.push({ kind: 'replaced', record: 'tactic', id, by });
    const fields = diffRecord(a, b).filter((field) => !(by !== null && field.pointer === '/superseded_by'));
    if (fields.length > 0) changes.push({ kind: 'changed', record, id, fields });
  }
  return changes;
}

export function semanticDiff(before: ExportedBundle, after: ExportedBundle): SemanticDiff {
  if (before.knowledge !== after.knowledge) throw new Error(`cannot diff a ${before.knowledge} export against a ${after.knowledge} export`);
  const pairs: readonly [RecordKind, Keyed, Keyed][] = [
    ['entity', byId(before.documents.entities), byId(after.documents.entities)],
    ['masked-entity', byId(before.documents.masked_entities), byId(after.documents.masked_entities)],
    ['stage', stagesOf(before), stagesOf(after)],
    ['rule', byId(before.documents.rules), byId(after.documents.rules)],
    ['state', byId(before.documents.states), byId(after.documents.states)],
    ['tactic', byId(before.documents.tactics), byId(after.documents.tactics)],
    ['intent-item', intentItemsOf(before), intentItemsOf(after)],
  ];
  return {
    knowledge: after.knowledge,
    before: { game_id: before.game_id, version: before.manifest_version },
    after: { game_id: after.game_id, version: after.manifest_version },
    changes: pairs.flatMap(([record, a, b]) => diffKind(record, a, b)),
  };
}
// @ts-expect-error augur-inject
semanticDiff = contract(semanticDiff, { ...augurContract_e5312268, contractId: 'C-78', mode: 'observe', sample: 1, where: 'src/diff/semantic-diff.ts:112', rule: 'contract-wrap', id: 'e5312268' }); /* augur-inject:contract-wrap:e5312268 */
