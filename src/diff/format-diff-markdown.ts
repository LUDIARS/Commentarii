// The semantic diff as human-readable Markdown (design 14.I). Every number is printed from the
// diff itself; the text around it is fixed wording, so the explanation cannot drift from the data.
// A player diff is labelled as the public material for update notes; a full diff as internal.

import type { FieldChange, RecordChange, RecordKind, SemanticDiff } from './semantic-diff.ts';

const RECORD_TITLES: Readonly<Record<RecordKind, string>> = {
  entity: 'エンティティ (敵・アイテム・スキル・アクター)',
  'masked-entity': '内部値 (masked)',
  stage: 'ステージ',
  rule: 'ルール',
  state: '状態機械',
  tactic: '定石',
  'intent-item': '設計意図',
};

function show(value: unknown): string {
  return `\`${JSON.stringify(value)}\``;
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function fieldLine(field: FieldChange): string {
  switch (field.kind) {
    case 'value':
      return `- \`${field.pointer}\`: ${show(field.before)} → ${show(field.after)}${field.delta === undefined ? '' : ` (${signed(field.delta)})`}`;
    case 'boundary':
      return `- \`${field.pointer}\`: 境界の${field.direction === 'promoted' ? '昇格' : '降格'} ${field.before} → ${field.after}`;
    case 'added-field':
      return `- \`${field.pointer}\`: 追加 ${show(field.after)}`;
    case 'removed-field':
      return `- \`${field.pointer}\`: 削除 (旧 ${show(field.before)})`;
  }
}

function changeLines(change: RecordChange): string[] {
  switch (change.kind) {
    case 'added':
      return [`- 追加: \`${change.id}\``];
    case 'removed':
      return [`- 削除: \`${change.id}\``];
    case 'replaced':
      return [`- 置換: \`${change.id}\` は \`${change.by}\` に置き換え`];
    case 'changed':
      return [`- 変更: \`${change.id}\``, ...change.fields.map((field) => `  ${fieldLine(field)}`)];
  }
}

function boundaryCount(diff: SemanticDiff, direction: 'promoted' | 'demoted'): number {
  return diff.changes.reduce(
    (sum, change) => sum + (change.kind === 'changed' ? change.fields.filter((f) => f.kind === 'boundary' && f.direction === direction).length : 0),
    0,
  );
}

export function formatDiffMarkdown(diff: SemanticDiff): string {
  const audience = diff.knowledge === 'player' ? '公開用 (player 書き出し同士の差分、アップデート説明の素材)' : '内部用 (full、masked を含む)';
  const lines = [
    '# 攻略本の変更説明',
    '',
    `- 対象: ${diff.before.game_id ?? '(game_id なし)'} ${diff.before.version ?? '(版なし)'} → ${diff.after.game_id ?? '(game_id なし)'} ${diff.after.version ?? '(版なし)'}`,
    `- 種別: ${audience}`,
    `- 変更: ${diff.changes.length} 件 (境界の昇格 ${boundaryCount(diff, 'promoted')} / 降格 ${boundaryCount(diff, 'demoted')})`,
    '',
  ];
  if (diff.changes.length === 0) return `${[...lines, '意味のある変更はありません。'].join('\n')}\n`;
  for (const record of Object.keys(RECORD_TITLES) as RecordKind[]) {
    const changes = diff.changes.filter((change) => change.record === record);
    if (changes.length === 0) continue;
    lines.push(`## ${RECORD_TITLES[record]}`, '', ...changes.flatMap(changeLines), '');
  }
  return `${lines.join('\n')}`;
}
