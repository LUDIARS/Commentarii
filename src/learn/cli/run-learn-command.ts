// Runs `guide learn ingest` (run observations -> observations/overlay.json + differences) and
// `guide learn consolidate` (overlay -> proposals; --apply writes the auto ones into the
// bundle). Ingest writes the overlay only, never a canonical file. Input problems (LearnError)
// are printed and exit 1 with nothing written.

import type { LoadResult } from '../../bundle/bundle.ts';
import { EXIT_INVALID, EXIT_OK, type CliIo } from '../../cli/cli-io.ts';
import { toFileOperations } from '../../import/plan/file-operations.ts';
import { formatConsolidateMarkdown } from '../consolidate/format-consolidate-markdown.ts';
import { planConsolidation } from '../consolidate/plan-consolidation.ts';
import { formatIngestMarkdown } from '../ingest/format-ingest-markdown.ts';
import { ingestRuns } from '../ingest/ingest-runs.ts';
import { LearnError } from '../learn-error.ts';
import { parseRunObservations, type RunObservations } from '../observations/run-observations.ts';
import { OVERLAY_PATH, type Overlay } from '../overlay/overlay.ts';
import { readOverlay } from '../overlay/read-overlay.ts';
import { learningPolicyOf } from '../policy/learning-policy.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import type { LearnCommand, LearnConsolidateCommand, LearnIngestCommand } from './learn-command.ts';
import type { LearnIo } from './learn-io.ts';

type LearnCliIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'writeFiles' | 'learnIo'>;

function requireLearnIo(io: LearnCliIo): LearnIo {
  if (io.learnIo === undefined) throw new Error('guide learn: no learn I/O is wired (main.ts must provide learnIo)');
  return io.learnIo;
}

function gameIdOf(load: LoadResult, gameDir: string): string {
  const manifest = load.bundle.manifest?.doc;
  if (manifest === undefined) throw new LearnError(`${gameDir} has no valid manifest.json`);
  return manifest.game_id;
}

async function readRuns(learnIo: LearnIo, paths: readonly string[], registry: SchemaRegistry): Promise<RunObservations[]> {
  const runs: RunObservations[] = [];
  for (const path of paths) {
    const text = await learnIo.readText(path);
    if (text === undefined) throw new LearnError(`run file ${path} does not exist`);
    runs.push(parseRunObservations(path, text, registry));
  }
  return runs;
}

function serializeOverlay(overlay: Overlay, registry: SchemaRegistry): string {
  const violations = registry.validate('overlay', overlay);
  if (violations.length > 0) throw new Error(`ingest produced an invalid overlay: ${violations.map((v) => `${v.pointer} ${v.message}`).join('; ')}`);
  return `${JSON.stringify(overlay, null, 2)}\n`;
}

async function ingest(command: LearnIngestCommand, io: LearnCliIo, learnIo: LearnIo): Promise<number> {
  const load = await io.openBundle(command.gameDir);
  if (load.issues.length > 0) io.stderr(`guide learn ingest: ${load.issues.length} schema issue(s); invalid files are left out (run guide validate)\n`);
  const gameId = gameIdOf(load, command.gameDir);
  const policy = learningPolicyOf(load.bundle.manifest?.doc);
  const registry = await learnIo.schemaRegistry();
  const runs = await readRuns(learnIo, command.runs, registry);
  const overlay = await readOverlay(learnIo, command.gameDir, gameId);
  const result = ingestRuns({ bundle: load.bundle, gameId, policy, overlay, runs });
  await io.writeFiles(command.gameDir, new Map([[OVERLAY_PATH, serializeOverlay(result.overlay, registry)]]));
  io.stdout(command.json ? `${JSON.stringify(result.report, null, 2)}\n` : formatIngestMarkdown(result.report));
  io.stderr(`guide learn ingest: wrote ${OVERLAY_PATH} (${result.report.runs.ingested.length} player run(s) ingested, ${result.report.runs.ignored_omniscient.length} omniscient ignored)\n`);
  return EXIT_OK;
}

async function consolidate(command: LearnConsolidateCommand, io: LearnCliIo, learnIo: LearnIo): Promise<number> {
  const load = await io.openBundle(command.gameDir);
  if (command.apply && load.issues.length > 0) {
    throw new LearnError(`${load.issues.length} schema issue(s) in the bundle; fix them (guide validate) before --apply`);
  }
  const gameId = gameIdOf(load, command.gameDir);
  const policy = learningPolicyOf(load.bundle.manifest?.doc);
  const overlay = await readOverlay(learnIo, command.gameDir, gameId);
  if (overlay === undefined) throw new LearnError(`${OVERLAY_PATH} does not exist; run guide learn ingest first`);
  const result = planConsolidation({ bundle: load.bundle, overlay, policy, apply: command.apply, registry: await learnIo.schemaRegistry() });
  const { writes } = toFileOperations(result.changes);
  if (writes.size > 0) await io.writeFiles(command.gameDir, writes);
  const written = [...writes.keys()];
  io.stdout(command.json ? `${JSON.stringify({ ...result, changes: undefined, written }, null, 2)}\n` : formatConsolidateMarkdown(result));
  io.stderr(`guide learn consolidate: ${result.proposals.length} proposal(s), applied ${result.applied.length}, wrote ${written.length} file(s)\n`);
  return EXIT_OK;
}

export async function runLearnCommand(command: LearnCommand, io: LearnCliIo): Promise<number> {
  const learnIo = requireLearnIo(io);
  try {
    return command.name === 'learn-ingest' ? await ingest(command, io, learnIo) : await consolidate(command, io, learnIo);
  } catch (cause) {
    if (!(cause instanceof LearnError)) throw cause;
    io.stderr(`guide learn: ${cause.message}\n`);
    return EXIT_INVALID;
  }
}
