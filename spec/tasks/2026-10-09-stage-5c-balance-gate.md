# 段階 5C: バランス回帰ゲート

設計正本: `spec/architecture/design.md` §14.C (バランス回帰ゲート)、§8.3 (意図ズレ)、§14.A (リプレイ)、§11 の 5C 行。段階 1〜5 はマージ済み。使う既存部品: `guide bench` (段階 3、sim アダプタで N 回走らせ、クリア率・時間・被ダメージ・定石分布を出す)、リプレイ `play` (段階 2A)、`verify intent` の分類 (段階 5)。5K (Praeforma 連携) は別 run が同時に進めるので `src/verify/pf-*` と `intent` のシーン ID 項目には触らない。本 run のコードは `src/bench/` (既存を拡張) と `src/gate/` に閉じる。Augur 契約 ID は **C-60 番台** (5K は C-70 番台)。

## 成果物

1. **ベンチ結果の保存と比較** `guide bench --game <bundle-dir> --runs N --persona <slug> --seed <n> --save bench/<label>.json` と `guide bench compare <base.json> <head.json> [--thresholds <manifest>] [--json|--md]`:
   - 保存形式 (スキーマ `schema/bench-result.schema.json`): ゲーム ID、バンドル版、エンジン版、seed、ペルソナ、run 数、ステージごとの クリア率・時間 (p50/p90)・被ダメージ (p50)・使われた定石の分布・意図ズレの分類件数 (段階 5 の結果を含める)。固有名を入れない。
   - 比較: 指標ごとの差分と、manifest `bench.thresholds` (例 `clear_rate_drop: 0.1`, `time_p50_increase: 0.2`, `new_undesired_divergence: 1`) を超えたものを「体験ブロック候補」として列挙。閾値が無ければ既定値を spec に明記。
2. **CI 向け短縮版** `guide bench replay --game <bundle-dir> --runs <recorded-dir>`: 記録済みリプレイを現在のエンジンと攻略本で再判定し (段階 2A の `play` を使う)、判断の一致率と分岐した run の一覧を出す。実走を伴わないので速い。CI の既定はこちら、実走は `--live`。
3. **ゲートの出力** `guide gate balance --game <bundle-dir> --base <base.json> --head <head.json> [--fail-on block|none]`: Revisor の審査に貼れる JSON + Markdown (先頭に要約、体験ブロック候補、根拠の run)。`--fail-on block` で候補があれば非 0。
4. **ゲームリポへの組み込み手順** `spec/feature/balance-gate.md`: Revisor の登録テストに `guide bench replay` を足す手順、夜間の `--live` の回し方、`bench/` の置き場所 (ゲームリポ側 `guide/<game-id>/bench/`)、閾値の決め方。
5. **フィクスチャ**: samples/bestia で base / head の結果 JSON (head は定石を 1 つ弱くした版) と、閾値越えが検出される期待出力。
6. `spec/domains/*.domain.json` に `src/gate/` の所属を足す (`(^|/)` 形式)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- 閾値を超えた指標だけが候補になり、`--fail-on block` で非 0、`--fail-on none` で 0 (テスト)。
- `bench replay` が記録済み run で一致率を出し、分岐 run を列挙する (テスト)。
- 結果 JSON に固有名・パスが無い (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-5c-balance-gate`)。`main` を直接編集しない。
- 5K run と同時進行。共有ファイル (`src/cli/*`, `augur.contracts.json`) への追加は自分の分の最小行に留める。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
