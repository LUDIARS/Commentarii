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
