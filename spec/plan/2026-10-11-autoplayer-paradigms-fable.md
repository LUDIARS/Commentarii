# 設計: 判断系アルゴリズムの使い分けとルール駆動の自律オートプレイヤー (Fable 案)

2026-10-11。依頼文 `spec/tasks/2026-10-11-autoplayer-paradigms-design-request.md`。叩き台 `spec/architecture/design.md` §16 を前提にせず、既存実装 (`src/engine/`、`src/replay/decider.ts`、`src/adapters/sim/`、`src/domain/expression/`、`schema/`、`samples/bestia/`) と設計原則 §1 から独立に組み立てた案。Astra 案は見ていない。

---

## 0. 結論 (推奨案の要約)

1. **5 方式は「層」ではなく「役割」で持つ。** BT / FSM / Utility / GOAP / MCTS は、(a) 相手の挙動モデルを読んで動かす **解釈器**、(b) 自分の手を作る **提案者**、(c) 提案を選ぶ **調停者**、(d) 選んだ計画を実行する **実行者** のどこで使うかが違うだけで、同じ 5 つの実装を共有する。自分の頭の中は **提案者 (複数) → 調停者 (1 つ) → 実行者 (1 つ)** の 3 役。叩き台の「FSM = 構え、Utility = 狙い、GOAP = 手順、MCTS = 先読み、BT = 実行」という固定の層構造は採らない (§8 の指摘 1・10)。
2. **方式選択は「予算配分」と「予測価値による調停」に分解する。** どの提案者をどれだけ回すかは、計算で求めた **局面レジーム** (calm / threat / critical) × 実行形態 (realtime / turn) × モデル信頼度で引く **予算表 (データ)** が決める。どの提案を採るかは、全提案を **同じ前向きモデルで予測した価値・費用・危険・確からしさ** で Utility が決める。叩き台の多腕バンディット (UCB) によるオンライン補正は採らない。方式別の成績は bench でオフラインに集計し、予算表の変更は定石書き換えと同じ **承認つきデータ更新** にする (原則 5)。
3. **ルールブックは STRIPS 風の pre / effects だけでは足りない。** リアルタイム・連続空間 (Bestia) には、持続時間つき行動 + **過程 (processes、毎ティックの連続変化: 回復・クールダウン・弾の進行)** + **運動プリミティブ (motion: toward / away / sideways / to_node)** + 相手の挙動モデルを同時に進める **副ステップ付き前向きモデル** が要る。ターン制はこの特殊形 (過程なし、持続 = 1 手番)。
4. **不明は「区間」で表す。** 信念状態の値は区間 `[lo, hi]` (点は退化区間)、真偽値も `[0,1]` の区間なので、`&&` = min、`||` = max、`!` = 1 − x で三値論理が式言語の拡張なしに出る。式言語 v2 は比較・論理・`if`・ID トークン・パラメータ `$x`・文脈関数 (`hp(x)`, `dist(a,b)`, `rule(id)`, 集約 `sum/count`) を足し、点評価は現行と完全互換 (既存 rule の結果不変)。
5. **masked は「上書き分離」で持つ。** `actions/<slug>.masked.json` は見える側の行動を **丸ごと上書きする真の定義** (効果分布・条件) を置く。player 側は見える定義だけで完結した (しかし間違っているかもしれない) モデルを持ち、omniscient は上書きを適用する。確率の和が 1 に満たない等で「隠された分岐がある」ことを player に漏らさない。ずれは reflect が検出し、学習した効果 (`discoverable`、`observed`) としてオーバーレイに積まれる。「存在も知らない」= player 型に現れない、「存在は知っているが値が分からない」= 区間が広い、で構造的に区別する。
6. **攻略法に依存しない = 目標述語と進捗尺度だけから計画する。** `objectives.json` の `win` / `lose` / `progress[]` (ゲームが何を進捗と定義するか、仕様の一部) が GOAP の目標と MCTS の評価関数の **唯一** の源。定石・意図・既存の `generic:*` 候補 (小さな手書き定石) は `autonomous` では一切使わない。アフォーダンス (今できる / 要実験 / k 手で可能 / 不可能 (理由)) は行動の `pre` の区間評価と後ろ向き探索で機械的に出す。
7. **性能と決定性: 予算は反復回数、乱数はティックごとの派生ストリーム。** 壁時計の予算はリプレイを壊すので使わない (測って記録するだけ)。MCTS / 確率的効果のサンプルは `deriveSeed(seed, "mcts:<tick>")` のようにティック別ストリームから引き、既存の「毎ティック 2 回」の乱数列を乱さない。
8. **既存資産は、Decider 契約・ドライバ・リプレイ・BT 実行器・Utility の合成器・ペルソナ・bench・overlay・学習経路・sim を残し、候補生成 (定石依存) を `guided` 構えに閉じ込める。** sim の状態遷移の慣例 (`enemy-transitions.ts` の「遷移先 id で読む」) は、ルールブックの `when` 式を読む形へ置き換え、前向きモデルと sim が同じ解釈器を使う (手書き版の軌跡を golden に残して同語反復を防ぐ)。
9. **段分けは R0 (リポ分離) → R1 (モデル) → R2 (計画なし + GOAP の自律で Bestia を定石なしにクリア) → R3 (MCTS・相手モデル 5 方式・オフライン方式評価・敵 AI 再利用)。** 叩き台の「R2 = 5 方式を全部」より、各段の終わりに動くプレイヤーがある形にする。R1 の依頼文は §7.4 の差分で直す。
10. **オートプレイヤーは Commentarii から切り離した別リポで運用する (neco 追加指示 2026-10-11)。** 境界は「データ形式と攻略本の正本操作 = Commentarii、実行時 (判断・アダプタ・sim・リプレイ記録 / 再生・bench・gate) = 新リポ」。両者は Commentarii が配る **SDK パッケージ** (スキーマ・型・式言語・`bundle.json` 読み込み・player ビュー・リプレイの不変条件) と、ファイル (`bundle.json` → run の replay / observations / bench) で一方向につなぐ。新リポの名前は **Lusor** (`Ls`、ラテン語で「遊ぶ者・プレイヤー」) を推奨 (§10.4)。

---

## 1. 解釈

| 指示の語 | 本案での意味 | 叩き台との差 |
|---|---|---|
| 判断系アルゴリズムを「理解している」 | (a) 5 方式の **解釈器** を持ち、どの形で書かれた挙動 (自分用・相手用) でも動かせる。(b) 5 方式のうち計画を作れるもの (GOAP / MCTS) と反応で手を出すもの (Utility、FSM / BT で書かれた既製の方策) を **提案者** として同じ契約で回せる。(c) 各提案を同じ **前向きモデル** で評価して比べられる。(d) 判断ログに「どの方式が、何を根拠に、何を出したか」を残して説明できる。 | 叩き台は (a) と「局面→方式」の選択器を中心に置く。本案は選択を「予算」と「調停」に分け、方式どうしを同じ通貨 (予測価値) で比べることを中心に置く |
| ベースのルール / メカニクスをデータとして持つ | `mechanics/` のルールブック: 変数、行動の型、過程、状態機械 (機械評価できる `when`)、相手の挙動モデル、目標。これは「ゲームが何か」で、「どう勝つか」ではない。前向きモデルはここから機械的に組む | 同じ。過程・運動・副ステップ・上書き分離を足す |
| 攻略法は仕様に依存せず自分で行動する | `autonomous` 構えでは定石・意図・手書きの汎用候補を判断の入力にしない。入力は観測 + player 側ルールブック + 学習した効果だけ。目標は `objectives` から | 同じ方向。`generic:*` も外す点、進捗尺度を仕様側に置く点を明示 |
| 能力的にできる事を判断・解釈して行動する | アフォーダンス = 自分が `actor` になれる行動の `pre` を信念状態 (区間) で評価し、確定 / 不明 (要実験) / k 手で可能 / 不可能 (どの項が落ちたか) に分ける。不明は実験で区間を狭めてから計画に入れる | 同じ。分類の定義と理由の出し方を具体化 |

「MCT」は MCTS (モンテカルロ木探索) と読む。ターン制・決定的・2 人なら、相手手番を敵対的に扱う MCTS と深さ制限 minimax は同じ提案者契約で並べられるので、別の読みがあっても構成は変わらない (§9 の未決 2)。

---

## 2. 比較した案とトレードオフ

### 2.1 全体構成

| 案 | 構成 | 利点 | 欠点 | 判定 |
|---|---|---|---|---|
| A. 層構造 (叩き台) | FSM 構え → Utility 狙い → GOAP / MCTS → BT 実行、方式選択器が層を差し替える | 直感的、既存 §7.4 (Utility→BT) の延長 | 方式の性質 (反応型 / 計画型) と置き場所を混同する。FSM の「探索 / 交戦 / 退避」のモードは攻略法 (ヒューリスティクス) の持ち込み。BT が「実行層」でもあり「相手モデルの一形式」でもあって役割が二重。方式選択器が独立の学習問題になる | 不採用 |
| **B. 提案者 / 調停者 / 実行者** | 複数の提案者 (継続・反応・GOAP・MCTS・実験・(guided のみ) 定石) が予算内で計画を出し、調停者 (Utility v2) が同じ前向きモデルの予測で選び、実行者 (BT v2) が計画を手順木にして回す | 方式を同じ通貨で比べられる。方式選択が「予算表 + 予測価値」に還元され決定的。判断ログに各方式の出力が並び、replay diff で方式の分岐が見える。相手モデルの解釈器と自分の提案者が同じ実装 | 毎ティック複数の提案者を回す計算量 (予算表で抑える)。調停の考慮項目が増える | **採用** |
| C. MCTS 単独 | 全部 MCTS で、FSM / BT / Utility は相手モデルの解釈器にだけ使う | 実装が 1 本 | リアルタイム毎ティックの予算で浅くなる。決定的・敵なしの手順問題は GOAP が桁違いに安い。「理解している」の意味が痩せる | 不採用 |
| D. 並列競争 (B の亜種) | 全提案者を常に全力で回し、最良を採る | 単純 | 予算が守れない。ゲームの性質に応じた使い分けが無く、方式の得意不得意が見えない | 不採用 (B の予算表で `calm` に GOAP 多め等と表現できる) |

### 2.2 方式の選び方

| 案 | 内容 | 判定 |
|---|---|---|
| 対応表 + 局面署名ごとの UCB 補正 (叩き台) | 局面を量子化し方式別成績でバンディット | 署名の設計が恣意的、署名あたりの標本が足りない (方式の優劣が出る前に run が終わる)、学習の上に学習が乗って分散の主因になる、補正値が「人間が読める差分」にならない (原則 5) | 不採用 |
| **予算表 + 予測価値の調停 + オフライン評価** | レジーム × 実行形態 × モデル信頼度で各提案者の反復予算を引く (データ)。採否は予測価値。bench が提案者別の成績 (予測誤差・採用率・成果) を出し、予算表の変更は `learn consolidate` と同じ承認経路 | 決定的、説明できる、テストしやすい。表の初期値は人が置く (それでよい: 表は攻略法ではなく計算資源の配分) | **採用** |
| 学習済み分類器 | 局面特徴 → 方式を回帰 | ブラックボックス、原則 5 に反する | 不採用 |

### 2.3 ルール / メカニクスの表現

| 案 | 内容 | 判定 |
|---|---|---|
| STRIPS 風 pre / effects + cost.time (叩き台) | 行動は瞬時の状態変換 | ターン制には十分。リアルタイムで「移動している間に撃たれる」「回復が進む」「クールダウンが減る」が表せない。前向きモデルが sim と合わない | 不足 |
| **持続行動 + 過程 + 運動プリミティブ + 相手の同時進行** | 行動に `duration` と効果の発生時刻、`processes/` に毎ティックの連続変化、`motion` に運動の種類、前向きモデルは `dt` の副ステップで過程と相手の挙動を進める | Bestia と KonbiniDominant の両方に効く。sim と同じ粒度 | **採用** |
| 汎用スクリプト (JS / Lua) でルールを書く | 何でも書ける | masked の分離を構造で担保できない (任意コードは静的に参照を追えない)、人間が書けない・マスターデータから起こせない、決定性の保証が難しい | 不採用 |

### 2.4 不明値

| 案 | 判定 |
|---|---|
| 不明を持たない (未知は既定値) | 要実験が定義できない。不採用 |
| **区間 `[lo, hi]`** (宣言の `range` が初期値、観測・学習で狭まる) | 真偽も区間なので三値論理が無料で出る。前向きモデルは区間演算 (加減乗は厳密、除算は 0 を跨がない前提で検査)。**採用** |
| 分布 (ヒストグラム / 粒子) | 表現力は高いが、ルール記述者が書けず、MCTS のサンプルと expect 判定が重い。学習側の統計 (平均・分散) はオーバーレイに持ち、信念に入れるのは区間に丸める。将来の拡張点として残す |

### 2.5 masked な分岐の見せ方

| 案 | 判定 |
|---|---|
| 見える分岐だけ残し、確率の和 < 1 を「不明分岐」にする | 「隠された何かがある」ことを player に漏らす (存在の秘匿にならない)。不採用 |
| 見える分岐を再正規化する | 見える側の数値が真の値と違う値に化け、`source` を失う。不採用 |
| **masked ファイルが行動を丸ごと上書き** (真の定義) | player は見える定義 (完結、おそらく誤り)、omniscient は真の定義。ずれは reflect が検出し学習で埋める。「プレイヤーに誤解される仕組み」の報告が自然に出る。**採用** |

---

## 3. 推奨案の詳細

### 3.1 用語

| 用語 | 意味 |
|---|---|
| ルールブック (rulebook) | `mechanics/` 配下の機械可読な仕様。`player` / `omniscient` の 2 つのビューを持つ |
| 信念状態 (belief) | ルールブックの変数宣言 + 観測 + 前向きモデルの予測から作る、区間値の状態 |
| 前向きモデル (forward model) | `simulate(belief, action, params, mode)` → 次の信念 (決定的サンプル / 期待値 / 分岐列挙) |
| アフォーダンス | 自分が今・不明・k 手で・不可能、のどれでできる行動の一覧 (理由つき) |
| 提案者 (proposer) | 計画 (Plan IR) を出す部品。continuation / reactive / goap / mcts / experiment / tactic |
| 計画 (Plan IR) | 目標述語 + 手順 (行動 + パラメータ + expect) + 有効条件 + 予測 + 由来 (方式) |
| 調停者 (arbiter) | 全計画を Utility v2 で採点し 1 つ選ぶ |
| 実行者 (executor) | 計画を BT に展開し 1 ティック 1 行動を出す。expect が破れたら再計画要求 |
| レジーム (regime) | 信念から計算する局面区分 calm / threat / critical と、モデル信頼度 (不明の割合) |
| 構え (stance) | `autonomous` / `guided` / `hybrid`。判断の入力に定石を使うか |

### 3.2 ルールブック `mechanics/`

```
mechanics/
├── variables.json                 # 状態変数の宣言 (所有者、型、値域、単位、観測との対応、初期値の出所)
├── rules/<slug>.json              # 式 (既存。式言語 v2 で比較・論理も書ける)
├── actions/<slug>.json            # 行動の型 (自分用も相手用も同じ形)
├── actions/<slug>.masked.json     # 行動の真の定義 (上書き)。player ビューには存在しない
├── processes/<slug>.json          # 過程 (毎ティックの連続変化)
├── states/<slug>.json             # 状態機械 (既存)。遷移に when (式) と p を足す
├── behaviors/<slug>.json          # 挙動モデル: paradigm = fsm | bt | utility | goap | scripted
└── objectives.json                # win / lose / progress[] (ステージの stage.json で上書き可)
```

全要素が §4.3 の `knowledge` / `source` を持つ。参照する変数・rule の最も厳しい knowledge が伝播する (validate)。

#### variables.json (Bestia)

```json
{
  "variables": {
    "t":               { "owner": "world", "type": "time", "observe": "t", "knowledge": "shown", "source": { "kind": "master", "ref": "engine tick" } },
    "pos":             { "owner": ["self", "entity"], "type": "vec3", "unit": "m", "observe": { "self": "self.pos", "entity": "pos" }, "knowledge": "shown", "source": { "kind": "master", "ref": "Bestia src/world.cpp Fighter::pos" } },
    "max_hp":          { "owner": ["self", "entity"], "type": "number", "unit": "hp", "range": [1, 1000], "from": "stats.health", "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp archetype" } },
    "hp":              { "owner": ["self", "entity"], "type": "number", "unit": "hp", "range": [0, "max_hp"], "init": "max_hp", "observe": { "self": "self.hp.value * max_hp(self)" }, "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp Fighter::hp" } },
    "speed":           { "owner": ["self", "entity"], "type": "number", "unit": "m/s", "range": [0, 20], "from": "stats.speed", "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp archetype" } },
    "range":           { "owner": ["self", "entity"], "type": "number", "unit": "m", "range": [0, 40], "from": "stats.range", "observe": { "self": "extra.reach" }, "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp archetype" } },
    "cooldown_sec":    { "owner": ["self", "entity"], "type": "number", "unit": "s", "range": [0, 5], "from": "stats.cooldown", "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp archetype" } },
    "ready_at":        { "owner": ["self", "entity"], "type": "time", "init": 0, "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp Fighter::readyAt" } },
    "last_damaged_at": { "owner": "self", "type": "time", "init": 0, "observe": { "self": "event:hit -> t" }, "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/world.cpp" } },
    "mode":            { "owner": "entity", "type": "state", "machine": "state:bestia:battle-ai", "observe": { "entity": "state_guess" }, "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia src/behavior.cpp" } },
    "alive":           { "owner": ["self", "entity"], "type": "bool", "init": 1, "derive": "hp > 0", "knowledge": "shown", "source": { "kind": "master", "ref": "Bestia src/world.cpp" } }
  },
  "sets": {
    "hostile": { "of": "entity", "where": "alive($e) && kind($e) == enemy", "knowledge": "shown", "source": { "kind": "master", "ref": "Bestia free-for-all" } }
  }
}
```

- `owner`: `world` / `stage` / `self` / `entity` (観測に現れる個体)。配列で複数。
- `type`: `number` / `time` / `bool` / `vec3` / `node` / `state` (`machine` の状態の 1 つ) / `enum` (`domain[]`) / `count`。
- `observe`: 観測フレーム (§7.2) からの読み取り規則。無い変数は **前向きモデルの予測だけで追跡** する (例: 敵 `hp`)。`event:<kind> -> t` はイベント到着でその時刻を入れる。
- `from`: player ビューの entity 文書から初期値を取るパス (`discoverable` の値は player 書き出しに入るので、プレイヤーも知っている前提)。`init`: 式。`derive`: 他変数から常に導く (記憶しない)。
- `range` の上限に変数名を書ける (区間の初期値)。
- `sets`: 集約の対象 (`sum(hostile, hp)` 等)。

#### actions/<slug>.json

```json
{
  "id": "action:bestia:shoot",
  "name": { "ja": "射撃", "en": "Shoot" },
  "actor": ["self", "entity"],
  "params": { "target": { "kind": "entity", "where": "hostile($target) && visible($target)" } },
  "maps_to": { "attack": "$target" },
  "pre": "t >= ready_at(actor) && dist(actor, $target) <= range(actor)",
  "duration": "0",
  "effects": [
    { "at": "start", "outcomes": [
        { "p": 1, "assign": [ { "var": "ready_at", "of": "actor", "expr": "t + cooldown_sec(actor)" } ] } ] },
    { "at": "start", "when": "mode($target) != state:bestia:battle-ai#dodge", "outcomes": [
        { "p": 1, "assign": [ { "var": "hp", "of": "$target", "expr": "hp($target) - rule(rule:bestia:damage)" } ] } ] }
  ],
  "cost": { "resource": {} },
  "knowledge": "discoverable",
  "source": { "kind": "master", "ref": "Bestia src/world.cpp attack()" }
}
```

```json
{
  "id": "action:bestia:move",
  "name": { "ja": "移動", "en": "Move" },
  "actor": ["self", "entity"],
  "params": {
    "goal": { "kind": ["entity", "node", "point"] },
    "how":  { "kind": "enum", "domain": ["toward", "away", "sideways"], "default": "toward" },
    "for":  { "kind": "number", "unit": "s", "range": [0.1, 2], "step": 0.5, "default": 0.5 }
  },
  "maps_to": { "move_to": "$goal", "params": { "how": "$how" } },
  "pre": "1",
  "duration": "$for",
  "motion": { "of": "actor", "kind": "$how", "goal": "$goal", "speed": "speed(actor)", "keep": 1.5 },
  "effects": [],
  "knowledge": "shown",
  "source": { "kind": "master", "ref": "Bestia src/world.cpp step" }
}
```

- `actor`: 誰がこの行動を取れるか。`self` を含む行動だけが自分のアフォーダンスになる。式の中の `actor` はその行動の実行者に束縛される。
- `params`: 候補の生成法。`entity` は `where` を満たす可視個体、`node` は地図ノード、`point` は運動プリミティブが作る点 (後述)、数値は `range` と `step` で **有限個に離散化** する (連続空間を計画器に見せる唯一の口)。
- `maps_to`: §7.3 の抽象アクションへの対応。`$how` のような追加情報は `params` に載せる (`replay.schema.json` の `action.params` は既にある)。相手用の行動には不要。
- `pre`: 式 (真偽 = 区間)。`duration`: 式 (秒、ターン制では手番数)。
- `effects[]`: 効果群。`at` = `start` / `end` / 秒。`when` 任意。`outcomes[]` は `p` の和が 1 (validate)。`assign[]` は変数・所有者・式 (叩き台の `"hp($target)": ...` というキーに式を入れる形は、JSON キーに左辺式を埋めるので構文検査もレンダも難しい。配列にする)。
- `motion`: 運動プリミティブ。`kind` = `toward` / `away` / `sideways` / `to_node` / `hold`、`goal`、`speed`、`keep` (これ以上近づかない距離)。前向きモデルはこれを `dt` の副ステップで積分する。`point` 型のパラメータは、運動の到達点として計画器が作る (例: `away` で `for` 秒進んだ点)。
- `cost`: 資源の消費 (`assign` で書いてもよいが、調停者が費用として読む場所を固定する)。
- 1 つの行動が `maps_to` を持ち、相手 (`entity`) にも使えるので、§14.F の敵 AI 再利用で同じファイルが使える。

#### actions/<slug>.masked.json (上書き)

```json
{
  "id": "action:bestia:shoot",
  "override": {
    "effects": [
      { "at": "start", "outcomes": [ { "p": 1, "assign": [ { "var": "ready_at", "of": "actor", "expr": "t + cooldown_sec(actor)" } ] } ] },
      { "at": "start", "when": "mode($target) != state:bestia:battle-ai#dodge", "outcomes": [
          { "p": 0.5, "when_target": "moved($target)", "assign": [] },
          { "p": 0.5, "assign": [ { "var": "hp", "of": "$target", "expr": "hp($target) - rule(rule:bestia:damage)" } ] } ] }
    ]
  },
  "knowledge": "masked",
  "source": { "kind": "master", "ref": "Bestia src/behavior.cpp movingEvasion 0.5" }
}
```

- `override` は見える定義の **同名キーを丸ごと置き換える** (マージしない。部分差分は読み手に「何が隠れているか」を推測させる)。
- validate: `.masked.json` に `override` と `knowledge: masked` 以外が無い。見える側は単独で完結している (確率の和 1、参照切れなし)。
- `omniscient` ビューだけが上書きを適用する。`player` ビューの型 (§4) には上書きという概念そのものが無い。

#### processes/<slug>.json

```json
{
  "id": "process:bestia:regen",
  "of": "self",
  "when": "alive(self) && t - last_damaged_at(self) >= 1.5",
  "rate": [ { "var": "hp", "expr": "min(max_hp(self), hp(self) + 8 * dt)" } ],
  "knowledge": "discoverable",
  "source": { "kind": "master", "ref": "Bestia src/world.cpp regen" }
}
```

過程は副ステップごとに `when` が真なら `rate` を適用する。ターン制では `dt` = 1 手番。弾の飛行 (発射から着弾までの時間) も `projectile` 型の一時個体 + 過程で書けるが、Bestia の sim は即着弾なので R1 では扱わない (§9 未決 7)。

#### states/<slug>.json (既存 + `when` / `p`)

```json
{ "from": "chase", "to": "dodge", "on": "弾が迫る", "rule": "rule:bestia:dodge-window",
  "when": "shot_at(self)", "p": 0.25, "hold": "rule(rule:bestia:dodge-window)" }
```

- `on` は人向けに残す。`when` が機械評価の条件、`p` は条件が真のときに遷移する確率 (省略 = 1)、`hold` はその状態に最低限留まる秒数 (式)。
- `shot_at(x)` のような **イベント由来の一時変数** は `variables.json` に `type: bool, observe: event:miss|hit -> 1, decay: tick` のように宣言する。sim の `shotAt` に対応。

#### behaviors/<slug>.json

```json
{
  "id": "behavior:bestia:battle-ai",
  "paradigm": "fsm",
  "machine": "state:bestia:battle-ai",
  "targeting": { "var": "target", "pick": "nearest(all_fighters_except(actor))" },
  "act": {
    "chase":   { "action": "action:bestia:move",  "params": { "goal": "$target", "how": "toward", "for": "dt" } },
    "attack":  { "action": "action:bestia:shoot", "params": { "target": "$target" } },
    "dodge":   { "action": "action:bestia:move",  "params": { "goal": "$target", "how": "sideways", "for": "dt" } },
    "retreat": { "action": "action:bestia:move",  "params": { "goal": "$target", "how": "away", "for": "dt" } },
    "return":  { "action": "action:bestia:move",  "params": { "goal": "node:center", "how": "toward", "for": "dt" } }
  },
  "knowledge": "discoverable",
  "source": { "kind": "master", "ref": "Bestia src/behavior.cpp" }
}
```

方式ごとの本体:

| `paradigm` | 記述 | 解釈器の段 |
|---|---|---|
| `fsm` | `machine` (states 参照) + `targeting` + 状態 → 行動の `act` 表 | R1 |
| `scripted` | `timeline: [{at, action, params}]` | R1 |
| `bt` | `tree`: Selector / Sequence / Condition (`pred` 式) / Action (行動 ID + params)。既存 `TreeSpec` に `pred` を足した形 | R3 |
| `utility` | `considerations: [{expr, weight, curve}]` を行動候補ごとに合成 | R3 |
| `goap` | `goal` (式) + `actions[]` (使える行動 ID) + `heuristic` 任意 | R3 |

挙動モデル自体が `masked` なら player では存在せず、相手は「学習モデル」(§3.10) で代える。entity 文書の `behavior` は現行どおり状態機械を指してよいが、R1 以降は `behavior:` を指すのを正とし、`state:` 直指しは「fsm で `act` 無し (予測は遷移だけ)」と解釈する。

#### objectives.json

```json
{
  "win":  "count(hostile) == 0",
  "lose": "!alive(self) || (has(time_limit) && t >= time_limit)",
  "progress": [
    { "id": "hostile_hp",  "expr": "sum(hostile, hp)",  "better": "lower",  "scale": "sum(hostile, max_hp)", "knowledge": "discoverable", "source": { "kind": "master", "ref": "Bestia last-monster-standing" } },
    { "id": "own_hp",      "expr": "hp(self)",          "better": "higher", "scale": "max_hp(self)",         "knowledge": "shown",        "source": { "kind": "master", "ref": "Bestia HP bar" } }
  ],
  "knowledge": "shown",
  "source": { "kind": "master", "ref": "Bestia spec/feature/battle.md" }
}
```

- `progress[]` は **ゲームが進捗として定義するもの** (勝敗条件を連続化したもの) で、攻略法ではない。これが GOAP のヒューリスティクス (目標述語への距離) と MCTS のロールアウト評価 (端末: win = 1 / lose = 0、非端末: 正規化した進捗の平均) の唯一の源。重みは等分が既定で、ペルソナが `progress_weights` で歪められる (「安全重視の初心者」)。
- `stage.json` の `objectives` (人向けの文) は残し、機械用の `objectives_expr` でステージごとに上書きできる。

#### アダプタだけの最小ルールブック

ルールブックが無い外部ゲームは、アダプタの `hello` に任意の `actions[]` (verb、params の種類) を足し、エンジンが `pre: 1`、`effects: []`、`effects_known: false`、`source.kind: adapter` の行動を合成する。全部が「要実験」から始まる。`maps_to` 以外は何も知らないので、信念は観測で `observe` できる基本項目 (自位置、可視個体、HP 比) だけになる。

### 3.3 式言語 v2 (`src/domain/expression/`)

```
expr    := or
or      := and ( '||' and )*
and     := not ( '&&' not )*
not     := '!' not | cmp
cmp     := sum ( ( '<' | '<=' | '==' | '!=' | '>=' | '>' ) sum )?
sum     := term ( ( '+' | '-' ) term )*
term    := unary ( ( '*' | '/' ) unary )*
unary   := ( '+' | '-' ) unary | primary
primary := number | idtoken | param | ident | ident '(' args ')' | '(' expr ')'
param   := '$' ident
idtoken := ident ':' [a-z0-9-]+ ( ':' [a-z0-9-]+ )* ( '#' [a-z0-9-]+ )?     例 rule:bestia:damage、state:bestia:battle-ai#dodge
```

- **値は全て区間** `[lo, hi]`。数値リテラルは点。真偽は `[0,0]` 偽、`[1,1]` 真、`[0,1]` 不明。比較: `a < b` は `a.hi < b.lo` なら真、`a.lo >= b.hi` なら偽、他は不明。`&&` = min、`||` = max、`!` = 1 − x (Kleene の三値)。`if(c, a, b)`: c が不明なら a と b の包 (hull)。
- 文脈関数 (評価文脈から注入、組み込みではない): 変数参照 `hp(x)`、`dist(a, b)`、`rule(rule:...)` (rule を現在の変数で評価)、`visible(x)`、`kind(x)`、`has(name)`、集約 `count(set)` / `sum(set, var)` / `min(set, var)` / `max(set, var)`、`nearest(set)`、`node(x)`。文脈は `self` / `actor` / `$param` / ID トークンを個体に束縛する。
- 既存の rule (`rule.schema.json`) は変数名だけの式なので、v2 で **点評価の結果は不変** (トークン・優先順位とも上位互換: 既存の演算子集合に対して文法は同一)。受入: 全 sample rule の example 評価が変更前後で一致するテスト。V08 は変えない。
- 静的検査 (validate): 未知の関数 / 変数 / パラメータ / ID、所有者の型違い (`hp(node:center)`)、比較の両辺の単位、区間除算で 0 を跨ぐ可能性 (warning)。
- 上限: 長さ 1000、深さ 64 は現行どおり。

### 3.4 信念状態と前向きモデル (`src/rulebook/`)

```
load-rulebook(bundle, mode)      → Rulebook<mode>     player は toPlayerView 経由 + override 無し型
build-belief(rulebook, frame)    → Belief             観測 + 宣言 (init / from / range)
predict(belief, action, dt)      → Belief             自分の行動 + 過程 + 相手の挙動モデルで 1 ティック
correct(predicted, frame)        → Belief             observe できる変数は観測で上書き、できない変数は予測のまま
simulate(belief, action, params, mode, rng?) → Belief | Belief[] | {belief, p}[]
```

- **1 ティックの信念更新** = `correct(predict(prev, lastAction), frame)`。観測に無い値 (敵 HP) は予測だけで追う。予測に不明 (区間) が入れば区間が広がり、観測できる値は点に戻る。これが「人間が頭の中で敵の残り HP を数える」に相当する。
- **simulate の意味論**: 行動の `duration` を `dt` の副ステップに割り、各副ステップで (1) 自分の `motion` を積分、(2) `at` が来た効果を適用、(3) 全過程を適用、(4) 各相手の挙動モデルを 1 歩 (遷移 → `act` の行動を同じ simulate で適用)、(5) `derive` を再計算。順序は sim の `step-sim.ts` と同じ (自分 → 相手 → 過程 → 終了判定) にそろえ、R1 の受入「1 ステップ予測が sim と一致」をこの順序で検査する。
- `mode`: `sample` (seed からの決定的サンプル: 各 `outcomes` を 1 つ選ぶ、`p` 付き遷移も同様)、`expect` (outcomes の期待値を区間として合成: 各分岐の結果の包。確率の重みは `predicted.value` の計算にだけ使う)、`enumerate` (分岐列挙、`{belief, p}[]`、幅は予算で切る)。
- **不明の伝播**: 不明値に依存する `assign` は区間演算で広がる。`pre` が不明の行動を simulate するときは「成功分岐 / 失敗分岐」の列挙になる。
- 前向きモデルは **純関数** (信念はイミュータブル、乱数は引数)。

### 3.5 アフォーダンス (`affordances(belief, rulebook, k, bound)`)

| 分類 | 定義 | 出力に添える理由 |
|---|---|---|
| `now` | `actor` に `self` を含む行動で、あるパラメータ束縛に対し `pre` が真 | 束縛 |
| `uncertain` (要実験) | `pre` が不明 (区間のため)、または `effects_known: false`、または効果式に不明値が入る | 不明の原因となった変数と区間 |
| `reachable(n)` | `pre` の偽の項を真にできる行動列が後ろ向き探索で深さ ≤ k、費用 (時間 + 資源) ≤ bound で見つかる | 有効化する行動列 |
| `blocked` | 上のどれでもない | 偽になった連言の項 (例: `dist(self, 2) <= range(self)` が 31 > 20) |

- k と bound はペルソナの `planning.affordance` (既定 k = 2、bound = 5 秒)。叩き台の「1〜2 手先」はこのパラメータ。
- 毎ティック計算し、判断ログに件数と分類別 ID を残す (全文は `--verbose` のみ)。
- `blocked` の理由は §8.5 の帯の材料 (「ルール上は可能だが射程に入れない」= extreme / illusory の候補)。一度も `now` にならなかった行動は未使用の仕組みとして意図ズレレポートへ。

### 3.6 提案者 (`src/engine/proposers/`)

共通契約:

```ts
interface Proposer {
  readonly id: ProposerId;                 // continuation | reactive | goap | mcts | experiment | tactic
  propose(input: ProposeInput): ProposeOutput;   // 純関数。rng はティック別派生ストリーム
}
interface ProposeInput { belief; rulebook; affordances; objectives; regime; budget; persona; running?: Plan; rng: Rng; }
interface ProposeOutput { plans: Plan[]; used: BudgetUsage; notes: Record<string, unknown>; }
```

Plan IR:

```json
{
  "plan_id": "plan:goap:t744:1",
  "proposer": "goap",
  "goal": "hp(2) <= 0",
  "steps": [
    { "action": "action:bestia:move",  "params": { "goal": 2, "how": "toward", "for": 0.5 }, "expect": { "within_sec": 0.6, "pred": "dist(self, 2) <= range(self)" } },
    { "action": "action:bestia:shoot", "params": { "target": 2 }, "expect": { "within_sec": 0.2, "pred": "hp(2) <= 150" } },
    { "action": "action:bestia:shoot", "params": { "target": 2 }, "repeat_until": "hp(2) <= 0" }
  ],
  "valid_while": "alive(2) && visible(2)",
  "predicted": { "value": 0.42, "cost_sec": 3.1, "risk": 0.08, "trust": 0.8, "progress": { "hostile_hp": -0.25, "own_hp": -0.05 } },
  "provenance": { "expansions": 37, "plan_cost": 3.1, "alternatives": 2 }
}
```

| 提案者 | 何を出すか | 予算の単位 | 備考 |
|---|---|---|---|
| `continuation` | 実行中の計画 (有効なら) をそのまま。再予測して `predicted` を更新 | なし | ヒステリシスはここに付く |
| `reactive` | `now` のアフォーダンス各 1 手を 1 ステップ simulate (expect) し、進捗の変化で並べた上位 n 本の 1 手計画 | n (既定 8) | 計画なしで常に動ける最低線。Utility そのもの |
| `goap` | 目標述語 (win、または進捗尺度を閾値化した部分目標 `sum(hostile, hp) <= 0.5 * scale` 等、生成規則はデータ) へ、行動の `pre` / `effects` で A*。費用 = 時間 + 資源 + 予測被害。確率的効果は期待値 | 展開ノード数 | 決定的・敵が消極的・手順が要る局面向け |
| `mcts` | 前向きモデル (sample) と相手モデルで UCT。行動は離散化されたパラメータ付き行動、1 ノード = 1 行動 (持続時間ぶん進む)。根の最良子から深さ h の主系列を計画に | ロールアウト数 × 深さ (× determinization 数) | 確率的・敵が能動的・分岐が大きい局面向け。木の再利用 (根のシフト) 可 |
| `experiment` | `uncertain` の行動のうち安全条件 (§3.11) を満たすものを 1 手計画に。`predicted.value` は情報利得 | n | ペルソナの探索率と `purpose` で有効化 |
| `tactic` | 既存の段 3 候補 (定石・変種) を、`do` を前向きモデルで simulate して `predicted` を付けた計画に | なし | `guided` / `hybrid` 構えだけ。`autonomous` では生成されない |

- 全提案者が同じ `predicted` を同じ前向きモデルで付けるので、方式が違っても **同じ通貨** で比べられる (`tactic` の `metrics` は `trust` の事前分布としてだけ効く)。
- 提案者は予算を使い切らなくてよい。使った量は判断ログに残す。

### 3.7 調停者 (Utility v2、`src/engine/arbiter/`)

既存 `scoreCandidate` の合成 (重み付き平均 + ヒステリシス) をそのまま使い、考慮項目を計画向けに差し替える。

| 考慮項目 | 値 (0〜1) |
|---|---|
| `value` | `predicted.progress` を `objectives.progress` の向きで正規化し重み付き平均 (端末 win = 1、lose = 0) |
| `risk` | 1 − 予測被害 (lose 条件に近づく量) |
| `cost` | 1 / (1 + cost_sec / 既定 10 秒) (ターン制は手番数) |
| `trust` | 予測の確からしさ = 1 − (計画が依存する不明区間の相対幅の平均) |
| `info` | 実験計画: 期待される区間幅の縮小 (他は何も言わない) |
| `continuity` | 実行中計画 1、他 0 (ヒステリシスは既存の加点のまま) |
| `novelty` | `coverage` のときだけ: 未試行の行動 / 未訪問ノードを含む計画 1 |

- ペルソナ v2 は `weights` を `guided` 用 (現行 8 項目) と `autonomous` 用 (上 7 項目) の 2 組持つ (`persona.schema.json` の `required` を壊さず `weights_autonomous` を足す)。
- 同点は計画 ID 順 (提案者 ID → 生成順の番号) で決める。判断ログは全計画を ID 順に並べ、採った計画 1 つに `chosen`。

### 3.8 実行者 (BT v2、`src/engine/bt/`)

- 計画 → 木: `Sequence[ Condition(valid_while), Step1, Step2, ... ]`、各 Step は `Selector[ Sequence[Condition(expect.pred), succeed], Action(maps_to を解決) ]` と `repeat_until` のループ。ノードは既存 4 種 + `pred` を取る Condition (既存の `when` 語彙と並存: `{ "pred": "<式>" }`) + `repeat` 装飾。既存の `stepTree` / `BtMemory` を使う。
- Action 葉は行動 ID + パラメータから `maps_to` を解決して抽象アクションにする (`resolve-step.ts` の拡張)。`move` は `duration` ぶん `move_to` を出し続け、`motion.keep` 以内で成功。
- 再計画の引き金: `valid_while` 偽、ある手の `expect` が `within_sec` 内に真にならない、次の手の `pre` が偽、計画の最後、`replan_every_ticks` 経過、`regime` の変化、新しい `now` アフォーダンス (`uncertain` → `now`)。引き金が無いティックは `continuation` 以外の提案者を **回さない** (リアルタイムの既定。予算表で変えられる)。
- expect の判定は既存 `checkExpect` に `pred` を足す (`entity_state` は残す)。

### 3.9 方式の使い分け (予算表)

レジームは信念から計算する (ゲーム非依存、攻略法ではなく「負け条件への近さ」):

| レジーム | 定義 |
|---|---|
| `critical` | 相手のアフォーダンス (相手が `actor` の行動で `pre` が真または不明) を h 秒 (既定 2) 適用した最悪ケースで `lose` が真になりうる、または `progress` の lose 側尺度が閾値 (既定 0.8) を超える |
| `threat` | 相手のアフォーダンスのうち、自分の lose 側尺度を悪化させる効果を持つものが `now` / `uncertain` にある |
| `calm` | それ以外 |

モデル信頼度 `trust` = 1 − (自分と可視相手の変数のうち不明区間の相対幅平均)。

予算表 (ペルソナ v2 `planning`、manifest の `deciders.planning` で上書き可):

```json
{
  "planning": {
    "affordance": { "k": 2, "bound_sec": 5 },
    "replan_every_ticks": 5,
    "tree_reuse": true,
    "budgets": {
      "realtime": {
        "calm":     { "reactive": 8, "goap": { "expansions": 200 }, "mcts": null,                                    "experiment": 2 },
        "threat":   { "reactive": 8, "goap": { "expansions": 60 },  "mcts": { "rollouts": 48, "depth": 6 },          "experiment": 1 },
        "critical": { "reactive": 8, "goap": null,                  "mcts": { "rollouts": 32, "depth": 3 },          "experiment": 0 }
      },
      "turn": {
        "any":      { "reactive": 16, "goap": { "expansions": 2000 }, "mcts": { "rollouts": 2000, "depth": 20, "determinizations": 8 }, "experiment": 2 }
      }
    },
    "low_trust": { "below": 0.5, "scale": { "goap": 0.25, "mcts": 0.25 }, "experiment_bonus": 2 }
  }
}
```

- `null` はその提案者を回さない。`low_trust` はモデルが当てにならないときに計画型の予算を削り、実験を増やす (叩き台の「予測誤差が大きい → Utility + 実験」に相当)。
- この表は **計算資源の配分** であって攻略法ではない。初期値は人が置く。bench (`--report proposers`) が提案者別に「採用率・予測誤差 (予測した進捗と実際の差)・採用時の成果」を出し、表の変更提案は `learn consolidate` と同じ承認経路 (`observations/planning-proposals.json` → 承認 → persona / manifest の差分)。オンラインの自動補正はしない。
- 判断ログに `regime`、`trust`、各提案者の予算と使用量、出した計画数を残す。`guide replay diff` は「採った計画の提案者が異なる最初のティック」も出す。

### 3.10 相手のモデル

| 相手の挙動モデルの knowledge | player での扱い |
|---|---|
| `shown` / `discoverable` | その方式の解釈器で動かし、予測に使う。`state_guess` が観測にあれば状態を補正 |
| `masked` または無し | player ビューには存在しない。**学習モデル** で代える: 相手の行動分類 (接近 / 離脱 / 攻撃 / 横移動 / 静止、観測の位置差分とイベントから機械的に分類) の頻度を、観測できる特徴 (距離の帯、自分の直前の行動分類) で条件付けして `observations/opponents/<entity-slug>.json` に積む。事前分布は一様 |

- MCTS での相手: `policy` (挙動モデル / 学習モデルを方策としてサンプル。木のノードは自分の手だけ) が既定。ターン制で相手の挙動が不明なら `adversarial` (相手手番をノードにして価値を最小化)。manifest `deciders.opponent` で選ぶ。
- 隠れ情報 (手札・山札) は変数の `enum` / `count` の区間として持ち、MCTS は `determinizations` 回だけ区間から決定化してサンプルする (情報集合 MCTS の簡易形)。
- 相手の挙動モデルが 5 方式のどれで書かれていても、§3.6 の提案者と同じ実装を「相手を actor にして」回すので、§14.F (敵 AI としての再利用) は `self` の差し替えだけになる。

### 3.11 実験と効果の学習

- 実験候補 = `uncertain` の行動で、**安全条件**: その行動を 1 回 simulate (不明は最悪側) しても `critical` に入らない、かつ資源の消費が区間下限で払える。
- 価値 (`info`) = 対象の不明変数の相対区間幅 × (1 − 予測被害)。1 回の実験で幅がどれだけ縮むかは「観測で値が読める (observe あり) なら 1、予測だけで追う変数なら 0.5」の粗い係数で十分 (正確な情報量計算は過剰)。
- 有効化: `purpose=coverage` では常に、`efficiency` ではペルソナの `exploration_rate` の確率 (既存の探索ティックの判定を流用) と `low_trust` の加点。
- 結果の取り込み: reflect が行動の前後の信念差を `observations/mechanics/<action-slug>.json` に積む。

```json
{
  "action": "action:bestia:shoot",
  "samples": 24,
  "runs": ["run:bestia-expert-s1", "run:bestia-expert-s2"],
  "effects": [
    { "var": "hp", "of": "$target", "observed_delta": { "lo": -24, "hi": 0, "mean": -12.4, "sd": 12.1 }, "predicted_delta": { "lo": -24, "hi": -24 } }
  ],
  "outcome_classes": [ { "signature": "no-change", "count": 12 }, { "signature": "hp-24", "count": 12 } ],
  "knowledge": "discoverable",
  "source": { "kind": "observed", "ref": "run:bestia-expert-s1 x24" }
}
```

- 次の run からは `load-rulebook` が overlay を **player ビューの上に重ねる** (見える定義の効果区間を観測区間に置き換える。真の定義は見えないまま)。正本への昇格は §8.4 と同じ承認制。
- `omniscient` の検算 (スコアには使わない): 学習した区間と真の定義 (上書き適用後) の期待値がずれていれば「ルール記述の不具合候補」、合っていて見える定義とずれていれば「プレイヤーに誤解される仕組み」として `report knowledge` に出す。
- `player` の観測だけを数える (既存 overlay と同じ。omniscient run は `ignored_omniscient` に列挙)。

### 3.12 定石の書き出し (`learned`)

- 実行者が計画を最後まで完走し、`predicted.value` の 70% 以上の進捗を実際に得たとき、reflect が `observations/plans/<run-slug>.jsonl` に (開始時の `now` アフォーダンスの連言、計画、実測) を 1 行書く。
- `learn ingest` が (目標述語、行動列 (パラメータの種類まで)) で束ね、`rewrite.min_runs` 以上で成功率が閾値以上なら `tactics/<slug>.json` の候補 (`confidence: learned`、`because` = 行動 ID と参照 rule、`when_expr` = 開始時の連言を式で) を作る。既存の `when` 語彙では書けないので tactic スキーマに `when_expr` (式) を任意で足し、段 3 の match は `when_expr` があれば式で判定する。
- 以後は §8.2 の書き換え・承認経路そのまま。定石は判断の **出力** であって `autonomous` の入力にはならない。

### 3.13 構え (stance)

| `stance` | 提案者 | 判断に使う知識 | 用途 |
|---|---|---|---|
| `autonomous` (推奨既定) | continuation / reactive / goap / mcts / experiment | player ルールブック + 観測 + 学習した効果 | 本来のオートプレイヤー |
| `guided` | 既存の段 3 (`decideTick` そのまま) | 定石 + 汎用 + 探索 | 比較基準。bench 基準値はこれで取ってある |
| `hybrid` | autonomous の全部 + tactic | 両方。定石は simulate して同じ通貨で比べる | 定石の価値の測定、§8.2 の対照 |

- `guided` は既存コードを変えずに残す (段 3 の `utility-bt` decider はそのまま `stance: guided` の実装)。新しい decider ID は `autonomous` と `hybrid` (`decider-registry.ts` に追加、`needsEngineSetup` true)。
- replay header に `stance` と `decider` を残す (無い旧記録は `guided`)。bench 結果と §14.C の比較可能性キーに `stance` を足す。
- `player` / `omniscient` とは独立の軸。`autonomous` + `omniscient` は上書き適用済みルールブックでの検算用。
- §12 の「攻略本ありで明確に強い」は `autonomous` では「ルールブックあり (`samples/bestia/mechanics`) が、アダプタ最小ルールブック (全部要実験) より明確に強い」。`guided` との差は bench で並べる。

### 3.14 判断ログとリプレイの拡張 (`schema/replay.schema.json`)

```json
{ "type": "tick", "tick": 744, "t": 74.4, "observation": { "...": "..." },
  "planning": {
    "stance": "autonomous", "regime": "threat", "trust": 0.82,
    "affordances": { "now": 5, "uncertain": 1, "reachable": 2, "blocked": 3 },
    "proposers": {
      "continuation": { "plans": 1 },
      "reactive":     { "plans": 5, "used": { "n": 5 } },
      "goap":         { "plans": 2, "used": { "expansions": 41 } },
      "mcts":         { "plans": 1, "used": { "rollouts": 48, "depth": 6 }, "root": [ { "action": "action:bestia:shoot", "visits": 21, "value": 0.44 } ] },
      "experiment":   { "plans": 0 }
    },
    "replanned": true, "trigger": "expect-broken"
  },
  "decision": [
    { "candidate": "plan:goap:t744:1", "proposer": "goap", "utility": 0.61, "chosen": true,
      "parts": { "value": 0.7, "risk": 0.9, "cost": 0.76, "trust": 0.8 },
      "predicted": { "value": 0.42, "cost_sec": 3.1, "risk": 0.08, "trust": 0.8 } },
    { "candidate": "plan:mcts:t744:1", "proposer": "mcts", "utility": 0.58, "chosen": false, "predicted": { "value": 0.45, "cost_sec": 4.0, "risk": 0.12, "trust": 0.7 } }
  ],
  "action": { "move_to": 2, "params": { "how": "toward" } } }
```

- `decisionEntry` に任意の `proposer` / `parts` / `predicted`、tick 行に任意の `planning` を足す。旧記録はそのまま読める (R5 / R6 / R7 の不変条件は変えない)。`planning` と `predicted` にも masked が無いことは既存の `isMaskedInPlayer` が深さを問わず見るので追加作業なし。
- `guide replay play` は `stance` / `decider` を header から読み、同じ構えで再判定する。

### 3.15 1 ティックの流れ (`autonomous`)

```
frame = observe()                                   (driver、masked 二重検査は現行どおり)
belief = correct(predict(prev.belief, prev.action), frame)
reflect: prev の expect 判定、実験の前後差を overlay へ、完走した計画を plans へ
aff = affordances(belief)
regime, trust = regime(belief, aff)
trigger = replanTrigger(prev.running, belief, aff, regime, tick)
plans = [continuation]
if trigger: for each proposer p in budgets[form][regime] (low_trust で縮小):
    plans += p.propose({belief, rulebook, aff, objectives, regime, budget, persona, running, rng: stream(seed, p.id, tick)})
scored = arbiter(plans, persona, purpose)            (ID 順、ヒステリシス)
for plan in rank(scored): result = executor.step(plan.tree, memory, belief, frame); if result.action: break
action = misplay ? wait 0 : result.action          (既存の 2 回の乱数はそのまま最初に引く)
log planning + decision + action
```

### 3.16 ターン制・離散 (KonbiniDominant / カード系) への適用

- manifest `execution: turn`。`dt` = 1 手番、`duration` = 手番数 (既定 1)、過程は手番の始め / 終わりに走る (`at: turn-start | turn-end`)。
- 相手の手番は前向きモデルの副ステップで相手の挙動モデル (または学習モデル / adversarial) が 1 行動取る。同時手番のゲームは `simultaneous: true` で自分と相手の行動を同じ副ステップに適用する。
- 空間はノード (地図) か無し。`motion` は使わず `to_node` だけ、または `assign` で `node` 変数を書く。
- 隠れ情報: `count` / `enum` 変数の区間 + determinization。
- 離散・決定的・相手が無い (パズル) なら予算表で `mcts: null`、GOAP だけになる。

---

## 4. マスク原則との整合

| 担保 | 仕組み | テスト |
|---|---|---|
| masked の行動・効果・変数・挙動モデルが player の前向きモデルに入らない | `load-rulebook(bundle, 'player')` は `toPlayerView` 経由で読む (既存のエンジン世界と同じ入口)。`PlayerRulebook` 型に `override` も `knowledge: 'masked'` も表現できない (`Knowledge` を `'shown' | 'discoverable'` に絞った型)。`.masked.json` は player ビューでは読み込み対象外 | player ルールブックを JSON 化して `masked` / `override` を深さ問わず検索し 0 件。omniscient では上書きが適用され、見える定義と `simulate` の結果が変わる |
| 「存在も知らない」と「値が分からない」の区別 | 前者 = player 型に要素が無い。後者 = 要素はあり値が区間 (`range` 幅)。アフォーダンスは後者だけを `uncertain` にする | masked 上書きされた行動は player で `now` (見える定義で評価)、`discoverable` で未観測の変数を参照する行動は `uncertain` |
| 学習した効果の knowledge | overlay は `discoverable` / `observed` のみ。player run だけ数える。昇格は承認制 | omniscient run を混ぜても overlay が変わらない |
| 判断ログに masked が漏れない | `planning` / `predicted` も既存の記録器の `isMaskedInPlayer` が検査 | 上書き済み (omniscient) の値を player のログに書こうとすると `RecordingError` |
| 相手の masked 挙動モデル | player ビューに存在せず、学習モデルは観測できる特徴だけで条件付ける (状態名を使わない) | `state_guess` の無い観測列から学習モデルが作れる |
| 行動の knowledge の伝播 | validate: 行動の `knowledge` ≥ 参照する変数・rule・状態機械の最も厳しいもの。`masked` の変数を参照する行動は見える側に置けない (置くなら上書きで) | 1 項目 1 テスト |
| 意図は使わない | `autonomous` の提案者・調停者は `EngineWorld.stages[].intents` を参照しない (型で `StageView` から意図を外した `PlanningStageView` を渡す) | `--intent-assist` を付けても `autonomous` の判断が変わらない |

---

## 5. 性能と決定性

- **予算は反復回数** (展開ノード数、ロールアウト数、深さ、determinization 数、reactive の n)。壁時計は `planning.wall_ms` として測って記録するだけで、判断には使わない。超過が常態なら予算表を下げる (人の判断)。sim の 0.1 秒ティックで、`threat` の既定 (GOAP 60 展開 + MCTS 48 × 6) は TypeScript で数 ms のオーダに収まる見込み。実測は R2 / R3 の受入で `bench --report proposers` に `wall_ms` の p50 / p95 を出す。
- **乱数**: 既存の `utility-bt` は毎ティック 2 回引いて列をずらさない。提案者の乱数は `createRng(deriveSeed(seed, `${proposer}:${tick}`))` の **ティック別派生ストリーム** にし、提案者が何回引いても他のティック・他の提案者に影響しない。sim は現行どおり `deriveSeed(seed, 'sim')`。
- **順序**: 個体・行動・パラメータ・計画は常に ID 順 / 宣言順で走査する (Map の挿入順に依存しない)。効用・予測値はログに 6 桁で丸める (既存と同じ)。
- **木の再利用**: MCTS の木は実行した行動の子へ根をずらして持ち越す (`tree_reuse`)。信念が `correct` で変わったときはその子の統計を保ったまま再評価する (決定的)。
- **計画の使い回し**: 引き金が無ければ提案者を回さない (§3.8)。`continuation` だけのティックは現行の `decideTick` と同程度の費用。
- **並列化しない**: 決定性のため提案者は逐次。将来 worker で並列にするなら乱数ストリームと ID 順を保てば結果は同じ。
- **リプレイ**: `guide replay play` は同じ seed・同じ構え・同じペルソナ・同じ overlay (ハッシュを header に) で再判定する。overlay の有無で判断が変わるのは学習の定義どおりで、header の `overlay_hash` が違えば play は「比較不能」と言う (黙って不一致にしない)。

---

## 6. 既存資産との関係

| 資産 | 扱い |
|---|---|
| `Decider` 契約 (`src/replay/decider.ts`)、`decider-registry.ts` | 残す。`autonomous` / `hybrid` の decider を追加。`utility-bt` は `guided` として不変 |
| `driver.ts`、masked 二重検査、記録器、`replay play / diff` | 残す。diff に提案者の分岐を足す |
| `decide-tick.ts` (段 3) | `guided` の実装として残す。`autonomous` は別の `decide-tick-autonomous.ts` (信念更新 → 提案 → 調停 → 実行)。共通部 (知覚遅延、誤操作、ログ整形) は関数に切り出して共有 |
| `src/engine/candidates/*` (定石・汎用・探索・変種) | `guided` と `hybrid` の `tactic` 提案者が使う。`generic:*` は `autonomous` では使わない (ルールブックが空のときの最後の砦としても使わない: アダプタ最小ルールブックの `reactive` が代わり) |
| `src/engine/utility/*` | 合成器 `scoreCandidate` の形を共有。考慮項目は計画向けの新しい組を `src/engine/arbiter/considerations/` に 1 項目 1 ファイル |
| `src/engine/bt/*` | 残して拡張 (`pred` Condition、`repeat`、行動 ID 葉)。`stepTree` / `BtMemory` の契約 C-20 は不変 |
| `src/engine/expect/check-expect.ts` | `pred` を足す |
| `src/engine/persona/*`、`schema/persona.schema.json` | v2: `weights_autonomous`、`planning`、`progress_weights` を任意で足す。同梱 3 ペルソナに既定値を足す |
| `src/engine/reflect/*`、overlay、`learn ingest / consolidate / approve` | 残す。`observations/mechanics/`、`observations/plans/`、`observations/opponents/`、`planning-proposals.json` を足す。承認経路は同じ |
| `src/adapters/sim/*` | 残す。`enemy-transitions.ts` の「遷移先 id の慣例」は、遷移に `when` があればそれを式で評価する経路に置き換え (無ければ現行の慣例)。`enemy-act.ts` も `behaviors` の `act` 表があればそれを使う。手書き版の軌跡 (seed 固定の observation 列) を golden として `tests/fixtures/sim/` に残し、置き換え後も一致することを検査 (同語反復の防止) |
| `src/domain/expression/*` | v2 に拡張。点評価の結果は不変 (全 sample rule で検査)。V08 不変 |
| `schema/rule.schema.json`、`state.schema.json`、`tactic.schema.json` | rule: 不変。state: `when` / `p` / `hold` 任意追加。tactic: `when_expr` 任意追加 |
| `schema/replay.schema.json` | `planning`、`decisionEntry.proposer / parts / predicted`、header `stance / decider / overlay_hash` を任意追加 |
| `bench`、§14.C ゲート (`spec/feature/balance-gate.md`) | `--stance`、結果と比較可能性キーに `stance` / `decider`。既存基準値は `guided` と見なす。`autonomous` の基準値は R2 で一度取り直す |
| §14.E ペルソナ | 上記 v2 |
| §14.F 敵 AI 再利用 | `behaviors` の解釈器 (R1 fsm / scripted、R3 bt / utility / goap) と、`autonomous` を `self` 差し替えで敵に使う経路。R3 で sim の敵を `behaviors` 解釈器で駆動して手書き軌跡と一致させるのが実証 |
| `spec/feature/engine.md`、`spec/domains/auto-player.domain.json` | `rulebook` ドメイン新設、`auto-player` に `proposers / arbiter` を追加 |

---

## 7. 実装の分割と受入条件

リポの分離 (§10) を先に置く。R1 以降は「Commentarii 側 (形式・validate・render・サンプル)」と「Lusor 側 (実行時)」の 2 つの PR 系列になり、Commentarii 側が先に SDK の版を上げ、Lusor 側がその版に依存する。

### 7.0 R0: リポ分離 (§10.3 の段階 0〜2)

成果物: Commentarii に `packages/sdk` (公開入口 1 つ)、`src/` の SDK 以外からの内部参照禁止 (lint)、新リポ Lusor (履歴つきで移動、§10.3 の表)、`COMPAT.md` (版の対応表)、契約フィクスチャ (`bundle.json` v1 / replay / observations) の共有、Commentarii 側の `guide run / bench / replay` の委譲 (deprecation)。

受入: Commentarii の `npm test` から engine / adapter / sim / replay 実行 / bench / gate のテストが消え、残りが全て通る。Lusor の `npm test` が移した全テストを通す。Lusor の契約テストが Commentarii の SDK フィクスチャで通る。`guide export` → `lusor run` → `guide learn ingest` / `guide verify intent` が samples/bestia で一巡する。

### 7.1 R1: ルールブック + 式言語 v2 + 信念 + 前向きモデル + アフォーダンス (+ fsm / scripted 解釈器)

置き場所: スキーマ・式言語・validate・render・samples・`load-rulebook` の player / omniscient ビュー・`spec/feature/rulebook.md` は **Commentarii (SDK)**。信念・前向きモデル・アフォーダンス・解釈器・sim の `when` / `act` 経路は **Lusor**。

成果物: §3.2 のスキーマ全部 (behaviors は `fsm` / `scripted` のみ受理、他は `paradigm` の値だけ予約)、§3.3、§3.4、§3.5、validate 項目、render (変数表・行動表・過程・FSM = Mermaid・目標)、`samples/bestia/mechanics/` (変数、move / shoot、regen 過程、battle-ai の `when` 付き遷移と `act` 表、objectives、shoot の masked 上書き = 移動中回避 50%)、sim が `when` / `act` を読む経路 + 手書き軌跡 golden、`spec/feature/rulebook.md`、`spec/domains/rulebook.domain.json`。

受入 (機械判定):

1. `npm run typecheck && npm test` が通る。
2. 全 sample rule の example 評価が変更前後で一致 (フィクスチャに変更前の値を固定)。
3. 式言語 v2: 比較 / 論理 / `if` / ID トークン / `$param` / 文脈関数 / 集約の各 1 テスト。区間評価: `[0,10] < 5` が不明、`[0,3] < 5` が真、`&&` / `||` / `!` の三値表。
4. validate の新項目が各 1 テストで違反を検出 (式の構文、未知参照、所有者の型、outcomes の和、`maps_to` の語彙、masked 分離 = 見える側が完結、上書きファイルに `override` 以外無し、knowledge の伝播、挙動モデルの参照切れ、`when` 付き遷移の `p` の範囲)。
5. player で読んだルールブックの JSON 表現に `masked` / `override` が 0 件。omniscient では shoot の `simulate` が上書き後の分岐 (hp 変化なしの分岐) を含む。
6. 信念: 観測列 (フィクスチャ) から `correct(predict(...))` を回し、敵 hp が予測で狭まり、観測できる値が点に戻る。
7. 前向きモデル vs sim: Bestia の sim を seed 固定で走らせ、各ティックで `simulate(belief_omniscient, action, 'enumerate')` の台 (分岐の集合) が sim の実際の次状態を含む。決定的な量 (位置、ready_at、回復) は点で一致。
8. sim の `when` / `act` 経路: 置き換え後の観測列が手書き版 golden と全ティック一致。
9. アフォーダンス 4 分類: shoot (射程外) が `reachable(1)` (move で到達)、未観測の `discoverable` 変数を参照する行動が `uncertain`、`blocked` の理由に落ちた項が入る。
10. render の出力に行動 ID と `pre` の式、Mermaid の `stateDiagram` が含まれる (スナップショットではなく包含検査)。
11. fsm / scripted 解釈器: フィクスチャの観測列で遷移が sim と同じ順で起きる。

### 7.2 R2: 自律の構え (reactive + GOAP + 実験 + 実行者 + 調停者 + レジーム) で Bestia を定石なしにクリア

成果物: `src/engine/proposers/` (continuation / reactive / goap / experiment)、`src/engine/arbiter/`、BT v2、`decide-tick-autonomous.ts`、decider `autonomous`、ペルソナ v2、レジームと予算表 (mcts は `null` 固定)、学習 (`observations/mechanics/`、`observations/plans/`)、`learn ingest` の定石候補化 (`when_expr`)、リプレイ拡張、`bench --stance`、ゲートの比較可能性キー、`autonomous` 基準値の取り直し。

受入:

1. `guide bench --stance autonomous --game samples/bestia --persona expert --runs 20 --seed 1` のクリア率が `guided --no-tactics` 以上、かつ `guided` (定石あり) の 90% 以上。`novice` でも `guided --no-tactics` 以上。数値は `spec/feature/engine.md` に実測として記録。
2. `autonomous` の判断ログに `tactic:` / `generic:` / `explore:` / `variant:` の候補が 1 件も無い (構えの純度)。`--intent-assist` で判断が変わらない。
3. アダプタ最小ルールブック (manifest に `mechanics/` 無し、adapter の `actions[]` だけ) でも run が完走し、`uncertain` から始まって N ティック後に `now` が増える (実験が効く)。`samples/bestia/mechanics` ありの方がクリア率で明確に上 (閾値は manifest `bench.thresholds`)。
4. GOAP: 既知解のある小問題 (フィクスチャのルールブック: 鍵を取って扉を開ける 3 手、資源 2 種の順序問題) で最短費用の計画を返す。予算超過で `plans: []` と `used.expansions = 予算` を返す。
5. 実行者: `expect.pred` が破れると同じティック内に再計画 (`planning.trigger = expect-broken`)、`valid_while` 偽で計画を捨てる、`repeat_until` が成立で終わる。
6. 実験: shoot の masked 上書き (移動中 50% 回避) に対し、player の 20 run 後の `observations/mechanics/shoot.json` の `observed_delta` 区間が真の期待値 (−12) を含み、見える定義の点 (−24) を含まない。omniscient run を混ぜても変わらない。`report knowledge` に「プレイヤーに誤解される仕組み」として出る。
7. 決定性: `guide replay play --decider autonomous` が記録した run を全ティック再現。overlay のハッシュが違うと「比較不能」。
8. 定石の書き出し: 完走した計画が `learn ingest` で `tactics/` 候補 (`confidence: learned`、`when_expr`) になり、`validate` を通る。
9. 既存テスト (`guided`) は全て不変で通る。bench 結果に `stance` があり、ゲートは `stance` 違いを比較不能で落とす。

### 7.3 R3: MCTS + 相手モデル 5 方式 + hybrid + オフライン方式評価 + 敵 AI 再利用

成果物: `mcts` 提案者 (UCT、policy / adversarial、determinization、木の再利用、ティック別乱数)、behaviors の bt / utility / goap 解釈器、学習モデル (`observations/opponents/`)、`hybrid` decider と `tactic` 提案者、`bench --report proposers` (採用率・予測誤差・成果・`wall_ms`)、`planning-proposals.json` と承認、`replay diff` の提案者分岐、§14.F の実証、ターン制のフィクスチャ (小さなカードゲーム 1 本、相手 adversarial)。

受入:

1. MCTS: 既知解の確率的小問題 (フィクスチャ: 2 択の繰り返しで期待値が分かるもの) で、ロールアウト 2000 で最良手を 95% 以上の seed で選ぶ。同 seed で同じ木 (訪問数まで一致)。
2. ティック別乱数: 提案者の乱数回数を変えても (予算を変えても) 他ティックの `misplay` / `explore` の判定が変わらない。
3. 相手モデル: 同じ敵の挙動を fsm と bt で書いた 2 つのフィクスチャが、同じ観測列で同じ行動列を出す。utility / goap の解釈器は各 1 つの既知挙動フィクスチャで一致。
4. 学習モデル: `state_guess` の無い観測列から相手の行動分類の頻度表が作れ、`masked` 挙動の敵に対して `trust` が run を重ねて上がる。
5. hybrid: 定石の `do` を simulate した `predicted` が付き、`autonomous` の計画と同じ考慮項目で並ぶ。bench で `guided` / `hybrid` / `autonomous` が同条件で並ぶ。
6. 方式評価: `bench --report proposers` が提案者別の採用率・予測誤差・成果・`wall_ms` p50 / p95 を出し、`learn consolidate` が予算表の変更提案を作り、承認なしでは persona / manifest が変わらない。
7. §14.F: sim の敵 3 体を `behaviors` 解釈器で駆動し、手書き版の観測列 golden と一致。さらに敵 1 体を `autonomous` (self 差し替え) で動かした run が完走し、判断ログが player モードで masked を含まない。
8. ターン制フィクスチャ: `execution: turn`、相手 adversarial、determinization 8 で、既知の必勝局面を選ぶ。
9. `replay diff` が「提案者が分岐した最初のティック」を出す (フィクスチャ 2 本)。

### 7.4 既存の R1 依頼文 (`spec/tasks/2026-10-11-stage-r1-rulebook-forward-model.md`) への差分

- **足す**: `processes/`、行動の `motion` と `duration` と効果の `at`、`effects[].outcomes[]` の形 (`assign` 配列)、`.masked.json` を「上書き」と定義、`variables.json` の `observe` / `from` / `init` / `derive` / `sets`、`objectives.progress[]`、遷移の `p` / `hold`、挙動モデルの `act` 表と `targeting`、ID トークンと `$param` の字句、**区間評価**、`correct / predict` の信念更新、sim の `when` / `act` 経路と手書き golden、アダプタ最小ルールブック (`hello.actions[]`)、fsm / scripted の解釈器。
- **外す / 後送り**: behaviors の bt / utility / goap の **スキーマ本体** は解釈器と同じ段 (R3) へ (`paradigm` の列挙値だけ予約)。スキーマだけ先に置くと意味の検証ができず、R3 で形が変わる。
- **直す**: 「`set` は `変数参照 → 式`」を `assign[]` に。「確率的効果は seed からのサンプルと期待値の両方」に **分岐列挙** を足す (受入 7 で使う)。「1 ステップ予測が sim と一致」を「決定的な量は点で一致、確率的な量は列挙の台が含む」と明記 (既に近い書き方だが `simulate` の 3 モードと結び付ける)。契約 ID C-100 番台はそのまま。
- **受入に足す**: 式 v2 の三値表、player ルールブック JSON に `masked` / `override` 0 件、sim の置き換え後 golden 一致。

---

## 8. 叩き台 §16 への指摘

番号は重要度順。

1. **(誤り) BT を「実行層」に固定しつつ、相手モデルの一形式としても使う。** 役割が二重で、`guided` の定石 BT・計画の実行 BT・敵の BT が別実装になりがち。本案は BT を「解釈器 / 実行者で共有する 1 実装」と位置づける (§3.8、§3.10)。
2. **(過剰 + 原則違反の恐れ) 方式選択器の多腕バンディット補正。** 局面署名の量子化が恣意的、署名あたりの標本が足りず run 内で収束しない、学習 (効果・定石) の上に学習が乗る、補正値が人間の読める差分にならず承認経路にも乗らない (原則 5)。予算表 + 予測価値の調停 + オフライン評価に置き換える (§2.2、§3.9)。
3. **(誤り) 「時間予算」。** 壁時計の予算は同じ seed でもマシンや負荷で判断が変わり、`guide replay play` が通らない。反復回数の予算にし、壁時計は測って記録するだけにする (§5)。
4. **(抜け) 前向きモデルの同時進行・持続・過程。** `cost.time` と `cooldown` だけでは「移動中に撃たれる」「回復が進む」「弾が飛ぶ」が表せず、Bestia の sim と一致する 1 ステップ予測 (R1 の受入) が作れない。`duration` + `motion` + `processes/` + 副ステップで相手を進める意味論を定義した (§3.2、§3.4)。
5. **(抜け) 評価関数の出所。** GOAP のヒューリスティクスと MCTS のロールアウト評価が無い。勝敗だけでは報酬が疎すぎ、実装者は定石や距離のヒューリスティクスを書きたくなる (= 攻略法の持ち込み)。`objectives.progress[]` を仕様の一部として置き、これだけを源にする (§3.2)。
6. **(抜け) masked な効果分岐の見せ方。** 「masked の効果・確率は player の前向きモデルに入らない」とだけあり、残った分岐の確率の和が 1 でなくなる扱いが無い (そのままだと隠し分岐の存在が漏れる)。上書き分離にする (§2.5)。
7. **(誤り寄り) FSM の「構え」(探索 / 交戦 / 退避 / 回収 / 移動) をゲーム非依存の既定として自分の頭に持つ。** これは攻略法 (「HP が減ったら退避」) であり、指示の「攻略法に依存せず」と衝突する。本案では自分の頭に FSM の層を置かず、負け条件への近さから計算する **レジーム** (計算資源の配分だけに使う) に替え、FSM は相手モデルと `guided` の解釈器に限る (§3.9)。neco が明示的なモードを望むならペルソナのデータとして置く (§9 未決 8)。
8. **(抜け) 連続空間を計画器に見せる方法。** GOAP / MCTS は有限の行動集合が要る。パラメータの `range` / `step` による離散化と `motion` の到達点生成を定義した (§3.2)。
9. **(抜け) 乱数ストリーム。** 既存 decider は毎ティック 2 回の乱数で列を固定しているが、MCTS は可変回数引く。ティック別派生ストリームにしないと後続ティックの誤操作判定がずれる (§5)。
10. **(抜け) 判断ログ・リプレイのスキーマ変更。** 提案者別の出力・予算・レジーム・予測を残す場所と、`replay play` が構えと overlay のハッシュを見ることが書かれていない (§3.14)。
11. **(抜け) アダプタだけの最小ルールブックの入口。** §16.4 に言及はあるが、アダプタがどうやって行動の語彙とパラメータを宣言するかが無い (`hello.actions[]`、§3.2)。
12. **(抜け) ターン制・隠れ情報。** KonbiniDominant / カードを対象に挙げながら設計はリアルタイムだけ。`execution: turn`、相手手番、同時手番、determinization を定義した (§3.16)。
13. **(誤り) `set: {"hp($target)": "..."}`。** JSON のキーに左辺式を置くと静的検査・レンダ・差分表示が全部キーのパースになる。`assign[]` に (§3.2)。
14. **(過剰) R1 で 5 方式の挙動モデルのスキーマを全部置く。** 解釈器の無いスキーマは意味の検証ができない。fsm / scripted だけ R1、残りは R3 (§7.4)。
15. **(抜け) 実験の価値と安全条件の定義。** 「情報量 × 危険の低さ」が未定義。相対区間幅 × (1 − 予測被害) と、最悪ケースで `critical` に入らない安全条件を置いた (§3.11)。
16. **(抜け) `hybrid` の比較の通貨。** 定石の `metrics` と計画の予測値は別物。定石の `do` を前向きモデルで simulate して同じ `predicted` を付ける (§3.13)。
17. **(抜け) 既存の `generic:*` 候補の扱い。** `survive / approach / gather` は小さな手書き定石で、`autonomous` では使えない。`reactive` 提案者が代わり (§6)。
18. **(抜け) ペルソナ v2 の互換。** 現行 `persona.schema.json` は 8 項目の `weights` が必須。計画向けの考慮項目を足すなら別キーにしないと同梱ペルソナと既存テストが壊れる (§3.7)。
19. **(抜け) 相手の挙動モデルが masked のときの学習モデルは状態名を使えない。** player では `state_guess` も出ないので、観測できる特徴 (位置差分・イベント) で条件付ける (§3.10)。
20. **(細部) `rule(rule:bestia:dash-damage)` は現行の字句では解析できない。** ID トークンの字句を定義した (§3.3)。

---

## 9. 未決事項 (neco に決めてもらうこと、推奨つき)

1. **既定の構え。** 推奨: `guide run` / `guide bench` の既定を `autonomous` にし、`guided` は `--stance guided` で残す。§14.C の基準値は構え別なので、`autonomous` の基準値を R2 で一度取り直す (旧基準値は `guided` のまま有効)。
2. **「MCT」の読み。** 推奨: MCTS。ターン制・決定的・2 人には深さ制限 minimax を同じ提案者契約で足せる (R3 の任意項目)。
3. **sim をルールブックの `when` / `act` で動かすか。** 推奨: 動かす (前向きモデルとの一致を構造で得る)。同語反復は手書き版の観測列 golden で防ぐ。やらないなら受入 7 は「sim の慣例を手で写した前向きモデル」との一致になり、ルールブックの表現力の検証が弱くなる。
4. **`efficiency` でも実験を許すか。** 推奨: 許す (ペルソナの `exploration_rate` と `low_trust` の加点で、安全条件つき)。禁じると最小ルールブックの外部ゲームが永遠に `uncertain` のまま。
5. **予算表の既定値。** §3.9 の数値を初期値として置き、R2 / R3 の `wall_ms` 実測で調整する。壁時計の上限を判断に効かせることは **しない** のを推奨 (リプレイ決定性)。
6. **MCTS の相手の既定。** 推奨: 挙動モデルが見えれば `policy`、見えないリアルタイムは学習モデル (事前は一様) の `policy`、見えないターン制は `adversarial`。
7. **連続値ノイズ (ダメージ幅・弾速) の表現。** 推奨: R1〜R3 は有限分岐 (`outcomes[]`) と区間だけ。分布 (平均・分散) は overlay の統計に留める。弾の飛行は `projectile` 個体 + 過程で書けるが Bestia の sim は即着弾なので後送り。
8. **自分の頭に明示的なモード FSM を置くか。** 推奨: 置かない (レジームは資源配分にだけ使う)。置くならペルソナのデータ (`modes/`) として、判断ログに「モードが候補を絞った」と残す形。
9. **式言語の ID トークンの字句。** 推奨: `kind:game:slug(#state)` をそのまま 1 トークンにする (`rule(rule:bestia:damage)`)。文字列リテラル (`'…'`) は入れない。
10. **ペルソナ v2 の置き方。** 推奨: 既存ファイルに任意キー (`weights_autonomous`、`planning`、`progress_weights`) を足す。別ファイル体系にはしない。
11. **`behavior` 参照の正。** 推奨: entity の `behavior` は `behavior:` を正にし、`state:` 直指しは R1 で「fsm、`act` 無し」として受理、render で移行を促す warning (V11 系)。
12. **実行時データの形式 (observation-frame / replay / bench-result) の所有。** 推奨: Commentarii (SDK) が所有 (§10.1 の理由: マスク原則の検査を原則の所有者が持つ、依存を一方向にする)。代替は「Lusor が所有し Cm が Lusor の SDK に依存する」で、依存が双方向になるので勧めない。
13. **SDK の配布形。** 推奨: Cm リポ内 `packages/sdk` を git タグ依存 (`github:LUDIARS/Commentarii#sdk-vX.Y.Z`) で参照。private npm を立てるなら Infra 側の判断。vendoring (複製) は版のずれを生むので不可。
14. **新リポ名。** 推奨: Lusor (`Ls`)。候補と理由は §10.4。
15. **R0 (リポ分離) の時期。** 推奨: 段 6 (描画タップ受信) のマージ直後、R1 の Lusor 側に着手する前。R1 の Cm 側 (スキーマ・validate・render・式 v2) は R0 と並行してよい。

---

## 10. Commentarii との分離 (別リポ運用、neco 追加指示 2026-10-11)

前提: オートプレイヤーは独立したプロジェクト (別リポ) として運用する。本節では新リポを **Lusor** (`Ls`) と呼ぶ (名前の候補と推奨は §10.4)。

### 10.1 境界案

原則は 1 つ: **「ゲームが何か」を書き、検証し、人に見せ、正本を更新するのが Commentarii。「それを読んで遊び、記録する」のが Lusor。** データ形式 (スキーマ) は全部 Commentarii が所有し、Lusor は実行時だけを持つ。依存は Lusor → Commentarii SDK の一方向で、Commentarii は Lusor のコードを import しない (ファイルを読むだけ)。

| 残す: Commentarii (Cm) | 移す: Lusor (Ls) |
|---|---|
| 攻略本ツクール CLI `guide` (`init` / `import masters|map|spec|plays` / `validate` / `render` / `export` / `report knowledge` / `diff` / `intent` / `learn ingest|consolidate|approve` / `verify intent` / `audit mask`) | オートプレイヤー CLI `lusor` (`run` / `bench` / `gate` / `replay play|diff` / `adapters`) |
| 攻略本バンドルのスキーマ全部 (`schema/`: entity / stage / map / events / rule / state / tactic / intent / glossary / manifest / value / id / overlay / observation / divergences / feasibility / human-candidates / praeforma-ref / mapping)。**R1 で足す rulebook のスキーマも** (variables / action / process / behavior / objectives) | ペルソナのスキーマと同梱ペルソナ (`personas/`、`persona.schema.json`): 実行時の概念で、バンドル内 `personas/` も Lusor が読む (Cm のローダは現行どおり対象外) |
| **実行時データの形式**も Cm が所有: `observation-frame` / `observation-fields` / `replay` / `bench-result` / `render-frame` のスキーマと、読み込み・不変条件 (R1〜R7、`find-masked-pointers`、観測境界の許可表)。理由: マスク原則 (Cm の第一原則) の構造的担保はこの検査にあり、原則を所有する側が検査を所有する | それらを **書く** 側: 記録器 (`RecordingSink`)、ドライバ、`replay play / diff`、decider 群、bench の実行、gate の比較 |
| 式言語 (`src/domain/expression/`、v2 を含む): validate V08 と静的検査が使う | 式言語の **実行時文脈** (信念からの文脈関数、区間評価器の呼び出し側) |
| バンドルのローダ (`src/bundle/`: ディレクトリ → Bundle、`classify-path`、`toPlayerView`)、`export` (`bundle.json`) | `bundle.json` の読み込み側 (SDK の reader を使う)。Lusor は **バンドルのディレクトリを直接読まない** (`player` では player 書き出しの `bundle.json` だけ、`omniscient` では `full` 書き出し)。これで「Lusor の player モードは masked の載ったファイルに触れない」が構造になる |
| 学習の正本側: `learn ingest` (観測 → overlay)、`consolidate` / `approve` (正本の書き換え)、定石候補化、予算表の変更提案の承認 | 学習の観測側: reflect (run 中の観測行・実験の前後差・完走した計画を `observations/` に書く)。書く形式は Cm の overlay / observation スキーマ |
| 意図ズレ検証 (`verify intent`)、feasibility、良い遊びの 2 軸、ヒートマップ、Praeforma 連携、人間プレイログの取り込み (`import plays`: テレメトリ → replay 形式、SDK の replay 書き込みを使う)、マスク境界監査、攻略本差分の説明、LLM 解説者 (読み取り専用で replay を読む) | バランス回帰ゲート (`gate`): bench 結果の比較と Revisor 証跡。意図ズレの分類変化は `verify intent` の JSON を入力ファイルとして受け取って同じレポートに載せる (Cm を呼ばない) |
| Web 編集画面 (段 7) | アダプタ契約 (`GameAdapter`、JSON Lines プロトコル、C++ ヘッダ)、アダプタ SDK (ゲーム側が実装する雛形)、sim、stdio、描画タップの受信・正規化・照合 (段 6 の受信側。契約 `render-tap/1` のスキーマと golden は Cm) |
| `samples/bestia/` (攻略本バンドル) | Lusor のテストは Cm の SDK が同梱する **フィクスチャ** (`samples/bestia` の `bundle.json` 書き出し、replay、observations) を使う。Lusor リポにバンドルの正本を置かない |
| Ludus 辞書参照、game-knowledge-graph | 敵 AI としての再利用 (§14.F)、ゲーム内逆利用の export は Cm (`export --target ingame`) |

**SDK パッケージ** (`@ludiars/commentarii-sdk`、Cm リポの `packages/sdk/`、公開入口 1 つ):

| 入口 | 中身 |
|---|---|
| `schemas` | `schema/*.json` と ajv の検証器 |
| `types` | Bundle / 各文書 / ObservationFrame / ReplayLine / Overlay / BenchResult の TypeScript 型 |
| `bundle` | `readExportedBundle(path | json)` (`bundle.json` → 型つき)、`index` の引き方 |
| `expression` | tokenize / parse / evaluate (点) / evaluateInterval / staticCheck / 文脈関数の差し込み口 |
| `rulebook` | `loadRulebook(exported, mode)` (player / omniscient のビュー、上書き適用、overlay の重ね) |
| `replay` | `parseReplay`、不変条件、`isMaskedInPlayer`、`findMaskedPointers`、`ReplayLineWriter` の型 |
| `observation` | 観測境界の許可表と `observationBoundaryProblems` |
| `fixtures` | `samples/bestia` の書き出し (player / full)、replay 2 本、observations、ルールブック付きの書き出し (R1 以降) |
| `knowledge` | 攻略本が何を可能に見せるかを読む部品: `buildEngineWorld` / `EngineWorld`、`match/` (`when` の照合)、観測の読み取り (`self-readings`、`visible-entities`、幾何)、定石候補と変種 (`tactic-candidates`、`tactic-variants`、`run-memory`、`candidate`)、ペルソナの型と信頼順、観測行の形 (`overlay-line`、`unknown-entities`)。Cm の `verify` / `learn` / `import plays` が実際に import している (§10.3) |

Lusor が持つ SDK 外の依存は `ajv` 系のみ。Augur の契約 (`#contract-runtime`) は両リポがそれぞれ持つ (契約 ID の空間は分ける: Cm は現行、Lusor は `L-` 接頭)。

### 10.2 両者をつなぐ契約

```
Commentarii                                   Lusor
guide export --knowledge player  ──bundle.json──▶  lusor run / bench  (player)
guide export --knowledge full    ──bundle.json──▶  lusor run          (omniscient 検算)
                                 ◀──replay/<run>.jsonl──          記録 (header に版と構え)
                                 ◀──observations/runs/*.jsonl──   reflect の観測行、実験、完走計画
                                 ◀──observations/opponents/*──    相手の学習モデル
                                 ◀──bench/<commit>.json──         bench 結果 (比較可能性キー)
guide learn ingest / verify intent / render  ◀── 上の 3 つを読む
guide learn consolidate ──overlay.json / 正本パッチ──▶  次の lusor run が読む (bundle.json に同梱 or 隣接ファイル)
```

| 契約 | 形式 | 所有 | 版 |
|---|---|---|---|
| 攻略本 / ルールブックの読み込み | `bundle.json` (`format: commentarii.bundle`)。R1 で `format_version` 2 (`documents.mechanics` = variables / actions / processes / behaviors / objectives、`index.actions`、`knowledge` に応じた上書き適用済みか否かを `view: player | full` で明示)。overlay は `export --with-overlay` で `documents.overlay` に同梱するか、`--overlay <path>` で隣接ファイルを渡す (header にハッシュ) | Cm | `format_version` (整数)。Lusor は対応範囲 `[min, max]` を宣言し、範囲外は起動時に拒否 (黙って読まない) |
| 観測 | `observation-frame.schema.json` + 観測境界の許可表 (manifest `observation.fields` を `bundle.json` に同梱) | Cm | `format_version` に含める |
| 行動 | `replay.schema.json#/$defs/action` (抽象アクション §7.3) | Cm | 同上 |
| リプレイ・判断ログ | `replay.schema.json`。header に `engine: {name: "lusor", version}`, `sdk_version`, `bundle_format`, `bundle_hash`, `overlay_hash`, `stance`, `decider`, `persona`。tick 行に §3.14 の `planning` (任意) | Cm | header の版 3 つ組。Cm の `verify intent` / `learn ingest` は `sdk_version` が自分より新しい記録を「未対応」として明示的に拒否 |
| 観測行 (overlay 入力) | `observation.schema.json` (既存 1 行形式) + R2 で足す `kind: mechanics-sample | plan-episode | opponent-sample` | Cm | 同上 |
| bench 結果 | `bench-result.schema.json`。比較可能性キーに `stance` / `decider` / `engine_version` / `sdk_version` を足す | Cm | 同上 |
| アダプタ ↔ Lusor | JSON Lines `protocol: 1` (ゲーム → Lusor)。`hello` に任意 `actions[]` (最小ルールブック) を足して `protocol: 2`。C++ ヘッダは Lusor 同梱 | Ls | `protocol` 整数。Lusor は 1 と 2 を受ける |
| 描画タップ | `render-tap/1` (スキーマ・golden は Cm、受信は Ls) | Cm (形式) / Ls (受信) | 契約名に版 |
| Revisor 証跡 (gate) | gate の JSON + Markdown。Cm の `verify intent` 出力を `--intent-report <path>` で受ける | Ls | bench 結果の版に従う |

版の対応は Cm の `COMPAT.md` に 1 表で持つ (SDK 版 × bundle `format_version` × replay header 版 × Lusor 版)。両リポの CI が同じ表を読んで、対応外の組み合わせのテストを「スキップ」ではなく「失敗」にする (黙った非互換を作らない)。

### 10.3 既存実装の移し方と移行中の互換

| 現在 (Cm) | 行き先 | 備考 |
|---|---|---|
| `src/engine/world/**`、`src/engine/match/**`、`src/engine/observation/**`、`src/engine/candidates/tactic-candidates.ts` / `tactic-variants.ts` / `run-memory.ts` / `candidate.ts`、`src/engine/persona/persona.ts` (型と信頼順)、`src/engine/reflect/overlay-line.ts` / `unknown-entities.ts` (観測行の形) | **Cm SDK `knowledge`** | grep で確認した実依存: `verify/feasibility/visible-solutions.ts` は player ビューから定石候補を生成して「見かけ上の解」を出し、`verify-intent.ts` は `buildEngineWorld` を、`learn/overlay/*` と `learn/ingest/*` は `tactic-variants` / `persona` / `unknown-entities` / `overlay-line` を、`import/plays/*` は `self-readings` を使う。これらは「攻略本が何を可能に見せるか」を読む部品で Cm の関心事。SDK に置き、Lusor の `guided` decider がそこから import する |
| `src/engine/**` の残り (decide-tick、generic / explore / variant の候補生成、utility、bt、expect、persona の解決 (ファイル)、reflect の実行、driver、rng、utility-bt-decider) | Ls `src/engine/**` | `rng.ts` は SDK にも要るなら (sim の seed 派生) 複製せず SDK へ |
| `src/adapter/**`、`src/adapters/sim/**`、`src/adapters/stdio/**`、`adapter/cpp/**` | Ls `src/adapter/**`、`src/adapters/**`、`adapter/cpp/**` | |
| `src/adapters/fs/replay-*.ts`、`read-engine-version.ts`、`load-persona.ts`、`fs-persona-source.ts` | Ls | `fs-bundle-source.ts`、`open-bundle-dir.ts`、`read-schema-documents.ts`、`write-output-files.ts`、`verify-io-fs.ts`、`plays-read-runs.ts` は Cm |
| `src/adapters/llm/**` | Cm | `import spec` 用 |
| `src/replay/`: `replay-record.ts`、`replay-action.ts`、`observation-frame.ts`、`parse-replay.ts`、`tick-invariants.ts`、`find-masked-pointers.ts`、`replay-schema.ts`、`replay-path.ts` | Cm SDK `replay` | 形式と検査 |
| `src/replay/`: `decider.ts`、`decider-registry.ts`、`recorded-decider.ts`、`wait-decider.ts`、`recording-sink.ts`、`recording-error.ts`、`play-replay.ts`、`diff-replays.ts`、`format-*.ts`、`replay-command.ts`、`run-replay-command.ts` | Ls | 実行側。`format-play-text` 等は Ls の CLI 表示 |
| `src/observation/**` (境界検査) | Cm SDK `observation` | ドライバ (Ls) が import する |
| `src/domain/expression/**` | Cm SDK `expression` | v2 もここ |
| `src/bundle/**`、`src/export/**`、`src/schema/**`、`src/validate/**`、`src/render/**`、`src/report/**`、`src/import/**`、`src/learn/**`、`src/verify/**`、`src/audit/**`、`src/praeforma/**`、`src/markdown/**`、`src/health/**` | Cm | `src/render/heatmap` も Cm (レポートの絵) |
| `src/bench/**`、`src/gate/**`、`src/autoplay/**` | Ls | gate は `verify intent` の JSON を入力に取る形へ |
| `src/render-tap/**` (段 6 の受信側、進行中の別 run) | Ls | 契約スキーマ `schema/render-frame.schema.json` と golden は Cm。段 6 の run は **今の場所で完走させ**、R0 でまとめて移す (並行 run と衝突しない) |
| `src/cli/*` | 分割: `guide` は Cm、`run` / `bench` / `gate` / `replay` のサブコマンドは Ls の `lusor` | |
| `src/contracts/*.contract.ts`、`augur.contracts.json` | 対象ファイルに従って分割 | Lusor 側は `L-` 接頭で振り直す (ID 衝突の再注入は既知の落とし穴) |
| `personas/**`、`schema/persona.schema.json` | Ls | バンドル内 `personas/` の解決順は現行どおり |
| `tests/engine`、`tests/adapters`、`tests/bench`、`tests/gate`、`tests/replay` (実行側)、`tests/render-tap` | Ls | `tests/replay` の形式テスト (parse / invariants) は Cm。`tests/fixtures/replay/*.jsonl` は SDK の `fixtures` へ (両方が読む) |
| `spec/feature/engine.md`、`adapter-protocol.md`、`balance-gate.md`、`replay.md` §3〜5、`render-tap-contract.md` の受信側 | Ls `spec/feature/` | `replay.md` §1〜2 (形式・不変条件)、`observation-boundary.md`、`render-tap-contract.md` の契約部は Cm |
| `spec/domains/auto-player`、`replay` (実行側)、`balance-gate`、`render-tap` (受信側) | Ls `spec/domains/` | Anatomia に新リポを登録する (未登録は既知の落とし穴) |
| `spec/architecture/design.md` §7、§14.A/C/E/F、§16 | Cm に残し、冒頭に「実装は Lusor」と所在を書く。Lusor は自分の `spec/architecture/design.md` に実行時の設計 (本書 §3〜§5) を持つ | 設計の正本を 2 つにしない: 原則・データ形式・学習・検証は Cm、判断・実行は Ls |

移行の段階と互換:

| 段階 | 内容 | 互換の担保 |
|---|---|---|
| 0. 切り出し準備 (Cm 内) | `packages/sdk` を作り、上の「Cm SDK」行のファイルを移す。`src/` から SDK へは公開入口だけを import する (lint で内部パス禁止)。`bundle.json` v1 のフィクスチャと replay フィクスチャを SDK に置く | 全テスト不変で通る。`guide` の挙動不変 |
| 1. 新リポ作成 | `git filter-repo` (または `subtree split`) で「Ls 行」のパスだけの履歴を切り出して Lusor を作る。`package.json` に `@ludiars/commentarii-sdk` を **git タグ依存** (LUDIARS は private npm を持たないので、`github:LUDIARS/Commentarii#sdk-vX.Y.Z` の `packages/sdk` を参照。Excubitor / service-bootstrap の clone 手順に従う) で足す。Excubitor にサービス登録 (Lusor は常駐しないので catalog 登録のみ、port は Excubitor catalog が正本) | Lusor の `npm test` が移したテスト全部を通す。Lusor の契約テストが SDK フィクスチャで通る |
| 2. Cm から削除 + 委譲 | Cm の `src/` から Ls 行を削除。`guide run / bench / replay / gate` は **1 版だけ** 残し、`lusor` が PATH にあれば委譲、無ければ「Lusor に移った」と出して終了コード 2。README と `spec/` の所在を更新。Anatomia・Concordia project-codes・Lictor の登録 | `guide export → lusor run → guide learn ingest / verify intent` が samples/bestia で一巡するテスト (Cm 側の E2E。Lusor の CLI はテスト用フィクスチャ run で代用可) |
| 3. 委譲の撤去 | 次の minor 版で委譲コマンドを消す | `COMPAT.md` に記載 |

移行中の運用ルール:

- 段階 0 と段 6 (描画タップ受信) の run は Cm で並行して進んでよい (触るディレクトリが違う)。段階 1 は段 6 のマージ後に行う。
- R1 のうち Cm 側 (スキーマ・validate・render・samples・式 v2・`loadRulebook` のビュー) は段階 0 と並行して着手できる (SDK に直接書く)。R1 の Lusor 側 (信念・前向きモデル・アフォーダンス) は段階 1 の後。段階 1 が遅れるなら、暫定で Cm の `src/rulebook-runtime/` (Ls 行として最初から登録) に書き、段階 1 でそのまま移す。
- 既存の bench 基準値 (`bench/<commit>.json`) は `engine_version` が Cm の版なので、Lusor の初版は比較可能性キーで「比較不能」になる。R0 の受入で Lusor から `guided` の基準値を取り直し、旧基準値と差が無いこと (同 seed・同 bundle で判断ログが一致) を 1 回だけ示す。

### 10.4 新リポの名前候補 (ラテン語)

Concordia の `/v1/project-codes` (2026-10-11 時点、100 件) と `E:/Document/Ars` のフォルダ名で衝突を確認した。

| 候補 | 意味 | 推奨コード | 評価 |
|---|---|---|---|
| **Lusor** | 遊ぶ者、プレイヤー (ludere の行為者名詞) | `Ls` (空き) | **推奨**。「オートプレイヤー」をそのまま言い当てる。短く、Ludus (`Lu`) / Ludellus 系 (`Lw` `Ln` `Lo` `Ll` `Lm` `LP`) と語源は同じだが綴りが違い、コードも離れている。Commentarii (攻略本) を読んで遊ぶ者、という対になる |
| Vicarius | 代理人、代わりに務める者 | `Vr` (空き) | 「人間の代わりに遊ぶ」側面を強調。意味が広く (代理全般)、他サービス (Famulus / Satelles) と役割が紛れる |
| Arbiter | 審判、判断する者 | `Ab` (空き) | 「判断系」を強調。ただし本書で調停者 (arbiter) を部品名に使っており、リポ名にすると部品と紛れる。審判は遊ぶ側ではない |
| Ludio | 役者、競技の演者 | `Lj` (空き) | 「プレイヤー」の意味はあるが、Ludus 系と綴りが近すぎて略称の読み違いが起きやすい |
| Athleta | 競技者 | `Ah` (空き) | 競技色が強く、意図ズレ検証やペルソナ (初心者) を担う主体の名としては狭い |

推奨: **Lusor (`Ls`)**。フォルダ `E:/Document/Ars/Lusor`、GitHub `LUDIARS/Lusor`、CLI 名 `lusor`、SDK の依存名 `@ludiars/commentarii-sdk`。Concordia の project-codes への登録 (`Ls Lusor`) と `LUDIARS/PROJECT-CODES.md`、Ars の `CLAUDE.md` の一覧 (アセット / ツール欄) への追記は R0 の成果物に含める。

---

## 付録 A. Bestia の最小ルールブック一式 (R1 で置くファイル)

```
samples/bestia/mechanics/
├── variables.json              §3.2 の例
├── rules/dodge-window.json     既存
├── rules/wounded-retreat.json  既存
├── rules/damage.json           新規: "power * cooldown_sec" (sim の既定式と同じ。power は actor の stats、無ければ example)
├── actions/move.json           §3.2
├── actions/shoot.json          §3.2
├── actions/shoot.masked.json   移動中回避 50% の上書き
├── processes/regen.json        §3.2
├── states/battle-ai.json       既存 + when / p / hold
├── behaviors/battle-ai.json    §3.2
└── objectives.json             §3.2
```

## 付録 B. 置き場所 (SRP、リポ別)

Commentarii (`packages/sdk/src/`):

```
expression/                     v2 (tokenize / parse / evaluate / evaluate-interval / context-functions / static-check)
rulebook/
├── load-rulebook.ts            exported bundle + mode → Rulebook (player 型 / omniscient 型)
├── player-rulebook.ts          player 型の定義 (masked / override を表現できない)
├── apply-overrides.ts          omniscient だけ
└── apply-overlay.ts            学習した効果を重ねる
bundle/ replay/ observation/ schemas/ fixtures/
```

Lusor (`src/`):

```
model/
├── belief/ { build-belief, predict, correct }
├── forward/ { simulate, motion, processes, effects, opponent-step }
├── affordances/ { classify, regress }
├── interpreters/ { fsm, scripted, (R3) bt, utility, goap }
└── objectives/ { evaluate, progress }
engine/
├── proposers/                  continuation / reactive / goap / mcts / experiment / tactic
├── arbiter/                    score-plan + considerations/
├── executor/                   plan-to-tree, step (bt/ を使う)
├── regime/                     regime, trust, budgets
├── bt/ utility/ candidates/ match/ persona/ reflect/   (Cm から移動)
├── decide-tick.ts (guided)     decide-tick-autonomous.ts
├── utility-bt-decider.ts (guided)  autonomous-decider.ts  hybrid-decider.ts
└── driver.ts
adapter/ adapters/{sim,stdio,fs} replay/{recording,play,diff,deciders} bench/ gate/ render-tap/ cli/
```
