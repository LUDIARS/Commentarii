// The observation field declarations a human run is recorded under (spec/feature/observation-boundary.md):
// the manifest's observation.fields, plus each resource the plays mapping reads with an explicit
// knowledge (the mapping is where the telemetry column's boundary is stated). The manifest wins
// on a path both declare. A resource without a stated knowledge is declared masked (principle 1),
// so it can never pass into a player run. Extra columns get no declaration from the mapping:
// they need one in the manifest.

import type { ObservationFieldDeclaration } from '../../observation/observation-fields.ts';
import type { PlaysMapping } from './plays-mapping.ts';

export function humanRunDeclarations(manifestFields: readonly ObservationFieldDeclaration[], mapping: PlaysMapping): ObservationFieldDeclaration[] {
  const declared = new Map(manifestFields.map((field) => [field.path, field]));
  for (const [name, resource] of Object.entries(mapping.self?.resources ?? {})) {
    const path = `self.resources.${name}`;
    if (!declared.has(path)) declared.set(path, { path, knowledge: resource.knowledge ?? 'masked', origin: `telemetry column ${resource.column} (plays mapping)` });
  }
  return [...declared.values()];
}
