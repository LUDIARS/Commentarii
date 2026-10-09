// Contract of "document -> draft JSON" (guide import spec / guide intent import).

import type { Intent, Rule, StateMachine } from '../../domain/documents.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import type { DraftLlm } from './draft-llm.ts';

export type DraftKind = 'rules' | 'states' | 'intent';

export interface DraftRequest {
  readonly kind: DraftKind;
  /** Specification text (Markdown) the draft is made from. */
  readonly document: string;
  /** File name of the document, written to source.ref. */
  readonly sourceName: string;
  readonly gameId: string;
  /** Stage slug; required for intent. */
  readonly stageSlug?: string;
}

export type DraftDocument =
  | { readonly kind: 'rule'; readonly path: string; readonly doc: Rule }
  | { readonly kind: 'state'; readonly path: string; readonly doc: StateMachine }
  | { readonly kind: 'intent'; readonly path: string; readonly doc: Intent };

/** A drafted record (or intent item) left out, and why. */
export interface SkippedDraft {
  readonly id: string;
  readonly reason: string;
}

export interface DraftResult {
  readonly documents: readonly DraftDocument[];
  readonly skipped: readonly SkippedDraft[];
}

export interface DraftDeps {
  readonly llm: DraftLlm;
  /** Text of prompts/<name>.md. */
  readonly readPrompt: (name: string) => Promise<string>;
  readonly registry: SchemaRegistry;
}
