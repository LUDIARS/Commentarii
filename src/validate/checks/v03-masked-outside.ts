// V03: knowledge=masked appears only in .masked.json files.
// A tactic's own knowledge is derived from what it references (V10) and is exempt; its
// masked label marks it for exclusion from player output instead of hiding a value.

import { isMaskedFilePath } from '../../bundle/bundle.ts';
import { findKnowledgeHolders } from '../../domain/value-node.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v03MaskedOutside: Check = {
  id: 'V03',
  title: '.masked.json 以外に masked が無い',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const file of load.files) {
      if (isMaskedFilePath(file.path)) continue;
      for (const { node, pointer } of findKnowledgeHolders(file.data)) {
        if (node.knowledge !== 'masked') continue;
        if (file.kind === 'tactic' && pointer === '') continue;
        findings.push(error(file.path, pointer, 'masked value outside a .masked.json file'));
      }
    }
    return findings;
  },
};
