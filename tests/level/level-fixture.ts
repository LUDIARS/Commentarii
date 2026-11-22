
import type { Intent } from '@ludiars/commentarii-sdk/types';
import type { LevelQuality } from '../../src/level/level-reports.ts';

export const STAGE = 'stage:1:1';
export const CHALLENGE = 'ch:1';
export const ACTION = 'action:1:1';
export const EXISTING_RULE = { action: ACTION, targets: [], conditions: '1' };
export const SECOND_RULE = { action: ACTION, targets: ['enemy:1:1'], conditions: '1' };
export const SOURCE = { kind: 'human', ref: '1' };
export const HASH = `sha256:${'0'.repeat(64)}`;
export const INTENT: Intent = {
  stage: STAGE,
  allowed_divergences: [],
  intended: [{
    kind: 'route', id: 'intent:1:1:1', path: ['node:1', 'node:2'],
    level: {
      challenge: CHALLENGE,
      solutions: [
        { id: '1', rules: [EXISTING_RULE], skills: [1], styles: ['balanced'] },
        { id: '2', rules: [SECOND_RULE], skills: [1], styles: ['balanced'] },
      ],
      decisions: [{ id: '1', options: 6, regime: 'critical' }],
      random: [{ id: '1', management: 'unmanaged', overlaps: ['2'] }, { id: '2', management: 'unmanaged' }],
      feel: 'responsive',
      disclosure: 'late',
    },
  }],
};

export const BASE: Readonly<Record<string, unknown>> = {
  'manifest.json': { game_id: '1', title: { en: '1' }, version: '1', coordinates: { system: 'grid', unit: '1' } },
  'stages/1/stage.json': {
    id: STAGE, name: { en: '1' }, objectives: [{ value: { en: '1' }, knowledge: 'shown', source: SOURCE }],
  },
  'stages/1/map.json': {
    stage: STAGE, kind: 'zones', source: SOURCE,
    nodes: [{ id: 'node:1', knowledge: 'shown' }, { id: 'node:2', knowledge: 'shown' }],
    edges: [{ from: 'node:1', to: 'node:2', knowledge: 'shown' }], annotations: [],
  },
  'mechanics/actions/1.json': {
    id: ACTION, name: { en: '1' }, actor: ['entity'], pre: '1 == 1', effects: [], knowledge: 'shown', source: SOURCE,
  },
  'intent/1.json': INTENT,
};

export function quality(bundleHash = HASH): LevelQuality {
  return {
    schema: 'level-quality/1',
    evidence: ['model', 'sim'],
    versions: { bundle_hash: bundleHash },
    compatibility: { mode: 'player', seed: 1, stages: [STAGE] },
    gate_thresholds: { new_unsolvable: 1 },
    stages: [{ id: STAGE, not_measured: [] }],
    challenges: [{
      id: CHALLENGE, stage: STAGE, solution_measurement: true, experience_measurement: true,
      undetermined: false, omitted_classes: 0, not_measured: [], classes: [],
      choice: { counts: { none: 2 }, total: 2 },
      play_value: { counts: { forced: 2 }, total: 2, rule_taught: 0, late_disclosure: 0 },
      outcomes: { classification: 'flat' }, findings: [],
    }],
  };
}
