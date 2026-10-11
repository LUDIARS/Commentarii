// loadRulebook(exported, mode): the rulebook of a bundle.json as an engine reads it.
//   player      masked documents and values are dropped, masked overrides are never read; the
//               result has no trace of them (works on a player or a full export alike).
//   omniscient  needs a full export; masked overrides are applied (apply-overrides.ts).
// The overlay, when given, adds learned estimates (apply-overlay.ts). A format 1 bundle.json
// has no rulebook and reads as one with rules and state machines only. loadRulebook reads only
// the part of bundle.json it needs (RulebookSource), so loadBundleRulebook can hand it a loaded Bundle.

import { stripMasked } from '../bundle/player-view.ts';
import type { Rule, StateMachine } from '../domain/documents.ts';
import { CURRENT_EXPRESSION_LANGUAGE } from '../domain/expression/expression-language.ts';
import type { RulebookVariables } from '../domain/rulebook-documents.ts';
import type { ExportedDocument, ExportedMechanics, ExportKnowledge } from '../export/exported-bundle.ts';
import type { Overlay } from '../overlay/overlay.ts';
import { learnedEstimates } from './apply-overlay.ts';
import { applyActionOverrides } from './apply-overrides.ts';
import type { OmniscientRulebook, PlayerRulebook, Rulebook, RulebookMode } from './rulebook-view.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:1d2a9f64 */
import augurContract_7b73cdf2 from '../contracts/load-rulebook.contract.ts'; /* augur-inject:contract-predicate:99c53f3f */

export interface LoadRulebookOptions {
  readonly overlay?: Overlay;
}

/** The part of a bundle.json (format 1 or 2) loadRulebook reads. */
export interface RulebookSource {
  readonly game_id: string | null;
  readonly knowledge: ExportKnowledge;
  readonly documents: {
    readonly rules: readonly ExportedDocument<Rule>[];
    readonly states: readonly ExportedDocument<StateMachine>[];
    /** Absent in format 1. */
    readonly mechanics?: ExportedMechanics;
  };
}

const NO_MECHANICS: ExportedMechanics = { actions: [], masked_actions: [], processes: [], behaviors: [] };

function mechanicsOf(exported: RulebookSource): ExportedMechanics {
  return exported.documents.mechanics ?? NO_MECHANICS;
}

function docs<T>(items: readonly ExportedDocument<T>[]): T[] {
  return items.map(({ doc }) => doc);
}

/** Visible documents only, each deep-copied without masked parts. */
function playerDocs<T extends { readonly knowledge: string }>(items: readonly ExportedDocument<T>[]): T[] {
  return items.filter(({ doc }) => doc.knowledge !== 'masked').map(({ doc }) => stripMasked(doc));
}

function playerDoc<T extends { readonly knowledge: string }>(item: ExportedDocument<T> | undefined): T | undefined {
  return item === undefined || item.doc.knowledge === 'masked' ? undefined : stripMasked(item.doc);
}

function variablesOf(document: RulebookVariables | undefined): Pick<Rulebook, 'variables' | 'sets'> {
  return { variables: document?.variables ?? {}, sets: document?.sets ?? {} };
}

function loadPlayer(exported: RulebookSource, options: LoadRulebookOptions): PlayerRulebook {
  const mechanics = mechanicsOf(exported);
  const variables = playerDoc(mechanics.variables);
  const objectives = playerDoc(mechanics.objectives);
  const declared = variablesOf(variables);
  return {
    mode: 'player',
    game_id: exported.game_id,
    expression_language: CURRENT_EXPRESSION_LANGUAGE,
    ...declared,
    actions: playerDocs(mechanics.actions),
    processes: playerDocs(mechanics.processes),
    behaviors: playerDocs(mechanics.behaviors),
    ...(objectives ? { objectives } : {}),
    rules: playerDocs<Rule>(exported.documents.rules),
    states: playerDocs<StateMachine>(exported.documents.states),
    learned: learnedEstimates(declared.variables, options.overlay),
  } as PlayerRulebook;
}

function loadOmniscient(exported: RulebookSource, options: LoadRulebookOptions): OmniscientRulebook {
  if (exported.knowledge !== 'full') throw new Error('the omniscient rulebook needs a full export (guide export --knowledge full)');
  const mechanics = mechanicsOf(exported);
  const declared = variablesOf(mechanics.variables?.doc);
  return {
    mode: 'omniscient',
    game_id: exported.game_id,
    expression_language: CURRENT_EXPRESSION_LANGUAGE,
    ...declared,
    actions: applyActionOverrides(docs(mechanics.actions), mechanics.masked_actions),
    processes: docs(mechanics.processes),
    behaviors: docs(mechanics.behaviors),
    ...(mechanics.objectives ? { objectives: mechanics.objectives.doc } : {}),
    rules: docs(exported.documents.rules),
    states: docs(exported.documents.states),
    learned: learnedEstimates(declared.variables, options.overlay),
  };
}

export function loadRulebook(exported: RulebookSource, mode: 'player', options?: LoadRulebookOptions): PlayerRulebook;
export function loadRulebook(exported: RulebookSource, mode: 'omniscient', options?: LoadRulebookOptions): OmniscientRulebook;
export function loadRulebook(exported: RulebookSource, mode: RulebookMode, options?: LoadRulebookOptions): Rulebook;
export function loadRulebook(exported: RulebookSource, mode: RulebookMode, options: LoadRulebookOptions = {}): Rulebook {
  return mode === 'player' ? loadPlayer(exported, options) : loadOmniscient(exported, options);
}
// @ts-expect-error augur-inject
loadRulebook = contract(loadRulebook, { ...augurContract_7b73cdf2, contractId: 'C-102', mode: 'observe', sample: 1, where: 'packages/sdk/src/rulebook/load-rulebook.ts:87', rule: 'contract-wrap', id: '7b73cdf2' }); /* augur-inject:contract-wrap:7b73cdf2 */
