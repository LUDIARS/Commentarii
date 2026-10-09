import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimAdapter } from '../../../src/adapters/sim/sim-adapter.ts';
import { runDriver } from '../../../src/engine/driver.ts';
import { createReflector } from '../../../src/engine/reflect/create-reflector.ts';
import { createObservationSink, MaskedObservationError } from '../../../src/engine/reflect/observation-sink.ts';
import type { OverlayLine } from '../../../src/engine/reflect/overlay-line.ts';
import { buildReflectWorld } from '../../../src/engine/reflect/reflect-world.ts';
import { createUtilityBtDecider } from '../../../src/engine/utility-bt-decider.ts';
import { findMaskedPointers } from '../../../src/replay/find-masked-pointers.ts';
import type { ObservationMode } from '../../../src/replay/observation-frame.ts';
import { schemaRegistry } from '../../support/bundles.ts';
import { loadDrifted } from '../../support/learn.ts';
import { shippedPersona } from '../../support/personas.ts';

async function reflectedRun(mode: ObservationMode): Promise<OverlayLine[]> {
  // The drifted bundle adds a tactic that holds whenever the dragonfly is near (no HP condition).
  const { bundle } = await loadDrifted();
  const persona = await shippedPersona('explorer');
  const written: string[] = [];
  const decider = createUtilityBtDecider({ bundle, persona }, 5);
  const reflect = createReflector({
    world: buildReflectWorld(bundle, mode),
    sink: createObservationSink({ append: async (line) => void written.push(line) }, mode),
    acted: () => decider.lastOutcome?.acted,
  });
  const adapter = createSimAdapter({ bundle, mode, purpose: 'efficiency', seed: 5 });
  await runDriver({ adapter, decider, mode, maxTicks: 1200, reflect });
  return written.map((line) => JSON.parse(line) as OverlayLine);
}

test('a player run reflects tactic outcomes into schema-valid lines with no masked value', async () => {
  const lines = await reflectedRun('player');
  const registry = await schemaRegistry();
  assert.ok(lines.some((line) => line.kind === 'tactic-outcome' && line.observed?.outcome === 'start'), 'the engine ran at least one tactic');
  for (const line of lines) {
    assert.deepEqual(registry.validate('observation', line), [], JSON.stringify(line));
    assert.equal(line.mode, 'player');
  }
  assert.deepEqual(findMaskedPointers(lines), []);
});

test('the sink refuses a player line carrying knowledge: masked and writes nothing of it', async () => {
  const written: string[] = [];
  const append = async (text: string): Promise<void> => void written.push(text);
  const sink = createObservationSink({ append }, 'player');
  const line: OverlayLine = {
    t: 0,
    tick: 0,
    kind: 'value-estimate',
    entity: 'enemy:bestia:wire-spider',
    observed: { leaked: { value: 1, knowledge: 'masked' } },
    source: 'render-tap',
    mode: 'player',
    purpose: 'efficiency',
  };
  await assert.rejects(sink.write([line]), MaskedObservationError);
  assert.deepEqual(written, []);
  await createObservationSink({ append }, 'omniscient').write([{ ...line, mode: 'omniscient' }]);
  assert.equal(written.length, 1, 'omniscient lines may carry masked values (checking only)');
});
