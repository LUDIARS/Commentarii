# 段階 1: 共通スキーマ・validate・render・report knowledge

設計正本: `spec/architecture/design.md` (このリポ)。本タスクは設計 §11 の段階 1。段階 2 以降 (import / export / エンジン / 学習 / 意図検証 / 描画タップ / Web) はやらない。

## 目的

攻略本バンドル (`guide/<game-id>/`) の JSON 正本を、スキーマで検証し、人間向け Markdown に描画し、知識境界 (第一原則) のレポートを出せる状態にする。段階 2 以降が全てこの上に乗る。

## 成果物

1. **共通 JSON Schema** (`schema/` 配下、JSON Schema draft 2020-12):
   - `value.schema.json`: 設計 §4.3 の共通フィールド (`value`, `unit`?, `knowledge` 必須, `source` 必須 (`kind`: master|observed|human|llm-draft, `ref`), `draft`)。`source.kind=llm-draft` なら `draft` は true でなければならない。
   - `manifest`, `glossary`, `entity` (enemies/items/skills/actors 共通 + 種別ごとの追加), `entity.masked` (masked 値だけを許す), `stage`, `map` (kind: grid|navgraph|zones、nodes/edges/annotations), `events`, `rule` (式文字列 + 変数定義 + 値域), `state` (状態機械), `tactic` (when/do/expect/because/knowledge/confidence/metrics/superseded_by), `intent` (intended[] kind: route|teach|time|forbid、allowed_divergences[])、`observation` (§4.4 の 1 行)。
   - ID 形式 `<kind>:<game-id>:<slug>` と `lexicon:<id>` を pattern で縛る。
2. **ローダ**: `guide/<game-id>/` を読み、全ファイルをスキーマ検証したうえでメモリ上のバンドルにする純関数群。ファイル I/O はアダプタに分離 (後で Web 画面からも使う)。
3. **`guide validate <bundle-dir>`**: 固定リストの検査項目を全部実行し、項目 ID 付きで結果を出す (JSON と人間向けテキスト)。検査項目 (1 項目 1 テスト):
   - V01 スキーマ違反
   - V02 参照整合 (entity / rule / state / tactic / intent / node が指す ID が存在する)
   - V03 `.masked.json` 以外に `knowledge: masked` が無い
   - V04 `.masked.json` に `masked` 以外が無い
   - V05 `knowledge` 無しの値が無い (スキーマ必須だが、ネストした全ての値を走査して確認する)
   - V06 `source` 無しの値が無い
   - V07 `llm-draft` なのに `draft: false`
   - V08 ルールの式が評価できる (変数定義と値域の例で 1 回評価)。式の評価は安全な小さな評価器 (四則 + `min`/`max`/`floor`/`ceil`/`abs`/`clamp`、`eval` や `Function` は使わない)
   - V09 単位の整合 (同じ stat 名で単位が揃っている)
   - V10 定石の `knowledge` が参照先の最も厳しい値と一致する (伝播規則)
   - V11 カバレッジ警告 (敵に状態機械が無い、ステージに意図が無い) は warning
   - V12 intent の `tactic` / `area` / `path` の参照が存在する
4. **`guide render <bundle-dir> --out <dir>`**: 生成 Markdown。敵図鑑表、アイテム/スキル表、ステージ (目標・出現表)、地図 (grid は ASCII、navgraph は Mermaid、zones は隣接表)、ルール (式と検算例)、状態機械 (Mermaid stateDiagram)、定石一覧 (実測つき)、意図一覧、知識境界レポート。`masked` の値は render に出さない (既定)。`--knowledge full` で masked も別節に出す。
5. **`guide report knowledge <bundle-dir>`**: エンティティ別の `shown` / `discoverable` / `masked` の件数と割合、根拠 (`source`) の無い `shown`/`discoverable`、`masked` を参照する定石の一覧。JSON と Markdown。
6. **サンプルバンドル** `samples/bestia/` (public ゲーム Bestia の archetype を手で起こした最小バンドル: 敵 3 種、ステージ 1、ルール 2、状態機械 1、定石 2、意図 1、masked ファイル 1)。全検査を通ること。KonbiniDominant など private ゲームの固有名は入れない。
7. **サービス受入条件** (Castra の service-bootstrap 契約): `excubitor.bootstrap.json` (`setup`: `scripts/site/setup.mjs`、`data.export` / `data.import`)。setup は依存導入 + typecheck。export/import はデータを持たないので「明示した空の形式」(所有サービス ID と形式版を含む JSON 1 ファイル) を書く/検証する。import は `--input` と `--sha256` を検証する。`npm run dev` は `/health` だけ返す最小 HTTP (port は `COMMENTARII_PORT`、既定 4410、127.0.0.1) を起動する (Web 画面は段階 7)。
8. **README** の更新 (CLI の使い方、サンプルの実行例)。

## 技術

- Node 24、TypeScript。実行は `node --experimental-strip-types` ではなく `tsc` でビルドして `dist/` を実行する (Revisor の test に `npm run typecheck` と `npm test` がある)。
- `package.json` scripts: `build` (tsc), `typecheck` (tsc --noEmit), `test` (node --test で `tests/**/*.test.ts` をビルド後に実行、または tsx 不要の方法), `dev` (health サーバ), `guide` (CLI)。bin: `guide`。
- 依存は最小: JSON Schema 検証に `ajv` (+ `ajv-formats`)、dev に `typescript` と `@types/node`。他は足さない。
- 構成 (SRP、1 ファイル 1 責務): `src/domain/` (値・知識境界・ID・式評価の純関数)、`src/schema/` (スキーマ読み込み・検証)、`src/bundle/` (ローダ)、`src/validate/` (検査項目を 1 ファイル 1 項目)、`src/render/` (Markdown 生成を種類ごと)、`src/report/`、`src/cli/`、`src/adapters/fs/`。`tests/` は `src/` と対で置く。
- `coding-conventions` (Castra `.claude/skills/coding-conventions/SKILL.md`) に従う。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- `node dist/cli/main.js validate samples/bestia` が全項目 OK。
- 意図的に壊したフィクスチャ (`tests/fixtures/broken/*`) で V01〜V12 がそれぞれ検出される (各 1 テスト)。
- `render` の出力に `masked` の値が含まれない (テストで文字列検索)。
- `report knowledge` の JSON がサンプルの件数と一致する。
- PR 説明に: 変更した境界 / 復旧方法 (dist 削除と再ビルド) / 実施した検証コマンドと結果 / 未実施 を書く。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-1-schema-validate-render`) を使う。`main` を直接編集しない。
- ビルドとテストはフォアグラウンドで待つ (バックグラウンド待ちにしない)。
- 完了は: コミット → Revisor local PR 提出 (Concordia 経由、`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>` か Cc の `/v1/prs/local`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。
- 不明点は推測で埋めず、報告に「仮定」として書く。
