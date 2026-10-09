// V11: coverage warnings. An enemy without a state machine or a stage without an intent is
// allowed, but the auto player and intent verification will be weaker there.

import { warning, type Check, type Finding } from '../check.ts';

export const v11Coverage: Check = {
  id: 'V11',
  title: 'カバレッジ (状態機械の無い敵、意図の無いステージ)',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const { path, doc } of load.bundle.entities) {
      if (doc.id.startsWith('enemy:') && doc.behavior === undefined) {
        findings.push(warning(path, '/behavior', `${doc.id} has no state machine`));
      }
    }
    const stagesWithIntent = new Set(load.bundle.intents.map(({ doc }) => doc.stage));
    for (const stage of load.bundle.stages) {
      if (stage.stage && !stagesWithIntent.has(stage.stage.doc.id)) {
        findings.push(warning(stage.stage.path, '', `${stage.stage.doc.id} has no intent`));
      }
    }
    return findings;
  },
};
