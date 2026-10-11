// render: the generated Markdown set of a bundle, as relative path -> text.
//
// Every page except masked.md is rendered from the player view (toPlayerView), so masked
// data never reaches them, whatever the options. masked.md exists only with knowledge=full.

import type { LoadResult } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import { localize } from '../domain/localize.ts';
import { document } from '../markdown/markdown.ts';
import { buildKnowledgeReport } from '../report/build-knowledge-report.ts';
import { formatKnowledgeMarkdown } from '../report/format-knowledge-markdown.ts';
import { renderCatalog } from './render-catalog.ts';
import { renderEnemies } from './render-enemies.ts';
import { renderIntents } from './render-intents.ts';
import { renderMasked } from './render-masked.ts';
import { renderRules } from './render-rules.ts';
import { renderStage } from './render-stage.ts';
import { renderStates } from './render-states.ts';
import { renderTactics } from './render-tactics.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:6b655d89 */
import augurContract_8469d421 from '../contracts/render-bundle.contract.ts'; /* augur-inject:contract-predicate:b27a6471 */

export type RenderKnowledge = 'player' | 'full';

export interface RenderOptions {
  readonly knowledge: RenderKnowledge;
  /** Stage slug -> extra section for stages/<slug>.md (guide verify intent's heatmap and bands). */
  readonly stageSections?: ReadonlyMap<string, string>;
}

const PAGES = [
  ['enemies.md', '敵図鑑'],
  ['catalog.md', 'アイテム / スキル'],
  ['rules.md', 'ルール'],
  ['states.md', '状態機械'],
  ['tactics.md', '定石'],
  ['intents.md', '意図'],
  ['knowledge.md', '知識境界レポート'],
] as const;

function renderIndex(load: LoadResult, stagePaths: readonly string[], options: RenderOptions): string {
  const manifest = load.bundle.manifest?.doc;
  const links = [
    ...PAGES.map(([path, title]) => `- [${title}](${path})`),
    ...stagePaths.map((path) => `- [${path.replace(/^stages\/|\.md$/g, '')}](${path})`),
    ...(options.knowledge === 'full' ? ['- [masked (内部用)](masked.md)'] : []),
  ];
  return document([
    `# ${manifest ? localize(manifest.title) : '攻略本'}`,
    manifest ? `ゲーム ID: ${manifest.game_id} / 版: ${manifest.version}` : '',
    'このファイル群は `guide render` が JSON 正本から生成する。手で直さず、JSON を直して再生成すること。',
    links.join('\n'),
  ]);
}

export function renderBundle(load: LoadResult, options: RenderOptions): Map<string, string> {
  const view = toPlayerView(load.bundle);
  const files = new Map<string, string>();
  files.set('enemies.md', renderEnemies(view));
  files.set('catalog.md', renderCatalog(view));
  files.set('rules.md', renderRules(view));
  files.set('states.md', renderStates(view));
  files.set('tactics.md', renderTactics(view));
  files.set('intents.md', renderIntents(view));
  files.set('knowledge.md', formatKnowledgeMarkdown(buildKnowledgeReport(load)));
  const stagePaths: string[] = [];
  for (const stage of view.stages) {
    const path = `stages/${stage.slug}.md`;
    stagePaths.push(path);
    files.set(path, renderStage(stage, options.stageSections?.get(stage.slug)));
  }
  if (options.knowledge === 'full') files.set('masked.md', renderMasked(load.bundle));
  files.set('README.md', renderIndex(load, stagePaths, options));
  return files;
}
// @ts-expect-error augur-inject
renderBundle = contract(renderBundle, { ...augurContract_8469d421, contractId: 'C-5', mode: 'observe', sample: 1, where: 'src/render/render-bundle.ts:52', rule: 'contract-wrap', id: '8469d421' }); /* augur-inject:contract-wrap:8469d421 */
