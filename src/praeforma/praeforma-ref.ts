// Links to Praeforma (Pf), the specification's source of truth (design 9, 14.K,
// spec/feature/praeforma-link.md): which Praeforma scene / specification an intended item or a
// stage belongs to. Praeforma IDs are opaque strings; Commentarii keeps them as they are and
// never resolves them (Praeforma shows the reports on its own scene screens).

import { contract } from '#contract-runtime'; /* augur-inject:import:50d2dcfb */
import augurContract_18304f8b from '../contracts/extract-praeforma-ref.contract.ts'; /* augur-inject:contract-predicate:c0250324 */

export interface PraeformaRef {
  readonly scene_id?: string;
  readonly spec_id?: string;
  readonly project_code?: string;
}

const ID = /^[^\s<>"']{1,120}$/;

/** A front matter line (`scene_id: x`) or an HTML comment marker (`<!-- praeforma:scene=x -->`). */
const FRONT_MATTER_KEYS: Readonly<Record<string, keyof PraeformaRef>> = { scene_id: 'scene_id', spec_id: 'spec_id', project_code: 'project_code' };
const MARKER_KEYS: Readonly<Record<string, keyof PraeformaRef>> = { scene: 'scene_id', spec: 'spec_id', project: 'project_code' };

function frontMatter(markdown: string): Map<keyof PraeformaRef, string> {
  const found = new Map<keyof PraeformaRef, string>();
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(markdown);
  if (match === null) return found;
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const pair = /^([a-z_]+)\s*:\s*["']?([^"'\s]+)["']?\s*$/.exec(line);
    const key = pair === null ? undefined : FRONT_MATTER_KEYS[pair[1] ?? ''];
    if (pair !== null && key !== undefined && ID.test(pair[2] ?? '')) found.set(key, pair[2] as string);
  }
  return found;
}

function markers(markdown: string): Map<keyof PraeformaRef, string> {
  const found = new Map<keyof PraeformaRef, string>();
  for (const match of markdown.matchAll(/<!--\s*praeforma:(scene|spec|project)=([^\s>]+)\s*-->/g)) {
    const key = MARKER_KEYS[match[1] ?? ''];
    if (key !== undefined && !found.has(key) && ID.test(match[2] ?? '')) found.set(key, match[2] as string);
  }
  return found;
}

/**
 * The Praeforma references a UX document states: front matter first, then the first marker of
 * each kind; an explicit scene ID (guide intent import --praeforma) overrides the document's.
 * Undefined when nothing is stated.
 */
export function extractPraeformaRef(markdown: string, explicitScene?: string): PraeformaRef | undefined {
  const values = new Map([...markers(markdown), ...frontMatter(markdown)]);
  if (explicitScene !== undefined) {
    if (!ID.test(explicitScene)) throw new Error(`--praeforma ${explicitScene} is not a Praeforma ID (1-120 characters, no spaces or quotes)`);
    values.set('scene_id', explicitScene);
  }
  if (values.size === 0) return undefined;
  const ref: Record<string, string> = {};
  for (const key of ['scene_id', 'spec_id', 'project_code'] as const) {
    const value = values.get(key);
    if (value !== undefined) ref[key] = value;
  }
  return ref;
}
// @ts-expect-error augur-inject
extractPraeformaRef = contract(extractPraeformaRef, { ...augurContract_18304f8b, contractId: 'C-73', mode: 'observe', sample: 1, where: 'src/praeforma/praeforma-ref.ts:44', rule: 'contract-wrap', id: '18304f8b' }); /* augur-inject:contract-wrap:18304f8b */
