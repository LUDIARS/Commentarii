// loadRulebook (SDK rulebook entry): the player rulebook carries no trace of a masked override -
// not the override, not its effects or probabilities, not even a difference that would let the
// player infer one exists - while the omniscient rulebook applies it.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBundle, type BundleSource } from '@ludiars/commentarii-sdk/bundle';
import { loadBundleRulebook, loadRulebook } from '@ludiars/commentarii-sdk/rulebook';
import { emptyOverlay, type ExportedBundle, type LegacyExportedBundle, type LoadResult } from '@ludiars/commentarii-sdk/types';
import { createFsBundleSource } from '../../src/adapters/fs/fs-bundle-source.ts';
import { buildExport } from '../../src/export/build-export.ts';
import { loadSample, SAMPLE_DIR, schemaRegistry } from '../support/bundles.ts';

const MASKED_FILES = ['mechanics/actions/shoot.masked.json', 'entities/enemies/bazooka-beetle.masked.json'];

function without(source: BundleSource, paths: readonly string[]): BundleSource {
  return {
    async listFiles() {
      return (await source.listFiles()).filter((path) => !paths.includes(path));
    },
    readText: (path) => source.readText(path),
  };
}

async function loadWithoutMasked(): Promise<LoadResult> {
  return loadBundle(without(await createFsBundleSource(SAMPLE_DIR), MASKED_FILES), await schemaRegistry());
}

function exported(load: LoadResult, knowledge: 'player' | 'full'): ExportedBundle {
  return JSON.parse(JSON.stringify(buildExport(load, { knowledge, target: 'runtime' }))) as ExportedBundle;
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return [...Object.keys(value), ...Object.values(value).flatMap(strings)];
  return [];
}

test('the player rulebook has no masked knowledge, override or overridden mark at any depth', async () => {
  const load = await loadSample();
  for (const knowledge of ['player', 'full'] as const) {
    const rulebook = loadRulebook(exported(load, knowledge), 'player');
    const text = JSON.stringify(rulebook);
    assert.equal(text.includes('"masked"'), false, knowledge);
    assert.equal(text.includes('override'), false, knowledge);
    assert.ok(rulebook.actions.some((action) => action.id === 'action:bestia:shoot'));
  }
});

test('nothing in the player rulebook or the player bundle.json tells whether a masked override exists', async () => {
  const withMasked = await loadSample();
  const withoutMasked = await loadWithoutMasked();
  assert.ok(withMasked.bundle.rulebook.maskedActions.length > 0);
  assert.equal(withoutMasked.bundle.rulebook.maskedActions.length, 0);
  assert.deepEqual(exported(withMasked, 'player'), exported(withoutMasked, 'player'));
  assert.deepEqual(loadRulebook(exported(withMasked, 'player'), 'player'), loadRulebook(exported(withoutMasked, 'player'), 'player'));
  assert.deepEqual(loadRulebook(exported(withMasked, 'full'), 'player'), loadRulebook(exported(withoutMasked, 'full'), 'player'));
});

test('the visible shoot is complete on its own: one certain hit branch, probabilities adding up to 1', async () => {
  const shoot = loadRulebook(exported(await loadSample(), 'player'), 'player').actions.find((action) => action.id === 'action:bestia:shoot');
  assert.ok(shoot);
  for (const effect of shoot.effects) assert.equal(effect.outcomes.reduce((sum, outcome) => sum + outcome.p, 0), 1);
  const words = strings(shoot);
  assert.equal(words.includes('evaded'), false);
  assert.equal(words.some((word) => word.includes('moved(self)')), false);
});

test('the omniscient rulebook applies the override: shoot gains the evaded branch, identity unchanged', async () => {
  const load = await loadSample();
  const player = loadRulebook(exported(load, 'full'), 'player').actions.find((action) => action.id === 'action:bestia:shoot');
  const omniscient = loadRulebook(exported(load, 'full'), 'omniscient').actions.find((action) => action.id === 'action:bestia:shoot');
  assert.ok(player && omniscient);
  assert.deepEqual(omniscient.overridden?.keys, ['effects']);
  assert.notDeepEqual(omniscient.effects, player.effects);
  const evaded = omniscient.effects.flatMap((effect) => effect.outcomes).find((outcome) => outcome.label === 'evaded');
  assert.deepEqual(evaded, { p: 0.5, label: 'evaded', assign: [] });
  for (const key of ['id', 'actor', 'params', 'maps_to', 'pre'] as const) assert.deepEqual(omniscient[key], player[key], key);
});

test('the omniscient rulebook needs a full export', async () => {
  const player = exported(await loadSample(), 'player');
  assert.throws(() => loadRulebook(player, 'omniscient'), /full export/);
});

test('a format 1 bundle.json reads as a rulebook of rules and state machines only', async () => {
  const current = exported(await loadSample(), 'player');
  const { mechanics: _mechanics, ...documents } = current.documents;
  const { actions: _actions, ...index } = current.index;
  const legacy: LegacyExportedBundle = {
    format: current.format,
    format_version: 1,
    game_id: current.game_id,
    manifest_version: current.manifest_version,
    knowledge: current.knowledge,
    target: current.target,
    documents,
    index,
  };
  const rulebook = loadRulebook(legacy, 'player');
  assert.deepEqual(rulebook.actions, []);
  assert.deepEqual(rulebook.variables, {});
  assert.equal(rulebook.rules.length, current.documents.rules.length);
});

test('the overlay adds learned estimates as intervals over the run estimates', async () => {
  const overlay = {
    ...emptyOverlay('bestia'),
    values: [
      {
        entity: 'enemy:bestia:wire-spider',
        quantity: 'health',
        estimates: [
          { run: 'run:b', value: 150 },
          { run: 'run:a', value: 130 },
        ],
      },
    ],
  };
  const rulebook = loadRulebook(exported(await loadSample(), 'player'), 'player', { overlay });
  assert.deepEqual(
    rulebook.learned.map(({ entity, variable, interval, samples, runs }) => ({ entity, variable, interval, samples, runs })),
    [{ entity: 'enemy:bestia:wire-spider', variable: 'max_hp', interval: [130, 150], samples: 2, runs: ['run:a', 'run:b'] }],
  );
});

test('a bundle loaded from its directory gives the same rulebook as its bundle.json', async () => {
  const load = await loadSample();
  assert.deepEqual(loadBundleRulebook(load.bundle, 'player'), loadRulebook(exported(load, 'player'), 'player'));
  assert.deepEqual(loadBundleRulebook(load.bundle, 'omniscient'), loadRulebook(exported(load, 'full'), 'omniscient'));
});
