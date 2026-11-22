
import { isJsonObject } from '@ludiars/commentarii-sdk/types';

export interface LevelFinding {
  readonly id: string;
  readonly severity: 'good' | 'bad' | 'advisory';
  readonly evidence: string;
  readonly references: readonly unknown[];
  readonly move?: string;
}

export interface FindingTarget {
  readonly stage: string;
  readonly challenge?: string;
  readonly rule?: string;
  readonly finding: LevelFinding;
}

export interface LevelChallenge {
  readonly id: string;
  readonly stage: string;
  readonly solution_measurement: boolean;
  readonly experience_measurement: boolean;
  readonly undetermined: boolean;
  readonly omitted_classes: number;
  readonly not_measured: readonly string[];
  readonly classes: readonly {
    readonly id: string;
    readonly rules: readonly string[];
    readonly confirmation: readonly { readonly status: string }[];
  }[];
  readonly choice: { readonly counts: Readonly<Record<string, number>>; readonly total: number };
  readonly play_value: {
    readonly counts: Readonly<Record<string, number>>;
    readonly total: number;
    readonly rule_taught: number;
    readonly late_disclosure: number;
  };
  readonly outcomes: { readonly classification: string };
  readonly findings: readonly LevelFinding[];
}

export interface LevelQuality {
  readonly schema: 'level-quality/1';
  readonly evidence: readonly string[];
  readonly versions: { readonly bundle_hash: string };
  readonly compatibility: Readonly<Record<string, unknown>>;
  readonly gate_thresholds: Readonly<Record<string, number>>;
  readonly stages: readonly {
    readonly id: string;
    readonly not_measured: readonly string[];
    readonly findings?: readonly LevelFinding[];
  }[];
  readonly challenges: readonly LevelChallenge[];
  readonly rules?: readonly { readonly id: string; readonly introduced: string }[];
  readonly priors?: {
    readonly schema: 'level-priors/1';
    readonly evidence: 'llm';
    readonly answers: readonly { readonly rule: string; readonly classification: string }[];
    readonly findings: readonly LevelFinding[];
  } | null;
}

export interface LevelGate {
  readonly schema: 'level-gate/1';
  readonly comparable: boolean;
  readonly candidates: readonly { readonly id: string; readonly change: number; readonly threshold: number }[];
}

function list(value: unknown, predicate: (entry: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(predicate);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function counters(value: unknown): boolean {
  return isJsonObject(value) && Object.values(value).every(count);
}

export function isLevelFinding(value: unknown): value is LevelFinding {
  return isJsonObject(value) && text(value.id) &&
    (value.severity === 'good' || value.severity === 'bad' || value.severity === 'advisory') &&
    text(value.evidence) && Array.isArray(value.references) && (value.move === undefined || text(value.move));
}

function isSolution(value: unknown): boolean {
  return isJsonObject(value) && text(value.id) &&
    list(value.rules, text) &&
    Array.isArray(value.confirmation) && value.confirmation.length === 5 &&
    value.confirmation.every((cell: unknown) => isJsonObject(cell) &&
      typeof cell.status === 'string' && ['viable', 'unviable', 'undetermined'].includes(cell.status));
}

function isStage(value: unknown): boolean {
  return isJsonObject(value) && typeof value.id === 'string' && list(value.not_measured, text) &&
    (value.findings === undefined || list(value.findings, isLevelFinding));
}

function isChallenge(value: unknown): value is LevelChallenge {
  return isJsonObject(value) && typeof value.id === 'string' && /^ch:[a-z0-9][a-z0-9:_-]*$/.test(value.id) &&
    typeof value.stage === 'string' && typeof value.undetermined === 'boolean' && count(value.omitted_classes) &&
    typeof value.solution_measurement === 'boolean' && typeof value.experience_measurement === 'boolean' &&
    list(value.not_measured, text) && list(value.classes, isSolution) && list(value.findings, isLevelFinding) &&
    isJsonObject(value.choice) && counters(value.choice.counts) && count(value.choice.total) &&
    isJsonObject(value.play_value) && counters(value.play_value.counts) && count(value.play_value.total) &&
    count(value.play_value.rule_taught) && count(value.play_value.late_disclosure) &&
    isJsonObject(value.outcomes) && text(value.outcomes.classification);
}

function isPriors(value: unknown): boolean {
  return value === null || (isJsonObject(value) && value.schema === 'level-priors/1' && value.evidence === 'llm' &&
    list(value.answers, (answer) => isJsonObject(answer) && text(answer.rule) && text(answer.classification)) &&
    list(value.findings, isLevelFinding));
}

export function parseLevelQuality(data: unknown): LevelQuality {
  if (!isJsonObject(data) || data.schema !== 'level-quality/1' ||
      !list(data.evidence, text) ||
      !isJsonObject(data.versions) || typeof data.versions.bundle_hash !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(data.versions.bundle_hash) ||
      !isJsonObject(data.compatibility) || data.compatibility.mode !== 'player' ||
      !isJsonObject(data.gate_thresholds) || Object.keys(data.gate_thresholds).length === 0 ||
      !Object.values(data.gate_thresholds).every(Number.isFinite) ||
      (data.rules !== undefined && !list(data.rules, (rule) => isJsonObject(rule) && text(rule.id) && typeof rule.introduced === 'string')) ||
      (data.priors !== undefined && !isPriors(data.priors)) ||
      !list(data.stages, isStage) || !Array.isArray(data.challenges) || !data.challenges.every(isChallenge) ||
      new Set(data.challenges.map(({ id }) => id)).size !== data.challenges.length) {
    throw new Error('invalid level-quality/1 player report');
  }
  return data as unknown as LevelQuality;
}

export function parseLevelGate(data: unknown): LevelGate {
  if (!isJsonObject(data) || data.schema !== 'level-gate/1' || typeof data.comparable !== 'boolean' ||
      !list(data.candidates, (entry) => isJsonObject(entry) && text(entry.id) &&
        Number.isFinite(entry.change) && Number.isFinite(entry.threshold))) {
    throw new Error('invalid level-gate/1 report');
  }
  return data as unknown as LevelGate;
}

export function findLevelFindings(report: LevelQuality): FindingTarget[] {
  const introduced = new Map((report.rules ?? []).map(({ id, introduced }) => [id, introduced]));
  return [
    ...report.stages.flatMap((stage) => (stage.findings ?? []).map((finding) => ({ stage: stage.id, finding }))),
    ...report.challenges.flatMap((challenge) => challenge.findings.map((finding) =>
      ({ stage: challenge.stage, challenge: challenge.id, finding }))),
    ...(report.priors?.findings ?? []).flatMap((finding) => finding.references.flatMap((rule) => {
      if (typeof rule !== 'string') return [];
      const stage = introduced.get(rule);
      return stage === undefined ? [] : [{ stage, rule, finding }];
    })),
  ];
}
