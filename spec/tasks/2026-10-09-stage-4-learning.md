# 段階 4: 学習ループ (reflect・learn ingest / consolidate・定石の効率書き換え・オーバーレイ・境界の昇格候補)

設計正本: `spec/architecture/design.md` §1 原則 5、§4.4 (tactic の metrics / superseded_by、manifest の learning.policy、observation)、§7.5 (reflect)、§8.1〜8.2、§8.4、§11 の段 4。段階 1〜3 (スキーマ・取り込み・リプレイ・監査・エンジン) はマージ済み。段階 3 の `src/engine/` (utility-bt、driver、sim アダプタ、guide run / bench) と `src/replay/` (記録形式) をそのまま使う。4D (人間プレイログ) は別 run が同時に進めるので `src/import/plays/` と `observations/human/` の扱いには触らない。本 run のコードは `src/learn/` と `src/engine/reflect/` に閉じる。

## 成果物

1. **reflect** `src/engine/reflect/`: ドライバの 1 ティックの最後に、進行中の定石の `expect` と観測を比べ、差分を `observations/runs/<run-id>.jsonl` (§4.4 の 1 行形式、段階 1 の `observation.schema.json`) に追記する。種類: `mismatch` (期待と違う)、`unknown-entity` (攻略本に無い entity: `render_signature` か識別子で雛形を起こす材料)、`tactic-outcome` (定石の開始 / 成功 / 失敗、所要ティック、消費資源、被ダメージ)、`value-estimate` (与ダメ積算などから推定した値と根拠)。`player` モードの記録に masked が混ざらない (既存の `find-masked-pointers` で検査)。
2. **オーバーレイ** `observations/overlay.json` (スキーマ `schema/overlay.schema.json`): 定石ごとの実測 (runs / success / time_sec の分位 / resource / risk)、考慮項目の重みの微調整、未知 entity の雛形 (`draft: true`、`source.kind: observed`)。エンジンは起動時にオーバーレイを読み、`metrics` を正本の値より優先する (正本は触らない)。
3. **`guide learn ingest --game <bundle-dir> <runs...>`**: run の観測 JSONL を取り込み、オーバーレイを更新し、差分一覧を出す: 値のずれ (正本の値 vs 推定値、件数と一致率)、未知 entity、失敗が続く定石、**効率の良い変種** (同じ `when` に対する `learned` 候補で、`learning.policy.rewrite` の `min_runs` と `min_gain` を満たすもの。合成指標は `metric_weights` で time / resource / risk を合成)。`player` モードの run だけを数える (`omniscient` は無視し、件数を報告する)。
4. **`guide learn consolidate --game <bundle-dir> [--apply]`**: オーバーレイから正本の更新案を JSON パッチ (RFC 6902) と Markdown (旧 → 新、実測比較、根拠 run) で出す。種類:
   - 定石の書き換え: `auto_apply: true` かつ意図に触れない (その定石を `intent` の `teach` が参照しておらず、`forbid` 領域を通らない) 候補は `--apply` で正本へ反映。旧定石は消さず `superseded_by` を付ける。意図に触れるものは「承認待ち」として残す。
   - 境界の昇格候補: `player` run の `value-estimate` が `promotion.discoverable_requires` (player_runs と agreement) を満たした値を `discoverable` 昇格候補にする。**自動反映しない** (人間承認)。`omniscient` の観測は根拠に数えない。
   - 未知 entity の雛形: `entities/<kind>/<slug>.json` の draft を提案 (自動反映しない)。
   - `--apply` は自動反映できる種類だけを書き、何を書いたか・何を残したかを出力する。
5. **探索の混入**: 段階 3 のエンジンで `exploration_rate` に従い探索候補 (定石の変種: 手順の順序入れ替え、条件の緩和、`do` の 1 要素差し替え) を生成していることを確認し、不足なら `src/engine/` の探索候補生成を補う (他 run と衝突しない範囲)。変種には `learned` と由来 (元の定石 ID と変異の種類) を付ける。
6. **サンプルとフィクスチャ**: samples/bestia の値をわざとずらしたバンドル (`tests/fixtures/learn/drifted/`) と、手書きの run 観測 (ずれ検出用 / 効率の良い変種用 / 昇格用 / omniscient 混入用)。
7. **仕様**: `spec/feature/learning.md` (観測の種類、オーバーレイ、ingest の差分、consolidate の種類と自動反映規則)。`spec/domains/*.domain.json` に `src/learn/`, `src/engine/reflect/` の所属を足す (`(^|/)` 形式)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- ずらしたバンドル + run 観測で、値のずれが検出され、正本は変わらない (テスト)。
- 効率の良い変種が `min_runs` / `min_gain` を満たしたときだけ書き換え候補になり、`--apply` で `superseded_by` 付きで反映される。閾値未満なら反映されない (テスト)。
- 意図の `teach` が参照する定石は `auto_apply` でも自動反映されず承認待ちになる (テスト)。
- `omniscient` の run は昇格根拠に数えられない (テスト)。
- `player` run の observations に masked が無い (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-4-learning`)。`main` を直接編集しない。
- 4D run と同時進行。**共有ファイル** (`src/cli/parse-command.ts`, `src/cli/run-cli.ts`, `src/cli/cli-io.ts`, `src/cli/main.ts`, `augur.contracts.json`) への追加は自分の分の最小行に留め、Augur 契約 ID は **C-30 番台** を使う (4D は C-40 番台)。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
- 不明点は推測で埋めず、報告に「仮定」として書く。

## 実装記録 (PR 説明)

Actio タスク: `actio:d7e96340-f8ed-407c-a864-7c2505a11b9d`。仕様は `spec/feature/learning.md`。

### 変更した境界

- CLI: `guide learn ingest --game <bundle> <runs...> [--json]` と `guide learn consolidate --game <bundle> [--apply] [--json]` を追加。`guide run` に `--observe <observations.jsonl>` を追加 (無指定なら従来どおり)。
- `guide run` / `guide bench` は、バンドルに `observations/overlay.json` があれば起動時にメモリ上で適用する (実測 metrics の優先、書き換え候補を learned 定石として追加、重みの係数)。オーバーレイが無いバンドルの挙動は変わらない。
- `CliIo` に任意の `learnIo` (ファイルの読み込み・スキーマレジストリ) を追加。共有ファイル (`src/cli/parse-command.ts` / `run-cli.ts` / `cli-io.ts` / `main.ts`) への追加は learn の配線だけ。
- エンジン (`src/engine/`): `runDriver` に任意の `reflect` を追加 (毎ティックの行動の後と run の終わり)。`TickOutcome` に `acted` (そのティックに動いたプラン) を追加。
- 探索候補: 変種を「手順の回転」1 種から `reorder` / `relax` / `substitute` の 3 種にした。候補 ID は `variant:<定石 ID>` から `variant:<定石 ID>--<変異>` に変わる。元の定石が保留中の間は変種も出さない (段階 3 の挙動を保つ)。
- スキーマ: `schema/overlay.schema.json` を追加し `overlay` を登録。`schema/observation.schema.json` に任意の `variant` を追加 (既存の行はそのまま有効)。
- 契約 C-30〜C-35 (`augur.contracts.json`、`src/contracts/*.contract.ts`) と注入行。
- domain: `spec/domains/learning.domain.json` を新設 (`src/learn/`、`tests/learn/`、`tests/fixtures/learn/`)。`auto-player` に `src/engine/reflect/` と `tests/engine/reflect/` を明記。
- 正本を書くのは `learn consolidate --apply` の自動反映 (意図に触れない定石の効率書き換え) だけ。旧定石は消さず `superseded_by` を付ける。

### 復旧方法

コミット `feat(stage-4): ...` を revert すれば段階 3 (+ 4D) の状態に戻る。既存のデータ・リプレイの形式は変えていない (observation の `variant` は任意項目の追加だけ)。学習結果を捨てるだけなら、バンドルの `observations/overlay.json` を消せばエンジンは正本だけで動く。`--apply` で書いた定石は、新しい定石ファイルを消し、旧定石の `superseded_by` を `null` に戻せば元に戻る。

### 実施した検証

- `npm install --include=dev && npm run typecheck && npm test`: origin/main (4D) を取り込んだ後で 273 件すべて成功。段階 4 の新規テストは 28 件 (`tests/engine/candidates/tactic-variants.test.ts`、`tests/engine/reflect/*`、`tests/learn/*`)。
- `npm run build` と `node dist/cli/main.js validate samples/bestia` (OK、warning 0)。
- `augur inject check`: applied=32、orphaned=0。`augur contracts report --acceptance`: C-1〜C-35 は全て covered・違反 0。
- 受入条件のテスト:
  - ずらしたバンドル + run 観測で値のずれを検出し、正本は変わらない: `tests/learn/ingest-runs.test.ts` (wire-spider の HP 正本 100 / 推定平均 139.5、一致率 0)、`tests/learn/learn-cli.test.ts` (ingest 前後で正本ファイルが同一)。
  - 効率の良い変種は `min_runs` / `min_gain` を満たしたときだけ書き換え候補になり、`--apply` で `superseded_by` 付きで反映される。閾値未満なら反映されない: `tests/learn/ingest-runs.test.ts`、`tests/learn/plan-consolidation.test.ts`、`tests/learn/learn-cli.test.ts`。
  - 意図の `teach` が参照する定石は `auto_apply` でも承認待ち: `tests/learn/plan-consolidation.test.ts` (kite-wire-spider)。
  - `omniscient` の run は昇格根拠に数えない: `tests/learn/plan-consolidation.test.ts` (player 2 本 + omniscient 2 本では候補にならず、player 3 本で承認待ちの候補)、`tests/learn/ingest-runs.test.ts`。
  - `player` run の observations に masked が無い: `tests/engine/reflect/reflector.test.ts` (sim の player run の全行がスキーマ適合・masked 無し、masked を含む行は書き込み口が拒否)、`tests/learn/learn-cli.test.ts` (`guide run --observe` の出力)。

### 未実施

- sim が `damage-dealt` イベントを出さないため、sim の実走では `value-estimate` が出ない (reflect は慣例どおりのイベントで推定する。テストは手書きのフレームで検証)。sim への追加は段階 3 のリプレイ・ベンチの数値に影響するため本 run では見送った。
- `spec/feature/engine.md` §9 のベンチ実測表 (段階 3 の数値) は、変種を 3 種に広げた後に測り直していない (テストの不等式は成立)。
- `guide replay play --decider utility-bt` はオーバーレイを読まない。オーバーレイを適用した `guide run --record` の記録を再判定すると一致しない場合がある (記録の header にオーバーレイの版が無い)。
- Web 画面での採否 (段階 7)。サービスの起動・起動テスト (常駐サービスの変更は無い)。
- Anatomia による解析はこのリポジトリが Anatomia に未登録 (`unknown project`) で使えなかったため、再利用探索は grep と既存コードの読解で行った。

### 再利用探索の採否

- 採用: `checkExpect` (reflect の期待判定をエンジンと同一に)、`findMaskedPointers` (観測行の masked 検査)、`toPlayerView` (reflect の世界)、`tacticCandidate` / `matchCondition` (変種候補)、`ReplayLineWriter` / `createReplayFileWriter` (観測ファイルの追記、既存ファイルの拒否)、`FileChange` / `toFileOperations` / `serializeDocument` (consolidate の書き出し)、`classifyPath` / `SCHEMA_OF_KIND` / スキーマレジストリ (書く前の検査)、`writeOutputFiles`。
- 不採用: `src/bench/summarize-bench.ts` の中央値は非公開で p50 しか出さないため、p50 / p90 の分位数を `src/learn/stats/quantile.ts` に別に置いた。`src/import/plan/assert-changes-valid.ts` は ImportError と import 向けの文言を返すため、consolidate 用の検査を `apply-proposals.ts` に持った。`diff-documents.ts` は dry-run 表示用の差分で RFC 6902 ではないため、JSON Patch は `src/learn/patch/json-patch.ts` に実装した。

### 仮定

- `rewrite.min_runs` は試行 (判定の出た定石の実行) の数として数える (設計 §8.2「min_runs 以上の試行」)。
- 合成ゲインには成功率を入れず、変種の成功率が元の定石以上であることを別条件にした (効率のために確実さを落とさない)。
- 「同じ when に対する learned 候補」は、同じ元の定石から作った変種と解釈した (relax は `when` を緩めるが、同じ状況への別案として比べる)。
- 被ダメは HP バーの比 (満タン = 100) で測る。正体不明の未知 entity は敵として雛形を起こす。
- 考慮項目の重みの微調整は、探索の重みを変種の勝ち負けで 0.8〜1.2 倍する規則に限った。
- 昇格の一致は、run ごとの推定の平均が正本の値から 5% 以内。
