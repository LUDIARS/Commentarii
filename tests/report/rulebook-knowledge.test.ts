// The knowledge report includes the rulebook: one row per element with its knowledge and its
// masked override count, never an override's content.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildKnowledgeReport } from '../../src/report/build-knowledge-report.ts';
import { formatKnowledgeMarkdown } from '../../src/report/format-knowledge-markdown.ts';
import { loadSample } from '../support/bundles.ts';

test('rulebook rows carry knowledge and masked override counts', async () => {
  const report = buildKnowledgeReport(await loadSample());
  const shoot = report.rulebook.rows.find((row) => row.id === 'action:bestia:shoot');
  assert.deepEqual(shoot, { kind: 'action', id: 'action:bestia:shoot', knowledge: 'discoverable', masked_overrides: 1, path: 'mechanics/actions/shoot.json' });
  assert.equal(report.rulebook.rows.find((row) => row.id === 'alive')?.knowledge, 'shown');
  const { totals } = report.rulebook;
  assert.equal(totals.total, totals.shown + totals.discoverable + totals.masked);
  assert.equal(totals.masked, 1);
  const markdown = formatKnowledgeMarkdown(report);
  assert.match(markdown, /## ルールブックの境界/);
  assert.ok(!markdown.includes('evaded'));
});
