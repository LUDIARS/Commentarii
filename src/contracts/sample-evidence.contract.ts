// C-68 sampleEvidence(members): only finished attempts are in the denominator (aborted ones are
// counted apart), successes never exceed attempts, and the 95% interval contains the success rate
// (both null without attempts).

import type { SampleEvidence } from '../verify/feasibility/sample-evidence.ts';

interface Attempt {
  readonly reached: boolean;
  readonly completed: boolean;
}

export default {
  post: (evidence: SampleEvidence, members: readonly Attempt[]) => {
    const finished = members.filter((member) => member.completed).length;
    if (evidence.attempts !== finished) return `${evidence.attempts} attempts counted, ${finished} finished`;
    if (evidence.aborted !== members.length - finished) return 'aborted attempts miscounted';
    if (evidence.successes > evidence.attempts) return 'more successes than attempts';
    if (evidence.attempts === 0) return (evidence.success_rate === null && evidence.interval === null) || 'a rate without attempts';
    const [low, high] = evidence.interval ?? [1, 0];
    const rate = evidence.success_rate ?? -1;
    return (low <= rate + 1e-9 && rate <= high + 1e-9) || `the interval [${low}, ${high}] misses the rate ${rate}`;
  },
};
