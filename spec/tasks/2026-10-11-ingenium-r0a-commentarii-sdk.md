# Ingenium R0-A: Commentarii SDK (`packages/sdk`) の切り出し

設計正本: `spec/plan/2026-10-11-ingenium-integrated-design.md` (§4 リポの境界、§5 の R0)。移管ファイルの対応表は `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §10.1〜§10.3 (段階 0) を正本にする。背景: オートプレイヤーは新リポ **Ingenium** (`LUDIARS/Ingenium`、private、略称 `Ig`) に分離する (neco 決定 2026-10-11)。依存は Ingenium → Commentarii SDK の一方向。本段は **Commentarii の中だけ** で行う (Ingenium リポへの移動は次段 R0-B)。

## 成果物

1. `packages/sdk/` を新設し、`@ludiars/commentarii-sdk` として公開入口 1 つ (`packages/sdk/src/index.ts` と、入口ごとのサブパス `schemas` / `types` / `bundle` / `expression` / `rulebook` (R1 用の空の入口は作らない。今ある部品だけ) / `replay` / `observation` / `knowledge` / `fixtures`) を持たせる。中身は Fable 案 §10.1 の SDK 表と §10.3 の「Cm SDK」行のファイル (形式・不変条件・マスク検査・式言語・バンドル読み込み・player ビュー・観測境界・攻略本の知識を読む部品・フィクスチャ)。
   - ファイルは **移動** する (複製しない)。`src/` 側は SDK の公開入口だけを import する。`src/` から `packages/sdk/src/` の内部パスを直接 import することを禁じる検査 (テスト 1 本でよい: import 文の走査) を足す。
   - SDK は `ajv` 系以外の実行時依存を持たない。
2. フィクスチャ: `samples/bestia` の `bundle.json` 書き出し (player / full)、`tests/fixtures/replay/*.jsonl`、observations の見本を `packages/sdk/fixtures/` に置き、SDK から読める形にする (Ingenium のテストが使う)。
3. `COMPAT.md` (リポ直下): SDK 版 × bundle `format_version` × replay header 版 × Ingenium 版 の対応表を 1 表で。初版は SDK 0.1.0 / bundle 現行版 / replay 現行版 / Ingenium 未対応 (R0-B で埋める)。
4. SDK の版付け: `packages/sdk/package.json` の version 0.1.0。Ingenium は `github:LUDIARS/Commentarii#sdk-v0.1.0` のタグで参照する予定 (タグ作成は本段ではしない。マージ後に親が行う)。
5. `spec/domains/` に `commentarii-sdk.domain.json` (pathPattern は `(^|/)packages/sdk/` の形。`^packages/` は不可)。既存ドメインの pathPattern で移動したファイルを指していたものは SDK 側へ直す。README に SDK の節。
6. Augur 契約 (`augur.contracts.json`、`src/contracts/*.contract.ts`) のうち移動したファイルを対象にしていたものは、対象パスを直す (ID は変えない。ID 衝突の再注入は既知の落とし穴)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通り、**テストの件数と結果が移動前と同じ** (PR 説明に前後の件数を書く)。
- `guide` CLI の挙動が不変 (既存の CLI テストがそのまま通る)。
- `src/` から SDK 内部パスへの import が 0 件 (追加した検査テストで担保)。
- SDK を単独で読み込める: `packages/sdk` だけを対象にした型検査が通る (`tsc -p packages/sdk/tsconfig.json --noEmit`)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方・注意

- 作業場所は親が渡した worktree とブランチ。`main` を直接編集しない。
- 段 6 の描画タップ受信の並行ブランチ (未提出) が `src/render-tap/` と `src/adapters/render-tap/` に触っている。本段は `src/render-tap/` を **移動しない** (R0-B で Ingenium へ移す)。render-tap が import している replay / observation の型は SDK 入口経由に書き換えてよい (そのブランチは後で親が取り込み直す)。
- 判断エンジン (`src/engine/` の実行側)、アダプタ、sim、bench、gate、replay の実行側は **本段では動かさない** (R0-B)。
- ビルドとテストはフォアグラウンドで待つ (バックグラウンドで待つと session-end される)。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
