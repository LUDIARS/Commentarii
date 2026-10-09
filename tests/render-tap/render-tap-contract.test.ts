import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { classifyDraw } from '../../src/render-tap/classify-draw.ts';
import { buildSignatureIndex, identifyAppearance } from '../../src/render-tap/identify-appearance.ts';
import { isTapEnd, type TapFrame, type TapLine } from '../../src/render-tap/render-frame.ts';
import { createRenderFrameSequence } from '../../src/render-tap/render-frame-sequence.ts';
import { ObserverError, selectPlayerDraws } from '../../src/render-tap/select-player-draws.ts';
import { schemaRegistry } from '../support/bundles.ts';

const GOLDEN = new URL('../../../tests/fixtures/render-tap/golden-v1.jsonl', import.meta.url);

const SIGNATURES = buildSignatureIndex([
  { entity: 'enemy:bestia:wire-spider', mesh: 'mesh:bestia:wire_spider', material: ['mat:bestia:spider_a'] },
  { entity: 'enemy:bestia:bomber-dragonfly', mesh: 'mesh:bestia:bomber_dragonfly', material: ['mat:bestia:dragonfly_a'] },
  { entity: 'enemy:bestia:bazooka-beetle', mesh: 'mesh:bestia:bazooka_beetle', material: ['mat:bestia:beetle_a'] },
]);

async function golden(): Promise<TapLine[]> {
  const text = await readFile(GOLDEN, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as TapLine);
}

async function goldenFrame(index: number): Promise<TapFrame> {
  const line = (await golden())[index];
  assert.ok(line !== undefined && !isTapEnd(line));
  return line;
}

test('every golden line follows schema/render-frame.schema.json and the stream has no sequence problem', async () => {
  const registry = await schemaRegistry();
  const sequence = createRenderFrameSequence();
  for (const line of await golden()) {
    assert.deepEqual(registry.validate('render-frame', line), []);
    assert.deepEqual(sequence.accept(line), []);
  }
  assert.deepEqual(sequence.close(), []);
});

test('the schema fixes the contract version, 16-element matrices and the pass vocabulary', async () => {
  const registry = await schemaRegistry();
  const frame = await goldenFrame(0);
  assert.notDeepEqual(registry.validate('render-frame', { ...frame, contract: 'render-tap/0' }), []);
  assert.notDeepEqual(registry.validate('render-frame', { ...frame, camera: { ...frame.camera, view: [1, 0, 0, 0, 1, 0, 0, 0, 1] } }), []);
  assert.notDeepEqual(registry.validate('render-frame', { ...frame, passes: [{ name: 'x', kind: 'bloom', draws: [] }] }), []);
});

test('only draws the player camera showed go on: occluded, transparent, shadow, reflection, hidden and clipped UI are left out', async () => {
  const selected = selectPlayerDraws(await goldenFrame(0), SIGNATURES);
  assert.deepEqual(
    selected.seen.map((seen) => [seen.instance, seen.entity ?? null, seen.identity]),
    [
      [2, 'enemy:bestia:wire-spider', 'entity'],
      [6, null, 'unidentifiable'],
    ],
  );
  assert.deepEqual(selected.seen[0]?.pos, [0, 0, 4]);
  assert.deepEqual(selected.seen[0]?.screen, [610, 340, 60, 48]);
  assert.deepEqual(selected.excluded, { 'pass-not-visible': 2, occluded: 1, transparent: 1, 'hidden-ui': 1, clipped: 1 });
  assert.equal(selected.unknown, 1);
  assert.deepEqual(selected.ui.map((seen) => seen.ui), [
    { role: 'bar', element: 'hud.hp', fill: 0.8 },
    { role: 'glyph', element: 'damage-number', glyph: '30' },
  ]);
  assert.equal(selected.incomplete, false);
});

test('nothing of a left-out draw and no renderer asset ID reaches the selection', async () => {
  const text = JSON.stringify(selectPlayerDraws(await goldenFrame(0), SIGNATURES));
  for (const leak of ['mesh:', 'mat:', 'vtx1204', 'hud.boss_hp', '0.35', '"87"', 'enemy:bestia:bomber-dragonfly', 'enemy:bestia:bazooka-beetle']) {
    assert.equal(text.includes(leak), false, `${leak} leaked`);
  }
});

test('a wall between the camera and an enemy: occlusion failed is excluded, frustum-only is unknown, never visible', async () => {
  const frame = await goldenFrame(0);
  const scene = frame.passes.find((pass) => pass.kind === 'scene');
  assert.ok(scene);
  const behindWall = scene.draws.find((draw) => draw.instance === 3);
  const unproven = scene.draws.find((draw) => draw.instance === 4);
  assert.ok(behindWall && unproven);
  assert.deepEqual(classifyDraw(behindWall, scene, frame), { verdict: 'excluded', reason: 'occluded' });
  assert.deepEqual(classifyDraw(unproven, scene, frame), { verdict: 'unknown', reason: 'no-occlusion-evidence' });
  assert.deepEqual(classifyDraw({ ...unproven, screen_bbox: [1300, 10, 40, 40], visibility: 'occlusion-passed' }, scene, frame), { verdict: 'excluded', reason: 'off-viewport' });
});

test('two kinds that look the same are ambiguous and stay unnamed; a count-hash never identifies', async () => {
  const lookalike = buildSignatureIndex([
    { entity: 'enemy:bestia:wire-spider', mesh: 'mesh:bestia:wire_spider', material: ['mat:bestia:spider_a'] },
    { entity: 'enemy:bestia:wire-spider-elite', mesh: 'mesh:bestia:wire_spider', material: ['mat:bestia:spider_a'] },
  ]);
  const selected = selectPlayerDraws(await goldenFrame(0), lookalike);
  assert.deepEqual(selected.seen[0], { instance: 2, identity: 'ambiguous', pos: [0, 0, 4], screen: [610, 340, 60, 48] });
  const frame = await goldenFrame(0);
  const countHash = frame.passes.flatMap((pass) => pass.draws).find((draw) => draw.identity === 'count-hash');
  assert.ok(countHash);
  const index = buildSignatureIndex([{ entity: 'enemy:bestia:wire-spider', mesh: countHash.mesh, material: countHash.material }]);
  assert.deepEqual(identifyAppearance(countHash, index), { kind: 'unidentifiable' });
});

test('a frame with dropped draws is incomplete, and frames for another observer are refused', async () => {
  assert.equal(selectPlayerDraws(await goldenFrame(2), SIGNATURES).incomplete, true);
  const spectator = await goldenFrame(0);
  assert.throws(() => selectPlayerDraws({ ...spectator, observer: { ...spectator.observer, id: 'debug-free-camera' } }, SIGNATURES), ObserverError);
});

test('stream problems: lost frames, order, time, handle reuse without a new generation, line after end, disconnect', async () => {
  const [first, second] = [await goldenFrame(0), await goldenFrame(1)];
  const codes = (lines: readonly TapLine[], closed = false): string[] => {
    const sequence = createRenderFrameSequence();
    const found = lines.flatMap((line) => sequence.accept(line));
    return [...found, ...(closed ? sequence.close() : [])].map((problem) => problem.code);
  };
  assert.deepEqual(codes([first, { ...second, seq: 3 }]), ['loss']);
  assert.deepEqual(codes([first, { ...second, frame: first.frame }]), ['frame-order']);
  assert.deepEqual(codes([first, { ...second, t: 0 }]), ['time-order']);
  assert.deepEqual(codes([first, { ...second, tick: 1 }]), ['time-order']);

  const reused = (generation: number): TapFrame => ({
    ...second,
    passes: second.passes.map((pass) => ({ ...pass, draws: pass.draws.map((draw) => (draw.instance === 2 ? { ...draw, mesh: 'mesh:bestia:bomber_dragonfly', generation } : draw)) })),
  });
  assert.deepEqual(codes([first, reused(0)]), ['instance-reuse']);
  assert.deepEqual(codes([first, reused(1)]), []);
  assert.deepEqual(codes([first, reused(1), { ...reused(0), seq: 2, frame: 102, t: 5 }]).includes('generation'), true);

  const end: TapLine = { contract: 'render-tap/1', seq: 1, end: 'shutdown' };
  assert.deepEqual(codes([first, end, { ...second, seq: 2 }]), ['after-end']);
  assert.deepEqual(codes([first, second], true), ['disconnect']);
  assert.deepEqual(codes([first, end], true), []);
});
