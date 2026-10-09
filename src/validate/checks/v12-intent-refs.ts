// V12: what an intent item points at exists: teach.tactic in tactics/, forbid.area and every
// route.path node in the map of the intent's stage.

import { error, type Check, type Finding } from '../check.ts';

export const v12IntentRefs: Check = {
  id: 'V12',
  title: 'intent の tactic / area / path の参照が存在する',
  run: ({ load, index }) => {
    const findings: Finding[] = [];
    const tactics = new Set(load.bundle.tactics.map(({ doc }) => doc.id));
    for (const { path, doc } of load.bundle.intents) {
      const nodes = index.stageNodes.get(doc.stage);
      const requireNode = (pointer: string, node: string): void => {
        if (nodes === undefined) findings.push(error(path, pointer, `${node} is referenced but ${doc.stage} has no map`));
        else if (!nodes.has(node)) findings.push(error(path, pointer, `map node ${node} does not exist in ${doc.stage}`));
      };
      doc.intended.forEach((item, position) => {
        const pointer = `/intended/${position}`;
        if (item.kind === 'teach' && !tactics.has(item.tactic)) findings.push(error(path, `${pointer}/tactic`, `${item.tactic} does not exist`));
        if (item.kind === 'forbid') requireNode(`${pointer}/area`, item.area);
        if (item.kind === 'route') item.path.forEach((node, step) => requireNode(`${pointer}/path/${step}`, node));
      });
    }
    return findings;
  },
};
