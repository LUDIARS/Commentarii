// What reflect knows from the guide: which entity IDs it describes (an entity outside that set
// is reported as unknown). Player mode reads the bundle only through toPlayerView, like the
// engine world (principle 2).

import type { Bundle } from '../../bundle/bundle.ts';
import { toPlayerView } from '../../bundle/player-view.ts';
import type { ObservationMode } from '../../replay/observation-frame.ts';

export interface ReflectWorld {
  readonly mode: ObservationMode;
  readonly knownEntities: ReadonlySet<string>;
}

export function buildReflectWorld(bundle: Bundle, mode: ObservationMode): ReflectWorld {
  const source = mode === 'player' ? toPlayerView(bundle) : bundle;
  return { mode, knownEntities: new Set(source.entities.map(({ doc }) => doc.id)) };
}
