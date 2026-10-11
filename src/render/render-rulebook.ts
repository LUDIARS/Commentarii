// ルールブック (rulebook.md): 変数表、行動の型の表と式、過程、挙動モデルの図、目標. Rendered
// from the player view like every page but masked.md, so a masked override never shows here.

import type { Bundle } from '@ludiars/commentarii-sdk/types';
import { document } from '../markdown/markdown.ts';
import { renderActions } from './rulebook/render-actions.ts';
import { renderBehaviors } from './rulebook/render-behaviors.ts';
import { renderObjectives } from './rulebook/render-objectives.ts';
import { renderProcesses } from './rulebook/render-processes.ts';
import { renderVariables } from './rulebook/render-variables.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:16d78a01 */
import augurContract_1727a4f9 from '../contracts/render-rulebook.contract.ts'; /* augur-inject:contract-predicate:42a196ad */

export function renderRulebook(bundle: Bundle): string {
  const { rulebook } = bundle;
  return document([
    '# ルールブック',
    '式は expr/2 (比較・論理・if・ID・$パラメータ・文脈関数)。仕様: spec/feature/rulebook.md。',
    renderVariables(rulebook.variables?.doc),
    renderActions(rulebook.actions.map(({ doc }) => doc)),
    renderProcesses(rulebook.processes.map(({ doc }) => doc)),
    renderBehaviors(
      rulebook.behaviors.map(({ doc }) => doc),
      bundle.states.map(({ doc }) => doc),
    ),
    renderObjectives(rulebook.objectives?.doc),
  ]);
}
// @ts-expect-error augur-inject
renderRulebook = contract(renderRulebook, { ...augurContract_1727a4f9, contractId: 'C-104', mode: 'observe', sample: 1, where: 'src/render/render-rulebook.ts:12', rule: 'contract-wrap', id: '1727a4f9' }); /* augur-inject:contract-wrap:1727a4f9 */
