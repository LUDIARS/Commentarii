// Markdown of `guide report plays`: one table per stage, human next to autoplay.

import { document, percent, table } from '../../markdown/markdown.ts';
import type { PlaysReport, StageSide } from './plays-report.ts';

function reach(side: StageSide): string {
  return side.reach_rate === null ? '-' : `${side.reached}/${side.runs} (${percent(side.reach_rate)})`;
}

function time(side: StageSide): string {
  return side.time_sec === null ? '-' : `${side.time_sec.p50} / ${side.time_sec.p90}`;
}

function routes(side: StageSide): string {
  return side.routes.length === 0 ? '-' : side.routes.map((route) => `${route.path.join(' → ') || '(ノード無し)'} ×${route.runs}`).join('<br>');
}

export function formatPlaysMarkdown(report: PlaysReport): string {
  const stages = report.stages.flatMap((stage) => [
    `## ${stage.stage}`,
    table(
      ['', '人間', 'オートプレイヤー'],
      [
        ['run 数', stage.human.runs, stage.autoplay.runs],
        ['到達', reach(stage.human), reach(stage.autoplay)],
        ['時間 p50 / p90 (秒)', time(stage.human), time(stage.autoplay)],
        ['経路', routes(stage.human), routes(stage.autoplay)],
      ],
    ),
  ]);
  return document([
    '# 人間 vs オートプレイヤー',
    `ゲーム: ${report.game_id}`,
    `人間: ${report.human.runs} run (${report.human.players} 人) / オートプレイヤー: ${report.autoplay.runs} run (player モード。omniscient ${report.autoplay.omniscient_excluded} run は比較から除外)`,
    report.skipped_files.length === 0 ? '' : `読み飛ばしたファイル: ${report.skipped_files.length} 件 (リプレイ形式でないか、置き場所と出所が合わない)`,
    ...(stages.length === 0 ? ['比較できる run がありません。'] : stages),
  ]);
}
