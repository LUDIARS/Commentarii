// Content hashes that identify what a bench measured (spec/feature/balance-gate.md §2): the
// canonical bundle (every document by path, masked companions included: the engine's world is
// built from them), the overlay and the persona. Paths stay out of the result; only hashes go in.

import type { Bundle } from '../bundle/bundle.ts';
import { contentHash } from '../learn/approval/proposal-hash.ts';

export function bundleHash(bundle: Bundle): string {
  const located = [
    ...(bundle.manifest === undefined ? [] : [bundle.manifest]),
    ...bundle.entities,
    ...bundle.maskedEntities,
    ...bundle.tactics,
    ...bundle.intents,
    ...bundle.rules,
    ...bundle.states,
  ];
  const stages = bundle.stages.flatMap((stage) => [stage.stage, stage.map, stage.events].filter((file) => file !== undefined));
  const documents = [...located, ...stages].map(({ path, doc }) => [path, doc] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return contentHash(documents);
}

export function documentHash(document: unknown): string {
  return contentHash(document);
}
