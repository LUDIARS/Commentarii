// What the commentator (design 14.J, stage 7J) may read: the decision log of a player-mode run,
// reduced to the moments the chosen candidate changed, with every candidate a player could not
// know (a tactic absent from the player view) replaced by a placeholder. This is the only thing
// handed to a narrator, so an external LLM never sees a masked tactic, a masked value or the
// omniscient observation. Observations themselves are left out: the commentary explains choices.

import type { Bundle } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import type { ReplayRun } from '../replay/replay-record.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:4b014617 */
import augurContract_ab97cecb from '../contracts/build-commentary-input.contract.ts'; /* augur-inject:contract-predicate:4b1e516a */

export const HIDDEN_CANDIDATE = '(非公開の定石)';

export interface CommentaryCandidate {
  readonly candidate: string;
  /** Display name for a tactic the player knows; absent for generic actions and hidden tactics. */
  readonly name?: string;
  readonly utility: number;
}

export interface CommentaryMoment {
  readonly tick: number;
  readonly t: number;
  readonly chosen: CommentaryCandidate;
  /** Runner-up candidates, best first (at most two). */
  readonly alternatives: readonly CommentaryCandidate[];
  /** Chosen utility minus the best runner-up; absent when nothing else was weighed. */
  readonly margin?: number;
}

export interface CommentaryInput {
  readonly run_id: string;
  readonly game_id: string;
  readonly manifest_version: string;
  readonly persona?: string;
  /** The engine used the designer's intent: not a persona's own ability (spec/feature/engine.md §4.1). */
  readonly intent_assisted: boolean;
  readonly result: string;
  readonly moments: readonly CommentaryMoment[];
}

function displayName(name: unknown): string | undefined {
  if (typeof name === 'string') return name;
  if (typeof name === 'object' && name !== null) {
    const text = (name as Record<string, unknown>).ja ?? Object.values(name)[0];
    return typeof text === 'string' ? text : undefined;
  }
  return undefined;
}

function candidateReader(bundle: Bundle): (candidate: string, utility: number) => CommentaryCandidate {
  const playerTactics = new Map(toPlayerView(bundle).tactics.map(({ doc }) => [doc.id, displayName(doc.name)]));
  const hiddenTactics = bundle.tactics.map(({ doc }) => doc.id).filter((id) => !playerTactics.has(id));
  return (candidate, utility) => {
    if (hiddenTactics.some((id) => candidate.includes(id))) return { candidate: HIDDEN_CANDIDATE, utility };
    const known = [...playerTactics.keys()].find((id) => candidate.includes(id));
    const name = known === undefined ? undefined : playerTactics.get(known);
    return name === undefined ? { candidate, utility } : { candidate, name, utility };
  };
}

export function buildCommentaryInput(run: ReplayRun, bundle: Bundle): CommentaryInput {
  if (run.header.mode !== 'player') throw new Error(`commentary reads player-mode runs only (this run is ${run.header.mode})`);
  const read = candidateReader(bundle);
  const moments: CommentaryMoment[] = [];
  let previous: string | undefined;
  for (const tick of run.ticks) {
    const chosen = tick.decision.find((entry) => entry.chosen);
    if (chosen === undefined || chosen.candidate === previous) continue;
    previous = chosen.candidate;
    const others = tick.decision.filter((entry) => !entry.chosen).sort((a, b) => b.utility - a.utility);
    const best = others[0];
    moments.push({
      tick: tick.tick,
      t: tick.t,
      chosen: read(chosen.candidate, chosen.utility),
      alternatives: others.slice(0, 2).map((entry) => read(entry.candidate, entry.utility)),
      ...(best === undefined ? {} : { margin: Math.round((chosen.utility - best.utility) * 1000) / 1000 }),
    });
  }
  return {
    run_id: run.header.run_id,
    game_id: run.header.game_id,
    manifest_version: run.header.manifest_version,
    ...(run.header.persona === undefined ? {} : { persona: run.header.persona }),
    intent_assisted: run.header.decision_mode === 'intent-assisted',
    result: run.footer.result,
    moments,
  };
}
// @ts-expect-error augur-inject
buildCommentaryInput = contract(buildCommentaryInput, { ...augurContract_ab97cecb, contractId: 'C-79', mode: 'observe', sample: 1, where: 'src/commentary/commentary-input.ts:61', rule: 'contract-wrap', id: 'ab97cecb' }); /* augur-inject:contract-wrap:ab97cecb */
