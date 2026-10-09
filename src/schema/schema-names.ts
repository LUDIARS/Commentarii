// Names of the bundled JSON Schemas (schema/<name>.schema.json). The schema $id is the file name.

export const DOCUMENT_SCHEMAS = [
  'manifest',
  'glossary',
  'entity',
  'entity.masked',
  'stage',
  'map',
  'events',
  'rule',
  'state',
  'tactic',
  'intent',
  'observation',
  // Learning overlay (stage 4): observations/overlay.json, never part of the canonical bundle.
  'overlay',
  // Approvals of consolidate proposals: observations/approvals.json (bound to content hash + guide version).
  'approvals',
  // Inputs of guide import (stage 2): never part of a bundle, validated before conversion.
  'mapping',
  'import-navgraph',
  'import-zones',
  // Player personas (design 14.E): shipped under personas/ or kept in a bundle's personas/.
  'persona',
  // Human play logs (design 14.D): the import plays mapping and the extracted candidates overlay.
  'plays-mapping',
  'human-candidates',
  // Intent verification (stage 5): observations/divergences.json and feasibility/<stage>.json, never canonical.
  'divergences',
  'feasibility',
  // Render tap stream lines (contract render-tap/1, spec/feature/render-tap-contract.md): a raw tap, never an observation.
  'render-frame',
] as const;

export type DocumentSchemaName = (typeof DOCUMENT_SCHEMAS)[number];

/** Schemas that only provide shared definitions and are never applied to a whole file. */
export const DEFINITION_SCHEMAS = ['id', 'value', 'observation-fields'] as const;

export const ALL_SCHEMAS = [...DEFINITION_SCHEMAS, ...DOCUMENT_SCHEMAS] as const;

export function schemaFileName(name: string): string {
  return `${name}.schema.json`;
}
