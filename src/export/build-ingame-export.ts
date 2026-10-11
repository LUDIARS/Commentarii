// `guide export --target ingame` (design 14.G, stage 7G): the light JSON a game ships for its
// in-game encyclopedia, hints and tutorial, from the same source as the public guide. Built on
// the player view (no masked value can be in it), and narrower still: a shown value is always
// in; a discoverable one only when the player has unlocked it (the game passes the refs it has
// unlocked, e.g. "enemy:g:x.stats.hp"). Tactics appear as hints under the same rule, and an
// intent's teach item becomes a tutorial line only when the item itself is shown (or unlocked).

import type { Bundle, LoadResult } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import type { GuideValue, LocalizedText } from '../domain/documents.ts';
import { isJsonObject } from '../domain/value-node.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:2a3d880c */
import augurContract_96eb191f from '../contracts/build-ingame-export.contract.ts'; /* augur-inject:contract-predicate:d45744e6 */

export const INGAME_FORMAT = 'commentarii-ingame';
export const INGAME_FORMAT_VERSION = 1;
export const INGAME_FILE_NAME = 'ingame.json';

export interface IngameValue {
  readonly value: unknown;
  readonly unit?: string;
}

export interface IngameEntry {
  readonly id: string;
  readonly name: LocalizedText;
  readonly stats: Readonly<Record<string, IngameValue>>;
}

export interface IngameHint {
  readonly tactic: string;
  readonly name: LocalizedText;
}

export interface IngameTutorial {
  readonly stage: string;
  readonly intent: string;
  readonly tactic: string;
  readonly tactic_name?: LocalizedText;
  readonly note?: string;
}

export interface IngameExport {
  readonly format: typeof INGAME_FORMAT;
  readonly format_version: typeof INGAME_FORMAT_VERSION;
  readonly game_id: string | null;
  readonly manifest_version: string | null;
  readonly encyclopedia: readonly IngameEntry[];
  readonly hints: readonly IngameHint[];
  readonly tutorial: readonly IngameTutorial[];
  readonly glossary: readonly { readonly text: string; readonly lang: string; readonly ref: string }[];
}

function visible(knowledge: unknown, ref: string, unlocked: ReadonlySet<string>): boolean {
  return knowledge === 'shown' || (knowledge === 'discoverable' && unlocked.has(ref));
}

function statsOf(id: string, stats: Readonly<Record<string, GuideValue<unknown>>> | undefined, unlocked: ReadonlySet<string>): Record<string, IngameValue> {
  const shown: Record<string, IngameValue> = {};
  for (const [key, node] of Object.entries(stats ?? {})) {
    if (!isJsonObject(node) || !visible(node.knowledge, `${id}.stats.${key}`, unlocked) || node.draft === true) continue;
    shown[key] = { value: node.value, ...(typeof node.unit === 'string' ? { unit: node.unit } : {}) };
  }
  return shown;
}

function encyclopedia(view: Bundle, unlocked: ReadonlySet<string>): IngameEntry[] {
  return view.entities
    .map(({ doc }) => ({ id: doc.id, name: doc.name, stats: statsOf(doc.id, doc.stats as Readonly<Record<string, GuideValue<unknown>>> | undefined, unlocked) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function hints(view: Bundle, unlocked: ReadonlySet<string>): IngameHint[] {
  return view.tactics
    .filter(({ doc }) => doc.superseded_by === null && doc.draft !== true && visible(doc.knowledge, doc.id, unlocked))
    .map(({ doc }) => ({ tactic: doc.id, name: doc.name }))
    .sort((a, b) => (a.tactic < b.tactic ? -1 : 1));
}

function tutorial(view: Bundle, unlocked: ReadonlySet<string>): IngameTutorial[] {
  const names = new Map(view.tactics.map(({ doc }) => [doc.id, doc.name]));
  return view.intents.flatMap(({ doc }) =>
    doc.draft === true
      ? []
      : doc.intended.flatMap((item) => {
          if (item.kind !== 'teach' || !visible(item.knowledge, item.id, unlocked)) return [];
          const name = names.get(item.tactic);
          return [{ stage: doc.stage, intent: item.id, tactic: item.tactic, ...(name === undefined ? {} : { tactic_name: name }), ...(item.note === undefined ? {} : { note: item.note }) }];
        }),
  );
}

export function buildIngameExport(load: LoadResult, unlocked: ReadonlySet<string>): IngameExport {
  const view = toPlayerView(load.bundle);
  const manifest = view.manifest?.doc;
  return {
    format: INGAME_FORMAT,
    format_version: INGAME_FORMAT_VERSION,
    game_id: manifest?.game_id ?? null,
    manifest_version: manifest?.version ?? null,
    encyclopedia: encyclopedia(view, unlocked),
    hints: hints(view, unlocked),
    tutorial: tutorial(view, unlocked),
    glossary: view.glossary?.doc.terms ?? [],
  };
}
// @ts-expect-error augur-inject
buildIngameExport = contract(buildIngameExport, { ...augurContract_96eb191f, contractId: 'C-77', mode: 'observe', sample: 1, where: 'src/export/build-ingame-export.ts:91', rule: 'contract-wrap', id: '96eb191f' }); /* augur-inject:contract-wrap:96eb191f */
