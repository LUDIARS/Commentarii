# Ingenium R1: ルールブック + 式言語 v2 + 信念・前向きモデル・アフォーダンス

設計正本: `spec/plan/2026-10-11-ingenium-integrated-design.md` (§1〜§5)。詳細は Fable 案 `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` の §3.2 (ルールブック `mechanics/`、JSON 例)、§3.3 (式言語 v2)、§3.4 (信念状態と前向きモデル)、§3.5 (アフォーダンス)、§3.10 (相手のモデル)、§7.1 (R1 の受入) を正本にする。Astra 案 `spec/plan/2026-10-11-autoplayer-paradigms-astra.md` の §4.3〜§4.6・§5 (存在・公開可否・認識状態の分離) と §9 の R1 指摘を受入に加える。

前提: R0-A (Commentarii `packages/sdk`) と R0-B (実行側を Ingenium へ移す) がマージ済み。初版 (叩き台、Commentarii に `src/rulebook/` を新設する案) は分離前提と矛盾するため破棄し、本書で置き換える (2026-10-11)。

本段は 2 リポにまたがり、**PR を 2 本** 出す。Commentarii 側 (形式) を先にマージして SDK のタグを上げてから、Ingenium 側 (実行) を出す。

## 成果物

### Commentarii (SDK = データ形式の所有者)

1. **式言語 v2** (`packages/sdk` の expression): 比較 (`< <= == != >= >`)、論理 (`&& || !`、短絡)、`if(c, a, b)`、ID トークン (`kind:game:slug(#state)` を 1 トークン、文字列リテラルは入れない)、パラメータ `$x`、文脈関数の差し込み口 (`hp(x)` 等の変数参照、`dist(a,b)`、`ready(id)`、`rule(id)`、集約 `sum` / `count`)。**区間評価** (`evaluateInterval`: 値は `[lo, hi]`、真偽は `[0,1]`、`&&`=min / `||`=max / `!`=1−x) と点評価。**点評価は現行と完全互換** (既存 rule の評価結果を 1 件も変えない)。静的検査 (未知の関数・変数・パラメータ・ID)。式言語の版を `expr/2` として記録し、`expr/1` の文書はそのまま読める。
2. **ルールブックのスキーマ** (`schema/`): `variables` (所有者 self / entity / stage / global、型、値域、単位、観測できるか)、`actions` (actor、`maps_to` 抽象アクション、params、`pre`、`outcomes[]` (`p` 合計 1、相互排他を明記)、effects、cost、cooldown、duration)、`processes` (毎ティックの連続変化)、運動プリミティブ (`toward` / `away` / `sideways` / `to_node`)、`behaviors` (`paradigm`: fsm / bt / utility / goap / mcts / scripted と方式ごとの記述)、`objectives` (`win` / `lose` / `progress[]`)。`states` の遷移に機械評価できる `when`。全要素に `knowledge` / `source`。
3. **masked は上書き分離**: `actions/<slug>.masked.json` は見える側の行動を丸ごと上書きする真の定義。player 側の定義だけで完結し (確率の和が 1 に満たない等の **隠れた分岐の痕跡を残さない**)、omniscient (full 書き出し) が上書きを適用する。
4. **validate** の検査項目 (1 項目 1 テスト、spec の検査項目リストにも追記): 式の構文 / 未知の参照 / 確率の合計 / `maps_to` の語彙 / masked の分離 / knowledge の伝播 / 挙動モデルの参照切れ / player 定義に隠れた分岐の痕跡が無いこと。
5. **render**: ルールブックの節 (変数表、行動の型の表と式、挙動モデルの図 (FSM は Mermaid stateDiagram、BT はインデント木)、目標)。知識境界レポートにルールブックを含める。
6. **bundle.json の `format_version` 2** (`documents.mechanics`、`index.actions`、`view: player | full`)。SDK の `rulebook` 入口: `loadRulebook(exported, mode)` (player / omniscient のビュー、overlay の重ね)。
7. **samples/bestia のルールブック一式** (Fable 案 付録 A): 変数・行動の型 (移動・攻撃・回避・後退・リングへ戻る相当)・過程・`battle-ai` の挙動モデル (fsm、遷移に `when`)・目標。少なくとも 1 つの効果を masked の上書きにする。
8. `COMPAT.md` に SDK 0.2.0 / bundle format 2 の行。`spec/feature/rulebook.md` (公開契約)。ドメイン宣言は `(^|/)` 形式。

### Ingenium (実行)

9. **信念状態** (`src/belief/`): 観測 + ルールブックの変数宣言から作る。値は区間、不明は値域いっぱいの区間。効果推定は仮説 (条件・根拠 run・信頼区間・撤回可) として別に持つ。
10. **前向きモデル** (`src/model/`): `step(state, jointActions, horizon, randomKey)`。持続行動・過程・運動・相手の挙動モデルを **副ステップで同時に** 進める。確率的な結果は seed からの標本 (決定的) と枝の列挙 (確率つき) の両方を返す。**期待状態は作らない** (期待値は集計のときだけ)。不明値に依存する結果は区間のまま返す。乱数は `deriveSeed(seed, "model:<tick>")` の派生ストリームから引く。
11. **アフォーダンス** (`src/affordance/`): 自分の行動の型を「今できる / 要実験 (不明値で成否不明) / k 手で可能 (witness つき) / 見つからない (探索範囲つき) / 不可能 (根拠つき)」に分ける。入力として送れるかと、効果が分かるかは別の軸。
12. **相手モデルの解釈器** (fsm / scripted) (`src/opponent/`): `behaviors` の記述を同じ実装で回し、相手の次の手を予測する。相手視点のビューでは相手から見えない情報にアクセスできない。
13. 判断ログ (リプレイ) に、信念の要約・アフォーダンスの分類を任意の欄として記録 (既存の replay 不変条件を壊さない)。

## 受入条件

- 両リポで `npm install --include=dev && npm run typecheck && npm test` が通る。
- 既存 rule の点評価が不変 (全 sample rule の example 評価が変更前と一致するテスト)。
- 新しい validate 項目がそれぞれ 1 テストで違反を検出する。
- player のルールブックと前向きモデルに、masked の行動・効果・確率・分岐の **痕跡** が無い (存在の有無を推測できる差も含めて検査するテスト)。omniscient では上書きが効く。
- 前向きモデルの検証は **独立した oracle** で行う (sim の実装を写した自己比較だけにしない): 複数ステップ・確率的な結果の分布の台・可視射影 (player に見える部分だけの一致) を、手で書いた期待値と比べるテスト。Bestia の sim 実走との一致も別に示す。
- 同じ seed で同じ予測 (決定性テスト)。既存のリプレイ検証が通る。
- アフォーダンスが 5 分類を返す (masked 効果の行動が「要実験」に入るテストを含む)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ。`main` を直接編集しない。
- Ingenium から Commentarii の内部パスを import しない (SDK の公開入口だけ)。
- ビルドとテストはフォアグラウンドで待つ。サービスは起動しない。
- 完了 = Revisor local PR 提出 → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
