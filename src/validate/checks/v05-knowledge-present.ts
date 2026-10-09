// V05: every value, however deeply nested, declares its knowledge boundary.

import { isKnowledge } from '../../domain/knowledge.ts';
import { findValueNodes } from '../../domain/value-node.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v05KnowledgePresent: Check = {
  id: 'V05',
  title: 'knowledge 無しの値が無い',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const file of load.files) {
      for (const { node, pointer } of findValueNodes(file.data)) {
        if (!Object.hasOwn(node, 'knowledge')) findings.push(error(file.path, pointer, 'value without knowledge'));
        else if (!isKnowledge(node.knowledge)) findings.push(error(file.path, pointer, `unknown knowledge '${String(node.knowledge)}'`));
      }
    }
    return findings;
  },
};
