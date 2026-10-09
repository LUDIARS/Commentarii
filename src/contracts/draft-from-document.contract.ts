// C-14 draftFromDocument(request, deps): every output is draft, llm-draft and masked, and
// carries only numbers written in the request document.

import { collectNumbers, documentedNumbers, expressionNumbers } from '../import/spec/documented-numbers.ts';
import type { DraftRequest, DraftResult } from '../import/spec/draft-request.ts';

export default {
  post: (result: DraftResult, request: DraftRequest) => {
    const documented = documentedNumbers(request.document);
    for (const { path, kind, doc } of result.documents) {
      if (doc.draft !== true) return `${path} is not draft`;
      if (doc.source?.kind !== 'llm-draft') return `${path} source is not llm-draft`;
      const levels = kind === 'intent' ? doc.intended.map((item) => item.knowledge) : [doc.knowledge];
      if (levels.some((level) => level !== 'masked')) return `${path} is not masked`;
      const numbers = [...collectNumbers(doc), ...(kind === 'rule' ? (expressionNumbers(doc.expression) ?? [Number.NaN]) : [])];
      const stray = numbers.find((number) => !documented.has(number));
      if (stray !== undefined) return `${path} carries ${stray}, which the document does not contain`;
    }
    return true;
  },
};
