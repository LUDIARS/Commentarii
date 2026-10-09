// Shape of bundle.json written by `guide export` (design 4.6): every document of the bundle in
// one file, plus lookup tables an engine needs at run time. Documents keep their bundle path
// so a reader can still tell where each came from.

import type {
  Entity,
  Glossary,
  GuideMap,
  Intent,
  Manifest,
  MaskedEntity,
  Rule,
  Stage,
  StageEvents,
  StateMachine,
  Tactic,
} from '../domain/documents.ts';

export const EXPORT_FORMAT = 'commentarii.bundle';
export const EXPORT_FORMAT_VERSION = 1;

export type ExportKnowledge = 'player' | 'full';
/** Targets of export. Only the engine runtime exists today (design 14.G adds ingame). */
export const EXPORT_TARGETS = ['runtime'] as const;
export type ExportTarget = (typeof EXPORT_TARGETS)[number];

export interface ExportedDocument<T> {
  readonly path: string;
  readonly doc: T;
}

export interface ExportedStage {
  readonly slug: string;
  readonly stage?: ExportedDocument<Stage>;
  readonly map?: ExportedDocument<GuideMap>;
  readonly events?: ExportedDocument<StageEvents>;
}

export interface ExportedDocuments {
  readonly manifest?: ExportedDocument<Manifest>;
  readonly glossary?: ExportedDocument<Glossary>;
  readonly entities: readonly ExportedDocument<Entity>[];
  /** Always empty in a player export. */
  readonly masked_entities: readonly ExportedDocument<MaskedEntity>[];
  readonly stages: readonly ExportedStage[];
  readonly rules: readonly ExportedDocument<Rule>[];
  readonly states: readonly ExportedDocument<StateMachine>[];
  readonly tactics: readonly ExportedDocument<Tactic>[];
  readonly intents: readonly ExportedDocument<Intent>[];
}

export type IndexedKind = 'entity' | 'stage' | 'rule' | 'state' | 'tactic' | 'intent';

export interface IndexEntry {
  readonly kind: IndexedKind;
  readonly path: string;
  /** JSON pointer of the record inside bundle.json. */
  readonly pointer: string;
}

export interface ExportIndex {
  /** entity / stage / rule / state / tactic / intent item ID -> where it is. */
  readonly ids: Readonly<Record<string, IndexEntry>>;
  /** render_signature mesh / sprite ID -> entity ID (design 7.1: draw -> entity). */
  readonly render_signatures: Readonly<Record<string, string>>;
  /** stage ID -> node ID -> neighbouring node IDs (sorted). */
  readonly adjacency: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

export interface ExportedBundle {
  readonly format: typeof EXPORT_FORMAT;
  readonly format_version: typeof EXPORT_FORMAT_VERSION;
  readonly game_id: string | null;
  readonly manifest_version: string | null;
  readonly knowledge: ExportKnowledge;
  readonly target: ExportTarget;
  readonly documents: ExportedDocuments;
  readonly index: ExportIndex;
}
