// The observation field registry (design 1 principle 1 applied to observations,
// spec/feature/observation-boundary.md): which places of an Observation frame may carry what,
// and where each comes from. A player frame may only hold
//   - boundary-free metadata (tick, mode, stage id ... : the frame's own bookkeeping, not a game value),
//   - protocol fields the player sees by construction (own position, entities on screen),
//   - fields the game declares in manifest observation.fields with a player-knowable boundary.
// Anything else is unregistered and refused (default deny): an unlabelled extra.secret_hp is
// masked by principle 1, so it must not reach the decider, a replay, the overlay or a report.

import type { Knowledge } from '../domain/knowledge.ts';

/** meta: bookkeeping without a knowledge boundary; shown: the player sees it by construction. */
export type BaseFieldClass = 'meta' | 'shown';

export interface BaseField {
  /** Field path (grammar below). */
  readonly path: string;
  readonly class: BaseFieldClass;
  /** Where the value comes from (the provenance a reviewer checks). */
  readonly origin: string;
}

/** A game's declaration of one observation field (manifest observation.fields, replay header observation_fields). */
export interface ObservationFieldDeclaration {
  readonly path: string;
  readonly knowledge: Knowledge;
  readonly origin: string;
}

/**
 * Field path grammar: dot-separated object keys; `[]` after a segment means every array item.
 * Events are addressed by kind: `events.<kind>.<field>`. Declarable places are
 * `self.resources.<name>`, `extra.<key>` and `events.<kind>.<field>`.
 */
export const BASE_FIELDS: readonly BaseField[] = [
  { path: 'tick', class: 'meta', origin: 'adapter tick counter' },
  { path: 't', class: 'meta', origin: 'game clock (seconds)' },
  { path: 'source', class: 'meta', origin: 'observation route (design 7.1)' },
  { path: 'mode', class: 'meta', origin: 'run mode' },
  { path: 'purpose', class: 'meta', origin: 'run purpose' },
  { path: 'stage.id', class: 'meta', origin: 'current stage (the player knows where they play)' },
  { path: 'stage.elapsed', class: 'meta', origin: 'seconds since the stage started' },
  { path: 'stage.node', class: 'meta', origin: 'map node of the own position' },
  { path: 'entities[].instance', class: 'meta', origin: 'per-run handle of a drawn instance' },
  { path: 'entities[].confidence', class: 'meta', origin: 'the adapter estimate of its own identification' },
  { path: 'events[].kind', class: 'meta', origin: 'event name' },
  { path: 'self.pos', class: 'shown', origin: 'own position (camera / avatar)' },
  { path: 'self.hp', class: 'shown', origin: 'HP bar ratio, labelled with its knowledge' },
  { path: 'entities[].entity', class: 'shown', origin: 'appearance identified by render_signature' },
  { path: 'entities[].pos', class: 'shown', origin: 'world position of a visible entity' },
  { path: 'entities[].screen', class: 'shown', origin: 'screen bounding box of a visible entity' },
  { path: 'entities[].state_guess', class: 'shown', origin: 'state read from motion; omitted when the state machine is masked' },
  { path: 'extra.reach', class: 'shown', origin: 'own attack reach (protocol convention)' },
  { path: 'extra.ready_skills', class: 'shown', origin: 'skill icons that are usable now (protocol convention)' },
  { path: 'extra.items', class: 'shown', origin: 'inventory counts (protocol convention)' },
  { path: 'extra.signatures', class: 'shown', origin: 'appearance of drawn unknown instances (render-tap)' },
  { path: 'events.hit.instance', class: 'shown', origin: 'hit effect on a visible instance' },
  { path: 'events.miss.instance', class: 'shown', origin: 'miss effect on a visible instance' },
  { path: 'events.kill.instance', class: 'shown', origin: 'defeat of a visible instance' },
  { path: 'events.damage-dealt.instance', class: 'shown', origin: 'damage number over a visible instance' },
  { path: 'events.damage-dealt.amount', class: 'shown', origin: 'damage number over a visible instance' },
];

const DECLARABLE = [/^self\.resources\.[a-z][a-z0-9_]*$/, /^extra\.[A-Za-z0-9_-]+$/, /^events\.[A-Za-z0-9_:-]+\.[A-Za-z0-9_-]+$/];

/** Whether a game may declare this path (base fields and frame structure are fixed by Commentarii). */
export function isDeclarablePath(path: string): boolean {
  if (BASE_FIELDS.some((field) => field.path === path)) return false;
  return DECLARABLE.some((pattern) => pattern.test(path));
}
