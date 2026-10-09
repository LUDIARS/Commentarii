// V10: a tactic's knowledge equals the strictest knowledge among the values it references
// (design 4.4 propagation rule: one masked reference makes the tactic masked).

import { referencedKnowledge } from '../../bundle/resolve-ref.ts';
import { strictestKnowledge } from '../../domain/knowledge.ts';
import { collectTacticRefs } from '../../domain/tactic-refs.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v10TacticKnowledge: Check = {
  id: 'V10',
  title: '定石の knowledge が参照先の最も厳しい値と一致する',
  run: ({ load, index }) => {
    const findings: Finding[] = [];
    for (const { path, doc } of load.bundle.tactics) {
      const expected = strictestKnowledge(collectTacticRefs(doc).flatMap((ref) => referencedKnowledge(index, ref)));
      if (expected === undefined || expected === doc.knowledge) continue;
      findings.push(error(path, '/knowledge', `knowledge is '${doc.knowledge}' but the strictest referenced value is '${expected}'`));
    }
    return findings;
  },
};
