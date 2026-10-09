// The player view of a bundle: everything the player may know, nothing masked (principle 1).
// render and export use this view by default, so masked data cannot leak into their output
// even when a bundle wrongly keeps a masked value outside its .masked.json.

import { isJsonObject } from '../domain/value-node.ts';
import type { Bundle, Located, StageFiles } from './bundle.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:57a6a525 */
import augurContract_6798a8ca from '../contracts/to-player-view.contract.ts'; /* augur-inject:contract-predicate:bc66eeb3 */

function isMaskedObject(value: unknown): boolean {
  return isJsonObject(value) && value.knowledge === 'masked';
}

/** Deep copy without any object whose knowledge is masked (array items and properties alike). */
export function stripMasked<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => !isMaskedObject(item)).map((item) => stripMasked(item)) as T;
  }
  if (!isJsonObject(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isMaskedObject(child)) continue;
    copy[key] = stripMasked(child);
  }
  return copy as T;
}

function keepPlayerDocuments<T>(items: readonly Located<T>[]): Located<T>[] {
  return items.filter(({ doc }) => !isMaskedObject(doc)).map(({ path, doc }) => ({ path, doc: stripMasked(doc) }));
}

function stripLocated<T>(item: Located<T> | undefined): Located<T> | undefined {
  if (item === undefined || isMaskedObject(item.doc)) return undefined;
  return { path: item.path, doc: stripMasked(item.doc) };
}

function stripStage(stage: StageFiles): StageFiles {
  const stageDoc = stripLocated(stage.stage);
  const map = stripLocated(stage.map);
  const events = stripLocated(stage.events);
  return {
    slug: stage.slug,
    ...(stageDoc ? { stage: stageDoc } : {}),
    ...(map ? { map } : {}),
    ...(events ? { events } : {}),
  };
}

export function toPlayerView(bundle: Bundle): Bundle {
  const manifest = stripLocated(bundle.manifest);
  const glossary = stripLocated(bundle.glossary);
  return {
    ...(manifest ? { manifest } : {}),
    ...(glossary ? { glossary } : {}),
    entities: keepPlayerDocuments(bundle.entities),
    maskedEntities: [],
    stages: bundle.stages.map(stripStage),
    rules: keepPlayerDocuments(bundle.rules),
    states: keepPlayerDocuments(bundle.states),
    tactics: keepPlayerDocuments(bundle.tactics),
    intents: keepPlayerDocuments(bundle.intents),
  };
}
// @ts-expect-error augur-inject
toPlayerView = contract(toPlayerView, { ...augurContract_6798a8ca, contractId: 'C-3', mode: 'observe', sample: 1, where: 'src/bundle/player-view.ts:47', rule: 'contract-wrap', id: '6798a8ca' }); /* augur-inject:contract-wrap:6798a8ca */
