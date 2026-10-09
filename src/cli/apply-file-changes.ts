// Writes the planned changes of an import into the bundle, after the last checks: no
// unreadable file is overwritten and every written document passes its schema.

import { ImportError } from '../import/import-error.ts';
import { assertChangesValid } from '../import/plan/assert-changes-valid.ts';
import type { FileChange } from '../import/plan/file-change.ts';
import { toFileOperations, type FileOperations } from '../import/plan/file-operations.ts';
import type { SchemaRegistry } from '../schema/schema-registry.ts';
import type { CliIo } from './cli-io.ts';
import type { ImportTarget } from './open-import-target.ts';

export async function applyFileChanges(
  io: CliIo,
  bundleDir: string,
  target: ImportTarget,
  changes: readonly FileChange[],
  registry: SchemaRegistry,
): Promise<FileOperations> {
  const blocked = changes.filter((change) => target.unreadable.has(change.path)).map((change) => change.path);
  if (blocked.length > 0) throw new ImportError(`cannot rewrite unreadable file(s) ${blocked.join(', ')}; fix them first`);
  assertChangesValid(changes, registry);
  const operations = toFileOperations(changes);
  if (operations.writes.size > 0) await io.writeFiles(bundleDir, operations.writes);
  if (operations.removals.length > 0) await io.importIo.removeFiles(bundleDir, operations.removals);
  return operations;
}
