// V07: a value drafted by an LLM stays draft until a human or a master source replaces it.

import { findValueNodes, isJsonObject } from '../../domain/value-node.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v07LlmDraft: Check = {
  id: 'V07',
  title: 'llm-draft なのに draft: false',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const file of load.files) {
      for (const { node, pointer } of findValueNodes(file.data)) {
        if (!isJsonObject(node.source) || node.source.kind !== 'llm-draft') continue;
        if (node.draft !== true) findings.push(error(file.path, pointer, `llm-draft value with draft: ${String(node.draft ?? 'missing')}`));
      }
    }
    return findings;
  },
};
