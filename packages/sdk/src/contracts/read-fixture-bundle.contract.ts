// C-91 readFixtureBundle(knowledge): the returned export is format commentarii.bundle at the
// current format_version with the requested knowledge, and a player export holds no
// knowledge: masked anywhere and no masked companion files.

import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION, type ExportedBundle, type ExportKnowledge } from '../export/exported-bundle.ts';

function containsMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.knowledge === 'masked') return true;
  return Object.values(record).some(containsMasked);
}

export default {
  post: (bundle: ExportedBundle, knowledge: ExportKnowledge) => {
    if (bundle.format !== EXPORT_FORMAT || bundle.format_version !== EXPORT_FORMAT_VERSION) return 'not the current bundle format';
    if (bundle.knowledge !== knowledge) return `asked for ${knowledge}, got ${bundle.knowledge}`;
    if (knowledge !== 'player') return true;
    if (bundle.documents.masked_entities.length > 0) return 'player fixture keeps masked companion files';
    return !containsMasked(bundle) || 'player fixture contains a masked value';
  },
};
