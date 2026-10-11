// TypeScript view of the rulebook documents under mechanics/ (spec/feature/rulebook.md). The
// JSON Schemas (variables / action / action.masked / process / behavior / objectives) are the
// source of truth; these types describe documents that already passed them. Every expression
// field is expr/2 text.

import type { LocalizedText, Source } from './documents.ts';
import type { Knowledge } from './knowledge.ts';

export type VariableOwner = 'world' | 'stage' | 'self' | 'entity';
export type VariableType = 'number' | 'time' | 'bool' | 'vec3' | 'node' | 'entity' | 'state' | 'enum' | 'count';
/** A number, or an expression over other variables. */
export type Bound = number | string;

export interface VariableDeclaration {
  readonly owner: VariableOwner | readonly VariableOwner[];
  readonly type: VariableType;
  readonly description?: LocalizedText;
  readonly unit?: string;
  readonly range?: readonly [Bound, Bound];
  readonly domain?: readonly string[];
  readonly machine?: string;
  readonly observe?: string | Readonly<Partial<Record<VariableOwner, string>>>;
  readonly from?: string;
  readonly init?: Bound;
  readonly derive?: string;
  readonly decay?: 'tick';
  readonly knowledge: Knowledge;
  readonly source: Source;
}

export interface SetDeclaration {
  readonly of: 'entity';
  readonly where: string;
  readonly description?: LocalizedText;
  readonly knowledge: Knowledge;
  readonly source: Source;
}

export interface RulebookVariables {
  readonly variables: Readonly<Record<string, VariableDeclaration>>;
  readonly sets?: Readonly<Record<string, SetDeclaration>>;
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export type ActionActor = 'self' | 'entity';
export type ParamKind = 'entity' | 'node' | 'point' | 'number' | 'enum';

export interface ActionParam {
  readonly kind: ParamKind | readonly ParamKind[];
  readonly where?: string;
  readonly domain?: readonly string[];
  readonly unit?: string;
  readonly range?: readonly [number, number];
  readonly step?: number;
  readonly default?: number | string;
}

export type MapsToOperand = string | number | Readonly<Record<string, string | number>>;

export type MotionKind = 'toward' | 'away' | 'sideways' | 'to_node' | 'hold';

export interface Motion {
  readonly of?: string;
  /** A MotionKind, or a $param holding one. */
  readonly kind: string;
  readonly goal?: string;
  readonly speed: string;
  readonly keep?: string;
}

export interface Assignment {
  readonly var: string;
  readonly of?: string;
  readonly expr: string;
}

export interface Outcome {
  readonly p: number;
  readonly label?: string;
  readonly assign: readonly Assignment[];
}

/** One draw: exactly one outcome happens; their p add up to 1. */
export interface Effect {
  readonly at: 'start' | 'end' | number;
  readonly when?: string;
  readonly outcomes: readonly Outcome[];
}

export interface ActionDefinition {
  readonly id: string;
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly actor: readonly ActionActor[];
  readonly params?: Readonly<Record<string, ActionParam>>;
  readonly maps_to?: Readonly<Record<string, MapsToOperand>>;
  readonly pre: string;
  readonly duration?: string;
  readonly motion?: Motion;
  readonly effects: readonly Effect[];
  readonly cost?: Readonly<Record<string, string>>;
  readonly cooldown?: string;
  readonly effects_known?: boolean;
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

/** Keys of an action a masked companion may replace (wholesale, never merged). */
export const OVERRIDABLE_ACTION_KEYS = ['pre', 'duration', 'motion', 'effects', 'cost', 'cooldown'] as const;
export type OverridableActionKey = (typeof OVERRIDABLE_ACTION_KEYS)[number];

export interface MaskedActionOverride {
  readonly id: string;
  readonly override: Readonly<Partial<Pick<ActionDefinition, OverridableActionKey>>>;
  readonly knowledge: 'masked';
  readonly source: Source;
  readonly draft?: boolean;
}

export interface ProcessDefinition {
  readonly id: string;
  readonly name?: LocalizedText;
  readonly of: VariableOwner;
  readonly when: string;
  readonly rate: readonly { readonly var: string; readonly expr: string }[];
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export const BEHAVIOR_PARADIGMS = ['fsm', 'bt', 'utility', 'goap', 'mcts', 'scripted'] as const;
export type BehaviorParadigm = (typeof BEHAVIOR_PARADIGMS)[number];

export type CallParams = Readonly<Record<string, string | number>>;

export interface ActionCall {
  readonly action: string;
  readonly params?: CallParams;
}

export interface BehaviorTreeNode {
  readonly type: 'selector' | 'sequence' | 'condition' | 'action';
  readonly children?: readonly BehaviorTreeNode[];
  readonly pred?: string;
  readonly action?: string;
  readonly params?: CallParams;
}

export interface UtilityCandidate {
  readonly action: string;
  readonly params?: CallParams;
  readonly considerations: readonly { readonly expr: string; readonly weight: number; readonly curve?: 'linear' | 'quadratic' | 'logistic' | 'step' }[];
}

export interface BehaviorModel {
  readonly id: string;
  readonly name?: LocalizedText;
  readonly paradigm: BehaviorParadigm;
  readonly targeting?: { readonly var: string; readonly pick: string };
  /** fsm */
  readonly machine?: string;
  readonly act?: Readonly<Record<string, ActionCall>>;
  /** scripted */
  readonly timeline?: readonly (ActionCall & { readonly at: number })[];
  readonly loop?: number;
  /** bt */
  readonly tree?: BehaviorTreeNode;
  /** utility */
  readonly candidates?: readonly UtilityCandidate[];
  /** goap */
  readonly goal?: string;
  readonly heuristic?: string;
  /** goap / mcts */
  readonly actions?: readonly string[];
  /** mcts */
  readonly search?: { readonly iterations: number; readonly depth: number; readonly exploration?: number; readonly evaluate?: string };
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export interface ProgressMeasure {
  readonly id: string;
  readonly expr: string;
  readonly better: 'lower' | 'higher';
  readonly scale?: string;
  readonly knowledge: Knowledge;
  readonly source: Source;
}

export interface Objectives {
  readonly win: string;
  readonly lose: string;
  readonly progress?: readonly ProgressMeasure[];
  readonly knowledge: Knowledge;
  readonly source: Source;
  readonly draft?: boolean;
}

export function ownersOf(declaration: { readonly owner: VariableOwner | readonly VariableOwner[] }): readonly VariableOwner[] {
  return typeof declaration.owner === 'string' ? [declaration.owner] : declaration.owner;
}
