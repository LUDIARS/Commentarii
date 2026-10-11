// Compiles the bundled schemas once and validates documents against them.
// Schema documents are passed in (read by an adapter), so this module does no I/O.

import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ALL_SCHEMAS, DOCUMENT_SCHEMAS, schemaFileName, type DocumentSchemaName } from './schema-names.ts';

export interface SchemaViolation {
  /** JSON pointer inside the validated document. */
  readonly pointer: string;
  readonly message: string;
}

export interface SchemaRegistry {
  validate(name: DocumentSchemaName, document: unknown): SchemaViolation[];
}

function toViolation(error: ErrorObject): SchemaViolation {
  const detail = error.params && Object.keys(error.params).length > 0 ? ` ${JSON.stringify(error.params)}` : '';
  return { pointer: error.instancePath, message: `${error.message ?? error.keyword}${detail}` };
}

/** Builds the registry from schema documents keyed by file name (e.g. `value.schema.json`). */
export function createSchemaRegistry(schemaDocuments: ReadonlyMap<string, unknown>): SchemaRegistry {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictTuples: false, strictRequired: false });
  addFormats.default(ajv);
  for (const name of ALL_SCHEMAS) {
    const fileName = schemaFileName(name);
    const document = schemaDocuments.get(fileName);
    if (document === undefined) throw new Error(`schema ${fileName} is missing`);
    ajv.addSchema(document as object, fileName);
  }
  const validators = new Map<DocumentSchemaName, ValidateFunction>();
  for (const name of DOCUMENT_SCHEMAS) {
    const validator = ajv.getSchema(schemaFileName(name));
    if (validator === undefined) throw new Error(`schema ${name} did not compile`);
    validators.set(name, validator);
  }
  return {
    validate(name, document) {
      const validator = validators.get(name);
      if (validator === undefined) throw new Error(`unknown schema ${name}`);
      if (validator(document)) return [];
      return (validator.errors ?? []).map(toViolation);
    },
  };
}
