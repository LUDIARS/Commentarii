import type { Proposal } from '../learn/consolidate/proposal.ts';
import type { Bundle } from '@ludiars/commentarii-sdk/types';
import type { FindingTarget } from '../level/level-reports.ts';

export default { post: (result: Proposal, bundle: Bundle, finding: FindingTarget) =>
  result.kind === 'level-design' && result.status === 'pending' && result.files.length > 0 &&
    result.files.every((file) => file.patch[0]?.op === (file.create ? 'add' : 'test')) &&
    bundle.stages.some(({ stage }) => stage?.doc.id === finding.stage) &&
    result.basis.condition !== undefined && result.reason === finding.finding.move };
