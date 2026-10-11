// The two views of a rulebook an engine reads (design: Fable §3.4, §4; Astra §5.1).
// PlayerRulebook cannot express a masked element or an override: its knowledge is only shown /
// discoverable and its actions have no `overridden` field. OmniscientRulebook is the true game:
// masked overrides applied, each overridden action saying where its truth came from.

import type { Rule, Source, StateMachine } from '../domain/documents.ts';
import type { ExpressionLanguage } from '../domain/expression/expression-language.ts';
import type { Interval } from '../domain/expression/interval.ts';
import type { Knowledge } from '../domain/knowledge.ts';
import type {
  ActionDefinition,
  BehaviorModel,
  Objectives,
  ProcessDefinition,
  SetDeclaration,
  VariableDeclaration,
} from '../domain/rulebook-documents.ts';

export type RulebookMode = 'player' | 'omniscient';

/** Knowledge a player may hold. */
export type PlayerKnowledge = Exclude<Knowledge, 'masked'>;

type Labelled<T, K> = Omit<T, 'knowledge'> & { readonly knowledge: K };

/**
 * A value learned from player runs (the overlay), as an interval over the run estimates. A
 * provisional hypothesis: never the canonical value, retracted when the overlay drops it.
 */
export interface LearnedEstimate {
  readonly entity: string;
  readonly variable: string;
  readonly interval: Interval;
  readonly samples: number;
  readonly runs: readonly string[];
  readonly source: Source;
}

interface RulebookBase<K extends Knowledge, A> {
  readonly game_id: string | null;
  readonly expression_language: ExpressionLanguage;
  readonly variables: Readonly<Record<string, Labelled<VariableDeclaration, K>>>;
  readonly sets: Readonly<Record<string, Labelled<SetDeclaration, K>>>;
  readonly actions: readonly A[];
  readonly processes: readonly Labelled<ProcessDefinition, K>[];
  readonly behaviors: readonly Labelled<BehaviorModel, K>[];
  readonly objectives?: Labelled<Objectives, K>;
  readonly rules: readonly Labelled<Rule, K>[];
  readonly states: readonly Labelled<StateMachine, K>[];
  readonly learned: readonly LearnedEstimate[];
}

export type PlayerAction = Labelled<ActionDefinition, PlayerKnowledge>;

export interface PlayerRulebook extends RulebookBase<PlayerKnowledge, PlayerAction> {
  readonly mode: 'player';
}

export interface OmniscientAction extends ActionDefinition {
  /** Set when a masked companion replaced keys of the visible definition. */
  readonly overridden?: { readonly keys: readonly string[]; readonly source: Source; readonly path: string };
}

export interface OmniscientRulebook extends RulebookBase<Knowledge, OmniscientAction> {
  readonly mode: 'omniscient';
}

export type Rulebook = PlayerRulebook | OmniscientRulebook;
