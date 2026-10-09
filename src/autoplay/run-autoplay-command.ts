// Runs `guide run` (one run of the engine through the sim or a stdio adapter, optionally
// recorded as a replay, optionally reflecting into an observation file) and `guide bench` (N sim
// runs, JSON report). Both start from the bundle with its learning overlay applied (stage 4). With --adapter stdio the
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
import { createObservationSink } from '../engine/reflect/observation-sink.ts';
import { createReflector } from '../engine/reflect/create-reflector.ts';
import { buildReflectWorld } from '../engine/reflect/reflect-world.ts';
import type { Persona } from '../engine/persona/persona.ts';
import { applyOverlay } from '../learn/overlay/apply-overlay.ts';
import { readOverlay } from '../learn/overlay/read-overlay.ts';
import type { AutoplayCommand, BenchCommand, RunCommand } from './autoplay-command.ts';

type AutoplayIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'engineIo' | 'learnIo'>;

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

/**
 * The bundle and persona the engine starts from: with observations/overlay.json applied when
 * the bundle has one (measured metrics, learned rewrites, weight factors; in memory only).
 * Callers that wire no learnIo (tests of stage 3) get the bundle as it is.
 */
async function setupEngine(io: AutoplayIo, gameDir: string, gameId: string, bundle: Bundle, persona: Persona): Promise<{ bundle: Bundle; persona: Persona }> {
  if (io.learnIo === undefined) return { bundle, persona };
  const overlay = await readOverlay(io.learnIo, gameDir, gameId);
  return overlay === undefined ? { bundle, persona } : applyOverlay(bundle, persona, overlay);
}

function runId(gameId: string, persona: string, seed: number): string {
  return `run:${gameId}-${persona}-s${seed}`;
}

async function runOnce(command: RunCommand, io: AutoplayIo, engineIo: EngineIo): Promise<number> {
  const game = await openGame(io, command.gameDir, 'run');
  const { gameId, version } = game;
  const { bundle, persona } = await setupEngine(io, command.gameDir, gameId, game.bundle, await engineIo.loadPersona(command.gameDir, command.persona));
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
  const reflect =
    command.observePath === undefined
      ? undefined
      : createReflector({
          world: buildReflectWorld(bundle, command.mode),
          sink: createObservationSink(await engineIo.createReplayWriter(command.observePath), command.mode),
          acted: () => decider.lastOutcome?.acted,
        });
  const report = await runDriver({ adapter, decider, mode: command.mode, maxTicks: command.ticks, ...(record ? { record } : {}), ...(reflect ? { reflect } : {}) });
  const out = command.adapter === 'stdio' ? io.stderr : io.stdout;
  const adapterId = command.adapter === 'sim' ? SIM_ADAPTER_ID : 'stdio';
  out(`${JSON.stringify({ run_id: id, adapter: adapterId, persona: persona.slug, mode: command.mode, purpose: command.purpose, seed: command.seed, ...report, ...(command.recordPath ? { record: command.recordPath } : {}), ...(command.observePath ? { observe: command.observePath } : {}) }, null, 2)}\n`);
  return report.stop.reason === 'masked-in-player' || report.stop.reason === 'mode-mismatch' ? EXIT_INVALID : EXIT_OK;
}

async function bench(command: BenchCommand, io: AutoplayIo, engineIo: EngineIo): Promise<number> {
  const game = await openGame(io, command.gameDir, 'bench');
  const { bundle, persona } = await setupEngine(io, command.gameDir, game.gameId, game.bundle, await engineIo.loadPersona(command.gameDir, command.persona));
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
