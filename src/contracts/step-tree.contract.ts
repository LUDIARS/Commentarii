// C-20 stepTree(tree, memory, context): running always carries an action, failure never does,
// an action has exactly one verb, and the returned memory only holds nodes of this tree.

import type { BtMemory } from '../engine/bt/bt-memory.ts';
import type { BtNode } from '../engine/bt/bt-node.ts';
import type { StepResult } from '../engine/bt/step-result.ts';
import { ACTION_VERBS } from '../replay/replay-action.ts';

export default {
  post: (result: StepResult, tree: BtNode, _memory: BtMemory) => {
    if (result.status === 'running' && result.action === undefined) return 'running without an action';
    if (result.status === 'failure' && result.action !== undefined) return 'failure with an action';
    if (result.action !== undefined) {
      const verbs = ACTION_VERBS.filter((verb) => result.action?.[verb] !== undefined);
      if (verbs.length !== 1) return `action has ${verbs.length} verbs`;
    }
    for (const id of result.memory.keys()) if (id < tree.id || id > tree.last) return `memory holds node ${id} outside the tree`;
    return true;
  },
};
