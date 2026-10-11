// TreeSpec -> BtNode with pre-order ids, and the tactic assembler: a tactic's `do` array
// becomes a Sequence of Action leaves (design 7.4: "do をサブツリーに展開").

import type { Tactic } from '../../domain/documents.ts';
import type { ActionStep, BtNode, TreeSpec } from './bt-node.ts';

export function buildTree(spec: TreeSpec): BtNode {
  let next = 0;
  const build = (current: TreeSpec): BtNode => {
    const id = next;
    next += 1;
    if ('selector' in current || 'sequence' in current) {
      const type = 'selector' in current ? 'selector' : 'sequence';
      const specs = 'selector' in current ? current.selector : current.sequence;
      if (specs.length === 0) throw new Error(`${type} needs at least one child`);
      const children = specs.map(build);
      return { type, id, last: next - 1, children };
    }
    if ('condition' in current) return { type: 'condition', id, last: id, when: current.condition };
    return { type: 'action', id, last: id, step: current.action };
  };
  return build(spec);
}

/** The steps of a `do` array, as Action leaves of one Sequence. */
export function stepsTree(steps: readonly ActionStep[]): BtNode {
  return buildTree({ sequence: steps.map((action) => ({ action })) });
}

export function tacticTree(tactic: Tactic): BtNode {
  return stepsTree(tactic.do as readonly ActionStep[]);
}
