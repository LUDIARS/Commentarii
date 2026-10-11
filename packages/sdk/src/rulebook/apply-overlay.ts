// Lays the learning overlay (observations/overlay.json) over a rulebook: each value estimate of
// (entity, quantity) becomes a LearnedEstimate of the rulebook variable it is about. The
// variable is the one named like the quantity, else the one read from `stats.<quantity>`, else
// the entity variable whose unit is the quantity (first by name). The overlay only counts
// player runs, so the estimates are fit for the player view; the canonical rulebook is unchanged.

import type { VariableDeclaration } from '../domain/rulebook-documents.ts';
import { ownersOf } from '../domain/rulebook-documents.ts';
import type { Overlay } from '../overlay/overlay.ts';
import type { LearnedEstimate } from './rulebook-view.ts';

function variableOf(variables: Readonly<Record<string, VariableDeclaration>>, quantity: string): string | undefined {
  const entityOwned = Object.entries(variables)
    .filter(([, declaration]) => ownersOf(declaration).includes('entity'))
    .sort(([a], [b]) => a.localeCompare(b));
  if (entityOwned.some(([name]) => name === quantity)) return quantity;
  return (
    entityOwned.find(([, declaration]) => declaration.from === `stats.${quantity}`)?.[0] ??
    entityOwned.find(([, declaration]) => declaration.unit === quantity)?.[0]
  );
}

export function learnedEstimates(variables: Readonly<Record<string, VariableDeclaration>>, overlay: Overlay | undefined): LearnedEstimate[] {
  if (overlay === undefined) return [];
  const learned: LearnedEstimate[] = [];
  for (const entry of overlay.values) {
    const variable = variableOf(variables, entry.quantity);
    if (variable === undefined || entry.estimates.length === 0) continue;
    const values = entry.estimates.map((estimate) => estimate.value);
    const runs = [...new Set(entry.estimates.map((estimate) => estimate.run))].sort();
    learned.push({
      entity: entry.entity,
      variable,
      interval: [Math.min(...values), Math.max(...values)],
      samples: values.length,
      runs,
      source: { kind: 'observed', ref: `observations/overlay.json values ${entry.entity} ${entry.quantity}` },
    });
  }
  return learned.sort((a, b) => a.entity.localeCompare(b.entity) || a.variable.localeCompare(b.variable));
}
