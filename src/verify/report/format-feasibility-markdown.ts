// guide report feasibility as Markdown (spec/feature/intent-verify.md 1.3): every stage's
// solutions with illusory first (the main source of confusion, design 8.5), then impossible,
// extreme and feasible; illusory solutions declared by design in their own table; the two
// good-play axes per persona side by side; convergence as a fact.

import { document, table } from '../../markdown/markdown.ts';
import type { Band, FeasibilityDocument, FeasibilitySolution } from '../feasibility/feasibility-document.ts';
import { BAND_LABEL, CONVERGENCE_TEXT, rateText } from './labels.ts';

const BAND_ORDER: Readonly<Record<Band, number>> = { illusory: 0, impossible: 1, 'insufficient-evidence': 2, 'not-observed': 3, extreme: 4, 'skill-gated': 5, feasible: 6 };

interface Row {
  readonly stage: string;
  readonly solution: FeasibilitySolution;
}

/** The sample behind the band: finished attempts, 95% interval, aborted runs, map proof. */
function evidenceText(solution: FeasibilitySolution): string {
  const { evidence } = solution;
  const interval = evidence.interval === null ? '-' : `[${rateText(evidence.interval[0])}, ${rateText(evidence.interval[1])}]`;
  const proof = solution.unwalkable === undefined ? '' : ` / 証明: ${solution.unwalkable}`;
  return `完了 ${evidence.successes}/${evidence.attempts} 95%区間 ${interval} / 中断 ${evidence.aborted} / seed ${evidence.seeds.length} 個${proof}`;
}

function solutionCells(row: Row): (string | number)[] {
  const { solution } = row;
  return [
    BAND_LABEL[solution.band],
    row.stage,
    solution.id,
    solution.tactics.length === 0 ? '-' : solution.tactics.join(', '),
    solution.route.length === 0 ? '-' : solution.route.join(' → '),
    solution.visible ? '見える' : '見えない',
    solution.personas.length === 0 ? '試行なし' : solution.personas.map((persona) => `${persona.persona} ${persona.successes}/${persona.attempts} (${rateText(persona.success_rate)})`).join(', '),
    solution.intended.length === 0 ? '-' : solution.intended.join(', '),
    evidenceText(solution),
  ];
}

export function formatFeasibilityMarkdown(documents: readonly FeasibilityDocument[]): string {
  if (documents.length === 0) return document(['# 行動可能性の帯', 'feasibility/ に帯がありません。先に `guide verify intent` を実行してください。']);
  const rows = documents.flatMap((doc) => doc.solutions.map((solution) => ({ stage: doc.stage, solution })));
  const sorted = rows
    .filter((row) => row.solution.by_design === undefined)
    .sort((a, b) => BAND_ORDER[a.solution.band] - BAND_ORDER[b.solution.band] || (a.stage < b.stage ? -1 : a.stage > b.stage ? 1 : 0) || (a.solution.id < b.solution.id ? -1 : 1));
  const byDesign = rows.filter((row) => row.solution.by_design !== undefined);
  const headers = ['帯', 'ステージ', '解法', '定石列', '経路', 'player 情報から', 'ペルソナ別 成功/試行', '想定解', '標本'];
  const axes = documents.flatMap((doc) => doc.axes.map((axis) => [doc.stage, doc.design_stance, axis.persona, axis.breadth, axis.confusion_depth, axis.runs, axis.convergence ? CONVERGENCE_TEXT : '-']));
  const omniscient = documents.reduce((sum, doc) => sum + doc.runs.ignored_omniscient.length, 0);
  return document([
    '# 行動可能性の帯',
    `- 帯の判定に使った run: ${new Set(documents.flatMap((doc) => doc.runs.counted)).size} (player のみ) / 無視した omniscient run: ${omniscient}`,
    '- 帯と 2 軸はペルソナモデル上の推定 (sim の反応遅延・誤操作率・探索率による)。人間ログで較正するまで人間の能力の測定ではない。入力の抽象化・照準や移動の物理的制約は模していない。',
    '- 成功 0 だけでは illusory / impossible にしない: 完了試行が足りなければ「判定保留」、impossible は地図上の到達不能証明があるときだけ。',
    '## 解法と帯 (illusory を先頭)',
    sorted.length === 0 ? '解法がありません。' : table(headers, sorted.map(solutionCells)),
    ...(byDesign.length === 0
      ? []
      : ['## 設計上の illusory (illusory_by_design)', table(['ステージ', '解法', '定石列', '経路', '根拠', '判定者'], byDesign.map((row) => [row.stage, row.solution.id, row.solution.tactics.join(', ') || '-', row.solution.route.join(' → ') || '-', row.solution.by_design?.rationale ?? '-', row.solution.by_design?.decided_by ?? '-']))]),
    '## 良い遊びの 2 軸 (ペルソナ別の散布)',
    '解法の広さ (breadth) と迷いの深さ (confusion depth) を常に並べて出す。散布図は `observations/verify/good-play.svg`。',
    axes.length === 0 ? '2 軸を測れる run がありません。' : table(['ステージ', 'design_stance', 'ペルソナ', '解法の広さ', '迷いの深さ', 'run', '収束'], axes),
  ]);
}
