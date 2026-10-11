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

## 実装記録 (PR 説明)

Actio タスク: `actio:7398fa1c-9d59-4b4b-95d0-4211c1856c93` (委託 run `dfd334a4-4c06-4a7e-a810-0ac6241bd84f`)。

### 変更した境界

- `packages/sdk/` (`@ludiars/commentarii-sdk` 0.1.0) を新設し、Fable 案 §10.1 の SDK 表と §10.3 の「Cm SDK」行のファイルを **移動** した (63 ファイル、`git mv`。複製なし)。
  - `src/domain/**`・`src/schema/**`・`src/bundle/**`・`src/observation/**`・`src/praeforma/praeforma-ref.ts` → `packages/sdk/src/` の同名ディレクトリ
  - `src/replay/` の形式側 8 本 (replay-record / replay-action / observation-frame / parse-replay / tick-invariants / find-masked-pointers / replay-schema / replay-path) → `packages/sdk/src/replay/`
  - `src/engine/{world,match,observation}/**`、`candidates/{tactic-candidates,tactic-variants,run-memory,candidate}.ts`、`persona/persona.ts`、`reflect/{overlay-line,unknown-entities}.ts` → `packages/sdk/src/knowledge/`
  - 依存の閉包で必要になった 4 本も SDK へ: `engine/bt/{bt-node,build-tree}.ts` (tactic-candidates が定石の木を組む)、`engine/reflect/reflect-world.ts` (unknown-entities の入力型)、`export/exported-bundle.ts` (`bundle.json` の型)。§10.1 の `types` 入口に挙がる型の 2 本 (`bench/bench-result.ts`、`learn/overlay/overlay.ts` → `overlay/overlay.ts`) も移した。
  - `schema/*.json` → `packages/sdk/schema/`、`contract-runtime.{mjs,d.mts}` → `packages/sdk/` (ルートの `#contract-runtime` もここを指す。実行時は 1 つのモジュール)。
- 公開入口: `src/index.ts` と `schemas` / `types` / `bundle` / `expression` / `rulebook` / `replay` / `observation` / `knowledge` / `fixtures` (各 `export *`)。`rulebook` は今ある player ビュー (`toPlayerView`) だけ。`readExportedBundle` や `loadRulebook` は作っていない (R1)。新しいコードは `schemaDirectory()` とフィクスチャの読み取り (`fixture-paths.ts` / `read-fixtures.ts`) だけ。
- 解決方式: npm workspaces (`node_modules/@ludiars/commentarii-sdk` → `packages/sdk`)。`exports` の `types` は `src/*.ts`、`default` は `dist/*.js`。`npm test` と `npm run build` が先に SDK を `packages/sdk/dist` へ build する。`src/` と `tests/` は SDK を **パッケージ名でだけ** import するので、実行時の SDK は 1 つ (`build-test/` に SDK の複製はできない。クラスや状態の二重化なし)。
- `src/` と `tests/` の import を公開入口へ機械的に書き換えた (切り出し時 338 ファイル、#2690 取り込み後 28 ファイル)。`src/render-tap/` は動かさず、replay / observation の型の import だけ入口経由に変わった (並行ブランチの取り込み時に衝突し得る)。
- `findPackageRoot` の目印を `schema/value.schema.json` から `package.json` に変えた (ルートに schema/ が無くなったため)。スキーマの読み込み (`read-schema-documents.ts` / `replay-schema-documents.ts`) は SDK の `schemaDirectory()` を使う。ルートの `ajv` / `ajv-formats` 依存は SDK に移した (ルートの src は ajv を直接 import しない)。
- フィクスチャ: `packages/sdk/fixtures/bestia/bundle.{player,full}.json` (`guide export` の現在の出力)、`fixtures/replay/*.jsonl` (旧 `tests/fixtures/replay/`)、`fixtures/observations/runs/*.jsonl` (旧 `tests/fixtures/learn/runs/`、観測行の見本)。
- `COMPAT.md` (SDK 0.1.0 / bundle `format_version` 1 / replay header 1 (版の欄は未導入) / Ingenium 未対応)。
- `spec/domains/commentarii-sdk.domain.json` を新設 (`(^|/)packages/sdk/...`)。既存 7 ドメインのうち移動したファイルを指していたパターンは削除するか `(?<!packages/sdk/)` で SDK を除外した (`(^|/)src/replay/` 等は `packages/sdk/src/replay/` にも一致するため)。SDK の全ファイルが commentarii-sdk だけに所属し、`src/` の .ts で所属なしが 0 件であることを確認。
- Augur: 移動した契約 8 件 (C-2 / C-3 / C-4 / C-8 / C-9 / C-34 / C-60 / C-73) の `file` / `module` を SDK 側へ直した (ID は不変)。注入行の `where` が旧パスを持つので、該当 8 ファイルの注入行を外して再注入した。新規契約 C-90 (`schemaDirectory`) / C-91 (`readFixtureBundle`) / C-92 (`readFixtureReplay`)。ID は並行ブランチ `feat/render-tap-receiver` が C-80 まで使うので C-90 から振った。`augur inject check`: applied=56 pending=0 orphaned=0。

### #2690 (段 6〜8) の取り込み

- `origin/main` (`db9f3b0`) をマージした。#2690 が変更した移動済みファイル (`domain/documents.ts`、`engine/match/match-entity.ts`、`export/exported-bundle.ts`、`schema/manifest|tactic.schema.json`) の変更はリネーム先の SDK 側に載った。
- 衝突 4 件: `src/cli/main.ts`・`src/adapters/sim/sim-world.ts` は main 側を採ってから import を SDK 入口へ書き直し、`auto-player` ドメインは main 側に bench の SDK 除外を再適用、本書は自分側。
- #2690 の新ファイル (`src/adapters/render-tap`、`src/render-tap`、`src/engine/enemy`、`src/web`、`src/diff`、`src/commentary`、`src/export/build-ingame-export.ts`、新しい契約述語とテスト、計 28 ファイル) の replay / observation / expression / bundle / types の import を SDK 入口経由に揃えた。`tests/commentary/commentary.test.ts` の旧フィクスチャパスは `fixtureReplayPath` に替えた。
- `samples/bestia` の manifest 変更 (stdio アダプタの観測項目の宣言) に合わせて `bundle.{player,full}.json` を書き出し直した。新ドメイン (commentary / semantic-diff / web-editor) を含む 16 ドメインで、SDK のファイルは commentarii-sdk だけに所属、`src/` の .ts で所属なしは 0 件。

### 再利用探索

- Anatomia は Commentarii を未登録として拒否する (既知) ので、import の依存グラフ (移動対象の推移閉包と逆依存) をスクリプトで計算して移動範囲を決めた。新しい実装は最小にし、フィクスチャは既存の `guide export` の出力、パス解決は既存の `findPackageRoot`、検査は既存の `createSchemaRegistry` / `parseReplay` / `buildExport` を再利用した。依存の追加は無し (workspace の内部パッケージのみ)。

### 実施した検証

- `npm install --include=dev` → `npm run typecheck` (ルート + SDK 単独) → `npm test`。
- テスト件数: 前 = 段 6〜8 (#2690) マージ後の main `db9f3b0` で **379 件 (全 pass)** → 後 = 本ブランチ **386 件 (全 pass)**。既存 379 件はテスト名・結果とも同一 (名前の差分は新規 7 件だけ)。参考: #2690 取り込み前の切り出し単体では 346 → 353。新規: `tests/sdk/sdk-boundary.test.ts` 3 件 (src/ から SDK 内部パスへの import が 0 件、宣言したサブパスに入口がある、SDK の依存は node: / ajv / 自分のファイル / 契約ランタイムだけ)、`tests/sdk/sdk-fixtures.test.ts` 4 件 (bundle フィクスチャが現在の export と一致、player に masked なし、replay が parse できる、観測行が observation.schema.json に適合)。
- `tsc -p packages/sdk/tsconfig.json --noEmit` が単独で通る。
- `guide` CLI: 既存の CLI テスト (export / run / bench / replay / validate / render ほか) がそのまま通る。`npm run build` の `dist/` には SDK の複製が入らない (`dist/` は src だけ)。
- `augur contracts report --acceptance` (worktree の `logs/` で集計): 全 63 契約 met。`augur inject check`: applied=63 pending=0 orphaned=0。

### 未実施・前提未確定

- SDK のタグ `sdk-v0.1.0` は作っていない (マージ後に親が作る)。
- git タグ依存で SDK を読むには `dist/` が要る (`exports.default` が `dist/*.js`)。Ingenium 側の取り込み方 (prepare で build するか、build 済みを置くか) は R0-B で決める。npm の git 依存はサブディレクトリを直接指せない点も R0-B の課題。
- R0-B で SDK に足すか入力ファイル化が要る依存 (Ig 行のファイルが SDK 外の Cm を import している): `autoplay/*` と `gate/cli/run-gate-command.ts` → `learn/overlay/{apply-overlay,read-overlay}.ts`・`cli/{cli-io,engine-io}.ts`・`verify/verify-intent.ts`・`verify/cli/verify-io.ts`、`bench/bundle-hash.ts` → `learn/approval/proposal-hash.ts`、`bench/to-bench-result.ts` → `verify/feasibility/sample-evidence.ts`、`gate/bench-divergences.ts` → `verify/report/verify-report.ts`、`replay/format-replay-diff-markdown.ts` → `markdown/markdown.ts`、`adapters/fs/{fs-persona-source,read-engine-version,load-persona}.ts` → `package-root.ts` / `read-schema-documents.ts`。
- `persona.schema.json` は §10.3 では Ig 行だが、`ALL_SCHEMAS` に含まれるので本段は SDK の schema/ に置いたまま (R0-B で分ける)。
- サービスの起動テストはしていない (本段は起動に関わらない)。
- 共有の契約ログ `E:/Document/Ars/logs/contracts.jsonl` が約 1.76GB あり、そこを読む `augur contracts report` は「Cannot create a string longer than 0x1fffffe8」で失敗する。テストの記録は共有ログにも書いたが、Concordia 側の集計が同じ理由で落ちる可能性がある (本段の変更とは無関係)。

### 復旧方法

- 生成物がおかしいときは `dist/`・`build-test/`・`packages/sdk/dist/` を消して `npm install --include=dev && npm test` (または `npm run build`)。
- `node_modules/@ludiars/commentarii-sdk` のリンクが無いと `@ludiars/commentarii-sdk` を解決できない。`npm install` をやり直す。
- 本段を取り消すときはこの PR を revert する (ファイルは `git mv` なので履歴は追える)。
