import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tactic } from '../../../src/domain/documents.ts';
import { extractCandidates } from '../../../src/import/plays/extract-candidates.ts';
import type { ReplayAction } from '../../../src/replay/replay-action.ts';
import type { ReplayRun } from '../../../src/replay/replay-record.ts';
import { headerFields, observation } from '../../replay/replay-fixtures.ts';

function humanRun(runId: string, player: string, actions: readonly ReplayAction[], result: 'success' | 'fail' = 'success'): ReplayRun {
  return {
    header: { type: 'header', ...headerFields(), run_id: runId, purpose: 'human', source: 'human' },
    ticks: actions.map((action, tick) => ({ type: 'tick', tick, t: tick / 10, observation: { ...observation(tick), purpose: 'human' }, decision: [], action })),
    footer: { type: 'footer', ended_at: '2026-10-09T00:00:01.000Z', result, summary: { player } },
  };
}

function tactic(id: string, steps: Tactic['do']): Tactic {
  return {
    id,
    name: { ja: id },
    when: { all: [{ entity: 'enemy:bestia:wire-spider', visible: true }] },
    do: steps,
    expect: { within_sec: 1 },
    because: ['enemy:bestia:wire-spider'],
    knowledge: 'discoverable',
    confidence: 'authored',
    superseded_by: null,
  };
}

// observation() shows the wire spider as instance 2, at node:mid-ring, full HP.
const approachThenAttack: ReplayAction[] = [{ move_to: 'node:center' }, { move_to: 'node:center' }, { wait: 0 }, { attack: 2 }];

test('a sequence an existing tactic covers is not a candidate', () => {
  const covering = tactic('tactic:bestia:approach-attack', [{ move_to: 'node:center' }, { attack: '$enemy' }]);
  const result = extractCandidates({ gameId: 'bestia', runs: [humanRun('run:human-a', 'p1', approachThenAttack)], tactics: [covering] });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.runs, 1);
});

test('a sequence no tactic covers becomes one learned draft candidate with its evidence', () => {
  const other = tactic('tactic:bestia:attack-only', [{ attack: '$enemy' }]);
  const runs = [humanRun('run:human-a', 'p1', approachThenAttack), humanRun('run:human-b', 'p2', approachThenAttack, 'fail'), humanRun('run:human-c', 'p2', approachThenAttack)];
  const result = extractCandidates({ gameId: 'bestia', runs, tactics: [other] });
  assert.equal(result.candidates.length, 1);
  const [candidate] = result.candidates;
  assert.match(candidate?.tactic.id ?? '', /^tactic:bestia:human-[0-9a-f]{10}$/);
  assert.deepEqual(candidate?.tactic.do, [{ move_to: 'node:center' }, { attack: '$enemy' }]);
  assert.deepEqual(candidate?.tactic.when, {
    all: [{ stage: { id: 'stage:bestia:dome-arena' } }, { entity: 'enemy:bestia:wire-spider', visible: true }],
  });
  assert.equal(candidate?.tactic.confidence, 'learned');
  assert.equal(candidate?.tactic.draft, true);
  assert.equal(candidate?.tactic.knowledge, 'masked');
  assert.deepEqual(candidate?.source, { kind: 'human', ref: 'run:human-a run:human-b run:human-c x3' });
  assert.deepEqual(candidate?.evidence, {
    stage: 'stage:bestia:dome-arena',
    occurrences: 3,
    runs: 3,
    players: 2,
    run_ids: ['run:human-a', 'run:human-b', 'run:human-c'],
    success_rate: 0.6667,
  });
});

test('a tactic whose when does not hold does not cover the sequence', () => {
  const elsewhere = { ...tactic('tactic:bestia:approach-attack', [{ move_to: 'node:center' }, { attack: '$enemy' }]), when: { all: [{ entity: 'enemy:bestia:bazooka-beetle', visible: true }] } };
  const result = extractCandidates({ gameId: 'bestia', runs: [humanRun('run:human-a', 'p1', approachThenAttack)], tactics: [elsewhere] });
  assert.equal(result.candidates.length, 1);
});

test('waits, positions and instances outside the situation are not steps', () => {
  const result = extractCandidates({ gameId: 'bestia', runs: [humanRun('run:human-a', 'p1', [{ wait: 0 }, { move_to: [1, 0, 2] }, { attack: 99 }])], tactics: [] });
  assert.deepEqual(result.candidates, []);
});
