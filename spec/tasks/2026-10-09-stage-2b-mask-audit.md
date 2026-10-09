# 段階 2B: マスク境界の監査 (CI lint)

設計正本: `spec/architecture/design.md` §1 (第一原則)、§5 (知識境界)、§14.B (マスク監査)、§11 の 2B 行。段階 1 はマージ済み (`src/` の責務分担、特に `src/bundle/` のローダと `.masked.json` の扱いに従う)。段階 2 (import) と 2A (replay) は別 run が同時に進めるので `src/import/`, `src/replay/` には触らない。本 run のコードは `src/audit/` に閉じる。

## 目的

攻略本の `.masked.json` (知ってはならない値) を正本に、ゲームリポの実装側に masked の値や名前が露出していないかを検査し、Revisor の審査に乗る形式で報告する。第一原則をゲーム実装側へ延長する。

## 成果物

1. **`guide audit mask --game <bundle-dir> --scan <path>... [--format json|md] [--fail-on hit|none]`**
   - 走査対象 (拡張子で判定、manifest の `audit.scan` で上書き可): UI 文字列・ローカライズ表 (`.json`, `.csv`, `.po`, `.resx`, `.yaml`)、ネットワーク応答のスキーマ (`.json` の schema、`.proto`、`.ts`/`.d.ts` の型定義)、ログ出力・セーブ形式 (`.ts`, `.js`, `.cs`, `.cpp`, `.h`, `.json`)。バイナリと `node_modules/`, `dist/`, `.git/` は除外。
   - 検出 3 種:
     - `value-hit`: masked の値 (数値は単位つきで同じ値、文字列は完全一致、ID は `<kind>:<game-id>:<slug>` の slug 部分) が走査対象に現れる。数値は短い整数 (manifest `audit.min_numeric_length`、既定 3 桁未満は対象外) の誤検出を避ける。
     - `key-hit`: manifest の `audit.forbidden_keys[]` (露出禁止キー名、例 `drop_rate`, `rng_seed`) がキー名・フィールド名・プロパティ名として現れる。
     - `undefined-exposure` (warning): 攻略本に無い数値定数が UI 文字列やローカライズ表に直書きされている (「攻略本で境界が未定義の露出候補」)。
   - 誤検出の除外は攻略本側 `audit.allow[]` (パターン + 根拠文 + 決めた人) で宣言する。根拠の無い allow はエラー。
2. **報告形式**: JSON (`{ summary, hits[], warnings[], allowed[] }`、hit は file / line / kind / masked ref / 根拠) と Markdown。Revisor の所見に貼れる短い要約 (件数と上位 10 件) を先頭に置く。
3. **スキーマ**: manifest に `audit` 節を足す (`schema/manifest.schema.json` の拡張。段階 1 の既存フィールドは変えない)。
4. **フィクスチャ**: `tests/fixtures/audit/` に、samples/bestia の masked 値が露出している偽のゲームリポ断片 (UI 文字列 JSON、型定義、ログ行) と、allow で除外される例を置く。
5. **仕様**: `spec/feature/mask-audit.md` (検出規則・除外規則・ゲームリポへの組み込み方: Revisor の登録テストに `guide audit mask ... --fail-on hit` を足す手順)。`spec/domains/*.domain.json` に `src/audit/` の所属を足す。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- フィクスチャで value-hit / key-hit / undefined-exposure がそれぞれ検出され、allow で除外した項目は `allowed[]` に移る (テスト)。
- 短い整数の誤検出が閾値で抑えられる (テスト)。
- `--fail-on hit` で終了コードが非 0、`--fail-on none` で 0 (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-2b-mask-audit`)。`main` を直接編集しない。
- `src/cli/parse-command.ts` 等の共有ファイルへの変更は、自分のサブコマンド登録の最小行に留める。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
