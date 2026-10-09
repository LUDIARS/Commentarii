// C-4 loadBundleFromTexts(texts, registry): invalid files always carry an issue, valid ones never.

import type { LoadResult } from '../bundle/bundle.ts';
import type { BundleText } from '../bundle/load-bundle.ts';

export default {
  post: (result: LoadResult, texts: readonly BundleText[]) => {
    const issuePaths = new Set(result.issues.map((issue) => issue.path));
    for (const file of result.files) {
      if (!file.schemaValid && !issuePaths.has(file.path)) return `${file.path} is invalid without an issue`;
      if (file.schemaValid && issuePaths.has(file.path)) return `${file.path} is valid but has an issue`;
    }
    const hasManifest = texts.some((text) => text.path === 'manifest.json');
    return hasManifest || issuePaths.has('manifest.json') || 'missing manifest.json is not reported';
  },
};
