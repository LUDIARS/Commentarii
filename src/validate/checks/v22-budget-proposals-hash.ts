// V22: a budget table proposal file is what the engine made: its proposals_hash is the content
// hash of its proposal list (an edited list breaks it, and an approval binds to that hash), each
// proposal ID is <cell>:<planner> and appears once, and every proposal changes something
// (from != to). Checked in proposals.json and in the copy inside approved-budget-table.json.

import type { ApprovedBudgetTable, PlanningProposals } from '@ludiars/commentarii-sdk/types';
import { contentHash } from '../../learn/approval/proposal-hash.ts';
import { error, type Check, type Finding } from '../check.ts';
import { validOutputs } from './engine-outputs.ts';

function proposalFindings(path: string, base: string, proposals: PlanningProposals): Finding[] {
  const findings: Finding[] = [];
  if (contentHash(proposals.proposals) !== proposals.proposals_hash) findings.push(error(path, `${base}/proposals_hash`, 'is not the content hash of the proposals (edited after they were made)'));
  const seen = new Set<string>();
  proposals.proposals.forEach((proposal, index) => {
    const pointer = `${base}/proposals/${index}`;
    if (proposal.id !== `${proposal.cell}:${proposal.planner}`) findings.push(error(path, `${pointer}/id`, `${proposal.id} is not ${proposal.cell}:${proposal.planner}`));
    if (seen.has(proposal.id)) findings.push(error(path, `${pointer}/id`, `${proposal.id} is proposed twice`));
    seen.add(proposal.id);
    if (proposal.from === proposal.to) findings.push(error(path, `${pointer}/to`, `${proposal.id} changes nothing (from = to = ${proposal.to})`));
  });
  return findings;
}

export const v22BudgetProposalsHash: Check = {
  id: 'V22',
  title: '予算表の変更案のハッシュと ID が整合する',
  run: ({ load }) => [
    ...validOutputs<PlanningProposals>(load, 'planning-proposals').flatMap(({ path, doc }) => proposalFindings(path, '', doc)),
    ...validOutputs<ApprovedBudgetTable>(load, 'approved-budget-table').flatMap(({ path, doc }) => proposalFindings(path, '/proposals', doc.proposals)),
  ],
};
