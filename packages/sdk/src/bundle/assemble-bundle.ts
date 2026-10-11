// Groups schema-valid files into the typed Bundle. Pure: no I/O, no validation.

import type {
  Entity,
  Glossary,
  GuideMap,
  Intent,
  Manifest,
  MaskedEntity,
  Rule,
  Stage,
  StageEvents,
  StateMachine,
  Tactic,
} from '../domain/documents.ts';
import type { Bundle, LoadedFile, Located, StageFiles } from './bundle.ts';

function stageSlugOf(path: string): string {
  return path.split('/')[1] ?? '';
}

function byPath<T>(items: Located<T>[]): Located<T>[] {
  return items.sort((a, b) => a.path.localeCompare(b.path));
}

export function assembleBundle(files: readonly LoadedFile[]): Bundle {
  let manifest: Located<Manifest> | undefined;
  let glossary: Located<Glossary> | undefined;
  const entities: Located<Entity>[] = [];
  const maskedEntities: Located<MaskedEntity>[] = [];
  const rules: Located<Rule>[] = [];
  const states: Located<StateMachine>[] = [];
  const tactics: Located<Tactic>[] = [];
  const intents: Located<Intent>[] = [];
  const stages = new Map<string, { stage?: Located<Stage>; map?: Located<GuideMap>; events?: Located<StageEvents> }>();
  const stageEntry = (path: string) => {
    const slug = stageSlugOf(path);
    const existing = stages.get(slug);
    if (existing) return existing;
    const created = {};
    stages.set(slug, created);
    return created as { stage?: Located<Stage>; map?: Located<GuideMap>; events?: Located<StageEvents> };
  };

  for (const file of files) {
    if (!file.schemaValid) continue;
    const { path } = file;
    switch (file.kind) {
      case 'manifest':
        manifest = { path, doc: file.data as Manifest };
        break;
      case 'glossary':
        glossary = { path, doc: file.data as Glossary };
        break;
      case 'entity':
        entities.push({ path, doc: file.data as Entity });
        break;
      case 'entity-masked':
        maskedEntities.push({ path, doc: file.data as MaskedEntity });
        break;
      case 'stage':
        stageEntry(path).stage = { path, doc: file.data as Stage };
        break;
      case 'map':
        stageEntry(path).map = { path, doc: file.data as GuideMap };
        break;
      case 'events':
        stageEntry(path).events = { path, doc: file.data as StageEvents };
        break;
      case 'rule':
        rules.push({ path, doc: file.data as Rule });
        break;
      case 'state':
        states.push({ path, doc: file.data as StateMachine });
        break;
      case 'tactic':
        tactics.push({ path, doc: file.data as Tactic });
        break;
      case 'intent':
        intents.push({ path, doc: file.data as Intent });
        break;
    }
  }

  const stageFiles: StageFiles[] = [...stages.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, entry]) => ({ slug, ...entry }));

  return {
    ...(manifest ? { manifest } : {}),
    ...(glossary ? { glossary } : {}),
    entities: byPath(entities),
    maskedEntities: byPath(maskedEntities),
    stages: stageFiles,
    rules: byPath(rules),
    states: byPath(states),
    tactics: byPath(tactics),
    intents: byPath(intents),
  };
}
