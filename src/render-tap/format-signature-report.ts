// The unknown-appearance report as Markdown for the game's maker: what to add to the guide (a
// render_signature on the right entity) or to the tap (asset names instead of count hashes, or
// distinct materials for look-alikes). Internal material: it names asset IDs, which the public
// guide and player observations never carry.

import type { UnknownAppearance, UnknownSignatureReport } from './collect-unknown-signatures.ts';

const ADVICE: Readonly<Record<UnknownAppearance['kind'], string>> = {
  'unknown-signature': '攻略本のどのエンティティにも無い外見。該当エンティティに `render_signature` を足す (新しい敵なら雛形を起こす)',
  ambiguous: '複数のエンティティが同じ外見。material を分けるか、どちらかの `render_signature` を直す',
  unidentifiable: '描画器が count-hash でしか名乗らない。タップ側でアセット名 (asset-name) か content-hash を出す',
};

function row(appearance: UnknownAppearance): string {
  const material = appearance.material.length === 0 ? '—' : appearance.material.map((m) => `\`${m}\``).join(', ');
  const candidates = appearance.candidates === undefined ? '' : ` (候補: ${appearance.candidates.map((c) => `\`${c}\``).join(', ')})`;
  return `| ${appearance.kind}${candidates} | \`${appearance.mesh}\` | ${material} | ${appearance.frames} | ${appearance.first_frame} | ${appearance.max_instances} |`;
}

export function formatSignatureReport(report: UnknownSignatureReport, gameId: string): string {
  const lines = [
    `# 未知の外見 (メーカー向け): ${gameId}`,
    '',
    `- 読んだフレーム (player-camera): ${report.frames_read}`,
    `- 名前の付かない外見: ${report.appearances.length} 種`,
    '- 内部資料: アセット ID を含む。公開版の攻略本やプレイヤー観測には入らない (エンジンには「未知の個体」としてだけ見える)。',
    '',
  ];
  if (report.appearances.length === 0) return `${[...lines, '見えた外見はすべて攻略本で名前が付いた。'].join('\n')}\n`;
  lines.push('| 種類 | mesh | material | 見えたフレーム数 | 初出フレーム | 1 フレームの最大数 |', '|---|---|---|---|---|---|', ...report.appearances.map(row), '', '## 対処', '');
  for (const kind of Object.keys(ADVICE) as UnknownAppearance['kind'][]) {
    if (report.appearances.some((a) => a.kind === kind)) lines.push(`- ${kind}: ${ADVICE[kind]}`);
  }
  return `${lines.join('\n')}\n`;
}
