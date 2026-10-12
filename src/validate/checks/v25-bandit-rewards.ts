// V25: the online correction's statistics are possible: each reward is 0..1, so an arm's summed
// reward is at most its episode count (and zero without episodes). A larger total means the file
// was edited or merged wrongly, and the correction would over-trust that arm.

import type { MethodBandit } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';
import { validOutputs } from './engine-outputs.ts';

function pointerToken(key: string): string {
  return key.replaceAll('~', '~0').replaceAll('/', '~1');
}

export const v25BanditRewards: Check = {
  id: 'V25',
  title: 'オンライン補正の報酬合計が回数以下',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const { path, doc } of validOutputs<MethodBandit>(load, 'method-bandit')) {
      for (const [version, signatures] of Object.entries(doc.versions)) {
        for (const [signature, arms] of Object.entries(signatures)) {
          for (const [arm, stats] of Object.entries(arms)) {
            if (stats === undefined || stats.total <= stats.n + 1e-9) continue;
            const pointer = `/versions/${pointerToken(version)}/${pointerToken(signature)}/${arm}/total`;
            findings.push(error(path, pointer, `summed reward ${stats.total} exceeds ${stats.n} episode(s) (each reward is 0..1)`));
          }
        }
      }
    }
    return findings;
  },
};
