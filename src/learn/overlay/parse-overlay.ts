// observations/overlay.json text -> Overlay, checked against overlay.schema.json and against
// the bundle it belongs to (game_id). A broken overlay is an error, never silently replaced
// by an empty one (that would forget every ingested run).

import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import { LearnError } from '../learn-error.ts';
import { OVERLAY_PATH, type Overlay } from './overlay.ts';

export function parseOverlay(text: string, registry: SchemaRegistry, gameId: string): Overlay {
  let data: unknown;
  try {
    data = JSON.parse(text.startsWith('﻿') ? text.slice(1) : text);
  } catch (error) {
    throw new LearnError(`${OVERLAY_PATH}: invalid JSON: ${(error as Error).message}`);
  }
  const violations = registry.validate('overlay', data);
  if (violations.length > 0) {
    throw new LearnError(`${OVERLAY_PATH} does not match overlay.schema.json:\n  ${violations.map((v) => `${v.pointer || '/'}: ${v.message}`).join('\n  ')}`);
  }
  const overlay = data as Overlay;
  if (overlay.game_id !== gameId) throw new LearnError(`${OVERLAY_PATH} belongs to game ${overlay.game_id}, not ${gameId}`);
  return overlay;
}
