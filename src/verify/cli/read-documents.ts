// Reads the derived documents of intent verification back with their schema check:
// observations/divergences.json and feasibility/*.json. An invalid one is a VerifyError (a
// person may have edited it by hand), never silently dropped.

import { join } from 'node:path';
import type { DocumentSchemaName } from '../../schema/schema-names.ts';
import type { SchemaRegistry, SchemaViolation } from '../../schema/schema-registry.ts';
import { FEASIBILITY_DIRECTORY, type FeasibilityDocument } from '../feasibility/feasibility-document.ts';
import { DIVERGENCES_PATH, type DivergenceStore } from '../intent/divergence-store.ts';
import { VerifyError } from '../verify-error.ts';
import type { VerifyIo } from './verify-io.ts';

function parseChecked<T>(path: string, text: string, schema: DocumentSchemaName, registry: SchemaRegistry): T {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new VerifyError(`${path} is not JSON: ${(cause as Error).message}`);
  }
  const violations: SchemaViolation[] = registry.validate(schema, data);
  if (violations.length > 0) throw new VerifyError(`${path} does not match ${schema}.schema.json: ${violations.map((v) => `${v.pointer || '/'} ${v.message}`).join('; ')}`);
  return data as T;
}

export async function readDivergenceStore(io: VerifyIo, gameDir: string, registry: SchemaRegistry): Promise<DivergenceStore | undefined> {
  const path = join(gameDir, DIVERGENCES_PATH);
  const text = await io.readText(path);
  return text === undefined ? undefined : parseChecked<DivergenceStore>(path, text, 'divergences', registry);
}

export async function readFeasibilityDocuments(io: VerifyIo, gameDir: string, registry: SchemaRegistry): Promise<FeasibilityDocument[]> {
  const { files } = await io.listFiles([join(gameDir, FEASIBILITY_DIRECTORY)], '.json');
  const documents: FeasibilityDocument[] = [];
  for (const path of files) {
    const text = await io.readText(path);
    if (text !== undefined) documents.push(parseChecked<FeasibilityDocument>(path, text, 'feasibility', registry));
  }
  return documents.sort((a, b) => (a.stage < b.stage ? -1 : a.stage > b.stage ? 1 : 0));
}

/** Pretty JSON after a schema check; a violation here is a bug of the tool, not of the input. */
export function serializeChecked(document: unknown, schema: DocumentSchemaName, registry: SchemaRegistry): string {
  const violations = registry.validate(schema, document);
  if (violations.length > 0) throw new Error(`guide verify produced an invalid ${schema} document: ${violations.map((v) => `${v.pointer || '/'} ${v.message}`).join('; ')}`);
  return `${JSON.stringify(document, null, 2)}\n`;
}
