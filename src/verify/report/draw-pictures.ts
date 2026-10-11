// Verification report -> its SVG pictures (design 14.H): one heatmap per stage (panels of all
// runs, each persona and humans side by side, the intent's route and forbid areas over them)
// and the good-play scatter plot. Stages without a map get no heatmap.

import type { Bundle } from '../../bundle/bundle.ts';
import type { GuideMap } from '../../domain/documents.ts';
import { drawHeatmap } from '../../render/heatmap/draw-heatmap.ts';
import { drawScatter } from '../../render/heatmap/draw-scatter.ts';
import type { StageReport, VerifyReport } from './verify-report.ts';

export function mapOfStage(bundle: Bundle, stage: string): GuideMap | undefined {
  return bundle.stages.find((files) => (files.stage?.doc.id ?? files.map?.doc.stage) === stage)?.map?.doc;
}

export function drawStageHeatmap(stage: StageReport, map: GuideMap): string {
  return drawHeatmap({
    title: `${stage.stage} 経路・死亡ヒートマップ`,
    map,
    panels: stage.heatmap.panels,
    overlay: { routes: stage.heatmap.routes, forbid: stage.heatmap.forbid },
  });
}

export function drawGoodPlay(report: VerifyReport): string {
  const points = report.stages.flatMap((stage) =>
    stage.feasibility.axes.map((axis) => ({ stage: stage.stage, persona: axis.persona, breadth: axis.breadth, confusionDepth: axis.confusion_depth })),
  );
  return drawScatter(`${report.game_id} 良い遊びの 2 軸`, points);
}

/** File name (relative to observations/verify/) -> SVG text. */
export function drawPictures(report: VerifyReport, bundle: Bundle): Map<string, string> {
  const pictures = new Map<string, string>();
  for (const stage of report.stages) {
    const map = mapOfStage(bundle, stage.stage);
    if (map !== undefined) pictures.set(stage.heatmap.svg, drawStageHeatmap(stage, map));
  }
  pictures.set(report.good_play_svg, drawGoodPlay(report));
  return pictures;
}
