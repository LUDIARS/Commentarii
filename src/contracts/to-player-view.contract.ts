// C-3 toPlayerView(bundle): no masked knowledge anywhere in the result.

import type { Bundle } from '../bundle/bundle.ts';

function containsMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.knowledge === 'masked') return true;
  return Object.values(record).some(containsMasked);
}

export default {
  post: (view: Bundle) => {
    if (view.maskedEntities.length > 0) return 'player view keeps masked companion files';
    return !containsMasked(view) || 'player view contains a masked value';
  },
};
