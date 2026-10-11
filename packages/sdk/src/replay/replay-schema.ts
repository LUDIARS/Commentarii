// Compiles the replay line schema (schema/replay.schema.json and what it references) and
// validates one parsed line. Kept apart from schema/schema-registry.ts, whose fixed list is
// the bundle document set: replay files are not bundle documents and never live in a bundle.
// Schema documents are passed in (read by an adapter), so this module does no I/O.

import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { SchemaViolation } from '../schema/schema-registry.ts';
import { isJsonObject } from '../domain/value-node.ts';

/** Schema files the replay line schema needs, in dependency order. */
export const REPLAY_SCHEMA_FILES = ['id.schema.json', 'value.schema.json', 'observation-fields.schema.json', 'observation-frame.schema.json', 'replay.schema.json'] as const;

const LINE_SCHEMA = 'replay.schema.json';
const LINE_TYPES = ['header', 'tick', 'footer'] as const;
type LineType = (typeof LINE_TYPES)[number];

export interface ReplaySchema {
  validateLine(line: unknown): SchemaViolation[];
}

function toViolation(error: ErrorObject): SchemaViolation {
  const detail = error.params && Object.keys(error.params).length > 0 ? ` ${JSON.stringify(error.params)}` : '';
  return { pointer: error.instancePath, message: `${error.message ?? error.keyword}${detail}` };
}

function isLineType(value: unknown): value is LineType {
  return (LINE_TYPES as readonly unknown[]).includes(value);
}

function run(validator: ValidateFunction, document: unknown): SchemaViolation[] {
  return validator(document) ? [] : (validator.errors ?? []).map(toViolation);
}

/** Builds the validator from schema documents keyed by file name (see REPLAY_SCHEMA_FILES). */
export function createReplaySchema(schemaDocuments: ReadonlyMap<string, unknown>): ReplaySchema {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictTuples: false, strictRequired: false });
  addFormats.default(ajv);
  for (const fileName of REPLAY_SCHEMA_FILES) {
    const document = schemaDocuments.get(fileName);
    if (document === undefined) throw new Error(`schema ${fileName} is missing`);
    ajv.addSchema(document as object, fileName);
  }
  const compile = (ref: string): ValidateFunction => {
    const validator = ajv.getSchema(ref);
    if (validator === undefined) throw new Error(`schema ${ref} did not compile`);
    return validator;
  };
  const whole = compile(LINE_SCHEMA);
  // Validating against the branch named by `type` keeps the messages about that line kind
  // instead of the oneOf noise of all three.
  const byType = new Map(LINE_TYPES.map((type) => [type, compile(`${LINE_SCHEMA}#/$defs/${type}`)] as const));
  return {
    validateLine(line) {
      const type = isJsonObject(line) ? line.type : undefined;
      const branch = isLineType(type) ? byType.get(type) : undefined;
      return run(branch ?? whole, line);
    },
  };
}
