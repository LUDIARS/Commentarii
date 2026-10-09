// V04: a .masked.json file holds masked values only.

import { isMaskedFilePath } from '../../bundle/bundle.ts';
import { findKnowledgeHolders } from '../../domain/value-node.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v04MaskedOnly: Check = {
  id: 'V04',
  title: '.masked.json に masked 以外が無い',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const file of load.files) {
      if (!isMaskedFilePath(file.path)) continue;
      for (const { node, pointer } of findKnowledgeHolders(file.data)) {
        if (node.knowledge === 'masked') continue;
        findings.push(error(file.path, pointer, `knowledge '${String(node.knowledge)}' in a .masked.json file`));
      }
    }
    return findings;
  },
};
