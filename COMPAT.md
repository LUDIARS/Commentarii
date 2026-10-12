# 互換表 (Commentarii SDK × 形式の版 × Ingenium)

`@ludiars/commentarii-sdk` (`packages/sdk`) の版と、SDK が所有する形式の版、それを読む Ingenium の版の対応を 1 表で持つ。
両リポの CI はこの表を読み、対応外の組み合わせのテストを「スキップ」ではなく「失敗」にする (黙った非互換を作らない。設計: `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §10.2、`spec/plan/2026-10-11-ingenium-integrated-design.md` §4)。

| SDK 版 (`packages/sdk/package.json`) | 取り出し元 | bundle `format_version` (`bundle.json`) | replay header 版 (`replay.schema.json`) | Ingenium 版 | 備考 |
|---|---|---|---|---|---|
| 0.1.0 | `sdk-v0.1.0` (マージ後に作成) | 1 | 1 (header に版の欄は未導入。現行の `replay.schema.json` を版 1 とみなす) | なし (Ingenium は 0.2.0 から) | R0-A: Commentarii 内で SDK を切り出した初版 |
| 0.2.0 | Ingenium `vendor/commentarii-sdk.json` に記録した commit | 1 | 2 (header に任意の `engine` / `sdk_version` / `bundle_format` / `bundle_hash` / `stance`。版 1 の記録もそのまま読める) | 0.2.0 (Ingenium #2697、`ae02821`) | R0-B: 実行側を Ingenium へ移した版。bench の比較キーに任意の `stance` / `decider` / `engine_version` / `sdk_version` を足した (無い旧結果は Ingenium の結果と比較不能) |
| 0.3.0 | Ingenium R1 の Commentarii PR のマージ commit (Ingenium `vendor/commentarii-sdk.json` に記録) | 2 (`documents.mechanics` = variables / actions / masked_actions / processes / behaviors / objectives、`index.actions`、`view: player \| full`、`expression_language: expr/2`。形式 1 の `bundle.json` も `loadRulebook` で読める: ルールブックは空) | 2 (tick 行に任意の `model` (信念の要約・アフォーダンスの分類) を足した。版 2 の記録はそのまま読める) | 0.3.0 (Ingenium R1、未リリース) | R1: 式言語 v2 (`expr/2`: 比較・論理・`if`・ID トークン・`$param`・文脈関数・区間評価・静的検査。`expr/1` の点評価は不変)、ルールブックのスキーマ、`loadRulebook(exported, mode)` (player / omniscient、masked 上書き、overlay)、validate V13〜V20、`rulebook.md` |
| 0.4.0 | Ingenium R2 の Commentarii PR の commit (Ingenium `vendor/commentarii-sdk.json` に記録) | 2 (変更なし) | 2 (header に任意の `decider` / `curriculum`、tick 行に任意の `planning` (判断の理由: 局面署名・予算表の行・提案者別の計画数と論理仕事量・実行中の計画・実験・adapter/2 の receipt)、`decision[]` に任意の `proposer` / `parts` / `predicted` / `rejected` を足した。版 2 の記録はそのまま読める) | 0.4.0 (Ingenium R2、未リリース) | R2: 自律構えの判断ログ。bench の比較キーに任意の `curriculum` / `curriculum_hash`、指標に任意の `proposer_share`、任意の `latency` (壁時計の記録だけ、較正点つき)。新しい形式 `effect-hypotheses/1` (`observations/rules/<action>.json`、効果の仮説) と `plan-record/1` (`observations/plans/<run>.jsonl`、定石候補の入力)。契約 shim は満たした契約をサイトごとに 1 回だけ記録する (違反は毎回) |

- SDK 版は `packages/sdk/package.json` の `version`、bundle の版は `EXPORT_FORMAT_VERSION` (`packages/sdk/src/export/exported-bundle.ts`)。どちらかを上げたら同じ PR でこの表に行を足す。
- Ingenium は `packages/sdk` を `npm pack` した tarball を自分の `vendor/commentarii-sdk-<版>.tgz` に置き、`file:` 依存で読む (npm の git 依存はリポ内サブディレクトリを扱えないため、タグ依存はやめた)。取り出し元 commit と sha256 は Ingenium の `vendor/commentarii-sdk.json` にあり、`scripts/update-sdk.mjs <Commentarii のパス> <commit>` で作り直す。
- `guide run / bench / gate / replay / report signatures` は Commentarii 0.2.x の 1 版だけ `ingenium` へ委譲する (PATH に無ければ終了コード 2)。0.3.0 で委譲を撤去する。
