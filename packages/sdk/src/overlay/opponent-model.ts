// observations/opponents/<entity-slug>.json (schema/opponent-model.schema.json, Ingenium R3, SDK
// 0.5.0): the learned model of an opponent whose behavior model the engine's view does not hold -
// how often it was seen to approach, retreat, strafe, attack or stand still, by context (the
// distance band to the engine's own entity and whether that entity had just moved). Counts only
// (no values of the game), summed run after run. Never part of the canonical bundle.

export const OPPONENT_MODEL_FORMAT = 'opponent-model/1';

/** Bundle-relative directory of the learned opponent models. */
export const OPPONENT_MODELS_DIR = 'observations/opponents';

export const OPPONENT_MOTION_CLASSES = ['approach', 'retreat', 'strafe', 'attack', 'still'] as const;
export type OpponentMotionClass = (typeof OPPONENT_MOTION_CLASSES)[number];

export interface OpponentModel {
  readonly format: typeof OPPONENT_MODEL_FORMAT;
  /** The entity ID the counts are about. */
  readonly entity: string;
  /** Runs whose observations went into the counts. */
  readonly runs: number;
  /** context key (<near|mid|far>|own:<moved|still>) -> class -> times seen. */
  readonly counts: Readonly<Record<string, Readonly<Partial<Record<OpponentMotionClass, number>>>>>;
}

/** observations/opponents/<slug>.json of an entity ID (the ID's last segment). */
export function opponentModelPath(entity: string): string {
  return `${OPPONENT_MODELS_DIR}/${entity.split(':').at(-1) ?? entity}.json`;
}
