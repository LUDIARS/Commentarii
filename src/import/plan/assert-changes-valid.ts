// Last gate before writing: every document an import writes must sit at a bundle path
// (design 4.2) and pass that path's schema. A failing import writes nothing.

import { classifyPath, SCHEMA_OF_KIND } from '../../bundle/classify-path.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import { ImportError } from '../import-error.ts';
import type { FileChange } from './file-change.ts';

export function assertChangesValid(changes: readonly FileChange[], registry: SchemaRegistry): void {
  const problems: string[] = [];
  for (const { path, after } of changes) {
    if (after === undefined) continue;
    const pathClass = classifyPath(path);
    if (pathClass.type !== 'document') {
      problems.push(`${path}: not a bundle document path`);
      continue;
    }
    for (const violation of registry.validate(SCHEMA_OF_KIND[pathClass.kind], after)) {
      problems.push(`${path}${violation.pointer}: ${violation.message}`);
    }
  }
  if (problems.length > 0) throw new ImportError(`the import would write invalid documents:\n  ${problems.join('\n  ')}`);
}
