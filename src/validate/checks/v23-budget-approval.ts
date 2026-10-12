// V23: an approved budget table names exactly the proposals it carries: approval.proposals_hash
// equals proposals.proposals_hash. An approval of other proposals would let a table change that
// nobody reviewed (the engine refuses such a file too).

import type { ApprovedBudgetTable } from '@ludiars/commentarii-sdk/types';
import { error, type Check } from '../check.ts';
import { validOutputs } from './engine-outputs.ts';

export const v23BudgetApproval: Check = {
  id: 'V23',
  title: '承認済み予算表の承認が変更案と一致する',
  run: ({ load }) =>
    validOutputs<ApprovedBudgetTable>(load, 'approved-budget-table')
      .filter(({ doc }) => doc.approval.proposals_hash !== doc.proposals.proposals_hash)
      .map(({ path, doc }) => error(path, '/approval/proposals_hash', `approves ${doc.approval.proposals_hash}, the proposals are ${doc.proposals.proposals_hash}`)),
};
