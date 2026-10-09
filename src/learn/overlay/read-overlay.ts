// Reads <bundle-dir>/observations/overlay.json: undefined when nothing was ingested yet (a
// bundle without an overlay is the normal starting point), the parsed overlay otherwise.

import { join } from 'node:path';
import type { LearnIo } from '../cli/learn-io.ts';
import { parseOverlay } from './parse-overlay.ts';
import { OVERLAY_PATH, type Overlay } from './overlay.ts';

export async function readOverlay(io: LearnIo, bundleDir: string, gameId: string): Promise<Overlay | undefined> {
  const text = await io.readText(join(bundleDir, ...OVERLAY_PATH.split('/')));
  return text === undefined ? undefined : parseOverlay(text, await io.schemaRegistry(), gameId);
}
