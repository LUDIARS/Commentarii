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

## 実装記録 (PR 説明)

Actio タスク: `actio:1cf5d580-78b4-45d6-8ab7-918ea345ae4a`。仕様は `spec/feature/intent-verify.md`。

### 変更した境界

- CLI: `guide verify intent --game <bundle> --runs <dir|file>... [--persona <slug>] [--json]`、`guide verify intent --game <bundle> --accept <id> --by <name> [--note <text>]`、`guide report feasibility --game <bundle> [--json]` を追加。共有ファイル (`src/cli/parse-command.ts` / `run-cli.ts` / `cli-io.ts` / `main.ts`) への追加は verify の配線と任意の `verifyIo` だけ。
- `guide render`: `verifyIo` があり `observations/verify/report.json` があるときだけ、ステージの頁にヒートマップ節を足し `stages/<slug>.heatmap.svg` を書く (player view から描くので masked の意図項目は出ない)。無ければ従来と同じ出力。`renderBundle` の options に任意の `stageSections`、`renderStage` に任意の `extra` を追加。
- 書き込み: 検証は overlay 側 (`observations/divergences.json`、`observations/verify/` の report.json / report.md / SVG) と `feasibility/<stage>.json` だけを書く。正本 (`intent/`) を書くのは `--accept` だけで、対象ステージの `allowed_divergences` に 1 件足すだけ。定石は書かない (learned → authored は報告のみ)。
- スキーマ: `schema/divergences.schema.json` と `schema/feasibility.schema.json` を追加しレジストリへ登録。`intent.schema.json` に任意の `design_stance`・`illusory_by_design`、`allowed_divergences` に任意の `intent` / `reason` / `divergence` / `signature` を追加。`manifest.schema.json` に任意の `feasibility.thresholds`。既存の文書はそのまま有効。
- bundle loader: `feasibility/` を無視する接頭辞に追加 (派生データ。V01 の misplaced にならない)。
- サンプル: `samples/bestia/intent/dome-arena.json` に `design_stance: "open"` を追加 (route / teach / time / forbid は元から 1 つずつ)。
- 契約 C-50〜C-56 (`augur.contracts.json`、`src/contracts/*.contract.ts`) と注入行。
- domain: `spec/domains/intent-verify.domain.json` を新設 (`src/verify/`、`src/render/heatmap/`、`tests/verify/`、`tests/fixtures/verify/`、`spec/feature/intent-verify.md`)。

### 復旧方法

コミット `feat(stage-5): ...` を revert すれば段階 4 (+4D) の状態に戻る。追加したスキーマ項目は全て任意なので、revert 前に書かれた intent に `design_stance` / `allowed_divergences[].signature` 等が残っていると旧スキーマでは V01 になる。その場合は該当項目を消す。検証結果だけを捨てるなら、バンドルの `observations/divergences.json`・`observations/verify/`・`feasibility/` を消せばよい (どれも正本ではない)。`--accept` で足した許容は、intent の `allowed_divergences` から該当項目 (`divergence` が ID) を消せば元に戻る。

### 実施した検証

- `npm install --include=dev && npm run typecheck && npm test`: 302 件すべて成功 (段階 5 の新規テストは 29 件: `tests/verify/*.test.ts`)。
- `npm run build` 後、サンプルのコピーで `verify intent` → `--accept` → 再検証 → `validate` (OK、warning 0) → `render` → `report feasibility` を手で通した。
- `augur inject check`: applied=39、orphaned=0。`augur contracts report --acceptance` (テスト実行のログ): C-1〜C-56 の 39 件すべて covered・違反 0。
- 受入条件のテスト:
  - 4 分類がそれぞれ出る: `tests/verify/classify-intents.test.ts` (主フィクスチャで route = 面白いズレ、teach = 望ましくないズレ、time = 一致、forbid = 望ましくないズレ。想定解法を封じた `runs-sealed` で route / teach = 不可能)。
  - `--accept` 後は同じズレを再報告しない: `tests/verify/verify-cli.test.ts` (accept → 再検証で ID が出ず route が一致に戻る、divergences.json の allow と note が残る、2 度目の accept は変更なし)、`classify-intents.test.ts` (ID / run / 署名の各照合)。
  - `omniscient` は帯にも分類にも使わない: `classify-intents.test.ts`、`feasibility.test.ts` (fixture の omniscient run が counted・根拠・解法に現れない)、`verify-cli.test.ts`。
  - `illusory` は候補生成 + 成功 0 のときだけ: `feasibility.test.ts` (kite の `when` が成り立つフレーム → illusory、成り立たない → impossible、成功あり → feasible、illusory_by_design は別扱い)。
  - `refined` 未宣言の収束が「収束」として出て推奨文言を含まない: `verify-cli.test.ts` (verify と report feasibility の出力を `推奨` / `すべき` / `recommend` / `should` 等で文字列検索)、`feasibility.test.ts` (refined なら convergence false)。
  - SVG が well-formed で forbid と経路の要素を含む: `tests/verify/heatmap.test.ts` (zones / grid / navgraph、散布図、壊れた XML の検出)、`verify-cli.test.ts` (書き出したファイル)。

### 未実施

- 実際の `guide run --purpose coverage --record` による実走ログでの検証 (フィクスチャは手書きのリプレイ)。sim の coverage 実走でも同じ形式なので読めるはずだが、本 run では手で走らせていない。
- 時間の想定差で「上限超過 = 望ましくないズレ」「下限未満 = 面白いズレ」以外 (経済の崩壊・詰み) の検出は、観測に該当する指標が無いため入れていない。
- ヒートマップの zones は位置情報が無いので横 1 列の矩形に並べた (隣接の形は描かない)。
- Web 画面での判定 (段階 7)、Praeforma のシーン ID (段階 5K)、バランス回帰ゲートへの分類変化の掲載 (段階 5C)。サービスの起動・起動テスト (常駐サービスの変更は無い)。
- Anatomia は Commentarii を未登録 (`unknown project`) のため使わず、再利用探索は grep と既存コードの読解で行った。

### 再利用探索の採否

- 採用: `stageVisits` (到達・時間・経路を 4D と同じ規則で)、`tacticCandidates` + `buildEngineWorld(bundle, 'player')` + `EMPTY_RUN_MEMORY` (illusory の「候補として生成される」を段階 3 のエンジンと同じ関数で判定)、`parseReplay` / `replaySchema` (run の読み込み)、`chosenCandidate`、`toPlayerView` (player 地図と render)、`quantile` (到達時間の中央値)、`parseRef`、`document` / `table` (Markdown)、`writeOutputFiles`、スキーマレジストリ。
- 不採用: `classifyPlayRuns` はバンドル内の `observations/human` / `observations/runs` の相対パスで人間 / オートを分け、coverage と efficiency を分けないため、任意パスの `--runs` に合わせて `select-runs.ts` を置いた。`buildPlaysReport` はステージ別の到達率の数表で、ペルソナ別・ノード別の集計を持たないため、到達率だけ同じ考えで `build-stage-report.ts` に持った。SVG は依存を足さない指示のため `src/render/heatmap/svg.ts` の文字列組み立てにした。

### 仮定

- Actio の本文取得 (`/v1/taskflow/tasks/content`) は `actio_unavailable` で失敗した。親がこのブランチにコミットした本ファイル (委託依頼文) を本文として実装した。
- teach は「その定石を選んだ」(判断ログの chosen) で判定し、変種 (`<定石>--<変異>`) は使用に数えない。判断ログの無い人間 run は teach の判定対象から外す。
- route の一致は経路が `path` を順序どおり含むこと (間に他のノードがあってよい)。route の別解・時間の下限未満を面白いズレ、teach 飛ばし・時間超過・forbid 侵入を望ましくないズレとした。
- 帯の `extreme` は「成功はあるが feasible の条件を満たさない」とした (設計の「上級者のみ低い成功率」を、ペルソナ別の帯で読み取れる形に一般化)。
- confusion depth の単位を揃えるため、失敗 1 回 = 1、滞留 1 秒 = 0.1 (`stall_weight`)、意図経路外のノード 1 つ = 1 とし、足跡あたりの平均にした。到達した run の最後の区間 (ステージを終えた場所) は滞留に数えない。
- `--persona` 指定時は人間 run を外す (人間はペルソナを持たない)。
