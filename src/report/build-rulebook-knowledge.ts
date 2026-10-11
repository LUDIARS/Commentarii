// The rulebook part of the knowledge boundary report: one row per element (variable, set,
// action, process, behavior, objectives, progress measure) with its knowledge, and how many
// masked overrides each action has. Counts and IDs only: an override's content never appears.

import type { Bundle, Knowledge } from '@ludiars/commentarii-sdk/types';
import type { KnowledgeCounts, RulebookKnowledge, RulebookKnowledgeRow } from './knowledge-report.ts';

export function buildRulebookKnowledge(bundle: Bundle, counts: (shown: number, discoverable: number, masked: number) => KnowledgeCounts): RulebookKnowledge {
  const { rulebook } = bundle;
  const overrides = new Map<string, number>();
  for (const { doc } of rulebook.maskedActions) overrides.set(doc.id, (overrides.get(doc.id) ?? 0) + 1);
  const rows: RulebookKnowledgeRow[] = [];
  const add = (kind: RulebookKnowledgeRow['kind'], id: string, knowledge: Knowledge, path: string): void => {
    rows.push({ kind, id, knowledge, masked_overrides: overrides.get(id) ?? 0, path });
  };
  const variables = rulebook.variables;
  if (variables) {
    for (const [name, declaration] of Object.entries(variables.doc.variables)) add('variable', name, declaration.knowledge, variables.path);
    for (const [name, set] of Object.entries(variables.doc.sets ?? {})) add('set', name, set.knowledge, variables.path);
  }
  for (const { path, doc } of rulebook.actions) add('action', doc.id, doc.knowledge, path);
  for (const { path, doc } of rulebook.processes) add('process', doc.id, doc.knowledge, path);
  for (const { path, doc } of rulebook.behaviors) add('behavior', doc.id, doc.knowledge, path);
  if (rulebook.objectives) {
    const { path, doc } = rulebook.objectives;
    add('objectives', 'objectives', doc.knowledge, path);
    for (const measure of doc.progress ?? []) add('progress', measure.id, measure.knowledge, path);
  }
  const tally = (level: Knowledge): number => rows.filter((row) => row.knowledge === level).length;
  const maskedOverrides = rows.reduce((total, row) => total + row.masked_overrides, 0);
  return { rows, totals: counts(tally('shown'), tally('discoverable'), tally('masked') + maskedOverrides) };
}
