// Whether a tactic rewrite touches the designer's intent (design 1 principle 5, 8.2), in which
// case it waits for a person even under auto_apply. Every kind of intent is judged, not only
// teach / forbid (spec/feature/learning.md §4.1):
//   teach               an intent teaches the tactic being replaced (or the new one);
//   forbid              the old or new tactic passes a forbid area (do move_to, when at_node,
//                       or the measured runs went through it);
//   route               the old and new tactic (their move_to / at_node) put different nodes of
//                       an intended route under the player's feet (the walk of the route changes);
//   time                the stage has a time range and the rewrite changes the tactic's time;
//   design_stance       open / mixed: superseding a tactic removes a solution (breadth), which is
//                       the designer's call; refined narrows on purpose and is not touched;
//   illusory_by_design  the tactic or its nodes are part of a declared bait;
//   allowed_divergences an accepted divergence names the tactic.
// An intent only counts for tactics that can apply on its stage: a tactic whose `when` names
// stage ids applies to those stages only; one that names none applies everywhere (safe side).
// Every intent of the bundle counts, drafts included (the safe side).

import type { Intent, Tactic } from '../../domain/documents.ts';
import { isNodeId } from '../../domain/id.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:053bc088 */
import augurContract_cbec7789 from '../../contracts/intent-touch.contract.ts'; /* augur-inject:contract-predicate:92394c8f */

/** What the rewrite changes beyond the tactic documents. */
export interface RewriteChange {
  /** The variant's measured time differs from the origin's. */
  readonly timeChanged?: boolean;
  /** The old tactic gets superseded_by (a solution leaves the engine's repertoire). */
  readonly supersedes?: boolean;
}

function collectCondition(condition: unknown, nodes: Set<string>, stages: Set<string>): void {
  if (Array.isArray(condition)) {
    for (const item of condition) collectCondition(item, nodes, stages);
    return;
  }
  if (!isJsonObject(condition)) return;
  for (const [key, value] of Object.entries(condition)) {
    if (key === 'at_node' && typeof value === 'string') nodes.add(value);
    else if (key === 'stage' && isJsonObject(value) && typeof value.id === 'string') {
      stages.add(value.id);
      if (typeof value.node === 'string') nodes.add(value.node);
    } else collectCondition(value, nodes, stages);
  }
}

/** Map nodes a tactic goes to or requires being at. */
export function nodesOfTactic(tactic: Tactic): string[] {
  const found = new Set<string>();
  for (const step of tactic.do) {
    const target = step.move_to;
    if (typeof target === 'string' && isNodeId(target)) found.add(target);
  }
  collectCondition(tactic.when, found, new Set());
  return [...found];
}

/** Stage IDs the tactic's `when` is limited to (empty = any stage). */
export function stagesOfTactic(tactic: Tactic): string[] {
  const stages = new Set<string>();
  collectCondition(tactic.when, new Set(), stages);
  return [...stages];
}

function appliesOn(intent: Intent, tactics: readonly Tactic[]): boolean {
  return tactics.some((tactic) => {
    const stages = stagesOfTactic(tactic);
    return stages.length === 0 || stages.includes(intent.stage);
  });
}

function onRoute(route: readonly string[], nodes: ReadonlySet<string>): string {
  return route.filter((node) => nodes.has(node)).join(',');
}

function itemTouch(intent: Intent, ids: ReadonlySet<string>, nodes: ReadonlySet<string>, sides: readonly ReadonlySet<string>[], change: RewriteChange): string | undefined {
  for (const item of intent.intended) {
    if (item.kind === 'teach' && ids.has(item.tactic)) return `intent ${item.id} (teach) refers to ${item.tactic}`;
    if (item.kind === 'forbid' && nodes.has(item.area)) return `passes the forbid area ${item.area} of intent ${item.id}`;
    if (item.kind === 'route' && sides.length === 2 && onRoute(item.path, sides[0] ?? new Set()) !== onRoute(item.path, sides[1] ?? new Set())) {
      return `changes which nodes of the route of intent ${item.id} are walked`;
    }
    if (item.kind === 'time' && change.timeChanged === true) return `changes the time on a stage with the time range of intent ${item.id}`;
  }
  return undefined;
}

function stanceTouch(intent: Intent, ids: ReadonlySet<string>, nodes: ReadonlySet<string>, change: RewriteChange): string | undefined {
  if (change.supersedes === true && (intent.design_stance === 'open' || intent.design_stance === 'mixed')) {
    return `supersedes a solution on ${intent.stage}, whose design_stance is ${intent.design_stance}`;
  }
  for (const bait of intent.illusory_by_design ?? []) {
    if ((bait.tactics ?? []).some((id) => ids.has(id)) || (bait.route ?? []).some((node) => nodes.has(node))) return `is part of the illusory_by_design of ${intent.stage}`;
  }
  const accepted = intent.allowed_divergences.find((divergence) => divergence.tactic !== undefined && ids.has(divergence.tactic));
  return accepted === undefined ? undefined : `an accepted divergence of ${intent.stage} names ${accepted.tactic}`;
}

/**
 * Why the rewrite touches the intent, or undefined when it does not. `tactics` is [old] or
 * [old, new]; `measuredNodes` are the nodes the new tactic's measured runs went through.
 */
export function intentTouch(intents: readonly Intent[], tactics: readonly Tactic[], measuredNodes: readonly string[], change: RewriteChange = {}): string | undefined {
  const ids = new Set(tactics.map((tactic) => tactic.id));
  // Route sides compare the documents only: the old tactic has no measured nodes to set against the new one's.
  const sides = tactics.map((tactic) => new Set(nodesOfTactic(tactic)));
  const nodes = new Set([...measuredNodes, ...tactics.flatMap(nodesOfTactic)]);
  for (const intent of intents) {
    if (!appliesOn(intent, tactics)) continue;
    const touch = itemTouch(intent, ids, nodes, sides, change) ?? stanceTouch(intent, ids, nodes, change);
    if (touch !== undefined) return touch;
  }
  return undefined;
}
// @ts-expect-error augur-inject
intentTouch = contract(intentTouch, { ...augurContract_cbec7789, contractId: 'C-65', mode: 'observe', sample: 1, where: 'src/learn/consolidate/intent-touch.ts:101', rule: 'contract-wrap', id: 'cbec7789' }); /* augur-inject:contract-wrap:cbec7789 */
