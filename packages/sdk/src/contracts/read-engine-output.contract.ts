// C-105 readEngineOutput(schema, text, registry): returns only a document that follows the named
// schema and carries that schema's format; anything else throws (never a half-read document).

import type { EngineOutputSchema } from '../planning/engine-outputs.ts';
import type { SchemaRegistry } from '../schema/schema-registry.ts';

export default {
  post: (document: unknown, schema: EngineOutputSchema, _text: string, registry: SchemaRegistry) => {
    if (registry.validate(schema, document).length > 0) return `returned a document that does not follow ${schema}`;
    const format = (document as { format?: unknown }).format;
    return (typeof format === 'string' && format.startsWith(`${schema}/`)) || `format ${String(format)} is not ${schema}/*`;
  },
};
