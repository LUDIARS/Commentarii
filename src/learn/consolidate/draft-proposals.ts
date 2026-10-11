// Draft entity proposals (design 7.1, 7.5): each unknown entity of the overlay as a new
// entities/<group>/<slug>.json, never applied automatically (a person names it and decides its
// values). Unknowns the bundle meanwhile describes, or whose file exists, are skipped.

import type { Bundle } from '../../bundle/bundle.ts';
import type { Overlay } from '../overlay/overlay.ts';
import type { ProposalDraft } from './proposal.ts';

export function draftProposals(bundle: Bundle, overlay: Overlay): ProposalDraft[] {
  const ids = new Set(bundle.entities.map(({ doc }) => doc.id));
  const paths = new Set(bundle.entities.map(({ path }) => path));
  return overlay.unknown_entities
    .filter(({ draft }) => !ids.has(String(draft.doc.id)) && !paths.has(draft.path))
    .map(({ key, draft, runs }) => ({
      id: `entity-draft:${key}`,
      kind: 'entity-draft',
      status: 'pending',
      reason: `drafted from observation (${draft.source.ref}); a person completes and approves it`,
      files: [{ path: draft.path, create: true, patch: [{ op: 'add', path: '', value: draft.doc }] }],
      evidence: runs,
    }));
}
