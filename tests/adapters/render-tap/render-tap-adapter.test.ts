import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ProtocolError } from '../../../src/adapter/protocol.ts';
import { createRenderTapAdapter } from '../../../src/adapters/render-tap/render-tap-adapter.ts';
import { cameraPosition, tapToObservation, type TapContext } from '../../../src/adapters/render-tap/tap-to-observation.ts';
import type { LineChannel } from '../../../src/adapters/stdio/line-channel.ts';
import { runDriver } from '../../../src/engine/driver.ts';
import { observationBoundaryProblems } from '../../../src/observation/check-observation-boundary.ts';
import { buildSignatureIndex } from '../../../src/render-tap/identify-appearance.ts';
import { isTapEnd, type TapFrame, type TapLine } from '../../../src/render-tap/render-frame.ts';
import type { SequenceProblem } from '../../../src/render-tap/render-frame-sequence.ts';
import { createWaitDecider } from '../../../src/replay/wait-decider.ts';
import { REPO_ROOT, schemaRegistry } from '../../support/bundles.ts';

const GOLDEN = join(REPO_ROOT, 'tests', 'fixtures', 'render-tap', 'golden-v1.jsonl');

const CONTEXT: TapContext = {
  stageId: 'stage:bestia:dome-arena',
  purpose: 'efficiency',
  config: { ui: [{ element: 'hud.hp', read: 'fill', path: 'self.hp' }, { element: 'hud.boss_hp', read: 'fill', path: 'extra.boss_hp' }, { element: 'enemy-hp-number', read: 'number', path: 'extra.enemy_hp' }] },
  signatures: buildSignatureIndex([
    { entity: 'enemy:bestia:wire-spider', mesh: 'mesh:bestia:wire_spider', material: ['mat:bestia:spider_a'] },
    { entity: 'enemy:bestia:bomber-dragonfly', mesh: 'mesh:bestia:bomber_dragonfly', material: ['mat:bestia:dragonfly_a'] },
  ]),
};

async function goldenLines(): Promise<string[]> {
  return (await readFile(GOLDEN, 'utf8')).split('\n').filter((line) => line.trim() !== '');
}

async function goldenFrame(index: number): Promise<TapFrame> {
  const line = JSON.parse((await goldenLines())[index] ?? 'null') as TapLine;
  assert.ok(line !== null && !isTapEnd(line));
  return line;
}

function memoryChannel(lines: readonly string[]): LineChannel & { written: string[] } {
  const queue = [...lines];
  const written: string[] = [];
  return { written, readLine: async () => queue.shift(), writeLine: async (line) => void written.push(line), close: () => {} };
}

test('a tapped frame becomes a player observation from the visible draws only, with no asset ID and inside the boundary', async () => {
  const observation = tapToObservation(await goldenFrame(0), CONTEXT);
  assert.deepEqual([observation.source, observation.mode, observation.tick, observation.t], ['render-tap', 'player', 40, 4]);
  assert.deepEqual(observation.entities, [
    { entity: 'enemy:bestia:wire-spider', instance: 2, pos: [0, 0, 4], screen: [610, 340, 60, 48], confidence: 1 },
    { instance: 6, pos: [3, 0, 2], screen: [700, 400, 30, 30], confidence: 0 },
  ]);
  assert.deepEqual(observation.self.hp, { value: 0.8, knowledge: 'shown' });
  assert.deepEqual(observation.self.pos, [0, 2, 20], 'the camera position from the view matrix');
  assert.equal(observation.extra, undefined, 'the hidden boss bar and the clipped enemy number are not read');
  const text = JSON.stringify(observation);
  for (const leak of ['mesh:', 'mat:', 'vtx', 'bomber-dragonfly', '0.35', '87']) assert.equal(text.includes(leak), false, leak);
  assert.deepEqual(observationBoundaryProblems(observation, []), []);
});

test('the camera position is -R^T t of the column-major view matrix', () => {
  const rotatedY90 = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 0, 0, 1];
  assert.deepEqual(cameraPosition(rotatedY90), [0, 0, -5]);
});

test('the adapter feeds the driver one observation per frame and ends on the end line; actions go out as protocol lines', async () => {
  const frames = memoryChannel(await goldenLines());
  const actions = memoryChannel([]);
  const registry = await schemaRegistry();
  const problems: SequenceProblem[] = [];
  const adapter = createRenderTapAdapter({ gameId: 'bestia', frames, actions, context: CONTEXT, validate: (line) => registry.validate('render-frame', line).map((v) => v.message), onProblem: (problem) => problems.push(problem) });
  const report = await runDriver({ adapter, decider: createWaitDecider(), mode: 'player', maxTicks: 10 });
  assert.deepEqual([report.ticks, report.stop.reason, report.result, report.summary.stopped], [3, 'game-ended', 'abort', 'tap-shutdown']);
  assert.deepEqual(actions.written.map((line) => (JSON.parse(line) as { type: string; tick: number }).tick), [40, 41, 42]);
  assert.deepEqual(problems, []);
});

test('a stream that closes without the end line is a disconnect; a lost frame is reported and the run goes on', async () => {
  const lines = await goldenLines();
  const skipped = [lines[0] ?? '', lines[2] ?? ''];
  const problems: SequenceProblem[] = [];
  const adapter = createRenderTapAdapter({ gameId: 'bestia', frames: memoryChannel(skipped), context: CONTEXT, validate: () => [], onProblem: (problem) => problems.push(problem) });
  const report = await runDriver({ adapter, decider: createWaitDecider(), mode: 'player', maxTicks: 10 });
  assert.deepEqual([report.ticks, report.summary.stopped], [2, 'tap-disconnected']);
  assert.deepEqual(problems.map((problem) => problem.code), ['loss', 'disconnect']);
});

test('a line that breaks render-tap/1 stops the run as a protocol error', async () => {
  const registry = await schemaRegistry();
  const frame = JSON.parse((await goldenLines())[0] ?? '{}') as Record<string, unknown>;
  const adapter = createRenderTapAdapter({ gameId: 'bestia', frames: memoryChannel([JSON.stringify({ ...frame, contract: 'render-tap/0' })]), context: CONTEXT, validate: (line) => registry.validate('render-frame', line).map((v) => v.message), onProblem: () => {} });
  await assert.rejects(adapter.observe(), ProtocolError);
});

test('guide run --adapter render-tap records a replay that loads, with the same observations', async () => {
  const { runCli } = await import('../../../src/cli/run-cli.ts');
  const { openBundleDir } = await import('../../../src/adapters/fs/open-bundle-dir.ts');
  const { writeOutputFiles } = await import('../../../src/adapters/fs/write-output-files.ts');
  const { openReplayFile } = await import('../../../src/adapters/fs/replay-open-file.ts');
  const { createReplayFileWriter } = await import('../../../src/adapters/fs/replay-file-writer.ts');
  const { loadPersona } = await import('../../../src/adapters/fs/load-persona.ts');
  const { openFrameSource } = await import('../../../src/adapters/fs/open-frame-source.ts');
  const { createFsVerifyIo } = await import('../../../src/adapters/fs/verify-io-fs.ts');
  const { fsScanSource } = await import('../../../src/audit/fs-scan-source.ts');
  const { testImportIo } = await import('../../support/import-io.ts');
  const { SAMPLE_DIR } = await import('../../support/bundles.ts');
  const directory = await mkdtemp(join(tmpdir(), 'cm-tap-'));
  try {
    const record = join(directory, 'tap.jsonl');
    let out = '';
    let err = '';
    const io = {
      stdout: (text: string) => void (out += text),
      stderr: (text: string) => void (err += text),
      openBundle: openBundleDir,
      writeFiles: writeOutputFiles,
      openReplay: openReplayFile,
      importIo: testImportIo(),
      scanSource: fsScanSource,
      verifyIo: createFsVerifyIo(),
      engineIo: { loadPersona, createReplayWriter: createReplayFileWriter, openStdioChannel: () => memoryChannel([]), now: () => new Date(0), openFrameSource },
    };
    const code = await runCli(['run', '--game', SAMPLE_DIR, '--adapter', 'render-tap', '--frames', GOLDEN, '--record', record], io);
    assert.equal(code, 0, err);
    assert.match(out, /"adapter": "render-tap"/);
    const loaded = await openReplayFile(record);
    assert.deepEqual(loaded.issues, []);
    assert.deepEqual(loaded.run?.ticks.map((tick) => tick.observation.source), ['render-tap', 'render-tap', 'render-tap']);
    const usage = await runCli(['run', '--game', SAMPLE_DIR, '--adapter', 'render-tap'], io);
    assert.equal(usage, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
