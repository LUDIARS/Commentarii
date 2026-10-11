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

## 実装記録 (Commentarii 側、SDK 0.3.0、2026-10-12)

Actio: `actio:99b90bdc-f124-48ef-bf91-306a9217e5b4`。ブランチ `feat/r1-rulebook-sdk`。公開契約は `spec/feature/rulebook.md`、検査項目は `spec/feature/validate-checks.md` (V13〜V20)、ドメインは `spec/domains/rulebook.domain.json`。

### 再利用の採否

| 候補 | 採否 | 理由 |
|---|---|---|
| 既存の式言語 (`packages/sdk/src/domain/expression/`) | 拡張 (採用) | 文法の下位層 (`sum` 以下) をそのまま残し、上に `or / and / not / cmp` を重ねたので `expr/1` の木と点評価が同一になる。点評価器は既存の分岐を残して v2 のノードだけ足した |
| `toPlayerView` / `stripMasked` (`bundle/player-view.ts`) | 採用 | player のルールブックも同じ入口で masked を落とす (`loadRulebook` の player は `stripMasked` を使う) |
| `buildBundleIndex` / `unresolvedReason` / `referencedKnowledge` | 採用 | ID の解決と knowledge の伝播 (V14・V18・V19) を既存の索引で行う。BUNDLE_KINDS に action / process / behavior を足しただけ |
| `findKnowledgeHolders` (V03 / V04) | 採用 | masked 上書きファイルの `knowledge: masked` は既存の V03 / V04 の枠でそのまま検査される |
| `render-states.ts` の Mermaid | 部分採用 | 同じ `stateDiagram-v2` の書式・エスケープ (`:` → `：`) を使い、挙動モデル用に状態ごとの行動と遷移の `when / p / hold` を足した別ファイル (`src/render/rulebook/render-behaviors.ts`) にした (states.md は不変) |
| 学習 overlay の値推定 (`overlay.values`) | 採用 | `loadRulebook(.., { overlay })` が `learned[]` (区間) として重ねる。新しい overlay の形は作らない |
| 汎用スクリプト / 外部の式ライブラリ | 不採用 | masked の分離を構造で担保できない・決定性と上限の保証が難しい (Fable 案 §2.3) |

### 判断した点 (前提未確定を含む)

- **rule 文書は expr/1 のまま**。`rule.schema.json` は変えず、V08 は rule を `expr/1` として読む (v2 の構文は従来どおり誤り)。ルールブック文書が `expr/2`。`bundle.json` の `expression_language` が `expr/2` を記録する。
- **`rule(id)` の束縛規則** (Ingenium が実装): rule の変数は名前が同じ変数 → `ref` のフィールドを `from` に持つ変数 → `example` の順。sim の `evaluateRule` と同じ順なので、追加した `rule:bestia:damage` (`power * cooldown`) は sim の既定式と同じ値になる (sim の挙動は変わらない)。
- **V18 の伝播は変数宣言を対象外にした**。変数は自分の値の境界を宣言する (`alive` は死亡が見えるので shown、`derive: hp > 0` の hp は discoverable)。行動・過程・挙動モデル・状態機械・集合・目標・進捗尺度は参照先以上に厳しくする。
- **移動中回避 (sim の movingEvasion 0.5) は撃たれた側が self で self が動いたときだけ**。masked 上書きはそれを `$target == self && moved(self)` で書くため、評価文脈に「値として記号になる素の名前」(`symbols`: self / actor) を足した。
- **行動は 5 型** (`move` / `shoot` / `dodge` / `retreat` / `return`)。Fable 案の「`move` 1 つに `how`」ではなく、`maps_to` の動詞が型ごとに 1 つになるよう分けた (dodge / retreat は sim の敵の `custom` 動詞、自分は move_to / attack だけ)。
- **entity の `behavior` は `state:` のまま**。`behavior:` も受理するようスキーマを広げたが、sim (Ingenium) が entity の `behavior` から状態機械を引くので、サンプルの書き換えは Ingenium 側の解釈器と同時に行う。挙動モデル `behavior:bestia:battle-ai` は `machine` で状態機械に結び付く。
- **挙動モデルのスキーマは 6 方式とも記述を定義した** (依頼文の「方式ごとの記述」)。解釈器は R1 で fsm / scripted、残りは R3 (Ingenium)。
- **知識境界レポート** (`knowledge.md`) はルールブックの要素ごとの knowledge と masked 上書きの件数を出す (既存のエンティティ行が masked の件数を出すのと同じ扱い。内容・キー名は出さない)。player 向けの `bundle.json` とルールブックには件数も出ない。
- **リプレイ**: tick 行に任意の `model` (信念の要約・アフォーダンス 5 分類) を足した (成果物 13 の形式側。書くのは Ingenium)。

### 検証

- `npm install --include=dev && npm run typecheck && npm test` (Commentarii): 全テスト緑。
- 既存 rule の点評価: 変更前 (dde85a8) の評価器で計算した値を `tests/domain/expression/point-compat.test.ts` に固定。
- validate の新項目は `tests/validate/checks/v13〜v20-*.test.ts` が各 1 フィクスチャ (`tests/fixtures/broken/v13〜v20-*`) で違反を検出し、サンプルでは ok。
- 痕跡なし: masked ファイルの有無で player の `bundle.json` と player のルールブックが deep-equal (`tests/sdk/load-rulebook.test.ts`)。omniscient では shoot に `evaded` 分岐が入る。
- SDK フィクスチャ (`packages/sdk/fixtures/bestia/bundle.{player,full}.json`) を format 2 で書き出し直した (`tests/sdk/sdk-fixtures.test.ts` が現行の書き出しとの一致を検査)。

### PR 説明 (Commentarii 側、Revisor local PR #2716)

- **変更した境界**: SDK の公開入口 (`@ludiars/commentarii-sdk/{expression,rulebook,types,schemas,bundle}`) に式言語 v2・ルールブックの型とビュー・`bundle.json` 形式 2 を足した。`Bundle` に `rulebook` (必須欄) を、`ExportedBundle` に `view` / `expression_language` / `documents.mechanics` / `index.actions` を足し、`EXPORT_FORMAT_VERSION` を 2 に上げた (形式 1 は `ReadableExportedBundle` / `loadRulebook` で読める)。entity の `behavior` は `behavior:` も受ける。validate は 12 → 20 項目、render は `rulebook.md` を足した。replay の tick に任意の `model`。SDK 0.2.0 → 0.3.0 (Commentarii 本体の版は 0.2.0 のまま)。
- **復旧方法**: この PR の revert で SDK 0.2.0 / 形式 1 に戻る (形式・フィクスチャ・サンプルが同じ commit に閉じている)。Ingenium は vendor の tarball (0.2.0) を使っているので、この PR のマージだけでは Ingenium の動作は変わらない。Ingenium 側の R1 PR は 0.3.0 の tarball を取り込むので、こちらを戻すときは Ingenium 側の PR も戻す。
- **実施した検証**: `npm install --include=dev && npm run typecheck && npm test` 全 316 件緑。Augur 契約 52 件 met (`augur contracts report --acceptance`、新規 C-100〜C-104、更新 C-1 / C-3 / C-5 / C-17)。変更前評価器 (dde85a8) との点評価一致。masked ファイルの有無で player の書き出し・ルールブックが一致。
- **未実施**: Ingenium 側 (信念・前向きモデル・アフォーダンス・相手モデル解釈器・sim との一致・決定性) は本 PR のマージ後に Ingenium の別 PR で行う。サービスの起動テストはしていない (サービスを持たない変更)。konbini-dominant サンプルへのルールブック追加はしていない (依頼は Bestia のみ)。
