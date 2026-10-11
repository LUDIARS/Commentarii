// The verification report as Markdown (spec/feature/intent-verify.md 5). SVG references are
// relative to observations/verify/, where the report and the pictures are written.

import { document, table } from '../../markdown/markdown.ts';
import { BAND_LABEL, CLASS_LABEL, CONVERGENCE_TEXT, DECISION_LABEL, rateText, REASON_LABEL } from './labels.ts';
import type { StageReport, VerifyReport } from './verify-report.ts';

function list(values: readonly string[]): string {
  return values.length === 0 ? 'なし' : values.join(', ');
}

function runsSection(report: VerifyReport): string {
  const { runs } = report;
  return [
    `対象 run: ${runs.counted.length}${report.persona === undefined ? '' : ` (ペルソナ ${report.persona} のみ)`}`,
    `無視した omniscient run: ${runs.ignored_omniscient.length}${runs.ignored_omniscient.length === 0 ? '' : ` (${runs.ignored_omniscient.join(', ')})`}`,
    `対象外の efficiency run: ${runs.ignored_efficiency.length}`,
    `対象外の意図支援 run (答えを渡した試験。能力の推定に使わない): ${runs.ignored_intent_assisted.length}`,
    ...(runs.filtered_out.length === 0 ? [] : [`--persona で除いた run: ${runs.filtered_out.length}`]),
    ...(runs.unreadable.length === 0 ? [] : [`読めなかったファイル: ${runs.unreadable.length} (${runs.unreadable.join(', ')})`]),
  ]
    .map((line) => `- ${line}`)
    .join('\n');
}

function intentsTable(stage: StageReport): string {
  if (stage.intents.length === 0) return '意図がありません (intent/ にこのステージの意図が無いか、下書きです)。';
  return table(
    ['意図', '種別', '分類', '対象 run', '到達', '再現', 'ズレ', '許容済み'],
    stage.intents.map((verdict) => [verdict.intent, verdict.kind, CLASS_LABEL[verdict.classification], verdict.runs, verdict.reached, verdict.reproduced, verdict.divergences.length, verdict.allowed]),
  );
}

function divergencesSection(stage: StageReport): string {
  const open =
    stage.divergences.length === 0
      ? '未許容のズレはありません。'
      : table(
          ['ID', '判定', '種類', '意図', '理由', '内容', 'run', 'ペルソナ'],
          stage.divergences.map((divergence) => [
            divergence.id,
            DECISION_LABEL[divergence.decision],
            divergence.kind === 'interesting' ? '面白いズレ (候補)' : '望ましくないズレ',
            divergence.intent,
            REASON_LABEL[divergence.reason],
            divergence.summary,
            divergence.runs.join(', '),
            divergence.personas.join(', '),
          ]),
        );
  const accepted = stage.accepted.length === 0 ? '' : `許容済みで再報告しないズレ: ${stage.accepted.length} 件 (${stage.accepted.map((entry) => entry.id).join(', ')})`;
  const promotions =
    stage.promotions.length === 0
      ? ''
      : `### learned → authored の昇格候補 (自動では昇格しない)\n\n${table(
          ['定石', 'ズレ', '由来'],
          stage.promotions.map((promotion) => [promotion.tactic, promotion.divergence, promotion.origin === 'bundle' ? '攻略本の learned 定石' : '探索の変種']),
        )}`;
  return document(['### ズレ', '人間が `decision` を書く欄は `observations/divergences.json`。許容は `guide verify intent --accept <ID> --by <名前>`。', open, accepted, promotions]).trimEnd();
}

function usageSection(stage: StageReport): string {
  const time = stage.time;
  const timeLine =
    time.median_sec === undefined
      ? '到達時間: 到達した run がありません。'
      : `到達時間の中央値: ${time.median_sec} 秒${time.range_sec === undefined ? '' : ` (想定 ${time.range_sec[0]}〜${time.range_sec[1]} 秒、差 ${time.diff_sec ?? 0} 秒)`}`;
  const tactics = stage.tactics_used.length === 0 ? '使われた定石: なし' : `使われた定石: ${stage.tactics_used.map((entry) => `${entry.tactic} (${entry.runs} run)`).join(', ')}`;
  return [
    `- 到達率: オートプレイヤー ${stage.reach.autoplay.reached}/${stage.reach.autoplay.runs} (${rateText(stage.reach.autoplay.reach_rate)})、人間 ${stage.reach.human.reached}/${stage.reach.human.runs} (${rateText(stage.reach.human.reach_rate)})`,
    `- ${timeLine}`,
    `- ${tactics}`,
    `- 未使用の rule: ${list(stage.unused.rules)}`,
    `- 未使用の skill: ${list(stage.unused.skills)}`,
    `- 未使用の定石: ${list(stage.unused.tactics)}`,
  ].join('\n');
}

function feasibilitySection(stage: StageReport): string {
  const { feasibility } = stage;
  const bands = (Object.keys(feasibility.bands) as (keyof typeof feasibility.bands)[]).map((band) => `${BAND_LABEL[band]} ${feasibility.bands[band]}`).join(' / ');
  const illusory = feasibility.illusory.length === 0 ? '' : `\n- illusory の解法: ${feasibility.illusory.join(', ')} (詳細は \`guide report feasibility\`)`;
  const axes =
    feasibility.axes.length === 0
      ? ''
      : `\n\n${table(
          ['ペルソナ', '解法の広さ', '迷いの深さ', 'run', '収束'],
          feasibility.axes.map((axis) => [axis.persona, axis.breadth, axis.confusion_depth, axis.runs, axis.convergence ? CONVERGENCE_TEXT : '-']),
        )}`;
  return `### 行動可能性の帯と良い遊びの 2 軸\n\n- design_stance: ${stage.design_stance}\n- 帯: ${bands}${illusory}\n- 根拠: \`${feasibility.path}\`${axes}`;
}

function stageSection(stage: StageReport): string {
  return document([
    `## ${stage.stage}`,
    intentsTable(stage),
    divergencesSection(stage),
    '### 使われ方',
    usageSection(stage),
    `### 経路・死亡ヒートマップ\n\n![${stage.stage} の経路・死亡ヒートマップ](${stage.heatmap.svg})`,
    feasibilitySection(stage),
  ]).trimEnd();
}

export function formatVerifyMarkdown(report: VerifyReport): string {
  return document([
    `# 意図ズレレポート (${report.game_id})`,
    runsSection(report),
    ...report.stages.map(stageSection),
    `## 良い遊びの 2 軸 (散布図)\n\n![解法の広さと迷いの深さ](${report.good_play_svg})`,
  ]);
}
