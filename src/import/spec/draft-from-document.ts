// guide import spec / guide intent import, domain entry: specification text -> draft
// documents. Every output is draft: true, source.kind = llm-draft, knowledge = masked, and
// carries only numbers written in the document.

import type { DraftKindSpec } from './draft-kind.ts';
import type { DraftDeps, DraftKind, DraftRequest, DraftResult } from './draft-request.ts';
import { documentedNumbers } from './documented-numbers.ts';
import { intentDrafts } from './intent-drafts.ts';
import { requestValidDraft } from './request-valid-draft.ts';
import { ruleDrafts } from './rule-drafts.ts';
import { stateDrafts } from './state-drafts.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:a49fa8f8 */
import augurContract_0cd5afa0 from '../../contracts/draft-from-document.contract.ts'; /* augur-inject:contract-predicate:64694785 */

const KINDS: Readonly<Record<DraftKind, DraftKindSpec>> = { rules: ruleDrafts, states: stateDrafts, intent: intentDrafts };

export async function draftFromDocument(request: DraftRequest, deps: DraftDeps): Promise<DraftResult> {
  const spec = KINDS[request.kind];
  const documents = await requestValidDraft(spec, request, deps);
  return spec.screen(documents, documentedNumbers(request.document));
}
// @ts-expect-error augur-inject
draftFromDocument = contract(draftFromDocument, { ...augurContract_0cd5afa0, contractId: 'C-14', mode: 'observe', sample: 1, where: 'src/import/spec/draft-from-document.ts:15', rule: 'contract-wrap', id: '0cd5afa0' }); /* augur-inject:contract-wrap:0cd5afa0 */
