// `guide bench --save <path>` (spec/feature/balance-gate.md §2): the live bench report as
// bench/<label>.json under the bundle directory. Hashes the canonical bundle, the overlay the
// engine started from and the persona; runs intent verification over the bench runs when the
// bench was a coverage bench; schema-checks the result before writing (nothing invalid is written).

import { bundleHash, documentHash } from '../bench/bundle-hash.ts';
import type { BenchDivergences } from '../bench/bench-result.ts';
import type { BenchReport } from '../bench/summarize-bench.ts';
import { toBenchResult } from '../bench/to-bench-result.ts';
import type { CliIo } from '../cli/cli-io.ts';
import type { EngineIo } from '../cli/engine-io.ts';
import type { Persona } from '../engine/persona/persona.ts';
import { benchDivergences } from '../gate/bench-divergences.ts';
import { readOverlay } from '../learn/overlay/read-overlay.ts';
import type { ReplayRun } from '../replay/replay-record.ts';
import { verifyIntent } from '../verify/verify-intent.ts';
import type { BenchCommand } from './autoplay-command.ts';

export type SaveBenchIo = Pick<CliIo, 'openBundle' | 'writeFiles' | 'learnIo' | 'verifyIo'>;

export interface SaveBenchInput {
  readonly command: BenchCommand & { readonly savePath: string };
  readonly persona: Persona;
  readonly report: BenchReport;
  /** The bench runs as replays (coverage benches only). */
  readonly runs: readonly ReplayRun[];
  readonly adapter: string;
}

export async function saveBenchResult(input: SaveBenchInput, io: SaveBenchIo, engineIo: EngineIo): Promise<string> {
  if (io.verifyIo === undefined) throw new Error('guide bench --save: no verify I/O is wired (main.ts must provide verifyIo)');
  const load = await io.openBundle(input.command.gameDir);
  const manifest = load.bundle.manifest?.doc;
  if (manifest === undefined) throw new Error(`guide bench --save: ${input.command.gameDir} has no valid manifest.json`);
  const overlay = io.learnIo === undefined ? undefined : await readOverlay(io.learnIo, input.command.gameDir, manifest.game_id);
  const divergences: BenchDivergences | null =
    input.command.purpose === 'coverage' ? benchDivergences(verifyIntent({ load, runs: input.runs, unreadable: [] }).report) : null;
  const result = toBenchResult({
    report: input.report,
    persona: input.persona,
    adapter: input.adapter,
    intentAssist: input.command.intentAssist,
    manifestVersion: manifest.version,
    gameBuilds: manifest.builds ?? [],
    bundleHash: bundleHash(load.bundle),
    overlayHash: overlay === undefined ? null : documentHash(overlay),
    engineVersion: (await engineIo.engineVersion?.()) ?? 'unknown',
    divergences,
  });
  const violations = (await io.verifyIo.schemaRegistry()).validate('bench-result', result);
  if (violations.length > 0) throw new Error(`bench produced an invalid result: ${violations.map((v) => `${v.pointer} ${v.message}`).join('; ')}`);
  await io.writeFiles(input.command.gameDir, new Map([[input.command.savePath, `${JSON.stringify(result, null, 2)}\n`]]));
  return input.command.savePath;
}
