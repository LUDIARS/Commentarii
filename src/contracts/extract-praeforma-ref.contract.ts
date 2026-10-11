// C-73 extractPraeformaRef(markdown, explicitScene): an explicit scene ID always wins; every value
// returned is a well-formed Praeforma ID that appears in the document (or is the explicit scene);
// nothing is returned when the document states nothing and no scene is given.

import type { PraeformaRef } from '../praeforma/praeforma-ref.ts';

const ID = /^[^\s<>"']{1,120}$/;

export default {
  post: (ref: PraeformaRef | undefined, markdown: string, explicitScene?: string) => {
    if (explicitScene !== undefined && ref?.scene_id !== explicitScene) return 'the explicit scene ID did not win';
    if (ref === undefined) return true;
    for (const [key, value] of Object.entries(ref)) {
      if (typeof value !== 'string' || !ID.test(value)) return `${key} is not a Praeforma ID`;
      if (!(key === 'scene_id' && value === explicitScene) && !markdown.includes(value)) return `${key} ${value} is not in the document`;
    }
    return true;
  },
};
