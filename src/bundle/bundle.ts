// In-memory guide bundle produced by the loader.

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
import type { FileKind } from './classify-path.ts';

/** A schema-valid document and the bundle-relative path it came from. */
export interface Located<T> {
  readonly path: string;
  readonly doc: T;
}

export interface StageFiles {
  readonly slug: string;
  readonly stage?: Located<Stage>;
  readonly map?: Located<GuideMap>;
  readonly events?: Located<StageEvents>;
}

/** Only documents that passed their schema. Invalid files stay visible through LoadedFile. */
export interface Bundle {
  readonly manifest?: Located<Manifest>;
  readonly glossary?: Located<Glossary>;
  readonly entities: readonly Located<Entity>[];
  readonly maskedEntities: readonly Located<MaskedEntity>[];
  readonly stages: readonly StageFiles[];
  readonly rules: readonly Located<Rule>[];
  readonly states: readonly Located<StateMachine>[];
  readonly tactics: readonly Located<Tactic>[];
  readonly intents: readonly Located<Intent>[];
}

/** Every parseable JSON file of the bundle, valid or not, for checks that walk raw JSON. */
export interface LoadedFile {
  readonly path: string;
  readonly kind: FileKind;
  readonly data: unknown;
  readonly schemaValid: boolean;
}

/** A schema violation, unreadable file or misplaced file (reported by validate V01). */
export interface LoadIssue {
  readonly path: string;
  readonly pointer: string;
  readonly message: string;
}

export interface LoadResult {
  readonly bundle: Bundle;
  readonly files: readonly LoadedFile[];
  readonly issues: readonly LoadIssue[];
}

export function isMaskedFilePath(path: string): boolean {
  return path.endsWith('.masked.json');
}
