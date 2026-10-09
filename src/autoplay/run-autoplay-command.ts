// Runs `guide run` (one run of the engine through the sim or a stdio adapter, optionally
// recorded as a replay) and `guide bench` (N sim runs, JSON report). With --adapter stdio the
// process's stdout is the protocol channel, so the run report goes to stderr instead.

import { createSimAdapter, SIM_ADAPTER_ID } from '../adapters/sim/sim-adapter.ts';
import { createStdioAdapter } from '../adapters/stdio/stdio-adapter.ts';
import type { GameAdapter } from '../adapter/game-adapter.ts';
import { runBench } from '../bench/run-bench.ts';
import type { Bundle } from '../bundle/bundle.ts';
import { EXIT_INVALID, EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import type { EngineIo } from '../cli/engine-io.ts';
import { runDriver } from '../engine/driver.ts';
import { deriveSeed } from '../engine/rng.ts';
import { createUtilityBtDecider } from '../engine/utility-bt-decider.ts';
import type { AutoplayCommand, BenchCommand, RunCommand } from './autoplay-command.ts';

type AutoplayIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'engineIo'>;

function requireEngineIo(io: AutoplayIo, verb: string): EngineIo {
  if (io.engineIo === undefined) throw new Error(`guide ${verb}: no engine I/O is wired (main.ts must provide engineIo)`);
  return io.engineIo;
}

async function openGame(io: AutoplayIo, gameDir: string, verb: string): Promise<{ bundle: Bundle; gameId: string; version: string }> {
  const load = await io.openBundle(gameDir);
  if (load.issues.length > 0) io.stderr(`guide ${verb}: ${load.issues.length} schema issue(s); invalid files are left out (run guide validate)\n`);
  const manifest = load.bundle.manifest?.doc;
  if (manifest === undefined) throw new Error(`guide ${verb}: ${gameDir} has no valid manifest.json`);
  return { bundle: load.bundle, gameId: manifest.game_id, version: manifest.version };
}

function runId(gameId: string, persona: string, seed: number): string {
  return `run:${gameId}-${persona}-s${seed}`;
}

async function runOnce(command: RunCommand, io: AutoplayIo, engineIo: EngineIo): Promise<number> {
  const { bundle, gameId, version } = await openGame(io, command.gameDir, 'run');
  const persona = await engineIo.loadPersona(command.gameDir, command.persona);
  const adapter: GameAdapter =
    command.adapter === 'sim'
      ? createSimAdapter({ bundle, mode: command.mode, purpose: command.purpose, seed: deriveSeed(command.seed, 'sim') })
      : createStdioAdapter(engineIo.openStdioChannel());
  const id = runId(gameId, persona.slug, command.seed);
  const record =
    command.recordPath === undefined
      ? undefined
      : {
          writer: await engineIo.createReplayWriter(command.recordPath),
          header: { run_id: id, seed: command.seed, manifest_version: version, purpose: command.purpose, persona: persona.slug },
          now: () => engineIo.now(),
        };
  const decider = createUtilityBtDecider({ bundle, persona }, command.seed);
  const report = await runDriver({ adapter, decider, mode: command.mode, maxTicks: command.ticks, ...(record ? { record } : {}) });
  const out = command.adapter === 'stdio' ? io.stderr : io.stdout;
  const adapterId = command.adapter === 'sim' ? SIM_ADAPTER_ID : 'stdio';
  out(`${JSON.stringify({ run_id: id, adapter: adapterId, persona: persona.slug, mode: command.mode, purpose: command.purpose, seed: command.seed, ...report, ...(command.recordPath ? { record: command.recordPath } : {}) }, null, 2)}\n`);
  return report.stop.reason === 'masked-in-player' || report.stop.reason === 'mode-mismatch' ? EXIT_INVALID : EXIT_OK;
}

async function bench(command: BenchCommand, io: AutoplayIo, engineIo: EngineIo): Promise<number> {
  const { bundle } = await openGame(io, command.gameDir, 'bench');
  const persona = await engineIo.loadPersona(command.gameDir, command.persona);
  const report = await runBench({
    bundle,
    persona,
    seed: command.seed,
    runs: command.runs,
    ticks: command.ticks,
    mode: command.mode,
    purpose: command.purpose,
    withoutTactics: command.withoutTactics,
  });
  io.stdout(`${JSON.stringify(report, null, 2)}\n`);
  return EXIT_OK;
}

export async function runAutoplayCommand(command: AutoplayCommand, io: AutoplayIo): Promise<number> {
  const engineIo = requireEngineIo(io, command.name);
  return command.name === 'run' ? runOnce(command, io, engineIo) : bench(command, io, engineIo);
}
