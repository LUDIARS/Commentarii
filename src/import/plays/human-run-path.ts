// Where human plays live in a bundle (design 14.D): observations/human/<player-hash>/<run>.jsonl
// and the candidates overlay observations/human/candidates.json. guide import plays writes
// nowhere else, so the canonical bundle (entities, tactics, intent) cannot be touched.

const RUN_ID = /^run:([a-z0-9][a-z0-9_-]*)$/;
const HASH = /^[0-9a-f]{16}$/;

export const HUMAN_DIRECTORY = 'observations/human';
export const AUTOPLAY_DIRECTORY = 'observations/runs';
export const CANDIDATES_PATH = `${HUMAN_DIRECTORY}/candidates.json`;

export function humanRunPath(playerHash: string, runId: string): string {
  const match = RUN_ID.exec(runId);
  if (!match || !HASH.test(playerHash)) throw new Error(`not a human run: ${playerHash} ${runId}`);
  return `${HUMAN_DIRECTORY}/${playerHash}/${match[1]}.jsonl`;
}

/** True for the only paths guide import plays may write. */
export function isHumanOverlayPath(path: string): boolean {
  if (path === CANDIDATES_PATH) return true;
  const parts = path.split('/');
  return parts.length === 4 && `${parts[0]}/${parts[1]}` === HUMAN_DIRECTORY && HASH.test(parts[2] ?? '') && /^[a-z0-9][a-z0-9_-]*\.jsonl$/.test(parts[3] ?? '');
}
