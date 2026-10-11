// V16: maps_to speaks the abstract adapter vocabulary (replay.schema.json#/$defs/action):
// exactly one verb, plus optional target / params; every $param it passes is declared; an
// action the player can take (actor self) has one.

import { ACTION_VERBS, type ActionDefinition } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';

const EXTRA_KEYS = new Set(['target', 'params']);

function paramRefs(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith('$') ? [value.slice(1)] : [];
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(paramRefs);
  return [];
}

function mapsToFindings(path: string, action: ActionDefinition): Finding[] {
  const mapsTo = action.maps_to;
  if (mapsTo === undefined) {
    return action.actor.includes('self') ? [error(path, '/actor', `${action.id} can be taken by self but has no maps_to`)] : [];
  }
  const findings: Finding[] = [];
  const keys = Object.keys(mapsTo);
  for (const key of keys) {
    if (!(ACTION_VERBS as readonly string[]).includes(key) && !EXTRA_KEYS.has(key)) findings.push(error(path, `/maps_to/${key}`, `'${key}' is not an adapter verb`));
  }
  const verbs = keys.filter((key) => (ACTION_VERBS as readonly string[]).includes(key));
  if (verbs.length !== 1) findings.push(error(path, '/maps_to', `maps_to needs exactly one verb, has ${verbs.length}`));
  if (mapsTo.params !== undefined && typeof mapsTo.params !== 'object') findings.push(error(path, '/maps_to/params', 'params must be an object'));
  const declared = new Set(Object.keys(action.params ?? {}));
  for (const name of paramRefs(mapsTo)) {
    if (!declared.has(name)) findings.push(error(path, '/maps_to', `$${name} is not a parameter of ${action.id}`));
  }
  return findings;
}

export const v16MapsTo: Check = {
  id: 'V16',
  title: '行動の maps_to が抽象アクションの語彙',
  run: ({ load }) => load.bundle.rulebook.actions.flatMap(({ path, doc }) => mapsToFindings(path, doc)),
};
