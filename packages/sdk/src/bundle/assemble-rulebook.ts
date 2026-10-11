// Groups the schema-valid rulebook files (mechanics/ variables, actions, masked action
// overrides, processes, behaviors, objectives) of a bundle. Pure: no I/O, no validation.

import type {
  ActionDefinition,
  BehaviorModel,
  MaskedActionOverride,
  Objectives,
  ProcessDefinition,
  RulebookVariables,
} from '../domain/rulebook-documents.ts';
import type { LoadedFile, Located, RulebookFiles } from './bundle.ts';

function byPath<T>(items: Located<T>[]): Located<T>[] {
  return items.sort((a, b) => a.path.localeCompare(b.path));
}

export function assembleRulebook(files: readonly LoadedFile[]): RulebookFiles {
  let variables: Located<RulebookVariables> | undefined;
  let objectives: Located<Objectives> | undefined;
  const actions: Located<ActionDefinition>[] = [];
  const maskedActions: Located<MaskedActionOverride>[] = [];
  const processes: Located<ProcessDefinition>[] = [];
  const behaviors: Located<BehaviorModel>[] = [];
  for (const file of files) {
    if (!file.schemaValid) continue;
    const { path } = file;
    switch (file.kind) {
      case 'variables':
        variables = { path, doc: file.data as RulebookVariables };
        break;
      case 'objectives':
        objectives = { path, doc: file.data as Objectives };
        break;
      case 'action':
        actions.push({ path, doc: file.data as ActionDefinition });
        break;
      case 'action-masked':
        maskedActions.push({ path, doc: file.data as MaskedActionOverride });
        break;
      case 'process':
        processes.push({ path, doc: file.data as ProcessDefinition });
        break;
      case 'behavior':
        behaviors.push({ path, doc: file.data as BehaviorModel });
        break;
      default:
        break;
    }
  }
  return {
    ...(variables ? { variables } : {}),
    actions: byPath(actions),
    maskedActions: byPath(maskedActions),
    processes: byPath(processes),
    behaviors: byPath(behaviors),
    ...(objectives ? { objectives } : {}),
  };
}
