// guide import plays: telemetry -> observations/human/<player-hash>/<run>.jsonl, then the
// alternative-solution candidates over every human run of the bundle ->
// observations/human/candidates.json. Fails before writing anything when the salt is missing,
// the mapping is wrong (including a masked value) or a run would not load as a replay.

import { basename, dirname, resolve } from 'node:path';
import type { CliIo } from '../../cli/cli-io.ts';
import { EXIT_OK } from '../../cli/cli-io.ts';
import { parseReplay } from '../../replay/parse-replay.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import { ImportError } from '../import-error.ts';
import type { TableMapping } from '../mapping.ts';
import { parseMapping } from '../parse-mapping.ts';
import { assertSchema } from '../validate-input.ts';
import { extractCandidates } from './extract-candidates.ts';
import { CANDIDATES_PATH, HUMAN_DIRECTORY, isHumanOverlayPath } from './human-run-path.ts';
import { createIdentify } from './identify.ts';
import { parsePlaysMapping } from './parse-plays-mapping.ts';
import { planPlaysImport } from './plan-plays-import.ts';
import type { ImportPlaysCommand } from './plays-command.ts';
import { playsContextOf } from './plays-context.ts';
import type { PlaysIo } from './plays-io.ts';
import type { PlaysMapping } from './plays-mapping.ts';
import { resolvePlayerSalt } from './player-salt.ts';
import { readTelemetry } from './read-telemetry.ts';

export type PlaysCliIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'writeFiles' | 'importIo'> & { readonly playsIo: PlaysIo };

async function mastersTable(io: PlaysCliIo, command: ImportPlaysCommand, mapping: PlaysMapping, registry: SchemaRegistry): Promise<TableMapping | undefined> {
  const masters = mapping.identify?.masters;
  if (masters === undefined) return undefined;
  const path = resolve(dirname(command.mapPath), masters.mapping);
  const table = parseMapping(await io.importIo.readText(path), basename(path), registry).tables?.[masters.table];
  if (table === undefined) throw new ImportError(`${basename(path)} has no table '${masters.table}' (identify.masters)`);
  return table;
}

/** Human runs already in the bundle, by path; files that do not load are reported and left out. */
async function existingHumanRuns(io: PlaysCliIo, bundleDir: string): Promise<Map<string, ReplayRun>> {
  const schema = await io.playsIo.replaySchema();
  const runs = new Map<string, ReplayRun>();
  for (const file of await io.playsIo.readRunFiles(bundleDir, HUMAN_DIRECTORY)) {
    const run = parseReplay(file.text, schema).run;
    if (run?.header.source === 'human') runs.set(file.path, run);
    else io.stderr(`guide import plays: ${file.path} is not a human run; left out of the candidates\n`);
  }
  return runs;
}

export async function runImportPlays(command: ImportPlaysCommand, io: PlaysCliIo): Promise<number> {
  const salt = resolvePlayerSalt(command.playerSalt, io.playsIo.playerSaltFromEnv());
  const registry = await io.importIo.schemaRegistry();
  const mapping = parsePlaysMapping(await io.importIo.readText(command.mapPath), basename(command.mapPath), registry);
  const load = await io.openBundle(command.bundleDir);
  const context = playsContextOf(load.bundle, command.bundleDir);
  const masters = await mastersTable(io, command, mapping, registry);
  const identify = createIdentify({
    gameId: context.gameId,
    entityIds: context.entityIds,
    ...(mapping.identify?.table === undefined ? {} : { table: mapping.identify.table }),
    ...(masters === undefined ? {} : { masters }),
  });
  const table = readTelemetry(await io.importIo.readText(command.from), basename(command.from));
  const plan = planPlaysImport({ table, mapping, context, identify, salt, replaySchema: await io.playsIo.replaySchema(), now: io.playsIo.now() });

  const runs = await existingHumanRuns(io, command.bundleDir);
  for (const file of plan.runs) runs.set(file.path, file.run);
  const candidates = extractCandidates({ gameId: context.gameId, runs: [...runs.values()], tactics: context.tactics });
  assertSchema(registry, 'human-candidates', candidates, CANDIDATES_PATH);

  const writes = new Map(plan.runs.map((file) => [file.path, file.text]));
  writes.set(CANDIDATES_PATH, `${JSON.stringify(candidates, null, 2)}\n`);
  const outside = [...writes.keys()].filter((path) => !isHumanOverlayPath(path));
  if (outside.length > 0) throw new Error(`import plays must only write observations/human/: ${outside.join(', ')}`);
  await io.writeFiles(command.bundleDir, writes);

  const players = new Set(plan.runs.map((file) => file.playerHash)).size;
  io.stderr(`guide import plays: wrote ${plan.runs.length} run(s) of ${players} player(s) under ${HUMAN_DIRECTORY}/\n`);
  if (plan.droppedColumns.length > 0) io.stderr(`guide import plays: dropped column(s) not in the mapping: ${plan.droppedColumns.join(', ')}\n`);
  for (const [what, count] of plan.tally) io.stderr(`guide import plays: ${what}: ${count}\n`);
  io.stderr(`guide import plays: ${candidates.candidates.length} candidate(s) from ${candidates.runs} human run(s) -> ${CANDIDATES_PATH}\n`);
  return EXIT_OK;
}
