// V20: the player-side rulebook carries no trace of what is hidden (design: Fable §2.5, Astra
// §5.1). Outside .masked.json files no key names an override or a hidden part, no string points
// at a .masked.json file, and an action that has a masked override does not announce
// "effects unknown" (that placeholder must be a public declaration of its own, never the shadow
// of a masked file). Probability shortfalls are V15.

import { isMaskedFilePath, type LoadedFile } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';

const RULEBOOK_KINDS: ReadonlySet<LoadedFile['kind']> = new Set(['variables', 'action', 'process', 'behavior', 'objectives', 'state', 'rule']);
const TRACE_KEYS = new Set(['override', 'overrides', 'masked', 'hidden', 'secret']);

function traces(value: unknown, pointer: string, found: string[]): void {
  if (typeof value === 'string') {
    if (value.includes('.masked.json')) found.push(pointer);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => traces(item, `${pointer}/${i}`, found));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (TRACE_KEYS.has(key)) found.push(`${pointer}/${key}`);
    traces(child, `${pointer}/${key}`, found);
  }
}

export const v20NoHiddenTraces: Check = {
  id: 'V20',
  title: 'player 側の定義に隠れた分岐の痕跡が無い',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const file of load.files) {
      if (!RULEBOOK_KINDS.has(file.kind) || isMaskedFilePath(file.path)) continue;
      const found: string[] = [];
      traces(file.data, '', found);
      for (const pointer of found) findings.push(error(file.path, pointer, 'the visible definition points at something hidden'));
    }
    const overridden = new Set(load.bundle.rulebook.maskedActions.map(({ doc }) => doc.id));
    for (const { path, doc } of load.bundle.rulebook.actions) {
      if (doc.effects_known === false && overridden.has(doc.id)) {
        findings.push(error(path, '/effects_known', `${doc.id} says its effects are unknown while a masked override defines them`));
      }
    }
    return findings;
  },
};
