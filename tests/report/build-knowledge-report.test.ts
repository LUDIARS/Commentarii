import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildKnowledgeReport } from '../../src/report/build-knowledge-report.ts';
import { formatKnowledgeMarkdown } from '../../src/report/format-knowledge-markdown.ts';
import { loadSample } from '../support/bundles.ts';

test('entity counts match the sample bundle', async () => {
  const report = buildKnowledgeReport(await loadSample());
  assert.equal(report.game_id, 'bestia');
  assert.deepEqual(
    report.entities.map((row) => [row.id, row.shown, row.discoverable, row.masked, row.total]),
    [
      ['enemy:bestia:bazooka-beetle', 1, 4, 2, 7],
      ['enemy:bestia:bomber-dragonfly', 1, 4, 0, 5],
      ['enemy:bestia:wire-spider', 1, 5, 0, 6],
    ],
  );
  assert.deepEqual(report.entities[0]?.ratio, { shown: 0.143, discoverable: 0.571, masked: 0.286 });
  assert.equal(report.totals.total, 18);
  assert.deepEqual([report.totals.shown, report.totals.discoverable, report.totals.masked], [3, 13, 2]);
});

test('ungrounded values and masked-referencing tactics are listed', async () => {
  const report = buildKnowledgeReport(await loadSample());
  assert.deepEqual(report.ungrounded, [
    { path: 'stages/dome-arena/events.json', pointer: '/events/0/description', knowledge: 'shown', reason: 'llm-draft-source' },
  ]);
  assert.deepEqual(report.tactics_referencing_masked, [{ tactic: 'tactic:bestia:sidestep-lead-shot', masked_refs: 1 }]);
});

test('the report never carries masked names or values', async () => {
  const report = buildKnowledgeReport(await loadSample());
  for (const text of [JSON.stringify(report), formatKnowledgeMarkdown(report)]) {
    for (const masked of ['body_mass', 'aim_lead_divisor', '18 kg']) assert.ok(!text.includes(masked), masked);
  }
});
