// C-65 intentTouch(intents, tactics, measuredNodes, change): for intents that apply on the
// tactics' stages, a teach naming a tactic, a forbid area among their nodes, a time range with
// a time change, an open / mixed design_stance with a supersede, an illusory_by_design naming a
// tactic, or an accepted divergence naming a tactic is always reported as a touch.

import type { Intent, Tactic } from '../domain/documents.ts';
import { nodesOfTactic, stagesOfTactic, type RewriteChange } from '../learn/consolidate/intent-touch.ts';

function applies(intent: Intent, tactics: readonly Tactic[]): boolean {
  return tactics.some((tactic) => {
    const stages = stagesOfTactic(tactic);
    return stages.length === 0 || stages.includes(intent.stage);
  });
}

export default {
  post: (touch: string | undefined, intents: readonly Intent[], tactics: readonly Tactic[], measuredNodes: readonly string[], change: RewriteChange = {}) => {
    if (touch !== undefined) return true;
    const ids = new Set(tactics.map((tactic) => tactic.id));
    const nodes = new Set([...measuredNodes, ...tactics.flatMap(nodesOfTactic)]);
    for (const intent of intents) {
      if (!applies(intent, tactics)) continue;
      for (const item of intent.intended) {
        if (item.kind === 'teach' && ids.has(item.tactic)) return `teach ${item.id} not reported`;
        if (item.kind === 'forbid' && nodes.has(item.area)) return `forbid ${item.id} not reported`;
        if (item.kind === 'time' && change.timeChanged === true) return `time ${item.id} not reported`;
      }
      if (change.supersedes === true && (intent.design_stance === 'open' || intent.design_stance === 'mixed')) return `design_stance of ${intent.stage} not reported`;
      if ((intent.illusory_by_design ?? []).some((bait) => (bait.tactics ?? []).some((id) => ids.has(id)))) return `illusory_by_design of ${intent.stage} not reported`;
      if (intent.allowed_divergences.some((divergence) => divergence.tactic !== undefined && ids.has(divergence.tactic))) return `accepted divergence of ${intent.stage} not reported`;
    }
    return true;
  },
};
