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
  // Inputs of guide import (stage 2): never part of a bundle, validated before conversion.
  'mapping',
  'import-navgraph',
  'import-zones',
] as const;

export type DocumentSchemaName = (typeof DOCUMENT_SCHEMAS)[number];

/** Schemas that only provide shared definitions and are never applied to a whole file. */
export const DEFINITION_SCHEMAS = ['id', 'value'] as const;

export const ALL_SCHEMAS = [...DEFINITION_SCHEMAS, ...DOCUMENT_SCHEMAS] as const;

export function schemaFileName(name: string): string {
  return `${name}.schema.json`;
}
