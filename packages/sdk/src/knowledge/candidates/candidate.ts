// A candidate the Utility selector weighs (design 7.4): a tactic whose `when` holds, a generic
// action (survive / approach / gather) or an exploration move. Each carries the behavior
// tree that carries it out and the facts the considerations score it on.

import type { TacticMetrics } from '../../domain/documents.ts';
import type { BtNode } from '../bt/bt-node.ts';
import type { Bindings } from '../match/bindings.ts';
import type { TacticConfidence } from '../persona/persona.ts';
import type { TacticMutation } from './tactic-variants.ts';

export type CandidateKind = 'tactic' | 'generic' | 'explore';

export interface CandidateTraits {
  /** Distance to what the candidate acts on, when it acts on something visible. */
  readonly targetDistance?: number;
  /** Map node the candidate heads for (scored against the intent). */
  readonly targetNode?: string;
  /** Moves away from danger: the lower the HP, the better. */
  readonly seeksSafety?: boolean;
  /** Pushes the stage toward its objective (fights, advances): better the less time is left. */
  readonly progresses?: boolean;
  /** Collects resources: better the emptier self's resources are. */
  readonly gathers?: boolean;
  /** Tactics: the tactic's confidence. */
  readonly confidence?: TacticConfidence;
  /** Tactics: measured results. */
  readonly metrics?: TacticMetrics;
  /** Tactic the candidate comes from (a tactic or its variant). */
  readonly tactic?: string;
  /** 0..1: how new this is to the run (untried tactic, unvisited node, untried variant). */
  readonly novelty: number;
}

/** Which variant an exploration candidate runs (tactic-variants.ts), for reflect to measure it. */
export interface VariantOrigin {
  /** The variant's own tactic ID (<tactic ID>--<mutation>). */
  readonly tactic: string;
  readonly of: string;
  readonly mutation: TacticMutation;
}

export interface Candidate {
  /** Unique within one tick: the tactic ID, generic:<name>, explore:<node>, variant:<variant tactic ID>. */
  readonly id: string;
  readonly kind: CandidateKind;
  readonly tree: BtNode;
  readonly bindings: Bindings;
  readonly traits: CandidateTraits;
  /** The tactic's `expect`, checked while the candidate runs. */
  readonly expect?: Readonly<Record<string, unknown>>;
  /** True for the plan already running (it gets the hysteresis bonus). */
  readonly continuing?: boolean;
  /** Exploration variants only. */
  readonly variant?: VariantOrigin;
}
