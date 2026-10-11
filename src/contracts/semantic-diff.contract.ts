// C-78 semanticDiff(before, after): both sides have the same knowledge, and a player (public) diff
// carries no masked record and no value labelled masked on either side of a change.

import type { ExportedBundle } from '../export/exported-bundle.ts';
import type { SemanticDiff } from '../diff/semantic-diff.ts';

export default {
  post: (result: SemanticDiff, before: ExportedBundle, after: ExportedBundle) => {
    if (before.knowledge !== after.knowledge || result.knowledge !== after.knowledge) return 'knowledge differs between the two sides';
    if (result.knowledge !== 'player') return true;
    for (const change of result.changes) {
      if (change.record === 'masked-entity') return `${change.id}: masked record in a player diff`;
      if (change.kind !== 'changed') continue;
      for (const field of change.fields) {
        if (field.kind === 'boundary' && (field.before === 'masked' || field.after === 'masked')) return `${change.id}${field.pointer}: masked label in a player diff`;
      }
    }
    return true;
  },
};
