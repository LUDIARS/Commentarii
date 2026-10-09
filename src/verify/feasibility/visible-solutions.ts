// Whether a solution looks possible to a player (design 8.5 illusory: "player 書き出しの情報から
// 定石候補として生成される"). Uses stage 3's own candidate generation (tacticCandidates) on the
// player-mode world (buildEngineWorld(bundle, 'player'), i.e. shown / discoverable only) over
// the frames the counted runs saw in the stage. A variant is visible when its tactic is. A
// solution without tactics is visible when every node of its route is on the player map.

import { tacticCandidates } from '../../engine/candidates/tactic-candidates.ts';
import { EMPTY_RUN_MEMORY } from '../../engine/candidates/run-memory.ts';
import type { Persona } from '../../engine/persona/persona.ts';
import type { EngineWorld } from '../../engine/world/engine-world.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { tacticOrigin } from '../runs/tactic-origin.ts';

/** Trusts every tactic the world holds: visibility is about information, not about one persona's habits. */
const ANY_PLAYER: Persona = {
  slug: 'any-player',
  name: { en: 'Any player' },
  weights: { distance: 1, hp: 1, time: 1, resource: 1, confidence: 1, metrics: 1, intent: 1, exploration: 1 },
  exploration_rate: 0,
  reaction_delay_ticks: 0,
  misplay_rate: 0,
  min_confidence: 'learned',
  hysteresis: 0,
};

/** Tactic IDs generated as candidates on at least one frame. */
export function generatedTactics(world: EngineWorld, frames: readonly ObservationFrame[]): Set<string> {
  if (world.mode !== 'player') throw new Error('visibility is judged on the player-mode world only');
  const generated = new Set<string>();
  for (const frame of frames) {
    if (frame.mode !== 'player') continue;
    for (const candidate of tacticCandidates(world, ANY_PLAYER, frame, EMPTY_RUN_MEMORY)) generated.add(candidate.id);
  }
  return generated;
}

export function isVisible(solution: { readonly tactics: readonly string[]; readonly route: readonly string[] }, generated: ReadonlySet<string>, playerNodes: ReadonlySet<string>): boolean {
  if (solution.tactics.length > 0) return solution.tactics.every((tactic) => generated.has(tacticOrigin(tactic)));
  return solution.route.length > 0 && solution.route.every((node) => playerNodes.has(node));
}
