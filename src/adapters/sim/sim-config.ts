// Tunables of the simulator. The sim is a small stand-in game for tests and benches, so these
// are its own physics, not guide data: everything the guide does say (enemy stats, map,
// state machines, rules) is read from the bundle instead.

export interface FighterStats {
  readonly health: number;
  /** Units per second. */
  readonly speed: number;
  /** Attack reach (units). */
  readonly range: number;
  /** Seconds between attacks. */
  readonly cooldown: number;
  /** Damage per second while attacking without pause (see damageExpression). */
  readonly power: number;
}

export interface SimConfig {
  /** Seconds per tick. */
  readonly dt: number;
  /** How far the player sees (player mode lists only entities this close). */
  readonly sightRange: number;
  /** Distance between rings of a zones map / between node depths when the map has no positions. */
  readonly nodeSpacing: number;
  /** Size of one cell of a grid map. */
  readonly gridCell: number;
  /** Self when the bundle has no actor entity to read stats from. */
  readonly self: FighterStats;
  /** Enemy stats the bundle does not give (power, and fallbacks for missing ones). */
  readonly enemy: FighterStats;
  /** Damage of one hit; variables power, cooldown, distance, range. A bundle rule `rule:<game>:damage` replaces it. */
  readonly damageExpression: string;
  /** Seconds without taking damage before self regenerates. */
  readonly regenDelaySec: number;
  readonly regenPerSec: number;
  /** Shot speed, for the closing_time of a dodge rule. */
  readonly shotSpeed: number;
  /** Chance an enemy whose state machine can dodge starts a dodge when shot at. */
  readonly dodgeChance: number;
  /** Seconds an enemy stays in a retreat state before it may chase again. */
  readonly retreatSec: number;
  /** Seconds a dodge lasts when the dodge transition has no rule. */
  readonly dodgeSec: number;
  /** Chance an enemy hit misses self when self moved during that tick (aimed shots lead a still target). */
  readonly movingEvasion: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  dt: 0.1,
  sightRange: 60,
  nodeSpacing: 12,
  gridCell: 1,
  self: { health: 150, speed: 9, range: 20, cooldown: 0.4, power: 30 },
  enemy: { health: 120, speed: 7, range: 18, cooldown: 0.8, power: 8 },
  damageExpression: 'power * cooldown',
  regenDelaySec: 1.5,
  regenPerSec: 8,
  shotSpeed: 30,
  dodgeChance: 0.25,
  retreatSec: 2,
  dodgeSec: 0.3,
  movingEvasion: 0.5,
};
