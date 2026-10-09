// Draft kind "states": {"states": [{slug, name, initial, states, transitions}]} ->
// mechanics/states/<slug>.json. The state schema has no numeric field, so screening only
// guards against a schema change letting numbers in.

import type { StateMachine } from '../../domain/documents.ts';
import type { DraftKindSpec } from './draft-kind.ts';
import { describeViolations, draftSource, readReplyRecords } from './draft-records.ts';
import type { DraftDocument, SkippedDraft } from './draft-request.ts';
import { collectNumbers, undocumented } from './documented-numbers.ts';

export const stateDrafts: DraftKindSpec = {
  prompt: 'import-spec-states',
  build(reply, request, registry) {
    const { records, problems } = readReplyRecords(reply, 'states');
    const documents: DraftDocument[] = [];
    for (const { slug, fields, pointer } of records) {
      const doc = { id: `state:${request.gameId}:${slug}`, ...fields, knowledge: 'masked', source: draftSource(request), draft: true };
      const violations = registry.validate('state', doc);
      if (violations.length > 0) problems.push(...describeViolations(pointer, violations));
      else documents.push({ kind: 'state', path: `mechanics/states/${slug}.json`, doc: doc as unknown as StateMachine });
    }
    return { documents, problems };
  },
  screen(documents, documented) {
    const kept: DraftDocument[] = [];
    const skipped: SkippedDraft[] = [];
    for (const document of documents) {
      if (document.kind !== 'state') continue;
      const missing = undocumented(collectNumbers(document.doc), documented);
      if (missing.length > 0) skipped.push({ id: document.doc.id, reason: `numbers not in the document: ${missing.join(', ')}` });
      else kept.push(document);
    }
    return { documents: kept, skipped };
  },
};
