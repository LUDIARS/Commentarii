# ルールブック (公開契約、SDK 0.3.0 / bundle format 2)

`mechanics/` 配下の機械可読な仕様。ゲームが「何であるか」(変数・行動・過程・挙動モデル・目標) をデータで持ち、Ingenium (`Ig`) の信念・前向きモデル・アフォーダンス・相手モデルがこれだけを読む。攻略法 (定石・意図) は含めない。

- 設計正本: `spec/plan/2026-10-11-ingenium-integrated-design.md` §1〜§5、詳細は `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §3.2〜§3.5・§3.10、Astra 案 `spec/plan/2026-10-11-autoplayer-paradigms-astra.md` §4.3〜§4.6・§5。
- 依頼文: `spec/tasks/2026-10-11-stage-r1-rulebook-forward-model.md` (Actio `actio:99b90bdc-f124-48ef-bf91-306a9217e5b4`)。
- 所有: 形式・検査・描画は Commentarii (`packages/sdk` と `src/validate` / `src/render`)。実行 (信念・前向きモデル・アフォーダンス・解釈器) は Ingenium。Ingenium は SDK の公開入口 (`@ludiars/commentarii-sdk/{expression,rulebook,types}`) だけを読む。

```
mechanics/
├── variables.json              状態変数と集合 (variables.schema.json)
├── rules/<slug>.json           式 (expr/1、既存)
├── states/<slug>.json          状態機械 (既存 + 遷移の when / p / hold)
├── actions/<slug>.json         行動の型 (action.schema.json)
├── actions/<slug>.masked.json  行動の真の定義 (上書き、action.masked.schema.json)。player には存在しない
├── processes/<slug>.json       過程 (process.schema.json)
├── behaviors/<slug>.json       挙動モデル (behavior.schema.json)
└── objectives.json             勝敗条件と進捗尺度 (objectives.schema.json)
```

全要素が `knowledge` / `source` を持つ (変数・集合・進捗尺度は 1 件ずつ)。

## 1. 式言語 v2 (`expr/2`)

```
expr    := or
or      := and ('||' and)*
and     := not ('&&' not)*
not     := '!' not | cmp
cmp     := sum (('<' | '<=' | '==' | '!=' | '>=' | '>') sum)?
sum     := term (('+' | '-') term)*
term    := unary (('*' | '/') unary)*
unary   := ('+' | '-') unary | primary
primary := number | ident | ident '(' args ')' | '(' expr ')' | idtoken | '$' ident
idtoken := kind ':' segment (':' segment)* ('#' state)?      例 rule:bestia:damage、state:bestia:battle-ai#dodge、node:center
```

- `expr/1` (rule 文書) は `sum` 以下だけ。v2 の構文で `expr/1` の式を読むと木も点評価も同一 (受入: 全 sample rule の example 評価を変更前の値に固定したテスト `tests/domain/expression/point-compat.test.ts`)。rule 文書は今後も `expr/1` で、validate V08 は v2 の構文を誤りとする (変更前と同じ)。
- 文字列リテラルは無い。ID は 1 トークン。比較の `==` / `!=` は記号 (状態・ノード・個体) 同士でも使える。順序比較は数だけ。
- 真偽: 点評価では 1 / 0 (0 以外は真)。`&&` `||` は短絡、`if(c, a, b)` は取る枝だけを評価する。
- 区間評価 (`evaluateInterval`): 値は `[lo, hi]`、真偽は `[0,0]` 偽 / `[1,1]` 真 / `[0,1]` 不明。`a < b` は `a.hi < b.lo` で真、`a.lo >= b.hi` で偽、他は不明。`&&` = min、`||` = max、`!` = 1 − x (Kleene の三値)。左辺で決まれば右辺は評価しない。条件が不明の `if` は両枝の包 (hull)。加減乗は厳密。0 を含む区間での除算はモデルエラー (`ExpressionError`) で、不明には混ぜない。記号の不明は「取りうる記号の集合」(`SymbolSet`) で表す。
- 評価文脈 (`PointContext` / `IntervalContext`): `variables` (素の名前)、`params` (`$name`)、`symbols` (値として記号になる素の名前、例 `self`)、`functions` (文脈関数の実装)。組み込み関数 `min max floor ceil abs clamp` と `if` は文脈関数より優先する。
- 文脈関数の語彙 (`CONTEXT_FUNCTIONS`、SDK が名前と引数の数を固定し、意味は評価する側が与える):

| 関数 | 引数 | 意味 |
|---|---|---|
| `dist(a, b)` | 2 | 所有者または点の距離 |
| `rule(id)` | rule の ID | rule を現在の変数で評価した値。rule の変数は名前が同じ変数 → `ref` のフィールドを `from` に持つ変数 → `example` の順で束縛する |
| `ready(action)` / `ready(owner, action)` | 1〜2 | 行動がクールダウン明け |
| `visible(x)` `kind(x)` `node(x)` | 所有者 | 観測に居る / 個体の種別 (記号) / 立っている地図ノード (記号) |
| `has(name)` | 変数名 | 値がある |
| `count(set)` `sum(set, var)` `nearest(set)` | 集合 | 集約 / 行為者に最も近い要素 (所有者) |

  ほかに、所有者が `self` / `entity` の変数はそれぞれ 1 引数の関数 (`hp(x)`)、集合は所属判定の関数 (`hostile(x)`)。
- 所有者 (owner) を取る引数に書けるのは `self`、`actor`、`$param`、個体 ID (`enemy:` `actor:` `item:` `skill:`) だけ (`hp(node:center)` は誤り)。
- 素の名前: 値として使えるのは `dt` (副ステップ長)、`self` / `actor` (記号)、所有者が `world` / `stage` の変数。変数宣言の中 (`range` / `init` / `derive`) では全変数が「同じ所有者の値」として使える (`derive: hp > 0`)。文脈関数の引数には集合名と変数名も書ける (`sum(hostile, hp)`)。
- 静的検査 (`checkExpression(source, scope)` と `rulebookScope`): 構文、未知の関数・変数・パラメータ・ID、引数の数、所有者の型。評価しない、例外を投げない。
- 上限: 長さ 1000、入れ子 64 (現行どおり)。

## 2. 変数 (`variables.json`)

| キー | 意味 |
|---|---|
| `owner` | `world` / `stage` / `self` / `entity` (配列で複数) |
| `type` | `number` / `time` / `bool` / `vec3` / `node` / `entity` / `state` (`machine` の状態) / `enum` (`domain`) / `count` |
| `unit` `range` | 単位と宣言の値域。値域は不明値の初期区間。上下限に式 (他の変数) を書ける (`[0, "max_hp"]`) |
| `observe` | 観測フレームからの読み取り (1 つ、または所有者ごと)。`event:<kind> -> <式>` はイベント到着時に設定。無い変数は前向きモデルの予測だけで追う |
| `from` | 所有個体の文書のフィールド (`stats.health`) から初期値を取る |
| `init` / `derive` / `decay` | 初期値の式 / 常に他の変数から導く / `tick` で 1 ティック後に戻るイベント旗 |

`sets.<name>` は `of: entity` と `where` (要素は `$e`)。評価する行為者自身は集合に含めない。

## 3. 行動 (`actions/<slug>.json`)・過程 (`processes/<slug>.json`)

- `actor` (`self` を含むものだけが自分のアフォーダンス)、`params` (`entity` / `node` / `point` / `number` / `enum`。数は `range` と `step` で有限に離散化)、`maps_to` (抽象アクションの動詞 1 つ + 任意の `target` / `params`。値は `$param` / ID / ノード / 数)、`pre`、`duration`、`cooldown`、`cost` (変数 → 量)、`motion` (`toward` / `away` / `sideways` / `to_node` / `hold` または `$param`、`goal`、`speed`、`keep`)、`effects[]`。
- `effects[]` の 1 要素は **1 回の抽選**: `outcomes[]` は相互排他で `p` の和は 1 (V15)、選ばれた枝の `assign[]` (`var`、所有者 `of`、`expr`) は同時に起きる。独立な抽選は別の効果にする。`at` は `start` / `end` / 秒、`when` は任意。
- `effects_known: false` は「存在は公開だが効果は未モデル化」の公開側の独立宣言。masked ファイルの影として置いてはならない (V20)。
- 式の中の `actor` は行動の実行者、`$name` はパラメータ。
- 過程は `of` の所有者ごとに副ステップで `when` が真なら `rate[]` (`var` の新しい値の式、`dt` を使う) を適用する。

## 4. masked は上書きで分離する

- `actions/<slug>.masked.json` = `{ id, override, knowledge: "masked", source }`。`override` は見える行動の `pre` / `duration` / `motion` / `effects` / `cost` / `cooldown` のうち名前を挙げたキーを **丸ごと** 置き換える (マージしない)。`id` / `actor` / `params` / `maps_to` は置き換えられない (できることは同じ、起きることだけが違う)。
- 見える定義は単独で完結する: 確率の和は 1、参照は解決する。確率の和が 1 に満たない・「不明分岐」を置く・masked ファイルを指す文字列を残す、といった **隠れた分岐の痕跡** を置かない (V15・V20)。
- player ビュー (`toPlayerView`、player の `bundle.json`、`loadRulebook(.., 'player')`) には上書きという概念が無い。player の書き出しと player のルールブックは、masked ファイルの有無で 1 バイトも変わらない (`tests/sdk/load-rulebook.test.ts`)。
- omniscient (`loadRulebook(full, 'omniscient')`) だけが上書きを適用し、行動に `overridden: { keys, source, path }` を付ける。

## 5. 挙動モデル (`behaviors/<slug>.json`) と状態機械の遷移

| `paradigm` | 記述 | 解釈器 (Ingenium) |
|---|---|---|
| `fsm` | `machine` (状態機械) + `targeting` + `act` (状態 → 行動呼び出し) | R1 |
| `scripted` | `timeline[]` (`at` 秒、行動、`params`) + 任意の `loop` | R1 |
| `bt` | `tree` (selector / sequence / condition `pred` / action) | R3 |
| `utility` | `candidates[]` (行動 + `considerations[]` の式・重み・曲線) | R3 |
| `goap` | `goal` (式) + `actions[]` + 任意の `heuristic` | R3 |
| `mcts` | `actions[]` + `search` (反復数・深さ、論理予算) | R3 |

- `targeting: { var, pick }` は `$<var>` を束縛する (Bestia: `target` = `nearest(hostile)`)。`act` の `params` の値は `$param`・`dt`・ID・ノード・数。
- 状態機械の遷移: `on` は人向けの文。`when` (式) が機械評価の条件、`p` は条件が真のとき遷移する確率 (既定 1)、`hold` は遷移先の状態に最低限留まる秒数 (式)。遷移の式では `actor` = 状態機械の持ち主、`$target` = その現在の標的。遷移は文書順で最初に成り立ったもの。
- entity の `behavior` は `behavior:` (挙動モデル) か `state:` (状態機械、`act` の無い fsm とみなす) を指す。

## 6. 目標 (`objectives.json`)

`win` / `lose` (式) と `progress[]` (`id`、`expr`、`better: lower | higher`、`scale`)。進捗尺度はゲームが定める勝敗条件の連続化で、計画器のヒューリスティクスとロールアウト評価の唯一の源。攻略法 (推奨手順) は書かない。

## 7. 検査 (validate、`spec/feature/validate-checks.md`)

V13 式の構文 / V14 未知の参照 / V15 確率の合計 / V16 `maps_to` の語彙 / V17 masked の分離 / V18 knowledge の伝播 / V19 挙動モデルの参照切れ / V20 隠れた分岐の痕跡。

## 8. 書き出し (`bundle.json` format 2) と SDK の入口

- `documents.mechanics = { variables?, actions[], masked_actions[], processes[], behaviors[], objectives? }`。player の書き出しでは `masked_actions` は常に空 (どのバンドルでも同じなので情報を持たない)。full では上書きを適用せず別に持つ。
- `index.actions[<id>] = { path, pointer, actor, maps_to }` (`maps_to` は動詞または null)。`index.ids` に action / process / behavior を足した。
- `view: player | full` と `expression_language: expr/2` を記録する。`format_version` 1 の書き出しは `loadRulebook` で「ルールブックが空」として読める (`READABLE_EXPORT_FORMAT_VERSIONS`)。
- `@ludiars/commentarii-sdk/rulebook`: `loadRulebook(exported, 'player' | 'omniscient', { overlay? })` → `PlayerRulebook` (knowledge は shown / discoverable だけ、上書きの欄なし) / `OmniscientRulebook`。overlay の値の推定は `learned[]` (エンティティ × 変数の区間、根拠 run、`source.kind: observed`) として重ねる。正本は変えない。
- リプレイ: tick 行の任意欄 `model` (`belief: { tracked, unknown, intervals? }`、`affordances: { now, uncertain, reachable, not_found, impossible }`)。

## 9. 描画

`guide render` の `rulebook.md`: 変数表と集合、行動の型の表と行動ごとの式 (前提・持続・運動・効果と確率)、過程、挙動モデル (fsm は Mermaid `stateDiagram-v2` に遷移の `when` / `p` / `hold` と状態ごとの行動、bt はインデント木、scripted は時刻表)、目標と進捗尺度。player ビューから描くので masked の上書きは出ない。`--knowledge full` の `masked.md` に上書きの節がある。知識境界レポートに「ルールブックの境界」(要素ごとの knowledge と masked 上書きの件数。内容は出さない) を足した。
