// C-90 schemaDirectory(): the returned path is the schema/ directory of the SDK package, and every
// schema of ALL_SCHEMAS is a file in it.

import { existsSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { ALL_SCHEMAS, schemaFileName } from '../schema/schema-names.ts';

export default {
  post: (directory: string) => {
    if (!isAbsolute(directory) || basename(directory) !== 'schema') return `not an absolute schema/ directory: ${directory}`;
    if (!existsSync(join(directory, '..', 'package.json'))) return 'schema/ is not directly under a package root';
    const missing = ALL_SCHEMAS.map(schemaFileName).filter((fileName) => !existsSync(join(directory, fileName)));
    return missing.length === 0 || `missing schema files: ${missing.join(', ')}`;
  },
};
