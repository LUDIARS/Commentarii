// Runs `guide bench compare`, `guide bench replay` and `guide gate balance`
// (spec/feature/balance-gate.md). Bench results are read and schema-checked; results that cannot
// be compared are reported with the reasons and exit 1 (never a false green). Input problems
// (GateError) are printed and exit 1.

import type { BenchResult } from '../../bench/bench-result.ts';
import { EXIT_INVALID, EXIT_OK, type CliIo } from '../../cli/cli-io.ts';
import type { EngineSetup } from '../../engine/utility-bt-decider.ts';
import { applyOverlay } from '../../learn/overlay/apply-overlay.ts';
import { readOverlay } from '../../learn/overlay/read-overlay.ts';
import { parseReplay } from '../../replay/parse-replay.ts';
import { createDecider } from '../../replay/decider-registry.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import type { VerifyIo } from '../../verify/cli/verify-io.ts';
import { benchThresholdsOf, DEFAULT_BENCH_THRESHOLDS } from '../bench-thresholds.ts';
import { compareBench } from '../compare-bench.ts';
import { decisionRegression } from '../decision-regression.ts';
import { formatGateMarkdown, formatRegressionMarkdown } from '../format-gate-markdown.ts';
import { gateBalance } from '../gate-balance.ts';
import type { BenchCompareCommand, BenchReplayCommand, GateBalanceCommand, GateCommand } from './gate-command.ts';

type GateCliIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'engineIo' | 'learnIo' | 'verifyIo'>;

export class GateError extends Error {
  override readonly name = 'GateError';
}

function requireVerifyIo(io: GateCliIo): VerifyIo {
  if (io.verifyIo === undefined) throw new Error('guide gate: no verify I/O is wired (main.ts must provide verifyIo)');
  return io.verifyIo;
}

async function readResult(verifyIo: VerifyIo, path: string): Promise<BenchResult> {
  const text = await verifyIo.readText(path);
  if (text === undefined) throw new GateError(`${path} does not exist`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new GateError(`${path} is not JSON: ${(cause as Error).message}`);
  }
  const violations = (await verifyIo.schemaRegistry()).validate('bench-result', parsed);
  if (violations.length > 0) throw new GateError(`${path} is not a bench result: ${violations.map((v) => `${v.pointer} ${v.message}`).join('; ')}`);
  return parsed as BenchResult;
}

async function thresholdsFor(io: GateCliIo, gameDir: string | undefined) {
  if (gameDir === undefined) return DEFAULT_BENCH_THRESHOLDS;
  return benchThresholdsOf((await io.openBundle(gameDir)).bundle.manifest?.doc);
}

async function compare(command: BenchCompareCommand | GateBalanceCommand, io: GateCliIo, verifyIo: VerifyIo) {
  const [base, head] = await Promise.all([readResult(verifyIo, command.base), readResult(verifyIo, command.head)]);
  return compareBench(base, head, await thresholdsFor(io, command.gameDir));
}

async function benchCompare(command: BenchCompareCommand, io: GateCliIo, verifyIo: VerifyIo): Promise<number> {
  const comparison = await compare(command, io, verifyIo);
  const verdict = gateBalance(comparison, 'none');
  io.stdout(command.json ? `${JSON.stringify(comparison, null, 2)}\n` : formatGateMarkdown(verdict));
  return comparison.comparable ? EXIT_OK : EXIT_INVALID;
}

async function gate(command: GateBalanceCommand, io: GateCliIo, verifyIo: VerifyIo): Promise<number> {
  const verdict = gateBalance(await compare(command, io, verifyIo), command.failOn);
  io.stdout(command.json ? `${JSON.stringify(verdict, null, 2)}\n` : formatGateMarkdown(verdict));
  io.stderr(`guide gate balance: ${verdict.status}${verdict.fail ? ' (gate fails)' : ''}\n`);
  return verdict.fail ? EXIT_INVALID : EXIT_OK;
}

async function readRuns(verifyIo: VerifyIo, paths: readonly string[], io: GateCliIo): Promise<ReplayRun[]> {
  const listed = await verifyIo.listFiles(paths, '.jsonl');
  if (listed.missing.length > 0) throw new GateError(`not found: ${listed.missing.join(', ')}`);
  const schema = await verifyIo.replaySchema();
  const runs: ReplayRun[] = [];
  for (const file of listed.files) {
    const loaded = parseReplay((await verifyIo.readText(file)) ?? '', schema);
    if (loaded.run === undefined) io.stderr(`guide bench replay: ${file} does not load as a replay (${loaded.issues.length} issue(s)); left out\n`);
    else runs.push(loaded.run);
  }
  return runs;
}

async function benchReplay(command: BenchReplayCommand, io: GateCliIo, verifyIo: VerifyIo): Promise<number> {
  if (io.engineIo === undefined) throw new Error('guide bench replay: no engine I/O is wired');
  const engineIo = io.engineIo;
  const load = await io.openBundle(command.gameDir);
  const gameId = load.bundle.manifest?.doc.game_id;
  if (gameId === undefined) throw new GateError(`${command.gameDir} has no valid manifest.json`);
  const overlay = io.learnIo === undefined ? undefined : await readOverlay(io.learnIo, command.gameDir, gameId);
  const runs = await readRuns(verifyIo, command.runs, io);
  const setups = new Map<string, EngineSetup>();
  for (const slug of new Set(runs.map((run) => run.header.persona ?? 'expert'))) {
    const persona = await engineIo.loadPersona(command.gameDir, slug);
    setups.set(slug, overlay === undefined ? { bundle: load.bundle, persona } : applyOverlay(load.bundle, persona, overlay));
  }
  const regression = decisionRegression(runs, (run) => createDecider('utility-bt', run, setups.get(run.header.persona ?? 'expert')));
  io.stdout(command.json ? `${JSON.stringify(regression, null, 2)}\n` : formatRegressionMarkdown(regression));
  io.stderr(`guide bench replay: ${regression.matched_runs}/${regression.runs} run(s) decided the same (${regression.note})\n`);
  return EXIT_OK;
}

export async function runGateCommand(command: GateCommand, io: GateCliIo): Promise<number> {
  const verifyIo = requireVerifyIo(io);
  try {
    if (command.name === 'bench-compare') return await benchCompare(command, io, verifyIo);
    if (command.name === 'bench-replay') return await benchReplay(command, io, verifyIo);
    return await gate(command, io, verifyIo);
  } catch (cause) {
    if (!(cause instanceof GateError)) throw cause;
    io.stderr(`guide gate: ${cause.message}\n`);
    return EXIT_INVALID;
  }
}
