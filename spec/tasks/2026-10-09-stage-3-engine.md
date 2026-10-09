# 段階 3: export・判断エンジン (Utility + BT)・アダプタ契約・模擬アダプタ・ペルソナ (3E)

設計正本: `spec/architecture/design.md` §7 (オートプレイヤー全体)、§7.2〜7.6、§4.4 の tactic / manifest 例、§14.A (リプレイ) と §14.E (ペルソナ)、§11 の段 3 と 3E。段階 1 / 2 / 2A / 2B はマージ済み。特に `src/replay/decider.ts` の `Decider` 契約 (観測 → 判断候補 + 行動、決定的) を **そのまま実装する** こと。`src/bundle/player-view.ts` の `toPlayerView` が masked を落とす既存の正本。

Bestia 本体 (C++、別リポ) 側の改修は本段ではやらない。本段は Commentarii 側の **エンジン・契約・模擬アダプタ** までで、Bestia 実機アダプタは次の run (Bestia リポ側 PR) に回す。

## 成果物

1. **`guide export <bundle-dir> --out <dir> [--knowledge player|full] [--target runtime]`**
   - `bundle.json` (全文書を 1 ファイルに結合した索引つき) を書く。既定 `player` は `toPlayerView` を通し、`masked` が 1 つも含まれないことをテストで保証する。`full` は内部用。
   - 索引: entity / tactic / rule / state / intent の ID → 位置、`render_signature` → entity ID の逆引き、ステージ → 地図ノードの隣接表。
2. **判断エンジン** `src/engine/` (ゲーム非依存、純関数中心):
   - `Decider` 実装 `utility-bt` (登録 ID。`src/replay/decider-registry.ts` に登録)。
   - **候補生成**: `when` が成り立つ定石 (観測との照合は `src/engine/match/` に分離: entity の可視・距離・状態、self の資源・スキル準備など、§4.4 の `when` 語彙を全部) + 汎用行動 (生存 / 目標接近 / 資源確保) + 探索候補 (未試行の定石、定石の変種)。`draft: true` の定石と `knowledge: masked` の定石は `player` モードでは候補にしない。
   - **効用**: 考慮項目 (距離、HP 比、残り時間、資源、`confidence`、`metrics`、意図の注記、探索ボーナス) を 0〜1 に正規化した値の重み付き合成。重みは **ペルソナ** (後述) と manifest から来る。計算は `src/engine/utility/` に考慮項目ごと 1 ファイル。
   - **継続 / 切替**: 直前の定石の BT が進行中なら継続に加点 (ヒステリシス値は設定)。`expect` が破れたら即再評価。
   - **BT 実行器** `src/engine/bt/`: Selector / Sequence / Condition / Action の 4 種。定石の `do` 配列をサブツリーに展開する組立器と、ティックごとに 1 歩進める実行器 (状態は明示的なオブジェクトで持ち、グローバルを使わない)。葉は抽象アクション (`move_to` / `attack` / `use_item` / `use_skill` / `wait` / `interact` / `custom`)。
   - **判断ログ**: `DecisionEntry[]` に全候補と効用値、選ばれたものを入れる (リプレイの `decision` 列に載る)。
   - 乱数は seed 付きの自前 PRNG (`src/engine/rng.ts`) だけを使う。同じ seed と観測列で同じ判断 (リプレイの `play` で検証)。
3. **ペルソナ (3E)** `personas/<slug>.json` (スキーマ `schema/persona.schema.json`): 考慮項目の重み、探索率、反応遅延 (ティック)、誤操作率、使う定石の `confidence` 下限。同梱: `novice` / `expert` / `explorer` の 3 つ (ゲーム非依存)。バンドル内 `personas/` にゲーム固有を置けること (同名はバンドル側が勝つ)。エンジンは `--persona <slug>` で重みを切り替える。
4. **アダプタ契約** `src/adapter/`:
   - TypeScript インターフェース: `observe(): ObservationFrame`、`act(action)`、`identify(gameEntity)`、ティック駆動 (`run(decider, options)` のループはエンジン側のドライバ `src/engine/driver.ts` に置き、アダプタは観測と行動だけ)。`mode` (`player` / `omniscient`) をアダプタに渡し、`player` では masked 値を観測に出さない責務をアダプタに課す (ドライバ側でも `find-masked-pointers` で二重に検査し、見つけたら停止)。
   - **プロセス分離プロトコル** (JSON Lines、stdin/stdout): `hello` (game_id, adapter_id, mode) → `observation` 行 ↔ `action` 行 → `bye`。`spec/feature/adapter-protocol.md` に書き、C++ 側の最小ヘッダ `adapter/cpp/commentarii_adapter.hpp` (構造体と JSON 行の読み書きの宣言だけ、依存ライブラリ無し、ビルドはしない) を同梱する。
5. **模擬アダプタ** `src/adapters/sim/`: バンドルの地図・entity・状態機械・ルールだけで動く小さな決定的シミュレータ (グリッド上を動く自分と敵、ルールの式でダメージ計算、状態機械でフェーズ遷移)。テストとベンチ用。`samples/bestia` で走ること。
6. **`guide run --game <bundle-dir> --adapter sim|stdio --persona <slug> --mode player|omniscient --purpose efficiency|coverage --seed <n> --ticks <n> --record <out.jsonl>`**: ドライバを回し、リプレイ (段階 2A の形式) を記録する。
7. **ベンチの最小形** `guide bench --game <bundle-dir> --runs N --persona <slug> --seed <n>`: sim アダプタで N 回走らせ、クリア率・時間・被ダメージ・使われた定石の分布を JSON で出す (§14.C の土台。閾値比較は段階 5C)。
8. **仕様**: `spec/feature/engine.md` (候補生成・効用・BT・決定性・ペルソナ)、`spec/feature/adapter-protocol.md`。`spec/domains/*.domain.json` に `src/engine/`, `src/adapter/`, `src/adapters/sim/` の所属を足す (`(^|/)` 形式)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- `export --knowledge player` の出力に masked が 1 つも無い (テスト)。
- 同じ seed・同じ観測列で判断が一致する (`guide replay play --decider utility-bt` で記録した run が一致、テスト)。
- `player` モードで `masked` / `draft` の定石が候補に出ない (テスト)。
- 攻略本の定石を全部外した状態 (汎用行動のみ) でも sim で走り切り、定石ありの方が samples/bestia のベンチでクリア率か時間が良い (テストで比較、閾値は緩くてよい)。
- `novice` / `expert` / `explorer` で判断の分布が変わる (テスト: 探索候補の採用率の差)。
- ドライバが `player` モードの観測に masked を見つけたら停止する (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-3-engine`)。`main` を直接編集しない。
- 他 run は同時に走らない (本段は単独)。CLI の登録は既存 3 系統 (replay / import / audit) の並記に倣う。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
- 不明点は推測で埋めず、報告に「仮定」として書く。
