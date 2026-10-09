import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { readSqliteTables } from '../../../src/adapters/sqlite/read-sqlite-tables.ts';
import { ImportError } from '../../../src/import/import-error.ts';
import { pairTables } from '../../../src/import/masters/pair-tables.ts';
import { parseCsvTable } from '../../../src/import/masters/parse-csv.ts';
import { planMasterImport } from '../../../src/import/masters/plan-master-import.ts';
import { parseMapping } from '../../../src/import/parse-mapping.ts';
import { schemaRegistry } from '../../support/bundles.ts';
import { makeTempDir, removeTempDir, SAMPLE_CSV, SAMPLE_MAPPING } from '../../support/import-io.ts';

const directories: string[] = [];
after(async () => {
  for (const directory of directories) await removeTempDir(directory);
});

/** Writes the sample archetype CSV into a SQLite table (numbers as REAL / NULL). */
async function sampleDatabase(): Promise<string> {
  const directory = await makeTempDir();
  directories.push(directory);
  const path = join(directory, 'master.sqlite');
  const table = parseCsvTable(await readFile(SAMPLE_CSV, 'utf8'), 'archetypes.csv');
  const database = new DatabaseSync(path);
  try {
    const columns = table.columns.map((column) => `"${column}"`).join(', ');
    database.exec(`CREATE TABLE archetypes (${columns})`);
    const insert = database.prepare(`INSERT INTO archetypes VALUES (${table.columns.map(() => '?').join(', ')})`);
    for (const row of table.rows) {
      insert.run(
        ...table.columns.map((column) => {
          const cell = String(row.cells[column] ?? '');
          if (cell === '') return null;
          return Number.isFinite(Number(cell)) ? Number(cell) : cell;
        }),
      );
    }
  } finally {
    database.close();
  }
  return path;
}

test('SQLite rows are read per mapped table with a rowid reference', async () => {
  const path = await sampleDatabase();
  const [table] = readSqliteTables(path, ['archetypes']);
  assert.equal(table?.name, 'archetypes');
  assert.ok(table?.columns.includes('health'));
  assert.equal(table?.rows[1]?.ref, 'master.sqlite#table=archetypes&rowid=2');
  assert.equal(table?.rows[0]?.cells.health, 180);
  assert.equal(table?.rows[1]?.cells.body_mass, null);
  assert.throws(() => readSqliteTables(path, ['missing']), ImportError);
});

test('importing from SQLite gives the same values as importing the CSV', async () => {
  const mapping = parseMapping(await readFile(SAMPLE_MAPPING, 'utf8'), 'mapping.json', await schemaRegistry());
  const fromCsv = planMasterImport({
    gameId: 'bestia',
    tables: pairTables([parseCsvTable(await readFile(SAMPLE_CSV, 'utf8'), 'archetypes.csv')], mapping, 'mapping.json'),
    existing: new Map(),
  });
  const fromSqlite = planMasterImport({
    gameId: 'bestia',
    tables: pairTables(readSqliteTables(await sampleDatabase(), ['archetypes']), mapping, 'mapping.json'),
    existing: new Map(),
  });
  const withoutRefs = (text: string) => text.replace(/"ref":"[^"]*"/g, '"ref":"-"');
  assert.equal(withoutRefs(JSON.stringify(fromSqlite)), withoutRefs(JSON.stringify(fromCsv)));
});
