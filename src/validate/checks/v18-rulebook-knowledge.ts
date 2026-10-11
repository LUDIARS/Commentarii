// V18: knowledge propagates into the rulebook (design 4.4, Fable §4): an action, process,
// behavior, state machine, set, objective or progress measure is at least as strict as the
// strictest variable, set, rule, state machine or action it refers to. A shown action that reads
// a discoverable variable must be discoverable; nothing visible may refer to a masked thing.
// Variable declarations are exempt (each declares the boundary of its own value), and masked
// overrides are masked already.

import type { BundleIndex } from '@ludiars/commentarii-sdk/bundle';
import { referencedKnowledge } from '@ludiars/commentarii-sdk/bundle';
import { expressionReferences } from '@ludiars/commentarii-sdk/expression';
import { rulebookExpressions } from '@ludiars/commentarii-sdk/rulebook';
import { strictestKnowledge, type Bundle, type Knowledge } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';

interface Element {
  readonly path: string;
  readonly pointer: string;
  readonly knowledge: Knowledge;
  readonly refs: Knowledge[];
}

function namedKnowledge(bundle: Bundle): Map<string, Knowledge> {
  const named = new Map<string, Knowledge>();
  const doc = bundle.rulebook.variables?.doc;
  for (const [name, declaration] of Object.entries(doc?.variables ?? {})) named.set(name, declaration.knowledge);
  for (const [name, set] of Object.entries(doc?.sets ?? {})) named.set(name, set.knowledge);
  return named;
}

/** The element an expression or reference at (path, pointer) belongs to, keyed `path#pointer`. */
function elementsOf(bundle: Bundle): Map<string, Element> {
  const elements = new Map<string, Element>();
  const add = (path: string, pointer: string, knowledge: Knowledge): void => {
    elements.set(`${path}#${pointer}`, { path, pointer, knowledge, refs: [] });
  };
  const { rulebook } = bundle;
  for (const { path, doc } of [...rulebook.actions, ...rulebook.processes, ...rulebook.behaviors, ...bundle.states]) add(path, '', doc.knowledge);
  if (rulebook.variables) {
    for (const [name, set] of Object.entries(rulebook.variables.doc.sets ?? {})) add(rulebook.variables.path, `/sets/${name}`, set.knowledge);
  }
  if (rulebook.objectives) {
    const { path, doc } = rulebook.objectives;
    add(path, '', doc.knowledge);
    doc.progress?.forEach((measure, i) => add(path, `/progress/${i}`, measure.knowledge));
  }
  return elements;
}

function owningElement(elements: Map<string, Element>, path: string, pointer: string): Element | undefined {
  const progress = /^\/progress\/\d+/.exec(pointer)?.[0];
  const set = /^\/sets\/[^/]+/.exec(pointer)?.[0];
  return elements.get(`${path}#${progress ?? set ?? ''}`);
}

function collectReferences(bundle: Bundle, index: BundleIndex, elements: Map<string, Element>): void {
  const named = namedKnowledge(bundle);
  for (const expression of rulebookExpressions(bundle)) {
    const element = owningElement(elements, expression.path, expression.pointer);
    if (element === undefined) continue;
    const references = expressionReferences(expression.text);
    for (const name of [...references.functions, ...references.names]) {
      const level = named.get(name);
      if (level !== undefined) element.refs.push(level);
    }
    for (const id of references.ids) element.refs.push(...referencedKnowledge(index, id));
  }
  const refer = (path: string, ids: readonly (string | undefined)[]): void => {
    const element = elements.get(`${path}#`);
    for (const id of ids) if (id !== undefined) element?.refs.push(...referencedKnowledge(index, id));
  };
  for (const { path, doc } of bundle.rulebook.behaviors) {
    refer(path, [
      doc.machine,
      ...Object.values(doc.act ?? {}).map((call) => call.action),
      ...(doc.timeline ?? []).map((step) => step.action),
      ...(doc.candidates ?? []).map((candidate) => candidate.action),
      ...(doc.actions ?? []),
    ]);
  }
  for (const { path, doc } of bundle.states) refer(path, doc.transitions.map((transition) => transition.rule));
}

export const v18RulebookKnowledge: Check = {
  id: 'V18',
  title: 'ルールブックの knowledge が参照先から伝播している',
  run: ({ load, index }) => {
    const elements = elementsOf(load.bundle);
    collectReferences(load.bundle, index, elements);
    const findings: Finding[] = [];
    for (const element of elements.values()) {
      const strictest = strictestKnowledge([element.knowledge, ...element.refs]);
      if (strictest === undefined || strictest === element.knowledge) continue;
      findings.push(error(element.path, `${element.pointer}/knowledge`, `knowledge is '${element.knowledge}' but it refers to '${strictest}' values`));
    }
    return findings;
  },
};
