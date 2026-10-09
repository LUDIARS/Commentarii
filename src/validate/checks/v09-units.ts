// V09: a stat name means one unit across the whole bundle (hp is never hp in one enemy and % in another).

import { isJsonObject } from '../../domain/value-node.ts';
import { error, type Check, type Finding } from '../check.ts';

const NO_UNIT = '(none)';

interface UnitUse {
  readonly unit: string;
  readonly path: string;
  readonly pointer: string;
}

export const v09Units: Check = {
  id: 'V09',
  title: '単位の整合',
  run: ({ load }) => {
    const uses = new Map<string, UnitUse[]>();
    for (const file of load.files) {
      if (file.kind !== 'entity' && file.kind !== 'entity-masked') continue;
      if (!isJsonObject(file.data) || !isJsonObject(file.data.stats)) continue;
      for (const [stat, value] of Object.entries(file.data.stats)) {
        if (!isJsonObject(value)) continue;
        const unit = typeof value.unit === 'string' ? value.unit : NO_UNIT;
        const list = uses.get(stat) ?? [];
        list.push({ unit, path: file.path, pointer: `/stats/${stat}/unit` });
        uses.set(stat, list);
      }
    }
    const findings: Finding[] = [];
    for (const [stat, list] of [...uses.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const first = list[0];
      if (first === undefined) continue;
      for (const use of list) {
        if (use.unit === first.unit) continue;
        findings.push(error(use.path, use.pointer, `stat '${stat}' uses unit '${use.unit}' but ${first.path} uses '${first.unit}'`));
      }
    }
    return findings;
  },
};
