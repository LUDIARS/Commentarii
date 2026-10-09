// Builds the knowledge boundary report from a loaded bundle.

import { buildBundleIndex } from '../bundle/bundle-index.ts';
import type { LoadResult } from '../bundle/bundle.ts';
import { referencedKnowledge } from '../bundle/resolve-ref.ts';
import { collectTacticRefs } from '../domain/tactic-refs.ts';
import { findValueNodes, isJsonObject } from '../domain/value-node.ts';
import type {
  EntityKnowledgeRow,
  KnowledgeCounts,
  KnowledgeReport,
  TacticReferencingMasked,
  UngroundedValue,
} from './knowledge-report.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:a8918a40 */
import augurContract_b0e318ca from '../contracts/build-knowledge-report.contract.ts'; /* augur-inject:contract-predicate:072fb9ce */

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 1000;
}

function counts(shown: number, discoverable: number, masked: number): KnowledgeCounts {
  const total = shown + discoverable + masked;
  return {
    shown,
    discoverable,
    masked,
    total,
    ratio: { shown: ratio(shown, total), discoverable: ratio(discoverable, total), masked: ratio(masked, total) },
  };
}

function entityRows(load: LoadResult): EntityKnowledgeRow[] {
  const tally = new Map<string, { shown: number; discoverable: number; masked: number }>();
  for (const { doc } of [...load.bundle.entities, ...load.bundle.maskedEntities]) {
    const row = tally.get(doc.id) ?? { shown: 0, discoverable: 0, masked: 0 };
    for (const { node } of findValueNodes(doc)) {
      if (node.knowledge === 'shown') row.shown += 1;
      else if (node.knowledge === 'discoverable') row.discoverable += 1;
      else if (node.knowledge === 'masked') row.masked += 1;
    }
    tally.set(doc.id, row);
  }
  return [...tally.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, row]) => ({ id, ...counts(row.shown, row.discoverable, row.masked) }));
}

function ungroundedValues(load: LoadResult): UngroundedValue[] {
  const found: UngroundedValue[] = [];
  for (const file of load.files) {
    for (const { node, pointer } of findValueNodes(file.data)) {
      if (node.knowledge !== 'shown' && node.knowledge !== 'discoverable') continue;
      const source = node.source;
      if (!isJsonObject(source) || typeof source.ref !== 'string' || source.ref === '') {
        found.push({ path: file.path, pointer, knowledge: node.knowledge, reason: 'missing-source' });
      } else if (source.kind === 'llm-draft') {
        // Principle 3: an LLM may draft a value but never decide its boundary.
        found.push({ path: file.path, pointer, knowledge: node.knowledge, reason: 'llm-draft-source' });
      }
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path) || a.pointer.localeCompare(b.pointer));
}

function tacticsReferencingMasked(load: LoadResult): TacticReferencingMasked[] {
  const index = buildBundleIndex(load.bundle);
  const found: TacticReferencingMasked[] = [];
  for (const { doc } of load.bundle.tactics) {
    const maskedRefs = collectTacticRefs(doc).filter((ref) => referencedKnowledge(index, ref).includes('masked')).length;
    if (maskedRefs > 0) found.push({ tactic: doc.id, masked_refs: maskedRefs });
  }
  return found.sort((a, b) => a.tactic.localeCompare(b.tactic));
}

export function buildKnowledgeReport(load: LoadResult): KnowledgeReport {
  const entities = entityRows(load);
  const sum = (key: 'shown' | 'discoverable' | 'masked'): number => entities.reduce((total, row) => total + row[key], 0);
  return {
    game_id: load.bundle.manifest?.doc.game_id ?? null,
    entities,
    totals: counts(sum('shown'), sum('discoverable'), sum('masked')),
    ungrounded: ungroundedValues(load),
    tactics_referencing_masked: tacticsReferencingMasked(load),
  };
}
// @ts-expect-error augur-inject
buildKnowledgeReport = contract(buildKnowledgeReport, { ...augurContract_b0e318ca, contractId: 'C-6', mode: 'observe', sample: 1, where: 'src/report/build-knowledge-report.ts:74', rule: 'contract-wrap', id: 'b0e318ca' }); /* augur-inject:contract-wrap:b0e318ca */
