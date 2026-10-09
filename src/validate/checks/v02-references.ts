// V02: referential integrity. IDs are unique, match where their file sits, and every ID that
// an entity / stage / map / event / rule / state / tactic / glossary points at exists.
// Intent item references (tactic / area / path) are V12.

import type { BundleIndex } from '../../bundle/bundle-index.ts';
import type { Bundle } from '../../bundle/bundle.ts';
import { unresolvedReason } from '../../bundle/resolve-ref.ts';
import type { Spawn } from '../../domain/documents.ts';
import { ENTITY_GROUP_OF_KIND, isEntityKind, parseRef } from '../../domain/id.ts';
import { collectTacticRefs } from '../../domain/tactic-refs.ts';
import { error, type Check, type Finding } from '../check.ts';

function fileSlug(path: string): string {
  const name = path.split('/').pop() ?? '';
  return name.replace(/\.masked\.json$|\.json$/, '');
}

class ReferenceCollector {
  readonly findings: Finding[] = [];

  constructor(private readonly index: BundleIndex) {}

  ref(path: string, pointer: string, ref: string): void {
    const reason = unresolvedReason(this.index, ref);
    if (reason !== undefined) this.findings.push(error(path, pointer, reason));
  }

  node(path: string, pointer: string, stageId: string, node: string): void {
    const nodes = this.index.stageNodes.get(stageId);
    if (nodes === undefined) this.findings.push(error(path, pointer, `${node} is referenced but ${stageId} has no map`));
    else if (!nodes.has(node)) this.findings.push(error(path, pointer, `map node ${node} does not exist in ${stageId}`));
  }

  /** The record ID is well placed: game segment, kind directory and slug agree with the path. */
  placement(path: string, id: string, expectedKind: string, expectedSlug: string): void {
    const parsed = parseRef(id);
    if (parsed === undefined) return;
    if (this.index.gameId !== undefined && parsed.game !== this.index.gameId) {
      this.findings.push(error(path, '/id', `${id} belongs to game '${parsed.game}', manifest says '${this.index.gameId}'`));
    }
    if (parsed.kind !== expectedKind) this.findings.push(error(path, '/id', `${id} is not a ${expectedKind} ID`));
    if (parsed.slug !== expectedSlug) this.findings.push(error(path, '/id', `${id} does not match file slug '${expectedSlug}'`));
  }

  spawns(path: string, pointer: string, stageId: string, spawns: readonly Spawn[] | undefined): void {
    (spawns ?? []).forEach((spawn, position) => {
      this.ref(path, `${pointer}/${position}/entity`, spawn.entity);
      if (spawn.at !== undefined) this.node(path, `${pointer}/${position}/at`, stageId, spawn.at);
    });
  }
}

function checkDuplicates(bundle: Bundle): Finding[] {
  const seen = new Map<string, string>();
  const findings: Finding[] = [];
  const claim = (id: string, path: string): void => {
    const first = seen.get(id);
    if (first === undefined) seen.set(id, path);
    else findings.push(error(path, '', `${id} is already defined in ${first}`));
  };
  for (const { path, doc } of bundle.entities) claim(doc.id, path);
  for (const stage of bundle.stages) if (stage.stage) claim(stage.stage.doc.id, stage.stage.path);
  for (const { path, doc } of [...bundle.rules, ...bundle.states, ...bundle.tactics]) claim(doc.id, path);
  for (const { path, doc } of bundle.intents) for (const item of doc.intended) claim(item.id, path);
  return findings;
}

function checkEntities(bundle: Bundle, refs: ReferenceCollector): void {
  for (const { path, doc } of bundle.entities) {
    const group = path.split('/')[1] ?? '';
    const parsed = parseRef(doc.id);
    if (parsed && isEntityKind(parsed.kind) && ENTITY_GROUP_OF_KIND[parsed.kind] !== group) {
      refs.findings.push(error(path, '/id', `${doc.id} must live under entities/${ENTITY_GROUP_OF_KIND[parsed.kind]}/`));
    }
    if (parsed) refs.placement(path, doc.id, parsed.kind, fileSlug(path));
    if (doc.behavior !== undefined) refs.ref(path, '/behavior', doc.behavior);
    doc.weak_to?.forEach((value, position) => refs.ref(path, `/weak_to/${position}/value`, value.value));
    doc.drops?.forEach((value, position) => refs.ref(path, `/drops/${position}/value`, value.value));
    doc.rules?.forEach((rule, position) => refs.ref(path, `/rules/${position}`, rule));
    doc.skills?.forEach((skill, position) => refs.ref(path, `/skills/${position}`, skill));
  }
  for (const { path, doc } of bundle.maskedEntities) {
    const publicPath = path.replace(/\.masked\.json$/, '.json');
    const owner = bundle.entities.find((entity) => entity.path === publicPath);
    if (owner === undefined) refs.findings.push(error(path, '', `masked companion has no entity file ${publicPath}`));
    else if (owner.doc.id !== doc.id) refs.findings.push(error(path, '/id', `${doc.id} differs from ${owner.doc.id} in ${publicPath}`));
  }
}

function checkStages(bundle: Bundle, refs: ReferenceCollector): void {
  for (const stage of bundle.stages) {
    const stageId = stage.stage?.doc.id;
    if (stage.stage) refs.placement(stage.stage.path, stage.stage.doc.id, 'stage', stage.slug);
    for (const companion of [stage.map, stage.events]) {
      if (companion === undefined) continue;
      if (stageId === undefined) refs.findings.push(error(companion.path, '/stage', `stages/${stage.slug}/stage.json is missing`));
      else if (companion.doc.stage !== stageId) refs.findings.push(error(companion.path, '/stage', `${companion.doc.stage} is not ${stageId}`));
    }
    if (stage.stage) refs.spawns(stage.stage.path, '/spawns', stage.stage.doc.id, stage.stage.doc.spawns);
    if (stage.map) {
      const { path, doc } = stage.map;
      doc.edges.forEach((edge, position) => {
        refs.node(path, `/edges/${position}/from`, doc.stage, edge.from);
        refs.node(path, `/edges/${position}/to`, doc.stage, edge.to);
      });
      doc.annotations.forEach((annotation, position) => {
        refs.node(path, `/annotations/${position}/target`, doc.stage, annotation.target);
        if (annotation.ref !== undefined) refs.ref(path, `/annotations/${position}/ref`, annotation.ref);
      });
    }
    if (stage.events) {
      const { path, doc } = stage.events;
      doc.events.forEach((event, position) => refs.spawns(path, `/events/${position}/spawns`, doc.stage, event.spawns));
    }
  }
}

function checkMechanics(bundle: Bundle, refs: ReferenceCollector): void {
  for (const { path, doc } of bundle.rules) {
    refs.placement(path, doc.id, 'rule', fileSlug(path));
    for (const [name, variable] of Object.entries(doc.variables)) {
      if (variable.ref !== undefined) refs.ref(path, `/variables/${name}/ref`, variable.ref);
    }
  }
  for (const { path, doc } of bundle.states) {
    refs.placement(path, doc.id, 'state', fileSlug(path));
    const names = new Set(doc.states.map((state) => state.id));
    if (!names.has(doc.initial)) refs.findings.push(error(path, '/initial', `initial state '${doc.initial}' does not exist`));
    doc.transitions.forEach((transition, position) => {
      for (const end of ['from', 'to'] as const) {
        if (!names.has(transition[end])) refs.findings.push(error(path, `/transitions/${position}/${end}`, `state '${transition[end]}' does not exist`));
      }
      if (transition.rule !== undefined) refs.ref(path, `/transitions/${position}/rule`, transition.rule);
    });
  }
}

function checkTactics(bundle: Bundle, refs: ReferenceCollector): void {
  for (const { path, doc } of bundle.tactics) {
    refs.placement(path, doc.id, 'tactic', fileSlug(path));
    for (const ref of collectTacticRefs(doc)) refs.ref(path, '', ref);
    if (doc.superseded_by !== null) refs.ref(path, '/superseded_by', doc.superseded_by);
  }
}

function checkGlossaryAndIntents(bundle: Bundle, refs: ReferenceCollector): void {
  if (bundle.glossary) {
    const { path, doc } = bundle.glossary;
    doc.terms.forEach((term, position) => {
      if (!term.ref.startsWith('lexicon:')) refs.ref(path, `/terms/${position}/ref`, term.ref);
    });
    doc.ui?.forEach((entry, position) => refs.ref(path, `/ui/${position}/shows`, entry.shows));
  }
  for (const { path, doc } of bundle.intents) {
    refs.ref(path, '/stage', doc.stage);
    const stageSlug = parseRef(doc.stage)?.slug;
    if (stageSlug !== undefined && stageSlug !== fileSlug(path)) {
      refs.findings.push(error(path, '/stage', `intent file must be named intent/${stageSlug}.json`));
    }
  }
}

export const v02References: Check = {
  id: 'V02',
  title: '参照整合',
  run: ({ load, index }) => {
    const refs = new ReferenceCollector(index);
    checkEntities(load.bundle, refs);
    checkStages(load.bundle, refs);
    checkMechanics(load.bundle, refs);
    checkTactics(load.bundle, refs);
    checkGlossaryAndIntents(load.bundle, refs);
    return [...checkDuplicates(load.bundle), ...refs.findings];
  },
};
