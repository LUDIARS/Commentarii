// IngestReport -> the Markdown a person reviews after guide learn ingest (design 4.6: review
// happens on generated Markdown). Canonical values are shown with their knowledge label; this
// is a maker-side report over the full bundle, like render --knowledge full.

import type { IngestReport } from './ingest-runs.ts';

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return 'なし\n';
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return `${[line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n')}\n`;
}

function text(value: number | string | undefined): string {
  return value === undefined ? '-' : String(value);
}

export function formatIngestMarkdown(report: IngestReport): string {
  const { runs } = report;
  const sections = [
    `# learn ingest: ${report.game_id}\n`,
    `- 取り込んだ player run: ${runs.ingested.length} (${runs.ingested.join(', ') || '-'})`,
    `- 取り込み済みで飛ばした run: ${runs.already_ingested.length}`,
    `- 無視した omniscient run: ${runs.ignored_omniscient.length} (累計 ${runs.omniscient_total}、学習にも昇格にも数えない)`,
    `- オーバーレイの player run 累計: ${runs.player_total}\n`,
    '## 値のずれ\n',
    table(
      ['値', 'knowledge', '正本', '推定 (平均)', 'run 数', '推定件数', '一致率', 'ずれ'],
      report.value_drifts.map((drift) => [
        drift.ref ?? `${drift.entity} (${drift.quantity})`,
        text(drift.knowledge),
        text(drift.canonical),
        String(drift.mean),
        String(drift.runs),
        String(drift.estimates),
        text(drift.agreement),
        drift.ref === undefined ? '正本に値なし' : drift.drifted ? 'あり' : 'なし',
      ]),
    ),
    '## 未知の entity\n',
    table(
      ['キー', '雛形', 'run 数', '目撃'],
      report.unknown_entities.map((entry) => [entry.key, entry.draft, String(entry.runs), String(entry.sightings)]),
    ),
    '## 失敗が続く定石\n',
    table(
      ['定石', '連続失敗', '試行', '成功率', '期待外れ'],
      report.failing_tactics.map((entry) => [entry.tactic, String(entry.streak), String(entry.runs), String(entry.success), String(entry.mismatches)]),
    ),
    '## 変種 (効率の良いものが書き換え候補)\n',
    table(
      ['変種', '元の定石', '変異', '試行', '成功率', '元の成功率', '合成ゲイン', '候補', '理由'],
      report.variants.map((entry) => [
        entry.tactic,
        entry.of,
        entry.mutation,
        String(entry.runs),
        String(entry.success),
        text(entry.origin_success),
        text(entry.gain),
        entry.meets ? '○' : '-',
        entry.reason,
      ]),
    ),
  ];
  return sections.join('\n');
}
