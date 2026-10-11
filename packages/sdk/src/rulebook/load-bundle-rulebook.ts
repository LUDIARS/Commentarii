// loadBundleRulebook(bundle, mode): the same rulebook loadRulebook makes from bundle.json, made
// from a bundle loaded from its directory (an engine that reads the directory, as Ingenium's
// run does). player goes through toPlayerView first, so no masked file reaches it; omniscient
// keeps the masked overrides for applyActionOverrides.

import type { Bundle } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import { loadRulebook, type LoadRulebookOptions, type RulebookSource } from './load-rulebook.ts';
import type { OmniscientRulebook, PlayerRulebook, Rulebook, RulebookMode } from './rulebook-view.ts';

function sourceOf(bundle: Bundle, mode: RulebookMode): RulebookSource {
  const view = mode === 'player' ? toPlayerView(bundle) : bundle;
  const { rulebook } = view;
  return {
    game_id: view.manifest?.doc.game_id ?? null,
    knowledge: mode === 'player' ? 'player' : 'full',
    documents: {
      rules: view.rules,
      states: view.states,
      mechanics: {
        ...(rulebook.variables ? { variables: rulebook.variables } : {}),
        actions: rulebook.actions,
        masked_actions: rulebook.maskedActions,
        processes: rulebook.processes,
        behaviors: rulebook.behaviors,
        ...(rulebook.objectives ? { objectives: rulebook.objectives } : {}),
      },
    },
  };
}

export function loadBundleRulebook(bundle: Bundle, mode: 'player', options?: LoadRulebookOptions): PlayerRulebook;
export function loadBundleRulebook(bundle: Bundle, mode: 'omniscient', options?: LoadRulebookOptions): OmniscientRulebook;
export function loadBundleRulebook(bundle: Bundle, mode: RulebookMode, options: LoadRulebookOptions = {}): Rulebook {
  return loadRulebook(sourceOf(bundle, mode), mode, options);
}
