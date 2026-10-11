// C-60 observationBoundaryProblems(frame, declarations): omniscient frames give no problem; in a
// player frame every reported pointer exists in the frame, and every place outside the base
// registry and the non-masked declarations (extra keys, resources, event fields) is reported.

import type { BoundaryProblem } from '../observation/check-observation-boundary.ts';
import { BASE_FIELDS, type ObservationFieldDeclaration } from '../observation/observation-fields.ts';
import type { ObservationFrame } from '../replay/observation-frame.ts';

const BASE = new Set(BASE_FIELDS.map((field) => field.path));

function declaredPlaces(frame: ObservationFrame): { path: string; pointer: string }[] {
  const places: { path: string; pointer: string }[] = [];
  for (const key of Object.keys(frame.extra ?? {})) places.push({ path: `extra.${key}`, pointer: `/extra/${key}` });
  for (const key of Object.keys(frame.self.resources ?? {})) places.push({ path: `self.resources.${key}`, pointer: `/self/resources/${key}` });
  frame.events.forEach((event, index) => {
    for (const key of Object.keys(event)) if (key !== 'kind') places.push({ path: `events.${event.kind}.${key}`, pointer: `/events/${index}/${key}` });
  });
  return places.filter((place) => !place.pointer.includes('~') && !place.path.slice(place.path.indexOf('.') + 1).includes('/'));
}

export default {
  post: (problems: BoundaryProblem[], frame: ObservationFrame, declarations: readonly ObservationFieldDeclaration[], base = '') => {
    if (frame.mode !== 'player') return problems.length === 0 || 'an omniscient frame was checked';
    const reported = new Set(problems.map((problem) => problem.pointer));
    const allowed = new Map(declarations.filter((declaration) => declaration.knowledge !== 'masked').map((declaration) => [declaration.path, declaration]));
    for (const place of declaredPlaces(frame)) {
      if (BASE.has(place.path) || allowed.has(place.path)) continue;
      if (!reported.has(`${base}${place.pointer}`)) return `${place.path} is outside the registry but not reported`;
    }
    return true;
  },
};
