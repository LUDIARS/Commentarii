// guide import masters: master data + mapping -> entities/<group>/<slug>(.masked).json.
// --dry-run prints the field-level diff and writes nothing.

import { basename } from 'node:path';
import { masterFormatOf } from '../import/masters/master-format.ts';
import type { MasterTable } from '../import/masters/master-table.ts';
import { mappedTableNames, pairTables } from '../import/masters/pair-tables.ts';
import { parseCsvTable } from '../import/masters/parse-csv.ts';
import { parseJsonTable } from '../import/masters/parse-json-table.ts';
import { planMasterImport } from '../import/masters/plan-master-import.ts';
import type { Mapping } from '../import/mapping.ts';
import { parseMapping } from '../import/parse-mapping.ts';
import { assertChangesValid } from '../import/plan/assert-changes-valid.ts';
import { formatChanges } from '../import/plan/format-changes.ts';
import { applyFileChanges } from './apply-file-changes.ts';
import { EXIT_OK, type CliIo } from './cli-io.ts';
import { openImportTarget } from './open-import-target.ts';
import type { ImportCommand } from './parse-import-command.ts';

type MastersCommand = Extract<ImportCommand, { name: 'import-masters' }>;

async function readMasterTables(io: CliIo, from: string, mapping: Mapping, mappingName: string): Promise<MasterTable[]> {
  const fileName = basename(from);
  switch (masterFormatOf(fileName)) {
    case 'csv':
      return [parseCsvTable(await io.importIo.readText(from), fileName)];
    case 'json':
      return [parseJsonTable(await io.importIo.readText(from), fileName)];
    case 'sqlite':
      return io.importIo.readSqliteTables(from, mappedTableNames(mapping, mappingName));
  }
}

export async function runImportMasters(command: MastersCommand, io: CliIo): Promise<number> {
  const registry = await io.importIo.schemaRegistry();
  const mappingName = basename(command.mapPath);
  const mapping = parseMapping(await io.importIo.readText(command.mapPath), mappingName, registry);
  const target = await openImportTarget(io, command.bundleDir);
  const tables = pairTables(await readMasterTables(io, command.from, mapping, mappingName), mapping, mappingName);
  const changes = planMasterImport({ gameId: target.gameId, tables, existing: target.existing });
  if (command.dryRun) {
    assertChangesValid(changes, registry);
    io.stdout(formatChanges(changes));
    return EXIT_OK;
  }
  const operations = await applyFileChanges(io, command.bundleDir, target, changes, registry);
  io.stderr(`guide import masters: wrote ${operations.writes.size} file(s), removed ${operations.removals.length} from ${basename(command.from)}\n`);
  return EXIT_OK;
}
