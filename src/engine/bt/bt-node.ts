// Behavior tree nodes (design 7.4): Selector / Sequence / Condition / Action. A tree is plain
// data (no closures), so a running plan can be logged and compared. Ids are assigned in
// pre-order; `last` is the largest id inside the node's subtree, so a subtree is the id range
// [id, last] and its memory can be cleared without walking it.

import type { ReplayAction } from '../../replay/replay-action.ts';

/** An abstract action whose operands may still be `$bindings` (resolved when the leaf runs). */
export type ActionStep = ReplayAction;

interface NodeBase {
  readonly id: number;
  readonly last: number;
}

export interface SelectorNode extends NodeBase {
  readonly type: 'selector';
  readonly children: readonly BtNode[];
}

export interface SequenceNode extends NodeBase {
  readonly type: 'sequence';
  readonly children: readonly BtNode[];
}

/** Holds when the `when`-style condition (match/match-condition.ts vocabulary) holds. */
export interface ConditionNode extends NodeBase {
  readonly type: 'condition';
  readonly when: unknown;
}

export interface ActionNode extends NodeBase {
  readonly type: 'action';
  readonly step: ActionStep;
}

export type BtNode = SelectorNode | SequenceNode | ConditionNode | ActionNode;

/** Tree description without ids, as builders write it. */
export type TreeSpec =
  | { readonly selector: readonly TreeSpec[] }
  | { readonly sequence: readonly TreeSpec[] }
  | { readonly condition: unknown }
  | { readonly action: ActionStep };
