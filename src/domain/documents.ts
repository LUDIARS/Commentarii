// TypeScript view of the guide bundle documents. The JSON Schemas under schema/ are the
// source of truth; these types describe documents that already passed schema validation.

import type { Knowledge } from './knowledge.ts';

export type LocalizedText = Readonly<Record<string, string>>;

export type SourceKind = 'master' | 'observed' | 'human' | 'llm-draft';

export interface Source {
  readonly kind: SourceKind;
  readonly ref: string;
}

export interface GuideValue<T = unknown> {
  readonly value: T;
  readonly unit?: string;
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export type StatMap = Readonly<Record<string, GuideValue<number>>>;

export interface Manifest {
  readonly game_id: string;
  readonly title: LocalizedText;
  readonly version: string;
  readonly builds?: readonly string[];
  readonly coordinates: { readonly system: 'grid' | 'world-xy' | 'world-xyz'; readonly unit: string };
  readonly lexicon?: { readonly version: string };
  readonly learning?: { readonly policy: unknown };
  /** Game-declared observation fields (spec/feature/observation-boundary.md). */
  readonly observation?: { readonly fields: readonly { readonly path: string; readonly knowledge: Knowledge; readonly origin: string }[] };
  /** Balance gate thresholds (spec/feature/balance-gate.md §3); defaults when absent. */
  readonly bench?: { readonly thresholds?: Readonly<Record<string, number>> };
  /** Feasibility band thresholds (spec/feature/intent-verify.md 6.3); defaults when absent. */
  readonly feasibility?: { readonly thresholds?: Readonly<Record<string, number>> };
}

export interface Glossary {
  readonly terms: readonly { readonly text: string; readonly lang: string; readonly ref: string }[];
  readonly ui?: readonly { readonly element: string; readonly shows: string }[];
  readonly glyphs?: readonly { readonly glyph: string; readonly means: string }[];
}

export interface Entity {
  readonly id: string;
  readonly name: LocalizedText;
  readonly lexicon?: readonly string[];
  readonly render_signature?: { readonly mesh?: string; readonly sprite?: string; readonly material?: readonly string[] };
  readonly stats?: StatMap;
  readonly tags?: readonly string[];
  // enemy / actor
  readonly behavior?: string;
  // enemy
  readonly weak_to?: readonly GuideValue<string>[];
  readonly drops?: readonly GuideValue<string>[];
  // item
  readonly category?: GuideValue<string>;
  // item / skill
  readonly effect?: GuideValue<LocalizedText>;
  // skill
  readonly rules?: readonly string[];
  // actor
  readonly skills?: readonly string[];
}

export interface MaskedEntity {
  readonly id: string;
  readonly stats?: StatMap;
  readonly fields?: Readonly<Record<string, GuideValue>>;
}

export interface Spawn {
  readonly entity: string;
  readonly count: GuideValue<number>;
  readonly at?: string;
  readonly wave?: number;
}

export interface Stage {
  readonly id: string;
  readonly name: LocalizedText;
  readonly objectives: readonly GuideValue<LocalizedText>[];
  readonly clear_conditions?: readonly GuideValue<LocalizedText>[];
  readonly time_limit?: GuideValue<number>;
  readonly spawns?: readonly Spawn[];
}

export type MapKind = 'grid' | 'navgraph' | 'zones';

export interface MapNode {
  readonly id: string;
  readonly label?: LocalizedText;
  readonly cell?: readonly [number, number];
  readonly pos?: readonly number[];
  readonly knowledge: Knowledge;
}

export interface MapEdge {
  readonly from: string;
  readonly to: string;
  readonly directed?: boolean;
  readonly cost?: number;
  readonly knowledge: Knowledge;
}

export type AnnotationKind = 'hazard' | 'resource' | 'shortcut' | 'spawn' | 'wanted' | 'unwanted';

export interface MapAnnotation {
  readonly target: string;
  readonly kind: AnnotationKind;
  readonly ref?: string;
  readonly note?: LocalizedText;
  readonly knowledge: Knowledge;
}

export interface GuideMap {
  readonly stage: string;
  readonly kind: MapKind;
  readonly size?: readonly [number, number];
  readonly source: Source;
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly annotations: readonly MapAnnotation[];
}

export type EventTrigger =
  | { readonly kind: 'time'; readonly at_sec: GuideValue<number> }
  | { readonly kind: 'condition'; readonly condition: GuideValue<LocalizedText> };

export interface StageEvent {
  readonly id: string;
  readonly trigger: EventTrigger;
  readonly description: GuideValue<LocalizedText>;
  readonly spawns?: readonly Spawn[];
}

export interface StageEvents {
  readonly stage: string;
  readonly events: readonly StageEvent[];
}

export interface RuleVariable {
  readonly description?: LocalizedText;
  readonly unit?: string;
  readonly range: readonly [number, number];
  readonly example: number;
  readonly ref?: string;
}

export interface Rule {
  readonly id: string;
  readonly name: LocalizedText;
  readonly expression: string;
  readonly result_unit?: string;
  readonly variables: Readonly<Record<string, RuleVariable>>;
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export interface StateMachine {
  readonly id: string;
  readonly name: LocalizedText;
  readonly initial: string;
  readonly states: readonly { readonly id: string; readonly label?: LocalizedText }[];
  readonly transitions: readonly { readonly from: string; readonly to: string; readonly on: string; readonly rule?: string }[];
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export interface TacticMetrics {
  readonly runs: number;
  readonly success: number;
  readonly time_sec?: { readonly p50?: number; readonly p90?: number };
  readonly resource?: Readonly<Record<string, number>>;
  readonly risk?: Readonly<Record<string, number>>;
}

export interface Tactic {
  readonly id: string;
  readonly name: LocalizedText;
  readonly when: unknown;
  readonly do: readonly Readonly<Record<string, string | number>>[];
  readonly expect: Readonly<Record<string, unknown>>;
  readonly because: readonly string[];
  readonly knowledge: Knowledge;
  readonly confidence: 'authored' | 'derived' | 'learned';
  readonly metrics?: TacticMetrics;
  readonly superseded_by: string | null;
  readonly draft?: boolean;
}

interface IntentCommon {
  readonly id: string;
  readonly note?: string;
  readonly knowledge?: Knowledge;
}

export type IntendedItem =
  | (IntentCommon & { readonly kind: 'route'; readonly path: readonly string[] })
  | (IntentCommon & { readonly kind: 'teach'; readonly tactic: string })
  | (IntentCommon & { readonly kind: 'time'; readonly range_sec: readonly [number, number] })
  | (IntentCommon & { readonly kind: 'forbid'; readonly area: string });

export type DivergenceReason = 'alt-route' | 'shortcut' | 'teach-skipped' | 'over-time' | 'forbid-entered';

/** Tactic sequence + map node route of the runs a divergence groups (spec/feature/intent-verify.md 4.1). */
export interface DivergenceSignature {
  readonly tactics: readonly string[];
  readonly route: readonly string[];
}

export interface AllowedDivergence {
  readonly run: string;
  readonly summary: string;
  readonly decided_by: string;
  readonly tactic?: string;
  /** Set by guide verify intent --accept. */
  readonly intent?: string;
  readonly reason?: DivergenceReason;
  readonly divergence?: string;
  readonly signature?: DivergenceSignature;
  /** Guide version the acceptance was judged under (set by guide verify intent --accept). */
  readonly manifest_version?: string;
}

export type DesignStance = 'open' | 'refined' | 'mixed';

/** A solution meant to look possible but fail (design 8.5). */
export interface IllusoryByDesign {
  readonly tactics?: readonly string[];
  readonly route?: readonly string[];
  readonly rationale: string;
  readonly decided_by: string;
}

export interface Intent {
  readonly stage: string;
  readonly intended: readonly IntendedItem[];
  readonly allowed_divergences: readonly AllowedDivergence[];
  readonly design_stance?: DesignStance;
  readonly illusory_by_design?: readonly IllusoryByDesign[];
  /** Set on intents drafted by `guide intent import` (source.kind = llm-draft, draft: true). */
  readonly source?: Source;
  readonly draft?: boolean;
}
