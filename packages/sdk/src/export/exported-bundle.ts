// Shape of bundle.json written by `guide export` (design 4.6): every document of the bundle in
// one file, plus lookup tables an engine needs at run time. Documents keep their bundle path
// so a reader can still tell where each came from. Format 2 (Ingenium R1) adds the rulebook
// (documents.mechanics, index.actions), the view and the expression language version.

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
import type { ExpressionLanguage } from '../domain/expression/expression-language.ts';
import type {
  ActionActor,
  ActionDefinition,
  BehaviorModel,
  MaskedActionOverride,
  Objectives,
  ProcessDefinition,
  RulebookVariables,
} from '../domain/rulebook-documents.ts';
import type { ActionVerb } from '../replay/replay-action.ts';

export const EXPORT_FORMAT = 'commentarii.bundle';
export const EXPORT_FORMAT_VERSION = 2;
/** Format versions this SDK reads (format 1 has no rulebook: it reads as an empty one). */
export const READABLE_EXPORT_FORMAT_VERSIONS = [1, 2] as const;

export type ExportKnowledge = 'player' | 'full';
/** Which view the documents are: player (masked stripped, no overrides) or full (overrides kept apart, not applied). */
export type ExportView = ExportKnowledge;
/** Targets of export. Only the engine runtime exists today (design 14.G adds ingame). */
export const EXPORT_TARGETS = ['runtime', 'ingame'] as const;
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

export interface ExportedMechanics {
  readonly variables?: ExportedDocument<RulebookVariables>;
  readonly actions: readonly ExportedDocument<ActionDefinition>[];
  /** Always empty in a player export (the same for every bundle, so it tells nothing). */
  readonly masked_actions: readonly ExportedDocument<MaskedActionOverride>[];
  readonly processes: readonly ExportedDocument<ProcessDefinition>[];
  readonly behaviors: readonly ExportedDocument<BehaviorModel>[];
  readonly objectives?: ExportedDocument<Objectives>;
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
  readonly mechanics: ExportedMechanics;
}

export type IndexedKind = 'entity' | 'stage' | 'rule' | 'state' | 'tactic' | 'intent' | 'action' | 'process' | 'behavior';

export interface IndexEntry {
  readonly kind: IndexedKind;
  readonly path: string;
  /** JSON pointer of the record inside bundle.json. */
  readonly pointer: string;
}

/** What an engine needs to list actions without reading each one: who may act, which verb. */
export interface ActionIndexEntry {
  readonly path: string;
  readonly pointer: string;
  readonly actor: readonly ActionActor[];
  /** The abstract adapter verb of maps_to, or null for an opponent-only action without one. */
  readonly maps_to: ActionVerb | null;
}

export interface ExportIndex {
  /** entity / stage / rule / state / tactic / intent item ID -> where it is. */
  readonly ids: Readonly<Record<string, IndexEntry>>;
  /** render_signature mesh / sprite ID -> entity ID (design 7.1: draw -> entity). */
  readonly render_signatures: Readonly<Record<string, string>>;
  /** stage ID -> node ID -> neighbouring node IDs (sorted). */
  readonly adjacency: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** action ID -> actor and verb (format 2). */
  readonly actions: Readonly<Record<string, ActionIndexEntry>>;
}

export interface ExportedBundle {
  readonly format: typeof EXPORT_FORMAT;
  readonly format_version: typeof EXPORT_FORMAT_VERSION;
  readonly game_id: string | null;
  readonly manifest_version: string | null;
  readonly knowledge: ExportKnowledge;
  readonly view: ExportView;
  readonly expression_language: ExpressionLanguage;
  readonly target: ExportTarget;
  readonly documents: ExportedDocuments;
  readonly index: ExportIndex;
}

/** bundle.json written by format 1 (SDK 0.1 / 0.2): no rulebook, no view, no expression version. */
export interface LegacyExportedBundle {
  readonly format: typeof EXPORT_FORMAT;
  readonly format_version: 1;
  readonly game_id: string | null;
  readonly manifest_version: string | null;
  readonly knowledge: ExportKnowledge;
  readonly target: ExportTarget;
  readonly documents: Omit<ExportedDocuments, 'mechanics'>;
  readonly index: Omit<ExportIndex, 'actions'>;
}

/** Any bundle.json this SDK reads. */
export type ReadableExportedBundle = ExportedBundle | LegacyExportedBundle;
