// The built-in narrator: commentary in fixed wording from the commentary input alone. It is what
// `guide commentary` writes without --narrator, and the frame an external narrator's prose is put
// in (header and caveats stay ours, so the file always says what it is and is not).

import type { CommentaryCandidate, CommentaryInput, CommentaryMoment } from './commentary-input.ts';

function label(candidate: CommentaryCandidate): string {
  return candidate.name === undefined ? `\`${candidate.candidate}\`` : `「${candidate.name}」`;
}

function momentLine(moment: CommentaryMoment): string {
  const head = `- ${moment.t.toFixed(1)} 秒 (tick ${moment.tick}): ${label(moment.chosen)} を選んだ (効用 ${moment.chosen.utility.toFixed(2)})`;
  if (moment.alternatives.length === 0) return `${head}。ほかの候補は記録されていない。`;
  const others = moment.alternatives.map((alt) => `${label(alt)} ${alt.utility.toFixed(2)}`).join('、');
  const margin = moment.margin ?? 0;
  const closeness = margin < 0.05 ? '僅差で' : margin < 0.2 ? 'はっきりと' : '大差で';
  return `${head}。次点は ${others}。${closeness}上回った (差 ${margin.toFixed(2)})。`;
}

export function commentaryHeader(input: CommentaryInput): string[] {
  return [
    `# 実況: ${input.run_id}`,
    '',
    `- ゲーム: ${input.game_id} ${input.manifest_version}${input.persona === undefined ? '' : ` / ペルソナ ${input.persona}`} / 結果 ${input.result}`,
    '- これは判断ログを読んだ解説で、判断には関与しない (読み取り専用)。攻略本の正本ではない。',
    '- 入力は player 視点の判断ログだけ。プレイヤーが知り得ない定石は伏せてある。',
    ...(input.intent_assisted ? ['- この run は意図支援モード (設計者の意図を判断に使った) で、ペルソナ本来の実力を示さない。'] : []),
    '',
  ];
}

export function formatCommentary(input: CommentaryInput): string {
  const body = input.moments.length === 0 ? ['判断の切り替わりは記録されていない。'] : input.moments.map(momentLine);
  return `${[...commentaryHeader(input), '## 判断の切り替わり', '', ...body].join('\n')}\n`;
}

/** An external narrator's prose, framed by our header so its status and limits stay explicit. */
export function frameNarration(input: CommentaryInput, prose: string, narrator: string): string {
  return `${[...commentaryHeader(input), `## 解説 (narrator: ${narrator})`, '', prose.trim()].join('\n')}\n`;
}
