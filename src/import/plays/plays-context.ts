// What guide import plays needs from the target bundle: the game, its version, the entity IDs
// identify may resolve to, the stages with their map nodes, and the tactics candidates are
// compared with. Built once from the loaded bundle (the full one: the import reads IDs only).

import type { Bundle } from '../../bundle/bundle.ts';
import type { Tactic } from '../../domain/documents.ts';
import type { ObservationFieldDeclaration } from '../../observation/observation-fields.ts';
import { ImportError } from '../import-error.ts';

export interface PlaysContext {
  readonly gameId: string;
  readonly manifestVersion: string;
  readonly entityIds: ReadonlySet<string>;
  /** Stage ID -> node IDs of its map. */
  readonly stages: ReadonlyMap<string, ReadonlySet<string>>;
  readonly tactics: readonly Tactic[];
  /** manifest observation.fields (spec/feature/observation-boundary.md). */
  readonly observationFields: readonly ObservationFieldDeclaration[];
}

export function playsContextOf(bundle: Bundle, bundleDir: string): PlaysContext {
  const manifest = bundle.manifest?.doc;
  if (manifest === undefined) throw new ImportError(`${bundleDir} has no valid manifest.json (run guide validate)`);
  const stages = new Map<string, ReadonlySet<string>>();
  for (const stage of bundle.stages) {
    const id = stage.stage?.doc.id ?? stage.map?.doc.stage;
    if (id !== undefined) stages.set(id, new Set((stage.map?.doc.nodes ?? []).map((node) => node.id)));
  }
  return {
    gameId: manifest.game_id,
    manifestVersion: manifest.version,
    entityIds: new Set(bundle.entities.map(({ doc }) => doc.id)),
    stages,
    tactics: bundle.tactics.map(({ doc }) => doc),
    observationFields: manifest.observation?.fields ?? [],
  };
}
