# 段階 5: 意図ズレ検証 + 5H 経路・死亡ヒートマップ + 5P 行動可能性の帯と「良い遊び」の 2 軸

設計正本: `spec/architecture/design.md` §8.3 (意図ズレの検証)、§8.5 (行動可能性の帯と良い遊びの指標)、§14.H (ヒートマップ)、§14.E (ペルソナ)、§11 の段 5 / 5H / 5P。段階 1〜4 と 4D はマージ済み。使う既存部品: `intent/` スキーマ (段階 1)、`guide run --purpose coverage --persona <slug>` と sim アダプタ (段階 3)、リプレイ形式 (段階 2A)、`observations/runs/` と overlay (段階 4)、`observations/human/` (4D)。本 run のコードは `src/verify/` (意図ズレ・帯・2 軸) と `src/render/heatmap/` (描画) に閉じる。本段は単独 run。

## 成果物

1. **`guide verify intent --game <bundle-dir> --runs <dir|files...> [--persona <slug>] [--json]`**
   - `coverage` 実走 (`purpose: coverage`、必要なら `human` も含める) を `intent/<stage>.json` と突き合わせ、意図ごとに分類する: `一致` / `面白いズレ` (候補) / `望ましくないズレ` / `不可能`。判定規則は §8.3 の表のとおり (`route` は経路一致、`teach` は定石の使用、`time` は範囲内、`forbid` は領域侵入、`不可能` は `teach` / `route` を再現した run が 0 本)。
   - `allowed_divergences` に一致するズレは再報告しない (run / 定石 / 経路の署名で照合)。
   - 「面白い」は人間が決める: ツールは候補を出すだけ。候補には人間が判定を書く欄 (`decision: allow|reject|pending`、`decided_by`、`note`) を持つ `observations/divergences.json` を作り、`guide verify intent --accept <id> --by <name>` で `allowed_divergences` へ移す (正本 `intent/` の更新はこのコマンドだけ。それ以外は正本を触らない)。許容された手に対応する `learned` 定石は `authored` へ昇格候補として報告する (自動昇格しない)。
   - レポート (JSON + Markdown): 意図ごとの到達可否、使われた定石、想定との時間差、未使用の仕組み (攻略本にあるのに 1 度も使われなかった rule / skill)、経路の地図重ね書き (5H)。
2. **5P 行動可能性の帯** `feasibility/<stage-slug>.json` (スキーマ `schema/feasibility.schema.json`):
   - ステージ × 解法 (定石列と経路のまとまり。クラスタ化は決定的な規則: 同じ定石 ID 列 + 同じ地図ノード列の前方一致) × ペルソナで、`feasible` / `extreme` / `illusory` / `impossible` を付ける。閾値は manifest `feasibility.thresholds` (無ければ既定値を spec に明記)。
   - `illusory` の判定: `player` 書き出しの情報から候補として生成される (段階 3 のエンジンの候補生成を `--dry-run` で呼ぶか、同じ関数を使う) のに成功 0。`intent` の `illusory_by_design` を尊重して別扱いにする。
   - `omniscient` の run は帯を決めない (無視し、件数だけ報告)。
   - **良い遊びの 2 軸**: ステージ・ペルソナ別に `breadth` (成功した解法クラスタ数、`illusory` を数えない) と `confusion_depth` (成功までの失敗候補数 + 滞留 + 意図経路からの逸脱距離、`illusory` に費やした試行は重み付き)。`intent` の `design_stance` (`open` / `refined` / `mixed`、無ければ `unspecified`) に対して評価し、`refined` 未宣言で解法が 1 つに収束していたら「収束」として **良い悪いを言わずに** 報告する。洗練化を推奨する文言を出さない。
   - `guide report feasibility --game <bundle-dir> [--json]`: 帯の一覧、2 軸の散布 (ペルソナ別)、`illusory` を最優先に並べる。
3. **5H ヒートマップ** `src/render/heatmap/`: `coverage` 実走 (と人間 run) の経路を地図ノード単位で集計 (到達回数・死亡回数・滞留時間) し、SVG で描く (grid は格子、navgraph はノード円 + 辺、zones は領域矩形)。`intent` の `route` / `forbid` を重ね書き。ペルソナ別、人間 vs オートプレイヤーの並置。`render` のステージ節と意図ズレレポートに埋め込む (SVG ファイル + Markdown からの参照)。2 軸の散布図も同じ描画器で SVG に出す。依存ライブラリは足さない (文字列組み立て)。
4. **フィクスチャ**: samples/bestia の intent を拡張 (route / teach / time / forbid を 1 つずつ、`design_stance`)、手書きの coverage run (一致 / 別解 / forbid 侵入 / teach 未使用 / omniscient 混入) と期待レポート。想定解法を封じた run 集合で「不可能」が出ること。
5. **仕様**: `spec/feature/intent-verify.md` (分類規則、許容の保存、帯の閾値と既定値、2 軸の定義、design_stance の扱い、ヒートマップの形式)。`spec/domains/*.domain.json` に `src/verify/`, `src/render/heatmap/` の所属を足す (`(^|/)` 形式)。Augur 契約 ID は **C-50 番台**。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- フィクスチャで 4 分類がそれぞれ出る。`--accept` 後は同じズレが再報告されない (テスト)。
- `omniscient` run は帯にも分類にも使われない (テスト)。
- `illusory` が候補生成 + 成功 0 の条件でだけ付く (テスト)。
- `refined` 未宣言の収束が「収束」として出て、推奨文言を含まない (テスト: 文字列検索)。
- SVG が well-formed (簡易パース) で、`forbid` 領域と経路の要素を含む (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-5-intent-verify`)。`main` を直接編集しない。
- CLI 登録は既存系統の並記に倣う (単独 run なので衝突はない)。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
- 不明点は推測で埋めず、報告に「仮定」として書く。
