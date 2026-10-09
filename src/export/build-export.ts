// `guide export`: the loaded bundle -> bundle.json. The player export goes through
// toPlayerView, the same masked-free view render uses (principle 1), so a masked value cannot
// reach it even when a bundle wrongly keeps one outside its .masked.json.

import type { Bundle, LoadResult } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import { buildExportIndex } from './build-export-index.ts';
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportedBundle,
  type ExportedDocuments,
  type ExportKnowledge,
  type ExportTarget,
} from './exported-bundle.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:13e5fa55 */
import augurContract_b48a0c8a from '../contracts/build-export.contract.ts'; /* augur-inject:contract-predicate:fd294bc1 */

export interface ExportOptions {
  readonly knowledge: ExportKnowledge;
  readonly target: ExportTarget;
}

export const EXPORT_FILE_NAME = 'bundle.json';

function documentsOf(bundle: Bundle): ExportedDocuments {
  return {
    ...(bundle.manifest ? { manifest: bundle.manifest } : {}),
    ...(bundle.glossary ? { glossary: bundle.glossary } : {}),
    entities: bundle.entities,
    masked_entities: bundle.maskedEntities,
    stages: bundle.stages,
    rules: bundle.rules,
    states: bundle.states,
    tactics: bundle.tactics,
    intents: bundle.intents,
  };
}

export function buildExport(load: LoadResult, options: ExportOptions): ExportedBundle {
  const bundle = options.knowledge === 'player' ? toPlayerView(load.bundle) : load.bundle;
  const documents = documentsOf(bundle);
  return {
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    game_id: bundle.manifest?.doc.game_id ?? null,
    manifest_version: bundle.manifest?.doc.version ?? null,
    knowledge: options.knowledge,
    target: options.target,
    documents,
    index: buildExportIndex(documents),
  };
}
// @ts-expect-error augur-inject
buildExport = contract(buildExport, { ...augurContract_b48a0c8a, contractId: 'C-17', mode: 'observe', sample: 1, where: 'src/export/build-export.ts:38', rule: 'contract-wrap', id: 'b48a0c8a' }); /* augur-inject:contract-wrap:b48a0c8a */

/** The files `guide export` writes (output-relative path -> text). */
export function exportFiles(exported: ExportedBundle): Map<string, string> {
  return new Map([[EXPORT_FILE_NAME, `${JSON.stringify(exported, null, 2)}\n`]]);
}
