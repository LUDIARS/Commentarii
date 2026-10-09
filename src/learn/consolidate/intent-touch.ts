// Whether a tactic rewrite touches the designer's intent (design 8.2: "intent の forbid / teach
// に関わらない"), in which case it waits for a person even under auto_apply:
//   - an intent `teach` item names the tactic being replaced (or the new one): replacing what
//     the designer wants taught is the designer's call;
//   - the old or new tactic passes a `forbid` area: it moves there (`do` move_to), requires
//     being there (`when` at_node), or its measured runs went through it.
// Every intent of the bundle counts, drafts included (the safe side).

import type { Intent, Tactic } from '../../domain/documents.ts';
import { isNodeId } from '../../domain/id.ts';
import { isJsonObject } from '../../domain/value-node.ts';

function nodesInCondition(condition: unknown, found: Set<string>): void {
  if (Array.isArray(condition)) {
    for (const item of condition) nodesInCondition(item, found);
    return;
  }
  if (!isJsonObject(condition)) return;
  for (const [key, value] of Object.entries(condition)) {
    if (key === 'at_node' && typeof value === 'string') found.add(value);
    else nodesInCondition(value, found);
  }
}

/** Map nodes a tactic goes to or requires being at. */
export function nodesOfTactic(tactic: Tactic): string[] {
  const found = new Set<string>();
  for (const step of tactic.do) {
    const target = step.move_to;
    if (typeof target === 'string' && isNodeId(target)) found.add(target);
  }
  nodesInCondition(tactic.when, found);
  return [...found];
}

/** Why the rewrite touches the intent, or undefined when it does not. */
export function intentTouch(intents: readonly Intent[], tactics: readonly Tactic[], measuredNodes: readonly string[]): string | undefined {
  const ids = new Set(tactics.map((tactic) => tactic.id));
  const nodes = new Set([...measuredNodes, ...tactics.flatMap(nodesOfTactic)]);
  for (const intent of intents) {
    for (const item of intent.intended) {
      if (item.kind === 'teach' && ids.has(item.tactic)) return `intent ${item.id} (teach) refers to ${item.tactic}`;
      if (item.kind === 'forbid' && nodes.has(item.area)) return `passes the forbid area ${item.area} of intent ${item.id}`;
    }
  }
  return undefined;
}
