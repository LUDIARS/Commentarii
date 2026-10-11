// Mutable state of one simulated game. The sim owns it and changes it in place, tick by tick;
// every change goes through step-sim.ts, and the only randomness is the sim's seeded PRNG.

import type {
  Entity,
  MaskedEntity,
  ObservationFrame,
  ObservationMode,
  ObservedEvent,
  ReplayAction,
  Rule,
  StateMachine,
} from '@ludiars/commentarii-sdk/types';
import type { Rng } from '../../engine/rng.ts';
import type { SimConfig } from './sim-config.ts';
import type { Point, SimLayout } from './sim-layout.ts';

export interface SimFighter {
  pos: Point;
  hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly range: number;
  readonly cooldown: number;
  readonly power: number;
  /** t from which the next attack is possible. */
  readyAt: number;
}

export interface SimSelf extends SimFighter {
  lastDamagedT: number;
  /** Self changed position during the current tick. */
  moved: boolean;
}

export interface SimEnemy extends SimFighter {
  readonly instance: number;
  readonly entity: Entity;
  readonly masked?: MaskedEntity;
  readonly machine?: StateMachine;
  /** Current sub-state id of the machine. */
  state?: string;
  stateSince: number;
  /** End of the current dodge. */
  dodgeUntil: number;
  /** Self shot at it during the last tick. */
  shotAt: boolean;
  alive: boolean;
}

export type SimOutcome = 'running' | 'success' | 'fail';

/** Something that decides an enemy's action from its own observation (stage 6F: the engine). */
export interface SimEnemyBrain {
  decide(observation: ObservationFrame): ReplayAction;
}

/** Enemies driven by a brain instead of their fixed state machine. */
export interface SimEnemyBrains {
  /** Enemy instance -> its brain. Enemies without one keep the fixed tree. */
  readonly brains: ReadonlyMap<number, SimEnemyBrain>;
  /** What the brains see: player (sight only, the default) or omniscient. */
  readonly mode: ObservationMode;
  /** The player's entity ID in the enemies' guide. */
  readonly playerEntity: string;
}

export interface SimWorld {
  tick: number;
  t: number;
  readonly stageId: string;
  readonly timeLimit?: number;
  readonly self: SimSelf;
  readonly enemies: SimEnemy[];
  readonly layout: SimLayout;
  readonly hazardNodes: ReadonlySet<string>;
  readonly rules: ReadonlyMap<string, Rule>;
  readonly damageRule?: Rule;
  readonly config: SimConfig;
  readonly rng: Rng;
  /** Events of the tick just simulated (shown with the next observation). */
  events: ObservedEvent[];
  damageTaken: number;
  damageDealt: number;
  outcome: SimOutcome;
  /** Enemies the engine drives (stage 6F); absent = every enemy keeps its fixed tree. */
  readonly enemyBrains?: SimEnemyBrains;
}
