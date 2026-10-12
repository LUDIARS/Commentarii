import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectHypothesesPath, EFFECT_HYPOTHESES_FORMAT, PLAN_RECORD_FORMAT, type EffectHypothesesFile, type PlanRecord } from '@ludiars/commentarii-sdk/types';
import { schemaRegistry } from '../support/bundles.ts';

const hypotheses: EffectHypothesesFile = {
  format: EFFECT_HYPOTHESES_FORMAT,
  game_id: 'bestia',
  action: 'action:bestia:shoot',
  runs: { player: ['run:bestia-expert-s1'], ignored_omniscient: ['run:bestia-expert-omni'] },
  hypotheses: [
    {
      id: 'hypothesis:bestia:shoot.self-hp.moving',
      action: 'action:bestia:shoot',
      role: 'target',
      observable: 'self.hp.value',
      unit: 'hp-bar-ratio',
      condition: 'moved(self)',
      predicted_delta: { lo: -0.16, hi: -0.16 },
      observed_delta: { lo: -0.16, hi: 0, mean: -0.08, sd: 0.08 },
      interval: { lo: -0.1, hi: -0.06, level: 0.95 },
      samples: 24,
      evidence: { completed: 24, censored: 2, confounded: 3 },
      holdout: { samples: 6, mean: -0.07, inside: true },
      runs: ['run:bestia-expert-s1'],
      status: 'provisional',
      knowledge: 'discoverable',
      source: { kind: 'observed', ref: 'run:bestia-expert-s1 x24' },
      approved_for_canonical: false,
    },
  ],
};

const record: PlanRecord = {
  format: PLAN_RECORD_FORMAT,
  run: 'run:bestia-expert-s1',
  game_id: 'bestia',
  tick: 40,
  stance: 'autonomous',
  proposer: 'goap',
  goal: 'hp(e:2) <= 0',
  when_expr: 'visible(e:2) && dist(self, e:2) > range(self)',
  steps: [
    { action: 'action:bestia:move', params: { goal: 'entity', for: 'number' } },
    { action: 'action:bestia:shoot', params: { target: 'entity' }, repeat_until: '!alive(e:2)' },
  ],
  because: { actions: ['action:bestia:move', 'action:bestia:shoot'], rules: ['rule:bestia:damage'] },
  predicted: { progress: 0.3, time_sec: 4 },
  measured: { progress: 0.28, time_sec: 4.4, damage: 12 },
  outcome: 'success',
  confidence: 'learned',
};

test('effect hypotheses (observations/rules/<action>.json) validate; approval and knowledge are fixed', async () => {
  const registry = await schemaRegistry();
  assert.deepEqual(registry.validate('effect-hypotheses', hypotheses), []);
  assert.equal(effectHypothesesPath('action:bestia:shoot'), 'observations/rules/shoot.json');
  const [first] = hypotheses.hypotheses;
  assert.ok(first);
  assert.notDeepEqual(registry.validate('effect-hypotheses', { ...hypotheses, hypotheses: [{ ...first, approved_for_canonical: true }] }), []);
  assert.notDeepEqual(registry.validate('effect-hypotheses', { ...hypotheses, hypotheses: [{ ...first, knowledge: 'masked' }] }), []);
});

test('a plan record (observations/plans/<run>.jsonl line) validates; params keep kinds only', async () => {
  const registry = await schemaRegistry();
  assert.deepEqual(registry.validate('plan-record', record), []);
  assert.notDeepEqual(registry.validate('plan-record', { ...record, steps: [{ action: 'action:bestia:shoot', params: { target: 2 } }] }), []);
  assert.notDeepEqual(registry.validate('plan-record', { ...record, stance: 'guided' }), []);
});

test('a bench result may carry the curriculum key, proposer shares and the decision latency', async () => {
  const registry = await schemaRegistry();
  const hash = `sha256:${'b'.repeat(64)}`;
  const result = {
    format: 'bench-result/1',
    kind: 'live-balance',
    evidence: 'sim',
    game_id: 'bestia',
    compatibility: {
      adapter: 'commentarii-sim',
      persona: 'expert',
      persona_hash: hash,
      seed: 1,
      seeds: [1],
      runs: 1,
      ticks: 10,
      mode: 'player',
      purpose: 'efficiency',
      decision_mode: 'player-knowledge',
      tactics: 'none',
      stance: 'autonomous',
      decider: 'autonomous',
      engine_version: '0.4.0',
      sdk_version: '0.4.0',
      curriculum: 'fresh-player',
      curriculum_hash: hash,
    },
    versions: { manifest_version: '0.1.0', game_builds: ['main'], bundle_hash: hash, overlay_hash: null, engine_version: '0.4.0' },
    metrics: { clear_rate: 1, clear_interval: [0.2, 1], time_p50: 20, time_p90: 20, damage_p50: 50, tactic_share: {}, proposer_share: { goap: 0.6, reactive: 0.4 } },
    latency: { decisions: 200, p50_ms: 1.2, p99_ms: 3.4, max_ms: 9, over_deadline: 2, calibration: { hz: 60, p99_ms: 2, deadline_ms: 4 } },
    divergences: null,
    per_run: [{ seed: 1, result: 'success', ticks: 200, time_sec: 20, damage_taken: 50 }],
  };
  assert.deepEqual(registry.validate('bench-result', result), []);
  assert.notDeepEqual(registry.validate('bench-result', { ...result, compatibility: { ...result.compatibility, curriculum: 'teacher' } }), []);
});
