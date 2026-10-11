# 段階 R1: ルールブック (mechanics/) + 前向きモデル + アフォーダンス

設計正本: `spec/architecture/design.md` §16 (特に §16.3 ルールブック、§16.4 アフォーダンス、§16.8 の R1 行)。§4.3 (共通フィールド)、§5 (知識境界)、§7.2 (Observation)、§7.6 (`player` / `omniscient`) が前提。段階 1〜5 (+5C/5K) はマージ済み。本 run のコードは `src/domain/expression/` (拡張)、`src/rulebook/` (新設)、`schema/` (追加)、`samples/bestia/mechanics/` に閉じる。Augur 契約 ID は **C-100 番台**。並行して段 6 (描画タップ、`src/render-tap/`・`src/adapters/render-tap/`) が別 run で進むので、そこには触らない。

neco の指示 (2026-10-11): 「オートプレイヤーは BT、FSM、Utility AI および GOAP、MCTS などの行動選択 AI の判断系アルゴリズムを理解しており、それを決定するためのベースのルール / メカニクス (仕様) をデータとして持つ。攻略法については仕様に依存せず自分で行動し、能力的にできる事を判断・解釈して行動する。」本段はその「ルール / メカニクスをデータとして持つ」部分と「能力的にできること」の列挙を作る。判断方式 (R2) と方式選択・自律構え (R3) は後続段。

## 成果物

1. **式言語の拡張** (`src/domain/expression/`): 比較 (`< <= == != >= >`)、論理 (`&& || !`、短絡評価)、`if(c, a, b)`、状態参照関数の差し込み口 (評価文脈から関数を渡す: `dist(a, b)` / `ready(skillId)` / 変数参照 `<var>(<owner>)` / `rule(<ruleId>)` / パラメータ `$name`)。真偽値は 1 / 0。**既存の rule の評価結果は 1 件も変えない** (既存テストと samples の全 rule の example 評価で確認)。式の静的検査 (未知の関数・変数・パラメータ) を validate に足す。
2. **スキーマ** (`schema/`): `variables.schema.json`、`action.schema.json`、`behavior.schema.json`、`objectives.schema.json`。`state.schema.json` の遷移に任意の `when` (式) を追加 (`on` は人間向けに残す)。全要素が `knowledge` / `source` を持つ (§4.3)。`masked` の要素・効果・確率は既存と同じく `.masked.json` に分離 (§5)。
   - 行動の型: `id`, `name`, `actor` (`self` | `entity:<filter>`), `maps_to` (§7.3 の抽象アクションへの対応), `params`, `pre`, `effects[]` (`p` 任意、合計 1、`set` は `変数参照 → 式`), `cost` (`time`, `resource`), `cooldown`, `duration` 任意。
   - 挙動モデル: `paradigm` (`fsm` | `bt` | `utility` | `goap` | `scripted`) と方式ごとの記述 (fsm=states 参照 + when、bt=ノード木 (Selector/Sequence/Condition/Action、葉は action ID)、utility=考慮項目 (式) と重み、goap=目標述語と使う action ID、scripted=時刻 → action)。解釈器は R2 なので、本段はスキーマと validate と render まで。
   - 目標: `win` / `lose` / `subgoals[]` を式 (述語) で。ステージの `stage.json` で上書き可。
3. **validate** に検査項目を追加 (1 項目 1 テスト、`spec/` の検査項目リストにも追記): 式の構文、未知の参照、確率の合計、`maps_to` の抽象アクションが §7.3 の語彙か `custom` 宣言済みか、`masked` の分離、`knowledge` の伝播 (masked の変数を参照する action は masked 以上)、挙動モデルの参照切れ。
4. **render**: ルールブックの節 (変数表、行動の型の表、前提と効果の式、挙動モデルの図 = FSM は Mermaid stateDiagram、BT はインデント木、目標)。知識境界レポートにルールブックを含める。
5. **`src/rulebook/`** (SRP で分割):
   - `load-rulebook`: バンドルから読み、`mode` (`player` / `omniscient`) に応じて masked を除いた **見える分のルールブック** を作る。除いた箇所は「不明」として残す (存在だけは分かる値と、存在も知らない値を区別: `discoverable` で未観測 = 不明、`masked` = player では存在しない)。
   - `belief-state`: 観測 (§7.2) + ルールブックの変数宣言から信念状態を作る。不明値は値域つきの「不明」。
   - `forward-model`: `simulate(belief, action, params, rng?)` → 次の状態。確率的効果は (a) seed からのサンプル (決定的) と (b) 期待値 / 分岐列挙の両方。不明値に依存する効果は結果を「不明」として返す。クールダウン・資源・時間を進める。
   - `affordances`: 自分の行動の型を、今 `pre` が成り立つ (確定) / 不明値のため成否不明 (要実験) / 1〜2 手先に成り立つ (後ろ向き探索) / 成り立たない (理由つき) に分類。
6. **samples/bestia のルールブック**: Bestia の既存資料 (samples/bestia の entities / mechanics / sim アダプタの規則 `src/adapters/sim/sim-rules.ts`) から、変数・行動の型 (移動、攻撃、回避、後退、リングへ戻る、相当)・`battle-ai` の挙動モデル (fsm、遷移に when)・目標。少なくとも 1 つの効果を `masked` にして、player 側で不明になることをテストで示す。
7. `spec/feature/rulebook.md` (公開契約: 式言語の文法、各ファイルの形、knowledge の扱い、前向きモデルの意味論)。`spec/domains/rulebook.domain.json` (新設、pathPattern は `(^|/)src/rulebook/` 形式で書く。`^src/` は不可)。README に節を追加。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- 既存 rule の評価が変わらない (全 sample rule の example 評価が変更前と一致するテスト)。
- 新しい validate 項目がそれぞれ 1 テストで違反を検出する。
- `player` で読んだルールブックと前向きモデルに masked の行動・効果・確率が入らない (テスト)。`omniscient` では入る。
- Bestia の sim で、観測 → 信念状態 → 前向きモデルで 1 ステップ予測した結果が、sim の実際の次の観測と一致する (決定的効果のもの。確率的なものは分布の台が一致) (テスト)。
- アフォーダンスが 4 分類を返す (テスト: masked 効果の行動が「要実験」に入る)。
- render にルールブックの節が出る (スナップショットではなく、行動の型 ID と式が含まれることを確認するテスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-r1-rulebook`)。`main` を直接編集しない。
- 共有ファイル (`src/cli/*`, `augur.contracts.json`, `src/schema/schema-names.ts`, `src/bundle/classify-path.ts`) への追加は自分の分の最小行に留める (段 6 の run と衝突しうる)。
- ビルドとテストはフォアグラウンドで待つ (バックグラウンドで待つと session-end される)。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
