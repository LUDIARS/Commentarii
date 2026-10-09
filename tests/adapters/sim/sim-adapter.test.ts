import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimAdapter } from '../../../src/adapters/sim/sim-adapter.ts';
import { createSimLayout } from '../../../src/adapters/sim/sim-layout.ts';
import { runDriver } from '../../../src/engine/driver.ts';
import { createUtilityBtDecider } from '../../../src/engine/utility-bt-decider.ts';
import { findMaskedPointers } from '../../../src/replay/find-masked-pointers.ts';
import type { ObservationFrame } from '../../../src/replay/observation-frame.ts';
import { createWaitDecider } from '../../../src/replay/wait-decider.ts';
import { loadSample } from '../../support/bundles.ts';
import { shippedPersona } from '../../support/personas.ts';

async function frames(mode: 'player' | 'omniscient', ticks: number): Promise<ObservationFrame[]> {
  const { bundle } = await loadSample();
  const adapter = createSimAdapter({ bundle, mode, purpose: 'efficiency', seed: 3 });
  const seen: ObservationFrame[] = [];
  for (let i = 0; i < ticks; i += 1) {
    const observed = await adapter.observe();
    if (observed.type === 'end') break;
    seen.push(observed.frame);
    await adapter.act({ move_to: 'node:center' });
  }
  return seen;
}

test('the sim lays the sample arena out as rings and spawns the stage roster', async () => {
  const { bundle } = await loadSample();
  const [first] = await frames('player', 1);
  assert.deepEqual(first?.entities.map((entity) => [entity.entity, entity.instance]), [
    ['enemy:bestia:bazooka-beetle', 1],
    ['enemy:bestia:wire-spider', 2],
    ['enemy:bestia:bomber-dragonfly', 3],
  ]);
  assert.equal(first?.stage.node, 'node:mid-ring');
  assert.deepEqual(first?.self.hp, { value: 1, knowledge: 'shown' });
  assert.equal(first?.entities[0]?.state_guess, 'state:bestia:battle-ai#chase');
  const layout = createSimLayout(bundle.stages[0]?.map?.doc, 12, 1);
  assert.equal(layout.nodeOf([0, 0]), 'node:center');
  assert.equal(layout.nodeOf([0, -35]), 'node:outside');
  assert.deepEqual(layout.pointOf('node:outer-ring', [0, 5]), [0, 24]);
});

test('player observations never carry a masked value; omniscient ones show the masked stats', async () => {
  for (const observation of await frames('player', 50)) assert.deepEqual(findMaskedPointers(observation), []);
  const [omniscient] = await frames('omniscient', 1);
  assert.ok(findMaskedPointers(omniscient).length > 0);
  assert.equal(omniscient?.source, 'game-api');
});

test('same seed and actions give the same game', async () => {
  assert.deepEqual(await frames('player', 80), await frames('player', 80));
});

test('the engine clears the sample arena in the sim; a waiting player does not', async () => {
  const { bundle } = await loadSample();
  const persona = await shippedPersona('expert');
  const adapter = createSimAdapter({ bundle, mode: 'player', purpose: 'efficiency', seed: 11 });
  const report = await runDriver({ adapter, decider: createUtilityBtDecider({ bundle, persona }, 11), mode: 'player', maxTicks: 2000 });
  assert.equal(report.result, 'success');
  assert.equal(adapter.stats().enemies_left, 0);
  const idle = createSimAdapter({ bundle, mode: 'player', purpose: 'efficiency', seed: 11 });
  const waited = await runDriver({ adapter: idle, decider: createWaitDecider(), mode: 'player', maxTicks: 2000 });
  assert.notEqual(waited.result, 'success');
});

test('identify maps the sim\'s entity keys to guide IDs', async () => {
  const { bundle } = await loadSample();
  const adapter = createSimAdapter({ bundle, mode: 'player', purpose: 'efficiency', seed: 1 });
  assert.equal(adapter.identify('wire-spider'), 'enemy:bestia:wire-spider');
  assert.equal(adapter.identify('enemy:bestia:wire-spider'), 'enemy:bestia:wire-spider');
  assert.equal(adapter.identify('unknown'), undefined);
});
