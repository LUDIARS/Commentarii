// guide import plays, without I/O: telemetry rows + mapping -> the human run files to write under
// observations/human/<player-hash>/ (design 14.D). Only mapped columns are read, every other
// column is dropped by name; every run must load as a replay (schema and invariants, including
// the player-mode masked ban) and no output may hold a raw player or run identifier.

import { parseReplay } from '../../replay/parse-replay.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import type { ReplaySchema } from '../../replay/replay-schema.ts';
import { ImportError } from '../import-error.ts';
import type { MasterTable } from '../masters/master-table.ts';
import { assertNoRawIdentifiers } from './assert-no-raw-identifiers.ts';
import { buildHumanRun } from './build-human-run.ts';
import { groupRuns } from './group-runs.ts';
import { humanRunPath } from './human-run-path.ts';
import type { Identify } from './identify.ts';
import { createTally, tallyEntries } from './import-tally.ts';
import type { PlaysContext } from './plays-context.ts';
import { mappedColumns, type PlaysMapping } from './plays-mapping.ts';
import { serializeReplayRun } from './serialize-replay-run.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:7b499fb4 */
import augurContract_7bcaaba2 from '../../contracts/plan-plays-import.contract.ts'; /* augur-inject:contract-predicate:d9e6f2d7 */

export interface PlaysImportRequest {
  readonly table: MasterTable;
  readonly mapping: PlaysMapping;
  readonly context: PlaysContext;
  readonly identify: Identify;
  readonly salt: string;
  readonly replaySchema: ReplaySchema;
  /** Import time (injected for deterministic tests). */
  readonly now: Date;
}

export interface HumanRunFile {
  /** Bundle-relative: observations/human/<player-hash>/<run>.jsonl */
  readonly path: string;
  readonly playerHash: string;
  readonly run: ReplayRun;
  readonly text: string;
}

export interface PlaysImport {
  readonly runs: readonly HumanRunFile[];
  /** Telemetry columns the mapping does not read (names only), in name order. */
  readonly droppedColumns: readonly string[];
  /** What was left out or could not be resolved, by kind. */
  readonly tally: readonly (readonly [string, number])[];
}

function assertColumnsExist(table: MasterTable, mapping: PlaysMapping): void {
  const present = new Set(table.columns);
  const missing = [...mappedColumns(mapping)].filter((column) => !present.has(column)).sort();
  if (missing.length > 0) throw new ImportError(`${table.name}: the mapping names column(s) the telemetry lacks: ${missing.join(', ')}`);
}

function assertLoads(file: HumanRunFile, schema: ReplaySchema): void {
  const loaded = parseReplay(file.text, schema);
  if (loaded.issues.length === 0) return;
  const detail = loaded.issues.slice(0, 5).map((issue) => `  line ${issue.line} ${issue.pointer || '/'}: ${issue.message}`).join('\n');
  throw new ImportError(`${file.path} would not load as a replay:\n${detail}`);
}

export function planPlaysImport(request: PlaysImportRequest): PlaysImport {
  const { table, mapping } = request;
  if (table.rows.length === 0) throw new ImportError(`${table.name} has no rows`);
  assertColumnsExist(table, mapping);
  const tally = createTally();
  const groups = groupRuns(table.rows, mapping);
  const runs = groups.map((group): HumanRunFile => {
    const built = buildHumanRun({ group, mapping, context: request.context, identify: request.identify, salt: request.salt, now: request.now, tally });
    return { path: humanRunPath(built.playerHash, built.run.header.run_id), playerHash: built.playerHash, run: built.run, text: serializeReplayRun(built.run) };
  });
  // The raw identifier check names the leak precisely, so it goes before the replay checks
  // (an undeclared extra column carrying the identifier also fails the boundary registry).
  const raw = new Set(groups.flatMap((group) => [group.player, group.run]));
  assertNoRawIdentifiers(new Map(runs.map((file) => [file.path, file.text])), raw);
  for (const file of runs) assertLoads(file, request.replaySchema);
  const mapped = mappedColumns(mapping);
  return {
    runs: [...runs].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    droppedColumns: table.columns.filter((column) => !mapped.has(column)).sort(),
    tally: tallyEntries(tally),
  };
}
// @ts-expect-error augur-inject
planPlaysImport = contract(planPlaysImport, { ...augurContract_7bcaaba2, contractId: 'C-40', mode: 'observe', sample: 1, where: 'src/import/plays/plan-plays-import.ts:61', rule: 'contract-wrap', id: '7bcaaba2' }); /* augur-inject:contract-wrap:7bcaaba2 */
