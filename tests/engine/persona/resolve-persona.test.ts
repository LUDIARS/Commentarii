import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePersona, type PersonaSource } from '../../../src/engine/persona/resolve-persona.ts';
import { schemaRegistry } from '../../support/bundles.ts';
import { shippedPersona, testPersona } from '../../support/personas.ts';

function source(bundle: Record<string, unknown>, shipped: Record<string, unknown>): PersonaSource {
  return {
    readBundlePersona: async (_dir, slug) => (slug in bundle ? { origin: `bundle/${slug}`, data: bundle[slug] } : undefined),
    readShippedPersona: async (slug) => (slug in shipped ? { origin: `shipped/${slug}`, data: shipped[slug] } : undefined),
    listShippedPersonas: async () => Object.keys(shipped),
  };
}

const accept = () => [];

test('the three shipped personas pass the persona schema and differ in their habits', async () => {
  const registry = await schemaRegistry();
  const personas = await Promise.all(['novice', 'expert', 'explorer'].map(shippedPersona));
  for (const persona of personas) assert.deepEqual(registry.validate('persona', persona), [], persona.slug);
  const [novice, expert, explorer] = personas;
  assert.ok((novice?.reaction_delay_ticks ?? 0) > (expert?.reaction_delay_ticks ?? 0));
  assert.equal(novice?.min_confidence, 'authored');
  assert.equal(expert?.min_confidence, 'learned');
  assert.ok((explorer?.exploration_rate ?? 0) > (expert?.exploration_rate ?? 0));
});

test('a bundle persona wins over the shipped one with the same slug', async () => {
  const own = testPersona({ slug: 'novice', hysteresis: 0.5 });
  const persona = await resolvePersona(source({ novice: own }, { novice: testPersona({ slug: 'novice' }) }), accept, 'guide', 'novice');
  assert.equal(persona.hysteresis, 0.5);
  const fallback = await resolvePersona(source({}, { novice: testPersona({ slug: 'novice' }) }), accept, 'guide', 'novice');
  assert.equal(fallback.hysteresis, 0.1);
});

test('missing, invalid or mislabelled personas are errors, never silently replaced', async () => {
  await assert.rejects(resolvePersona(source({}, { expert: {} }), accept, 'guide', 'pro'), /not shipped|neither/);
  await assert.rejects(resolvePersona(source({ pro: {} }, {}), () => ['/ bad'], 'guide', 'pro'), /invalid/);
  await assert.rejects(resolvePersona(source({ pro: testPersona({ slug: 'other' }) }, {}), accept, 'guide', 'pro'), /declares slug/);
  await assert.rejects(resolvePersona(source({}, {}), accept, 'guide', '../x'), /not a slug/);
});

test('the persona schema rejects out-of-range weights and rates', async () => {
  const registry = await schemaRegistry();
  assert.notDeepEqual(registry.validate('persona', { ...testPersona(), exploration_rate: 2 }), []);
  assert.notDeepEqual(registry.validate('persona', { ...testPersona(), weights: { distance: 1 } }), []);
});
