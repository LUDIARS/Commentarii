// What guide render adds to the stage pages when observations/verify/report.json exists
// (design 14.H "render のステージ節に埋め込む"): the heatmap SVG next to the page
// (stages/<slug>.heatmap.svg) and a section that references it, with the band summary. Called
// with the player view: intent items the view does not hold (masked) are left out of the
// section and of the picture.

import type { Bundle } from '../../bundle/bundle.ts';
import { document, table } from '../../markdown/markdown.ts';
import { drawStageHeatmap, mapOfStage } from './draw-pictures.ts';
import { BAND_LABEL, CLASS_LABEL, CONVERGENCE_TEXT } from './labels.ts';
import type { StageReport, VerifyReport } from './verify-report.ts';

export interface StageExtras {
  /** Stage slug -> Markdown section appended to stages/<slug>.md. */
  readonly sections: ReadonlyMap<string, string>;
  /** Rendered file path -> SVG text. */
  readonly files: ReadonlyMap<string, string>;
}

function section(stage: StageReport, svg: string | undefined): string {
  const bands = (Object.keys(stage.feasibility.bands) as (keyof typeof stage.feasibility.bands)[]).map((band) => `${BAND_LABEL[band]} ${stage.feasibility.bands[band]}`).join(' / ');
  const intents = stage.intents.length === 0 ? '' : table(['意図', '分類'], stage.intents.map((verdict) => [verdict.intent, CLASS_LABEL[verdict.classification]]));
  const axes =
    stage.feasibility.axes.length === 0
      ? ''
      : table(['ペルソナ', '解法の広さ', '迷いの深さ', '収束'], stage.feasibility.axes.map((axis) => [axis.persona, axis.breadth, axis.confusion_depth, axis.convergence ? CONVERGENCE_TEXT : '-']));
  return document([
    '## 経路・死亡ヒートマップと行動可能性 (guide verify intent の結果)',
    svg === undefined ? '' : `![経路・死亡ヒートマップ](${svg})`,
    intents,
    `帯: ${bands}`,
    axes,
  ]).trimEnd();
}

function visibleOnly(stage: StageReport, bundle: Bundle): StageReport {
  const items = bundle.intents.filter(({ doc }) => doc.stage === stage.stage).flatMap(({ doc }) => doc.intended);
  const ids = new Set(items.map((item) => item.id));
  return {
    ...stage,
    intents: stage.intents.filter((verdict) => ids.has(verdict.intent)),
    heatmap: {
      ...stage.heatmap,
      routes: items.flatMap((item) => (item.kind === 'route' ? [item.path] : [])),
      forbid: items.flatMap((item) => (item.kind === 'forbid' ? [item.area] : [])),
    },
  };
}

export function renderStageExtras(report: VerifyReport, bundle: Bundle): StageExtras {
  const sections = new Map<string, string>();
  const files = new Map<string, string>();
  for (const reported of report.stages) {
    const stage = visibleOnly(reported, bundle);
    const map = mapOfStage(bundle, stage.stage);
    const svg = map === undefined ? undefined : `${stage.slug}.heatmap.svg`;
    if (map !== undefined && svg !== undefined) files.set(`stages/${svg}`, drawStageHeatmap(stage, map));
    sections.set(stage.slug, section(stage, svg));
  }
  return { sections, files };
}
