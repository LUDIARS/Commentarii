// Draft kind "rules": {"rules": [{slug, name, expression, result_unit?, variables}]} ->
// mechanics/rules/<slug>.json. A rule with a number the document does not contain (variable
// range / example, or an expression literal) is dropped whole: without that number it cannot
// be evaluated, and keeping the model's estimate would break principle 3.

import type { Rule } from '../../domain/documents.ts';
import type { DraftKindSpec } from './draft-kind.ts';
import { describeViolations, draftSource, readReplyRecords } from './draft-records.ts';
import type { DraftDocument, SkippedDraft } from './draft-request.ts';
import { collectNumbers, expressionNumbers, undocumented } from './documented-numbers.ts';

export const ruleDrafts: DraftKindSpec = {
  prompt: 'import-spec-rules',
  build(reply, request, registry) {
    const { records, problems } = readReplyRecords(reply, 'rules');
    const documents: DraftDocument[] = [];
    for (const { slug, fields, pointer } of records) {
      const doc = { id: `rule:${request.gameId}:${slug}`, ...fields, knowledge: 'masked', source: draftSource(request), draft: true };
      const violations = registry.validate('rule', doc);
      if (violations.length > 0) problems.push(...describeViolations(pointer, violations));
      else documents.push({ kind: 'rule', path: `mechanics/rules/${slug}.json`, doc: doc as unknown as Rule });
    }
    return { documents, problems };
  },
  screen(documents, documented) {
    const kept: DraftDocument[] = [];
    const skipped: SkippedDraft[] = [];
    for (const document of documents) {
      if (document.kind !== 'rule') continue;
      const literals = expressionNumbers(document.doc.expression);
      if (literals === undefined) {
        skipped.push({ id: document.doc.id, reason: 'the expression cannot be read' });
        continue;
      }
      const missing = undocumented([...collectNumbers(document.doc), ...literals], documented);
      if (missing.length > 0) skipped.push({ id: document.doc.id, reason: `numbers not in the document: ${missing.join(', ')}` });
      else kept.push(document);
    }
    return { documents: kept, skipped };
  },
};
