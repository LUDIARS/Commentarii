// Composes the file system persona source with the persona schema: (bundle dir, slug) -> Persona.

import type { Persona } from '../../engine/persona/persona.ts';
import { resolvePersona } from '../../engine/persona/resolve-persona.ts';
import { createSchemaRegistry, type SchemaRegistry } from '../../schema/schema-registry.ts';
import { createFsPersonaSource } from './fs-persona-source.ts';
import { readSchemaDocuments } from './read-schema-documents.ts';

let registry: Promise<SchemaRegistry> | undefined;

export async function loadPersona(bundleDir: string, slug: string): Promise<Persona> {
  registry ??= readSchemaDocuments().then(createSchemaRegistry);
  const schemas = await registry;
  const validate = (data: unknown): string[] => schemas.validate('persona', data).map((violation) => `${violation.pointer || '/'} ${violation.message}`);
  return resolvePersona(createFsPersonaSource(), validate, bundleDir, slug);
}
