// V12: what an intent item points at exists: teach.tactic in tactics/, forbid.area and every
// route.path node in the map of the intent's stage. Teach hints use expr/2 syntax.

import { ExpressionError, parseExpression } from '@ludiars/commentarii-sdk/expression';
import { error, type Check, type Finding } from '../check.ts';
import { levelIntentRefs } from './level-intent-refs.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:fc03e46b */
import augurContract_9e0835bf from '../../contracts/hint-syntax-issue.contract.ts'; /* augur-inject:contract-predicate:8fe8bb0f */

export function hintSyntaxIssue(text: string): string | undefined {
  try {
    parseExpression(text);
    return undefined;
  } catch (cause) {
    if (!(cause instanceof ExpressionError)) throw cause;
    return cause.message;
  }
}
// @ts-expect-error augur-inject
hintSyntaxIssue = contract(hintSyntaxIssue, { ...augurContract_9e0835bf, contractId: 'C-109', mode: 'observe', sample: 1, where: 'src/validate/checks/v12-intent-refs.ts:7', rule: 'contract-wrap', id: '9e0835bf' }); /* augur-inject:contract-wrap:9e0835bf */

export const v12IntentRefs: Check = {
  id: 'V12',
  title: 'intent の参照とヒントの述語が正しい',
  run: ({ load, index }) => {
    const findings: Finding[] = [];
    const tactics = new Set(load.bundle.tactics.map(({ doc }) => doc.id));
    const actions = new Set(load.bundle.rulebook.actions.map(({ doc }) => doc.id));
    for (const { path, doc } of load.bundle.intents) {
      const nodes = index.stageNodes.get(doc.stage);
      const requireNode = (pointer: string, node: string): void => {
        if (nodes === undefined) findings.push(error(path, pointer, `${node} is referenced but ${doc.stage} has no map`));
        else if (!nodes.has(node)) findings.push(error(path, pointer, `map node ${node} does not exist in ${doc.stage}`));
      };
      doc.intended.forEach((item, position) => {
        const pointer = `/intended/${position}`;
        if (item.kind === 'teach') {
          if (!tactics.has(item.tactic)) findings.push(error(path, `${pointer}/tactic`, `${item.tactic} does not exist`));
          item.hints?.forEach(({ when }, hint) => {
            const issue = hintSyntaxIssue(when);
            if (issue !== undefined) findings.push(error(path, `${pointer}/hints/${hint}/when`, issue));
          });
        }
        if (item.kind === 'forbid') requireNode(`${pointer}/area`, item.area);
        if (item.kind === 'route') item.path.forEach((node, step) => requireNode(`${pointer}/path/${step}`, node));
        if ((item.kind === 'route' || item.kind === 'teach') && item.level !== undefined) {
          findings.push(...levelIntentRefs(item.level, actions, path, `${pointer}/level`));
        }
      });
    }
    return findings;
  },
};
