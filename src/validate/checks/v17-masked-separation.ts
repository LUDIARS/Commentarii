// V17: a masked action override stands beside the visible action it overrides: the visible
// mechanics/actions/<slug>.json exists and has the same ID. The visible side is checked on its
// own by the other items (V13-V16, V18-V20), so it is complete without the override.

import { error, type Check, type Finding } from '../check.ts';

export const v17MaskedSeparation: Check = {
  id: 'V17',
  title: 'masked の上書きが見える行動と分離している',
  run: ({ load }) => {
    const findings: Finding[] = [];
    const { actions, maskedActions } = load.bundle.rulebook;
    for (const { path, doc } of maskedActions) {
      const visiblePath = path.replace(/\.masked\.json$/, '.json');
      const visible = actions.find((action) => action.path === visiblePath);
      if (visible === undefined) findings.push(error(path, '', `masked override has no visible action ${visiblePath}`));
      else if (visible.doc.id !== doc.id) findings.push(error(path, '/id', `${doc.id} differs from ${visible.doc.id} in ${visiblePath}`));
    }
    return findings;
  },
};
