# 段階 2: 取り込み (import masters / import map / import spec / intent import)

設計正本: `spec/architecture/design.md` §4 (データモデル)、§5 (知識境界)、§6 (ツクールのコマンド表)、§11 段階 2。段階 1 (スキーマ・ローダ・validate・render・report) はマージ済み (`src/` を読んで既存の責務分担に従う)。段階 2A (リプレイ) と 2B (マスク監査) は別 run が同時に進めるので、それらのディレクトリ (`src/replay/`, `src/audit/`) には触らない。

## 成果物

1. **`guide import masters --game <bundle-dir> --from <path> --map <mapping.json>`**
   - 入力: CSV (ヘッダ行あり、UTF-8)、JSON (配列)、SQLite (テーブル名を mapping で指定。Node 24 の `node:sqlite` を使い、依存を足さない)。
   - mapping はゲームごとに 1 ファイル。列 → entity の種別 / `id` の slug / stats のキー / 単位 / `knowledge` の初期値 (省略時 **`masked`**、第一原則) / `render_signature` の列 を宣言する。mapping 自体にもスキーマを付ける (`schema/mapping.schema.json`)。
   - 出力: `entities/<kind>/<slug>.json` と、`masked` の値だけを `entities/<kind>/<slug>.masked.json` に分けて書く。`source` は `{ kind: "master", ref: "<ファイル名>#row=<n>" }` (SQLite は `#rowid=`)。
   - 再実行可能: 既存ファイルがあれば `source.kind=master` の値だけ上書きし、`observed` / `human` / `llm-draft` の値と `knowledge` の昇格済み値は保持する (昇格を取り込みで戻さない)。`--dry-run` で差分だけ出す。
2. **`guide import map --game <bundle-dir> --stage <slug> --from <path> --kind grid|navgraph|zones`**
   - grid: 文字の格子 (テキスト) か 2 次元配列 JSON。`mapping` で文字 → 通行可否・注記種別を宣言。セルをノード、4 近傍 (オプションで 8 近傍) をエッジにする。
   - navgraph: ノード配列とエッジ配列の JSON (座標つき)。そのまま正規化。
   - zones: 領域 (多角形か矩形) と隣接の JSON。領域をノード、隣接をエッジにする。
   - 出力は `stages/<slug>/map.json` (段階 1 の `map.schema.json` に適合)。座標系と単位は manifest を参照し、不一致なら失敗。
3. **`guide import spec --game <bundle-dir> --from <md ファイル> --kind rules|states`** と **`guide intent import --game <bundle-dir> --stage <slug> --from <md ファイル>`**
   - LLM で下書きを起こす。LLM 呼び出しは `claude -p` (Anthropic API キーは持たない。Castra のメモリ「Anthropic は claude -p で呼ぶ」に従う) をアダプタ (`src/adapters/llm/`) に閉じ、ドメイン層は「文書 → 下書き JSON」の純関数契約だけを持つ。テストでは LLM アダプタをフェイクに差し替える (実呼び出しをテストに入れない)。
   - 出力は必ず `draft: true`、`source.kind = "llm-draft"`。数値は文書に書かれているものだけ (LLM に推定させない。推定した値は捨てる)。`knowledge` は `masked` 固定。
   - プロンプトはファイル (`prompts/*.md`) に置き、出力は JSON Schema で検証して不適合なら失敗 (リトライ 1 回)。
4. **サンプル**: `samples/bestia` に Bestia の archetype を CSV にしたフィクスチャ (`samples/bestia/masters/archetypes.csv`) と mapping を置き、`import masters` の結果が段階 1 の手書き entity と一致することをテストで確認する。grid の地図サンプル 1 つ (`samples/bestia/masters/ring.grid.txt`)。
5. **仕様の更新**: `spec/feature/import.md` (入力形式・mapping の項目・再実行の規則・draft の扱い)。`spec/domains/*.domain.json` の所属パターンに新ディレクトリ (`src/import/`, `src/adapters/llm/`, `src/adapters/sqlite/`) を足す (Revisor の「未分類」「spec_linkage」所見を増やさない)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- `guide import masters` → `guide validate` が samples/bestia で全項目 OK。masked の列が `.masked.json` にだけ書かれる (テスト)。
- 昇格済み `knowledge` を持つ既存 entity に再取り込みしても昇格が戻らない (テスト)。
- `import map` 3 種がそれぞれ `map.schema.json` に適合する出力を出す (テスト)。
- `import spec` / `intent import` の出力が常に `draft: true` で、数値が文書に無い場合は含まれない (フェイク LLM でテスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証コマンドと結果 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-2-import`)。`main` を直接編集しない。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。Revisor のブロック所見は直して再提出する。
- 不明点は推測で埋めず、報告に「仮定」として書く。
