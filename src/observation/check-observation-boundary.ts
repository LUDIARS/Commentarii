// The observation boundary check (spec/feature/observation-boundary.md): every place of a player
// frame must be in the field registry (observation-fields.ts) - boundary-free metadata, a
// protocol field the player sees by construction, or a field the game declared player-knowable.
// Unregistered places are refused whatever their content: a bare value has no boundary and is
// masked by principle 1, and a self-labelled one is the adapter vouching for itself.
// Masked labels are reported by find-masked-pointers; this check is about the places.
// Omniscient frames are never checked (they may hold anything, design 7.6).

import { isKnowledge, strictestKnowledge } from '../domain/knowledge.ts';
import { isJsonObject } from '../domain/value-node.ts';
import type { ObservationFrame } from '../replay/observation-frame.ts';
import { BASE_FIELDS, isDeclarablePath, type ObservationFieldDeclaration } from './observation-fields.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:5750df13 */
import augurContract_3d8c6766 from '../contracts/observation-boundary.contract.ts'; /* augur-inject:contract-predicate:30d6aebb */

export type BoundaryProblemCode = 'unregistered' | 'declared-masked' | 'label-contradicts';

export interface BoundaryProblem {
  readonly code: BoundaryProblemCode;
  /** JSON pointer (relative to the frame, prefixed with the caller's base). */
  readonly pointer: string;
  /** Registry path of the place. */
  readonly path: string;
  readonly message: string;
}

const BASE_PATHS = new Set(BASE_FIELDS.map((field) => field.path));
const FRAME_SECTIONS = new Set(['self', 'entities', 'stage', 'events', 'extra']);

function escapeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function labelOf(value: unknown): unknown {
  return isJsonObject(value) && 'knowledge' in value && 'value' in value ? value.knowledge : undefined;
}

class BoundaryWalk {
  readonly problems: BoundaryProblem[] = [];
  private readonly declared: ReadonlyMap<string, ObservationFieldDeclaration>;

  constructor(declarations: readonly ObservationFieldDeclaration[]) {
    // A declaration of a place a game cannot declare (a base field, frame structure) is ignored.
    this.declared = new Map(declarations.filter((declaration) => isDeclarablePath(declaration.path)).map((declaration) => [declaration.path, declaration]));
  }

  /** One place: base fields pass, declared ones pass when player-knowable and labelled consistently. */
  place(path: string, pointer: string, value: unknown): void {
    if (BASE_PATHS.has(path)) return;
    const declaration = this.declared.get(path);
    if (declaration === undefined) {
      this.problems.push({ code: 'unregistered', pointer, path, message: `${path} is not a registered observation field; declare it in manifest observation.fields (an undeclared value is masked, principle 1)` });
      return;
    }
    if (declaration.knowledge === 'masked') {
      this.problems.push({ code: 'declared-masked', pointer, path, message: `${path} is declared masked and cannot appear in a player observation` });
      return;
    }
    const label = labelOf(value);
    if (isKnowledge(label) && label !== 'masked' && strictestKnowledge([label, declaration.knowledge]) !== label) {
      this.problems.push({ code: 'label-contradicts', pointer, path, message: `${path} is labelled ${label} but declared ${declaration.knowledge}` });
    }
  }

  keysUnder(prefix: string, pointer: string, value: unknown): void {
    if (!isJsonObject(value)) return;
    for (const [key, child] of Object.entries(value)) this.place(`${prefix}.${key}`, `${pointer}/${escapeSegment(key)}`, child);
  }

  self(value: unknown, pointer: string): void {
    if (!isJsonObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const at = `${pointer}/${escapeSegment(key)}`;
      if (key === 'resources') this.keysUnder('self.resources', at, child);
      else this.place(`self.${key}`, at, child);
    }
  }

  entities(value: unknown, pointer: string): void {
    if (!Array.isArray(value)) return;
    value.forEach((entity, index) => this.keysUnder('entities[]', `${pointer}/${index}`, entity));
  }

  events(value: unknown, pointer: string): void {
    if (!Array.isArray(value)) return;
    value.forEach((event, index) => {
      if (!isJsonObject(event)) return;
      const kind = typeof event.kind === 'string' ? event.kind : '';
      for (const [key, child] of Object.entries(event)) {
        const at = `${pointer}/${index}/${escapeSegment(key)}`;
        this.place(key === 'kind' ? 'events[].kind' : `events.${kind}.${key}`, at, child);
      }
    });
  }

  frame(frame: ObservationFrame, base: string): void {
    for (const [key, value] of Object.entries(frame)) {
      const at = `${base}/${escapeSegment(key)}`;
      if (!FRAME_SECTIONS.has(key)) this.place(key, at, value);
      else if (key === 'self') this.self(value, at);
      else if (key === 'entities') this.entities(value, at);
      else if (key === 'events') this.events(value, at);
      else this.keysUnder(key, at, value);
    }
  }
}

/** Places of a player frame outside the registry (empty for omniscient frames). */
export function observationBoundaryProblems(frame: ObservationFrame, declarations: readonly ObservationFieldDeclaration[], base = ''): BoundaryProblem[] {
  if (frame.mode !== 'player') return [];
  const walk = new BoundaryWalk(declarations);
  walk.frame(frame, base);
  return walk.problems;
}
// @ts-expect-error augur-inject
observationBoundaryProblems = contract(observationBoundaryProblems, { ...augurContract_3d8c6766, contractId: 'C-60', mode: 'observe', sample: 1, where: 'src/observation/check-observation-boundary.ts:106', rule: 'contract-wrap', id: '3d8c6766' }); /* augur-inject:contract-wrap:3d8c6766 */
