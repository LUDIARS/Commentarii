
export type LevelSkill = 1 | 2 | 3 | 4 | 5;
export type LevelFeel = 'flat' | 'responsive' | 'uncontrolled';
export type LevelDisclosure = 'rule-taught' | 'late' | 'discovery';
export type LevelRegime = 'calm' | 'threat' | 'critical';
export type RandomManagement = 'bounded' | 'bag' | 'previewed' | 'narrow' | 'unmanaged';

export interface LevelRuleKey {
  readonly action: string;
  readonly targets: readonly string[];
  readonly conditions: string;
}

export interface LevelSolution {
  readonly id: string;
  readonly rules: readonly LevelRuleKey[];
  readonly skills: readonly LevelSkill[];
  readonly styles: readonly string[];
}

export interface LevelDecision {
  readonly id: string;
  readonly options: number;
  readonly regime: LevelRegime;
}

export interface LevelRandomSource {
  readonly id: string;
  readonly management: RandomManagement;
  readonly overlaps?: readonly string[];
}

export interface LevelIntent {
  readonly challenge: string;
  readonly solutions?: readonly LevelSolution[];
  readonly decisions?: readonly LevelDecision[];
  readonly random?: readonly LevelRandomSource[];
  readonly feel?: LevelFeel;
  readonly disclosure?: LevelDisclosure;
}

export type LevelDivergenceReason = 'blocked-solution' | 'unexpected-solution' | 'skill-mismatch' |
  'disclosure-mismatch' | 'choice-count-mismatch' | 'feel-mismatch';

export interface LevelDivergenceEvidence {
  readonly challenge: string;
  readonly subject: string;
}
