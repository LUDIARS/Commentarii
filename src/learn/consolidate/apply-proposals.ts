// The auto proposals as file changes of the canonical bundle: each file's JSON Patch applied to
// its current document (patches of several proposals on one file apply in order), and every
// resulting document checked against the schema of its bundle path. Any failure throws and
// nothing is written (a rewrite lands whole or not at all).

import type { Bundle, Located } from '../../bundle/bundle.ts';
import { classifyPath, SCHEMA_OF_KIND } from '../../bundle/classify-path.ts';
import type { FileChange } from '../../import/plan/file-change.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import { LearnError } from '../learn-error.ts';
import { applyJsonPatch, JsonPatchError } from '../patch/json-patch.ts';
import type { Proposal } from './proposal.ts';

function documentsByPath(bundle: Bundle): Map<string, unknown> {
  const located: Located<unknown>[] = [
    ...bundle.entities,
    ...bundle.maskedEntities,
    ...bundle.tactics,
    ...bundle.intents,
    ...bundle.rules,
    ...bundle.states,
  ];
  return new Map(located.map(({ path, doc }) => [path, doc]));
}

function assertValid(changes: readonly FileChange[], registry: SchemaRegistry): void {
  const problems: string[] = [];
  for (const { path, after } of changes) {
    const pathClass = classifyPath(path);
    if (pathClass.type !== 'document') {
      problems.push(`${path}: not a bundle document path`);
      continue;
    }
    for (const violation of registry.validate(SCHEMA_OF_KIND[pathClass.kind], after)) problems.push(`${path}${violation.pointer}: ${violation.message}`);
  }
  if (problems.length > 0) throw new LearnError(`consolidate would write invalid documents:\n  ${problems.join('\n  ')}`);
}

export function applyProposals(bundle: Bundle, proposals: readonly Proposal[], registry: SchemaRegistry): FileChange[] {
  const current = documentsByPath(bundle);
  const before = new Map<string, unknown>();
  const after = new Map<string, unknown>();
  for (const proposal of proposals) {
    for (const file of proposal.files) {
      const existing = after.has(file.path) ? after.get(file.path) : current.get(file.path);
      if (file.create === (existing !== undefined)) {
        throw new LearnError(`${proposal.id}: ${file.path} ${file.create ? 'already exists' : 'is not in the bundle'}`);
      }
      if (!before.has(file.path)) before.set(file.path, current.get(file.path));
      try {
        after.set(file.path, applyJsonPatch(existing ?? null, file.patch));
      } catch (cause) {
        if (cause instanceof JsonPatchError) throw new LearnError(`${proposal.id}: ${file.path}: ${cause.message}`);
        throw cause;
      }
    }
  }
  const changes = [...after].map(([path, doc]) => ({ path, before: before.get(path), after: doc }));
  assertValid(changes, registry);
  return changes;
}
