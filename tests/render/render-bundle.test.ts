import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderBundle } from '../../src/render/render-bundle.ts';
import { loadBroken, loadSample } from '../support/bundles.ts';

// Names and values that exist only in samples/bestia/entities/enemies/bazooka-beetle.masked.json,
// plus the name of the masked tactic. The masked tactic's ID may appear in knowledge.md (it is
// listed as a tactic that references masked values), its content may not.
const MASKED_STRINGS = ['body_mass', 'aim_lead_divisor', '18 kg', '偏差射撃'];

test('player render produces every page and no masked value', async () => {
  const files = renderBundle(await loadSample(), { knowledge: 'player' });
  for (const page of ['README.md', 'enemies.md', 'catalog.md', 'rules.md', 'states.md', 'tactics.md', 'intents.md', 'knowledge.md', 'stages/dome-arena.md']) {
    assert.ok(files.has(page), page);
  }
  assert.equal(files.has('masked.md'), false);
  for (const [path, text] of files) {
    for (const masked of MASKED_STRINGS) {
      assert.ok(!text.includes(masked), `${path} contains masked string ${masked}`);
    }
  }
});

test('a masked value misplaced in a public file does not reach the player render', async () => {
  const files = renderBundle(await loadBroken('v03-masked-outside'), { knowledge: 'player' });
  const enemies = files.get('enemies.md') ?? '';
  assert.match(enemies, /enemy:bestia:bomber-dragonfly/);
  assert.ok(!enemies.includes('1.1 s'), 'masked cooldown of the dragonfly leaked');
});

test('full render adds the masked section only', async () => {
  const files = renderBundle(await loadSample(), { knowledge: 'full' });
  const masked = files.get('masked.md') ?? '';
  assert.match(masked, /body_mass/);
  assert.match(masked, /aim_lead_divisor/);
  assert.match(masked, /tactic:bestia:sidestep-lead-shot/);
  assert.ok(!(files.get('enemies.md') ?? '').includes('body_mass'));
  assert.match(files.get('README.md') ?? '', /masked\.md/);
});

test('pages carry the content the guide promises', async () => {
  const files = renderBundle(await loadSample(), { knowledge: 'player' });
  assert.match(files.get('enemies.md') ?? '', /\| enemy:bestia:wire-spider \| ワイヤースパイダー \|/);
  assert.match(files.get('rules.md') ?? '', /検算例: max_health = 180 → \*\*45 hp\*\*/);
  assert.match(files.get('states.md') ?? '', /stateDiagram-v2\n {2}\[\*\] --> chase/);
  assert.match(files.get('stages/dome-arena.md') ?? '', /\| 中間リング \| 中央, 外周 \|/);
  assert.match(files.get('tactics.md') ?? '', /\| tactic:bestia:kite-wire-spider \| .* \| 12 \| 75\.0% \| 2\.4 s \|/);
  assert.match(files.get('intents.md') ?? '', /node:mid-ring → node:center/);
});
