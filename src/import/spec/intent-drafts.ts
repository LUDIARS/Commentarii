// Draft kind "intent": {"intended": [{slug, kind, ...}]} -> intent/<stage-slug>.json. Every
// item is masked; accepted divergences are a human decision and start empty. An item with a
// number the document does not contain (time range_sec) is dropped; the intent is left out
// when no item survives.

import type { IntendedItem, Intent } from '../../domain/documents.ts';
import { ImportError } from '../import-error.ts';
import type { DraftKindSpec } from './draft-kind.ts';
import { describeViolations, draftSource, readReplyRecords } from './draft-records.ts';
import type { DraftDocument, SkippedDraft } from './draft-request.ts';
import { collectNumbers, undocumented } from './documented-numbers.ts';

export const intentDrafts: DraftKindSpec = {
  prompt: 'intent-import',
  build(reply, request, registry) {
    if (request.stageSlug === undefined) throw new ImportError('intent import needs a stage');
    const { records, problems } = readReplyRecords(reply, 'intended');
    const intended = records.map(({ slug, fields }) => ({ id: `intent:${request.gameId}:${request.stageSlug}:${slug}`, ...fields, knowledge: 'masked' }));
    const doc = {
      stage: `stage:${request.gameId}:${request.stageSlug}`,
      intended,
      allowed_divergences: [],
      source: draftSource(request),
      draft: true,
    };
    if (problems.length > 0) return { documents: [], problems };
    const violations = registry.validate('intent', doc);
    if (violations.length > 0) return { documents: [], problems: describeViolations('', violations) };
    return { documents: [{ kind: 'intent', path: `intent/${request.stageSlug}.json`, doc: doc as unknown as Intent }], problems: [] };
  },
  screen(documents, documented) {
    const kept: DraftDocument[] = [];
    const skipped: SkippedDraft[] = [];
    for (const document of documents) {
      if (document.kind !== 'intent') continue;
      const items: IntendedItem[] = [];
      for (const item of document.doc.intended) {
        const missing = undocumented(collectNumbers(item), documented);
        if (missing.length > 0) skipped.push({ id: item.id, reason: `numbers not in the document: ${missing.join(', ')}` });
        else items.push(item);
      }
      if (items.length > 0) kept.push({ ...document, doc: { ...document.doc, intended: items } });
    }
    return { documents: kept, skipped };
  },
};
