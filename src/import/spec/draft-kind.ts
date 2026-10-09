// What differs between rules, state machines and intents when drafting: the prompt, how the
// model's JSON becomes bundle documents, and how undocumented numbers are screened out.

import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import type { DocumentedNumbers } from './documented-numbers.ts';
import type { DraftDocument, DraftRequest, DraftResult } from './draft-request.ts';

export interface DraftBuild {
  readonly documents: readonly DraftDocument[];
  /** Why the reply cannot be used; non-empty triggers the retry. */
  readonly problems: readonly string[];
}

export interface DraftKindSpec {
  /** prompts/<name>.md */
  readonly prompt: string;
  /** Reply JSON -> documents with the fixed fields (ID, knowledge, source, draft) set and the schema checked. */
  build(reply: unknown, request: DraftRequest, registry: SchemaRegistry): DraftBuild;
  /** Drops what carries a number the document does not contain. */
  screen(documents: readonly DraftDocument[], documented: DocumentedNumbers): DraftResult;
}
