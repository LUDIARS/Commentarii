// V21: the engine outputs next to the bundle (observations/planning/{method-report,proposals,
// approved-budget-table}.json, observations/selection/method-bandit.json,
// observations/opponents/<slug>.json; SDK 0.5.0) are JSON that follows their schema. They are
// never bundle documents, so V01 does not see them.

import { error, type Check } from '../check.ts';

export const v21EngineOutputSchema: Check = {
  id: 'V21',
  title: 'エンジン出力がスキーマどおり',
  run: ({ load }) => (load.outputs ?? []).flatMap((output) => output.violations.map((violation) => error(output.path, violation.pointer, `${output.schema}: ${violation.message}`))),
};
