# 攻略本ツクール + 汎用オートプレイヤー 設計 (Commentarii / Cm)

初版 2026-10-09。neco の指示 (同日) を統合した版。所属: 新規リポ `LUDIARS/Commentarii` (Cc 略称 `Cm`)。

## 0. 指示の経緯

1. 汎用的オートプレイヤーを作るための「攻略本ツクール」を用意する。判断は Utility AI か BT、ゲームの基本仕様を学習し、何が起きているかを再帰ループしながら賢くなる。ゼロから学習させず、攻略本 (敵のマスターデータやステージのマップ) を作って食わせる。データは構造化し、人間と AI のそれぞれが処理しやすくする。
2. 画面に映っているものの検知にコマンドバッファ (フレームキャプチャ → 描画命令) を使う。これはオートプレイヤー側。
3. 攻略本生成の大きな目的の一つは「ユーザーが知りうるデータと知ってはならないデータ (マスクデータ)」の境界を引くこと。これを **原則** に持つ。
4. オートプレイヤーのフィードバックで攻略本の定石を書き換える (より効率的であればそうする)。
5. 人間側の意図とのズレを検証する。面白いズレは許容されるべきなので、ズレそのものを検証する (レベルデザインのプレイヤー行動可能性の検証)。
6. 攻略本には「人間がやってやれそうなこと」「出来そうで出来ない / 超頑張ればできること」の範囲を構造化して測る目的がある。良い遊びは「解法がたくさんあり、かつ深く迷わないこと」と定義する。迷わないは難易度と直結したギミックの組み合わせや戦法の洗練化 (答えを一つに絞らせる遊び) で作られるが、洗練化が絶対的に正しいわけではないことを明示する (§8.5)。

### 解釈

- 「汎用」= 判断エンジンはゲーム固有のコードや情報を持たない。ゲーム差は攻略本バンドルとゲームアダプタに閉じる。
- 「攻略本」= 人間向け攻略本と同じ構造 (図鑑・地図・仕組み・定石) を機械可読にし、さらに「設計者の意図」と「知識境界」を持つもの。
- 「賢くなる」= LLM の再学習ではなく、攻略本 (正本とオーバーレイ) の更新。
- 対象は LUDIARS のゲーム (Bestia / KonbiniDominant / KuzuSurvivors / Pagus など) を第一とし、外部ゲームはアダプタ追加で対応する。

## 1. 設計原則

全ての節に優先する。

1. **マスク原則 (第一原則)**: 攻略本の全ての値は、プレイヤーが知りうる (`shown` / `discoverable`) か、知ってはならない (`masked`) かの境界を必ず持つ。境界の無い値は存在できない。既定は `masked` (安全側)。昇格には根拠と人間承認が要る。`masked` は別ファイルに分離し、書き出し・公開・オートプレイヤーの既定動作のどれにも混ざらないことを構造で担保する。
2. **プレイヤー条件が既定**: オートプレイヤーは人間のプレイヤーと同じ情報だけで判断するのが既定 (`player` モード)。全知 (`omniscient`) は検算とデバッグ専用で、スコアにも昇格根拠にも使わない。
3. **出典の無い値は正本に入らない**: 全ての値は出典 (マスターデータ / 観測 / 人間) を持つ。LLM は下書きと説明文だけを作り、数値・ID・境界を決めない。
4. **エンジンとデータの分離**: 判断エンジンはゲーム固有情報を持たない。
5. **学習はデータの更新**: 更新は人間が読める差分として残る。効率差だけの定石書き換えは規則で自動反映してよいが、設計者の意図に関わる更新と「面白いズレ」の判定は人間が行う。

## 2. 用語

| 用語 | 意味 |
|---|---|
| 攻略本 (Guide Bundle) | ゲーム 1 本分の構造化知識。正本はファイル (git) |
| ツクール (Guide Maker) | 攻略本を作る・検証する・書き出す・学習結果を統合する CLI と Web 画面 |
| オートプレイヤー (Auto Player) | 攻略本を読み、観測 → 照合 → 判断 → 行動 → 反省を回すエンジン |
| ゲームアダプタ | ゲームとオートプレイヤーの境界。観測と行動を共通スキーマへ変換する |
| 定石 (tactic) | 前提条件 → 手順 → 期待結果 → 根拠。Utility の候補であり BT のサブツリーの種 |
| 意図 (intent) | 設計者が宣言する「こう遊ばれるはず」。定石とは別の層 |
| 知識境界 (knowledge) | 値ごとの `shown` / `discoverable` / `masked` |
| オーバーレイ | オートプレイヤーが書く学習結果。正本と分離し、統合は人間レビューか規則で行う |

## 3. 全体構成

```
マスターデータ / マップ / 仕様書 (Praeforma) / 設計者の意図
        │ import (ツクール。LLM は draft のみ)
        ▼
  Guide Bundle (JSON 正本、masked は別ファイル) ──render──▶ Markdown (人間が読む・レビューする)
        │ export --knowledge player (既定)                      ▲
        ▼                                                      │ verify intent / report knowledge
  Auto Player ◀──observe (3 段) / act──▶ ゲーム (アダプタ経由)      │
        │ reflect (予測と観測の差分、定石の実測)                   │
        ▼                                                      │
  Overlay (observations/) ──learn ingest / consolidate──▶ 正本の更新案 (規則で自動 or 人間承認)
```

部品は 3 つ。Commentarii リポに置くのは ツクール・エンジン・共通スキーマ・アダプタ SDK。攻略本バンドルは各ゲームリポの `guide/<game-id>/`。

## 4. 攻略本 (Guide Bundle)

### 4.1 形式

- 機械正本は JSON (1 エンティティ 1 ファイル)。全ファイルに JSON Schema。人間向け Markdown はツクールが生成し、手では直さない。
- JSON を選ぶ理由: マスターデータ (CSV/JSON/SQLite) の取り込みと、TypeScript / C++ 双方からの読み込みが最も楽。地図のようなネストに TOML は向かない。
- ID は `<kind>:<game-id>:<slug>`。Ludus の辞書は `lexicon:<id>` で参照する (複製しない)。

### 4.2 ファイル構成

```
guide/<game-id>/
├── manifest.json                 # ゲーム ID、版、対応ビルド、座標系、Ludus 辞書の版、learning.policy
├── glossary.json                 # 人間の言葉 → ID (Ludus 参照 / 自前定義)、UI 要素と値の対応、グリフ表
├── entities/{enemies,items,skills,actors}/<slug>.json
├── entities/{enemies,items,skills,actors}/<slug>.masked.json   # masked 値だけ
├── stages/<slug>/stage.json      # 目標、クリア条件、出現表
├── stages/<slug>/map.json        # grid | navgraph | zones を「ノード + 辺 + 注記」に正規化
├── stages/<slug>/events.json     # 時間・条件で起きること
├── mechanics/rules/<slug>.json   # 式 + 変数定義 + 値域
├── mechanics/states/<slug>.json  # 状態機械 (フェーズ、行動パターン)
├── tactics/<slug>.json           # 定石 + 実測 + superseded_by
├── intent/<stage-slug>.json      # 設計者の意図 + 許容したズレ
├── observations/                 # オーバーレイ (run ごとの JSONL と集計)。正本に混ぜない
└── schema/                       # Commentarii 同梱スキーマへの参照
```

### 4.3 共通フィールド

全ての「値」は次を持つ。スキーマで必須。

```json
{ "value": 120, "unit": "hp", "knowledge": "discoverable",
  "source": { "kind": "master", "ref": "enemies.csv#row=12" },
  "draft": false }
```

- `knowledge`: `shown` / `discoverable` / `masked` (第一原則)。
- `source.kind`: `master` (マスターデータ) / `observed` (観測、`ref` は run と件数) / `human` / `llm-draft`。
- `draft`: true の値は判断に使わない。`llm-draft` は必ず true から始まる。

### 4.4 例

enemy (`entities/enemies/shoplifter.json`):

```json
{ "id": "enemy:kd:shoplifter", "name": { "ja": "万引き犯", "en": "Shoplifter" },
  "lexicon": ["lexicon:health-system"],
  "render_signature": { "mesh": "mesh:kd:npc_shoplifter", "material": ["mat:kd:npc_skin_a"] },
  "stats": {
    "hp":    { "value": 120, "unit": "hp", "knowledge": "discoverable", "source": { "kind": "master", "ref": "enemies.csv#row=12" } },
    "speed": { "value": 3.2, "unit": "m/s", "knowledge": "shown", "source": { "kind": "master", "ref": "enemies.csv#row=12" } }
  },
  "behavior": "state:kd:shoplifter-loop",
  "weak_to": [{ "value": "attr:kd:stun", "knowledge": "discoverable", "source": { "kind": "observed", "ref": "run:2026-10-09-003 x14" } }] }
```

同名の `.masked.json` には `drop_rate` など `masked` の値だけを置く。`validate` は `.masked.json` 以外に `masked` が無いこと、`.masked.json` に `masked` 以外が無いことを検査する。

tactic (`tactics/stun-then-grab.json`):

```json
{ "id": "tactic:kd:stun-then-grab", "name": { "ja": "スタンして確保" },
  "when":    { "all": [ { "entity": "enemy:kd:shoplifter", "visible": true, "distance_lt": 4 }, { "self": { "skill_ready": "skill:kd:stun" } } ] },
  "do":      [ { "use_skill": "skill:kd:stun", "target": "$enemy" }, { "move_to": "$enemy" }, { "interact": "$enemy" } ],
  "expect":  { "within_sec": 3, "entity_state": { "$enemy": "state:kd:shoplifter-loop#stunned" } },
  "because": ["rule:kd:stun-duration", "enemy:kd:shoplifter.weak_to"],
  "knowledge": "discoverable",
  "confidence": "authored",
  "metrics": { "runs": 42, "success": 0.88, "time_sec": { "p50": 2.6 }, "resource": { "stamina": 10 }, "risk": { "damage_taken_p50": 0 } },
  "superseded_by": null }
```

- `knowledge` は参照する値の最も厳しいものが伝播する (`masked` を 1 つでも参照すれば `masked`)。
- `confidence`: `authored` (人間) / `derived` (ルールから機械的に導出) / `learned` (観測から)。

intent (`intent/store-night-1.json`):

```json
{ "stage": "stage:kd:store-night-1",
  "intended": [
    { "id": "intent:kd:store-night-1:route", "kind": "route", "path": ["node:entrance", "node:aisle-3", "node:backroom"], "knowledge": "shown" },
    { "id": "intent:kd:store-night-1:learn-stun", "kind": "teach", "tactic": "tactic:kd:stun-then-grab", "note": "ここでスタンを覚えてほしい" },
    { "id": "intent:kd:store-night-1:time", "kind": "time", "range_sec": [60, 120] },
    { "id": "intent:kd:store-night-1:no-skip", "kind": "forbid", "area": "node:loading-dock", "note": "裏口から抜けられてはいけない" } ],
  "allowed_divergences": [ { "run": "run:2026-10-09-007", "summary": "棚を押して通路を塞ぐ別解", "decided_by": "neco", "tactic": "tactic:kd:shelf-block" } ] }
```

manifest の学習規則:

```json
{ "learning": { "policy": {
    "exploration_rate": 0.15,
    "rewrite": { "min_runs": 20, "min_gain": 0.10, "metric_weights": { "time": 0.5, "resource": 0.2, "risk": 0.3 }, "auto_apply": true },
    "promotion": { "discoverable_requires": { "player_runs": 5, "agreement": 0.9 } } } } }
```

observation (オーバーレイ、`observations/runs/<run-id>.jsonl` の 1 行):

```json
{ "t": 12.4, "tick": 744, "kind": "mismatch", "tactic": "tactic:kd:stun-then-grab",
  "expected": { "entity_state": "stunned" }, "observed": { "entity_state": "fleeing" },
  "source": "render-tap", "mode": "player", "purpose": "efficiency" }
```

### 4.5 地図

`map.json` は `kind` (`grid` / `navgraph` / `zones`) と `nodes[]` / `edges[]` / `annotations[]` を持つ。grid はセルをノード化、zones は領域の隣接をエッジ化する。注記は危険地帯・資源・ショートカット・意図の「通ってほしい / ほしくない」を参照できる。座標系と単位は manifest。

### 4.6 人間と AI の二重表現

- 機械: JSON 正本 + `export` 時の結合索引 `bundle.json` (+ 任意で定石・用語の埋め込みベクトル、正本ではない)。
- 人間: 生成 Markdown。敵図鑑表、地図 (grid は ASCII、navgraph は Mermaid)、ルールの検算例、定石一覧 (実測つき)、知識境界レポート、意図ズレレポート。レビューはこの差分で行う。
- 同期は `render` だけ。手書き Markdown を取り込みたいときは `import --from-notes` で LLM 下書き (draft) にする。

## 5. 知識境界 (第一原則の具体化)

| 値 | 意味 | 例 |
|---|---|---|
| `shown` | 画面に直接表示される | 敵の名前、残り時間、所持金、HP バー |
| `discoverable` | 表示はないがプレイで推定できる | 敵 HP (与ダメ積算)、出現パターン、弱点 |
| `masked` | 内部データ。知ってはならない | ドロップ率の内部値、乱数表、調整係数 |

- 取り込み時の既定は `masked`。`shown` は `glossary` の UI 対応表 (値 → 画面要素) から、`discoverable` は `player` モードの観測 (`promotion.discoverable_requires`) から昇格する。昇格は根拠を持ち、人間承認の対象。`omniscient` の観測は昇格根拠にならない。
- `export --knowledge player` (既定) は `shown` + `discoverable` だけ。`full` は内部用。`player` 書き出しがそのまま「公開できる攻略本」。
- `report knowledge`: エンティティ別の割合、根拠の無い昇格、`masked` を参照する定石の一覧。設計側の「何を見せ、何を隠すか」の点検表。

## 6. 攻略本ツクール (Guide Maker)

CLI `guide` が正本の操作口。Web 画面はファイルを書くだけで独自 DB を持たない (Excubitor 配下、port 4410)。

| コマンド | 役割 |
|---|---|
| `init <game-id>` | 骨格と manifest。Ludus 辞書の版を固定 |
| `import masters --from <path> --map <mapping.json>` | マスターデータ → entities。mapping はゲームごとに 1 つ、再実行可能。既定 `masked` |
| `import map --from <path> --kind grid\|navgraph\|zones` | 地図 → `stages/*/map.json` |
| `import spec --from <Pf 文書>` | ルール・状態機械の LLM 下書き (`draft`) |
| `intent import --from <Pf 文書>` / `intent edit` | 設計者の意図の下書きと編集 |
| `validate` | スキーマ、参照整合、単位、式の評価可能性、カバレッジ、知識境界の分離、draft の混入 |
| `render` | Markdown 生成 (レポート含む) |
| `export --target <runtime> [--knowledge player\|full]` | `bundle.json` と索引。既定 `player` |
| `report knowledge` | 知識境界レポート |
| `learn ingest <runs>` | 観測を `observations/` に取り込み、差分一覧 (値のずれ、未知の敵、定石の失敗、効率の良い変種) |
| `learn consolidate` | 正本の更新案 (JSON パッチ)。`learning.policy` の範囲は自動反映、残りは承認待ち |
| `verify intent --runs <runs>` | 意図ズレレポート (分類つき) |
| `diff <a> <b>` | 版間の意味差分 |

- `validate` の検査項目は固定リストとして spec に置き、1 項目 1 テスト。
- LLM の使いどころは下書きと説明文だけ (原則 3)。

## 7. オートプレイヤー (Auto Player)

### 7.1 観測経路 (3 段)

| 段 | 経路 | 取れるもの | 使いどころ |
|---|---|---|---|
| 1 | ゲーム内 API | 全状態 | 自前ゲームで協力できるとき。`omniscient` 専用 |
| 2 | **描画命令タップ** | 画面に映っている物 (どのメッシュ/スプライト/マテリアルが、どの変換で、画面のどこに) | 既定の「目」 |
| 3 | 画素 (スクショ + 画像認識) | 見た目だけ | 1・2 が無い外部ゲームの最後の手段 |

段 2 の仕組み:

- Pictor 系: Pictor に「フレームタップ」を足し、フレームごとの描画リスト (draw ごとの mesh/material/instance ID、world 変換、画面外接矩形、深度順、pass 名) を JSON Lines か共有メモリで外へ出す。画素の読み戻しをしないので GPU を待たない。シーン pass と UI pass を区別する。契約は Commentarii の `spec/` に置き、Pictor へは PR で持ち込む。
- 外部ゲーム: グラフィックス API 層 (Vulkan layer / D3D12 フック、RenderDoc in-app API や apitrace と同じ位置)。リソース ID は不透明なので、メッシュ・テクスチャの指紋で同一性を取り、人間が一度ラベル付けした対応表で攻略本 ID に結ぶ。
- 攻略本の `render_signature` で draw → entity を引く。マスターデータ取り込み時にアセット表から埋め、埋まらない分は観測で `draft` 雛形を起こす。
- 位置は world と画面の両方を出す。地図照合は world、「狙えるか」は画面。
- 限界: 描かれていない状態 (内部 HP、クールダウン、画面外) は取れない。HP バー・数字は UI スプライト/グリフから読む (`glossary` のグリフ表)。足りない分は「不明」として定石側で扱う。カリング後しか見えないのは「人間と同じ条件」と一致する (原則 2)。
- **描画に出したもの ≠ 人間に見えたもの** (Astra レビュー P0-2 / P1-7、2026-10-09): 遮蔽 (壁の裏で深度テストに落ちた draw)、透明、UI の clip 外・非表示、
  影・反射・深度 pass、アセット ID そのものは、提出されても人間には見えない (見えても名前は分からない)。raw tap と player 観測を分け、
  観測者 (`player-camera`)、観測に入れてよい pass (scene / ui)、可視性の根拠 (遮蔽クエリ)、外見からの識別可否 (同じ外見の別種は名付けない、
  頂点数 + インデックス数の指紋は識別不能) を契約 `render-tap/1` で固定する。根拠を示せない draw は「不明」として観測に入れない。
  画素を読み戻さないので、GPU と同期した厳密な可視性は約束しない。契約は `spec/feature/render-tap-contract.md` + `schema/render-frame.schema.json` + golden で、Pictor / Bestia はこれに合わせる。

### 7.2 Observation スキーマ (共通)

```json
{ "tick": 744, "t": 12.4, "source": "render-tap", "mode": "player", "purpose": "efficiency",
  "self": { "pos": [3.1, 0, 7.2], "hp": { "value": 0.6, "knowledge": "shown" }, "resources": { "stamina": 40 } },
  "entities": [ { "entity": "enemy:kd:shoplifter", "instance": 17, "pos": [5.0, 0, 7.9], "screen": [812, 410, 60, 120], "state_guess": "state:kd:shoplifter-loop#wander", "confidence": 0.9 } ],
  "stage": { "id": "stage:kd:store-night-1", "elapsed": 12.4, "node": "node:aisle-3" },
  "events": [], "extra": {} }
```

`knowledge` が `masked` の値は `player` モードの観測に現れない (段 1 のアダプタが `mode` を見て落とす。落とし忘れはエンジンのテストで担保)。

**観測の場所にも境界を持たせる** (Astra レビュー P0-1、2026-10-09): ラベルの無い値は masked (原則 1) なので、player の観測が持てる場所を
許可表で固定する。基本項目 (tick・自位置・見えている entity など、境界不要のメタデータと構造上見えているもの) と、manifest
`observation.fields` で `knowledge` と出所を宣言したゲーム固有項目 (`self.resources.*` / `extra.*` / `events.<kind>.*`) だけを通し、
表に無い場所は中身を問わず拒否する。ドライバ・記録器・読み込み・人間ログ取り込みが同じ判定を使う。詳細 `spec/feature/observation-boundary.md`。

### 7.3 ゲームアダプタ契約

- `observe(): Observation`
- `act(action)`: `move_to` / `attack` / `use_item` / `use_skill` / `wait` / `interact` + `custom` (攻略本側で宣言)
- `identify(gameEntity) → entity ID` (取り込み時の mapping と同じ表)
- ティックはアダプタが呼ぶ (リアルタイムは固定周期、ターン制は手番ごと)。
- 実装: TypeScript 契約を正本に、C++ ヘッダを同じ契約で用意 (JSON Lines でプロセス分離可)。ネイティブゲームは別プロセスから始める。

### 7.4 判断: Utility が狙いを選び、BT が手順を実行する

- **候補** = 攻略本の定石のうち `when` が成り立つもの + 汎用行動 (生存、目標接近、資源確保) + 探索候補 (未試行の行動列、定石の変種)。
- **効用** = 考慮項目の重み付き合成。考慮項目: 距離、HP 比、残り時間、資源、定石の `confidence`、`metrics` (成功率・時間・リスク)、探索ボーナス (`purpose=coverage` では未訪問・未使用・未試行を強く加点、`efficiency` では `exploration_rate` の割合で混ぜる)。
- **意図は評価器であって判断材料ではない** (Astra レビュー P1-4、2026-10-09): 意図の注記 (通ってほしい場所の加点、`forbid` の減点、意図の時間上限) は、明示した **意図支援試験** (`--intent-assist`、run に `decision_mode: intent-assisted`) でだけ効かせる。既定の判断器は承認済みのプレイヤー知識だけで判断し、意図支援の run は人間の能力の推定に使わない。sim の結果は人間ログで較正するまで「ペルソナモデル上の推定」と呼ぶ (`spec/feature/engine.md` §4.1)。
- **継続 / 切替**: 直前の定石の BT が進行中なら継続に加点 (ヒステリシス)。`expect` が破れたら即再評価。
- **BT**: 選ばれた定石の `do` をサブツリーに展開。Selector / Sequence / Condition / Action の 4 種 (Bestia の固定配列 BT を一般化し、データから組む)。葉はアダプタの抽象アクション。
- 攻略本ゼロでも汎用行動だけで動く (弱い)。攻略本の効果はここの差で測る。

### 7.5 1 ティック

observe → match (entity と状態機械の照合、未知は記録) → decide (Utility) → act (BT) → reflect (`expect` と観測の差分、定石の実測更新、未知の雛形起こし) → オーバーレイへ追記。

### 7.6 動作モードと実走の目的

- `mode`: `player` (既定) / `omniscient` (検算・デバッグ、スコアと昇格に使わない)。
- `purpose`: `efficiency` (定石の実測と書き換えのため) / `coverage` (意図ズレ検証のため、多様性探索)。観測形式は同じで、集計時に分ける。

## 8. 学習と検証

### 8.1 オーバーレイ

プレイ中の更新は `observations/` だけ (定石の実測、考慮項目の重みの微調整、未知の雛形)。正本 (`entities` / `tactics` / `intent`) は触らない。

### 8.2 定石の書き換え (効率)

- `learn ingest` が、同じ `when` に対する `learned` 変種のうち、`rewrite.min_runs` 以上の試行で合成指標 (`metric_weights`) が既存より `min_gain` 以上良いものを「書き換え候補」にする。`player` モードの実測だけを数える。
- オーバーレイには即時反映 (次のプレイから使う)。
- `learn consolidate` が正本の書き換え提案 (旧 → 新、実測比較、根拠 run) を作る。`auto_apply: true` かつ意図ズレに触れない候補は自動反映。それ以外は承認待ち。
  「意図に触れる」は teach / forbid だけでなく route / time / design_stance / illusory_by_design / 許容ズレの全種類で判定し、`when` を緩めた
  変種 (`relax`) は同じ条件での効率比較ではないので自動反映しない (Astra レビュー P1-5、2026-10-09)。
- 承認は提案の内容ハッシュ・承認者・根拠・攻略本の版に紐付ける (`guide learn approve`)。提案の内容 (根拠 run、パッチ、条件、単位、版) が
  変われば承認は失効し、再承認まで正本は変わらない。詳細 `spec/feature/learning.md` §4。
- 旧定石は `superseded_by` を付けて残す。

### 8.3 意図ズレの検証 (レベルデザインのプレイヤー行動可能性)

`verify intent --runs` が `coverage` 実走を `intent/` と突き合わせ、意図ごとに分類する。

| 分類 | 意味 | 扱い |
|---|---|---|
| 一致 | 想定経路・解法で想定時間内 | 記録 |
| 面白いズレ | 想定外だが成立する別解・ショートカット・意外な組合せ | 人間が「許容」とマーク → `allowed_divergences` に保存、再報告しない。許容された手は `learned` → `authored` へ昇格可 |
| 望ましくないズレ | 想定を崩す (学習意図の飛ばし、経済の崩壊、詰み、`forbid` 侵入) | レベルデザイン修正候補 |
| 不可能 | 想定解法 (`teach` / `route`) が **再現できないと証明される** (地図上で歩けない、定石が攻略本に無い) | 「意図した行動が可能か」の反証。設計かデータの不具合候補 |
| 再現されず | どの run も想定解法を再現しなかったが、証明は無い (Astra レビュー P1-3) | 実測として標本数と区間を添えて報告。「不可能」とは呼ばない |

- 「面白い」は人間が決める。ツールは候補を出し、過去の判定を並べ替えに使うだけ。
- 許容は意図・署名 (定石列と正規化した経路)・攻略本の版に紐付ける。run や定石だけを名指しする許容や、別の版で許容したものは黙って抑えず「再判定要」として再報告する。解法のまとまりは順序に依らない同値関係で作る (Astra レビュー P2-8)。
- レポート: 意図ごとの到達可否、経路の地図重ね書き、使われた定石、時間差、未使用の仕組み。生成 Markdown に含める。

### 8.4 境界の昇格

`player` 実走で `promotion.discoverable_requires` を満たした値は `discoverable` 昇格候補になる。承認で `knowledge` が書き換わり、根拠 run が `source` に残る。

### 8.5 行動可能性の範囲と「良い遊び」の指標

neco 指示 (2026-10-09): 攻略本には「人間がやってやれそうなこと」「出来そうで出来ない / 超頑張ればできること」の範囲を構造化して測る目的がある。良い遊び = 解法がたくさんあり、かつ深く迷わないこと。

**行動可能性の帯 (feasibility band)**

ステージごと、解法 (定石・経路のまとまり) ごとに、ペルソナ (§14.E) 別の実走から帯を付ける。帯は `feasibility/<stage-slug>.json` に根拠 run つきで残し、`render` のステージ節と意図ズレレポートに出す。

| 帯 | 意味 | 判定 (manifest `feasibility.thresholds` で調整) |
|---|---|---|
| `feasible` | 人間がやってやれそう | 初心者〜上級者の各ペルソナで成功率が閾値以上 |
| `extreme` | 超頑張ればできる | 上級者ペルソナの `coverage` 実走でのみ成功し、成功率が低い (0 より大きく閾値未満) |
| `skill-gated` | 上手い人ならできる | 判定対象のペルソナのうち、閾値以上で成功するもの (上級者) と下回るもの (初心者) がある (Astra レビュー P1-3 で追加) |
| `illusory` | 出来そうで出来ない | `player` 書き出しの情報 (shown / discoverable) から定石候補として生成される (= プレイヤーに「できそう」と見える) のに、完了した試行が十分ある中で成功 0 (成功率の 95% 上限が `zero_success_upper` 未満) |
| `impossible` | できない | 地図上で経路を歩けないと証明される。§8.3 の「不可能」と同じ。成功 0 だけでは付けない |

成功 0 でも完了した試行が足りなければ `insufficient-evidence` (判定保留)、完了した試行が無ければ `not-observed` (未観測) を **分類外の実測状態** として残す。分母はその解法を試して完了した run (tick 上限・エラーで中断した run は数えない) で、帯ごとに標本数・seed・予算・成功率の区間を記録する (Astra レビュー P1-3、`spec/feature/intent-verify.md` §6.2)。

- `illusory` は「見かけ上の解」であり、迷いの主因。レポートでは最優先で目立たせる (設計の意図なら `intent` に `illusory_by_design` として根拠つきで宣言できる。例: 釣りの選択肢)。
- 帯の判定は `player` モードの実走だけで行う。`omniscient` は帯を決めない (原則 2)。

**良い遊びの 2 軸**

| 軸 | 測り方 (ステージ・ペルソナ別) |
|---|---|
| 解法の広さ (breadth) | `coverage` 実走で成功した解法のまとまり (定石列と経路をクラスタ化) の数。`feasible` + `extreme` を数え、`illusory` は数えない |
| 迷いの深さ (confusion depth) | 成功までに試して失敗した候補の数、往復、滞留時間、失敗した試行が意図の経路から外れた距離の合計。`illusory` に費やした試行は重く数える。観測値 (失敗・往復・滞留・経路外) は解釈と分けて出し、到達した別解の経路の長さは迷いに数えない (Astra レビュー P2-8) |

- 良い遊び = breadth が高く、confusion depth が低い。レポートはステージを 2 軸の散布図に置き、ペルソナ別に描く (§14.H の描画器)。
- 片方だけを上げるのは簡単 (解法を 1 つにすれば迷わない、何でも通せば広い)。両立させる設計が目標で、ツールは両軸を常に並べて出し、片方だけで「良い」と判定しない。

**迷わなさの作り方と洗練化の位置づけ**

- 迷わなさは、難易度と直結したギミックの組み合わせ (仕組みが解法を自然に示す) と、戦法の洗練化 (答えを一つに絞らせる遊び) で作られる。どちらも設計の手段であり、攻略本では `intent` の `design_stance` に `open` (解法を広く残す) / `refined` (絞らせる) / `mixed` を書いて、レポートはその立場に対して評価する。
- **洗練化が絶対的に正しいわけではない。** 洗練化は confusion depth を下げる代わりに breadth を削る。ツールは洗練化を自動で推奨せず、`refined` を宣言していないステージで解法が 1 つに収束していたら「収束」として報告する (良いとも悪いとも言わない。判断は人間)。
- 面白いズレ (§8.3) の許容は breadth を増やす行為。許容されたズレは帯の判定に入り、`illusory` が `feasible` へ変わることもある。

## 9. 既存資産との関係

- **Ludus (Lu)**: 汎用辞書の中央正本。攻略本は版 + 安定 ID で参照し、複製しない。固有名・未公開情報を Ludus へ混入させない。汎化できた知識だけ PR で戻す。
- **game-knowledge-graph**: `glossary` / `mechanics` の分類語彙の参照候補。
- **Bestia**: 固定 BT の実装例。BT 実行器の原型であり、最初のアダプタ対象 (archetype と状態機械が小さい)。
- **Pictor (Pc)**: 描画命令タップの実装先。契約は Commentarii が定め、PR で持ち込む。
- **Praeforma (Pf)**: 仕様の正本。`import spec` / `intent import` の入力元。
- **Omnipotens / Discutere**: メカニクス・経済分析はルールの下書き元になり得る。

## 10. 公開・秘匿

- 攻略本バンドルはゲームと同じ可視性。`player` 書き出しだけが公開候補。`masked` は別ファイルなので混入しない。
- Commentarii 本体はゲーム固有情報を持たないので public。同梱サンプルは public ゲーム (Bestia) のみ。
- 観測ログに固有名・パスを入れない (ID と数値のみ)。

## 11. 実装の分割 (フルセット、MVP で縮めない)

| 段 | 内容 | テスト |
|---|---|---|
| 1 | 共通スキーマ (共通フィールド、`knowledge`、`.masked.json` 分離、intent、metrics)、`validate`、`render`、`report knowledge` | スキーマ違反・参照切れ・式評価・境界分離の各検査項目 1 つずつ |
| 2 | `import masters` (CSV/JSON/SQLite + mapping)、`import map` (3 種)、`import spec` / `intent import` (LLM draft) | Bestia archetype と KonbiniDominant マスターデータから生成、既定 `masked` |
| 3 | `export` (`player` / `full`)、Utility 選択器、BT 実行器、アダプタ契約 (TS + C++)、Bestia アダプタ (段 1)、`player` / `omniscient` | 固定観測列の決定の再現性、`player` に `masked` が漏れない、Bestia 既存 BT と同等以上 |
| 4 | 学習ループ: reflect の観測、`learn ingest` / `consolidate`、書き換え規則、オーバーレイ、探索の混入、境界の昇格候補 | ずらした値の検出、閾値を満たしたときだけ書き換わる、`omniscient` が昇格根拠にならない |
| 5 | 意図ズレ検証: `intent/`、`verify intent`、`coverage` 探索、分類レポート、許容マーク | 想定解法を封じたステージで「不可能」、別解が候補に出て許容後は再報告しない |
| 6 | 描画命令タップ: Pictor フレームタップ + Commentarii 側の受信・正規化・`render_signature` 照合 | Bestia を段 2 だけで動かし、見える範囲で段 1 と同じ判断 |
| 7 | Web 編集画面 (エンティティ、地図注記、定石、意図、観測差分の採否、ズレ判定) | 保存が正本と一致、スクショ確認 |
| 8 | 2 本目のアダプタ (KonbiniDominant か KuzuSurvivors) | 攻略本とアダプタの差し替えだけで動く |

追加実装 (neco 2026-10-09 全採用、§14 に要点)。土台になるものを前に挟む。

| 段 | 内容 | 入れる位置 |
|---|---|---|
| 2A | リプレイ記録と再生 (§14.A) | 段 2 と並行。段 3 のテストはリプレイで書く |
| 2B | マスク境界の監査 CI lint (§14.B) | 段 2 と並行 (段 1 の `.masked.json` だけで作れる) |
| 3E | プレイヤー・ペルソナ (§14.E) | 段 3 に同梱 (Utility 重みプリセット) |
| 5H | 経路・死亡ヒートマップ (§14.H) | 段 5 に同梱 (レポートの絵) |
| 5P | 行動可能性の帯と良い遊びの 2 軸 (§8.5: feasibility、breadth / confusion depth、design_stance) | 段 5 の直後 (3E のペルソナと coverage 実走が前提) |
| 4D | 人間プレイログの取り込み (§14.D) | 段 4 の直後 |
| 5C | バランス回帰ゲート (§14.C) | 段 5 の直後 |
| 5K | Praeforma 連携 (§14.K) | 段 5C の後 |
| 6F | 敵 AI としての再利用 (§14.F) | 段 6 の後 (Bestia の 5 体 AI で実証) |
| 7G | 攻略本のゲーム内逆利用 (§14.G) | 段 7 の後 |
| 7I | 攻略本差分の変更説明 (§14.I) | 段 7 の後 |
| 7J | LLM 解説者 (§14.J) | 最後 |

各段は 1 PR、`src` と `tests` を対で持つ。段 1〜5 (2A・2B・3E・5H 含む) はゲーム無しで (固定観測列とリプレイで) テストできる。

## 12. 受入条件

- 全ファイルがスキーマ検証を通り、人間向け Markdown が生成される。
- 全ての値が `knowledge` と `source` を持ち、`player` 書き出しに `masked` が混ざらず、`player` モードが `masked` を参照しない。
- 同じエンジンが、攻略本とアダプタの差し替えだけで 2 本のゲームで動く。
- 攻略本ゼロでも動き、攻略本ありで明確に強い (勝率・クリア時間)。
- 効率差だけの定石書き換えは規則の範囲で自動反映され、それ以外は承認なしに正本が変わらない。
- 意図ズレが分類付きで報告され、許容したズレは再報告されず、再現できない想定解法は「不可能」として出る。
- 段 2 (描画命令タップ) だけで Bestia が遊べる。

## 14. 追加実装の設計要点 (neco 2026-10-09 全採用)

### A. リプレイ記録と再生

- run ごとに `replay/<run-id>.jsonl`: seed、manifest の版、アダプタ ID、ティックごとの Observation と Action、判断ログ (候補と効用値)。観測は §7.2 の形式そのまま。
- `guide replay play <run> --until <tick>`: 記録した観測列をエンジンに流し、同じ判断が出るかを検証する (決定性テスト)。アダプタ不要。
- `guide replay diff <a> <b>`: 判断が分岐した最初のティックと、その時の効用値の差を出す。定石の書き換え前後の比較に使う。
- 段 3 以降のエンジンのテストは固定観測列ではなくリプレイを正本にする。観測に `masked` が混ざっていないかもリプレイで検査する。

### B. マスク境界の監査 (CI lint)

- `guide audit mask --game <bundle> --scan <paths>`: ゲームリポの UI 文字列・ローカライズ表・ネットワーク応答のスキーマ・ログ出力・セーブデータ形式を走査し、`.masked.json` の値 (数値・ID・名前) と一致するものを報告する。一致の判定は値そのものと、manifest に書いた「露出禁止キー名」の両方。
- 結果は Revisor の審査に乗る形式 (JSON + Markdown) で出し、ゲームリポの PR ゲートに足せる。誤検出の除外は攻略本側の `audit.allow[]` (根拠つき) に書く。
- 第一原則をゲーム実装側へ延長するもの。攻略本に無い値は検査できないので、報告に「未定義の露出候補」(数値定数が UI に直書きされている等) も含める。

### C. バランス回帰ゲート

- ゲームリポの PR で `guide bench --runs N --purpose efficiency` を走らせ、ステージごとのクリア率・時間・被ダメージ・使われた定石の分布を前回 (main) と比較する。差分が manifest の `bench.thresholds` を超えたら「体験ブロック」の証跡として Revisor に出す (現状「未確認」になる欄を埋める)。
- 走行はリプレイ可能な seed 固定で、結果は `bench/<commit>.json` に残す。意図ズレ (§8.3) の分類変化も同じレポートに載せる。
- 時間がかかるので、CI では段 2 のリプレイ再生による短縮版 (記録済み run の再判定) を既定にし、実走は夜間か手動。
- **判断回帰とバランス回帰を分ける** (Astra レビュー P1-6、2026-10-09): 固定 replay の再判定は「同じ観測で同じ判断か」の decision regression で、live のバランス回帰とは別の結果として出す。replay が一致しても体験は検証済みにしない。live の結果はゲームビルド・アダプタ・攻略本 / オーバーレイ / ペルソナのハッシュ・seed 集合・purpose / mode・予算を保存し、条件が違う結果は比較しない (ゲートは比較不能で落ちる)。sim の結果は `evidence: sim` と明示する。詳細 `spec/feature/balance-gate.md`。

### D. 人間プレイログの取り込み

- ゲームのテレメトリを `guide import plays --from <path> --map <mapping>` で Observation 形式に変換し、`observations/human/<player-hash>/` に置く (個人は匿名化したハッシュのみ、固有名は入れない)。
- 人間の実走は `learned` 定石の候補源 (人間が見つけた別解) と、意図ズレの比較対象 (人間 vs オートプレイヤーで到達率・時間・経路を並べる) になる。
- 人間の観測は `mode: player` として扱うが、昇格根拠に使うかは manifest で選ぶ (既定は使う)。
  - 現状 (2026-10-09): 人間 run は別解候補 → `human-tactic` 提案 → 承認 → 正本 `tactics/` の経路と、意図ズレの比較に使う。
    境界の昇格根拠に数えるには人間 run から値の推定を作る段が要り、未実装 (manifest の選択肢はその段と同時に置く)。

### E. プレイヤー・ペルソナ

- `personas/<slug>.json`: Utility の考慮項目の重み、探索率、反応遅延、誤操作率、使う定石の上限 (`confidence` の下限) のプリセット。例: 初心者 (遅延大・探索低・authored のみ)、上級者 (遅延小・learned 可)、探索好き (探索率高)。
- `guide bench --persona <slug>` で走らせ、ペルソナ別の到達率・詰まり箇所を出す。「初心者が詰まる場所」が意図ズレレポートに並ぶ。
- ペルソナはゲーム非依存 (Commentarii 同梱) と、ゲーム固有 (バンドル内) の 2 層。Discutere / Histrio のペルソナと ID で結べるようにする。

### F. 敵 AI としての再利用

- 同じエンジンを敵・NPC の脳として使う。敵用の攻略本は「敵から見たプレイヤー」を entity にした別バンドル (またはバンドル内の `actors/` 視点切替)。
- アダプタの `self` を敵個体に差し替えるだけで動くことを Bestia の 5 体 AI で実証する (既存の固定 BT と置き換えて同等以上)。
- 敵 AI も `player` モード (見えている情報だけ) を既定にし、全知の敵は `omniscient` と明示する。

### G. 攻略本のゲーム内逆利用

- `export --target ingame --knowledge player` で、ゲーム内図鑑・ヒント・チュートリアル用の軽量 JSON を出す (shown だけ、または shown + 解放済み discoverable)。
- ゲーム側は `glossary` の表示名と `intent` の `teach` を使い、「ここで覚えてほしいこと」をチュートリアル文に出せる。公開版攻略本とゲーム内ヘルプが同じ正本になる。

### H. 経路・死亡ヒートマップ

- `coverage` 実走の経路を地図のノード単位で集計し、到達回数・死亡回数・滞留時間を SVG (grid は格子、navgraph はノード円) に描く。意図の `route` / `forbid` を重ねて表示する。
- `render` のステージ節と意図ズレレポートに埋め込む。ペルソナ別・人間ログ (D) との並置も同じ描画器で行う。

### I. 攻略本差分の変更説明

- `guide diff --explain <a> <b>`: 意味差分 (敵の値の変化、定石の追加・置換、意図の変更、境界の昇格) を人間向け Markdown にする。LLM は文章化だけ (数値は差分から機械的に)。
- 出力は 2 種: 内部用 (full) と公開用 (player 書き出し同士の差分だけ)。公開用はアップデート説明の素材になる。

### J. LLM 解説者

- run の判断ログ (候補・効用値・選ばれた定石・`expect` の結果) を入力に、「なぜその判断か」を実況文にする。定石のレビューと、面白いズレの人間判定を助けるための補助。
- 判断には一切関与しない (読み取り専用)。出力は `observations/commentary/` に置き、正本に混ぜない。

### K. Praeforma 連携

- `intent/` の各項目に Praeforma のシーン ID / 仕様 ID を持たせ、`intent import` は Praeforma の UX 文書から下書きを起こす (draft)。
- 意図ズレレポートを Praeforma 側で該当シーンに表示できるよう、レポートの JSON にシーン ID を含める。Praeforma への表示実装は Praeforma 側の PR。

## 15. 未決事項 (neco 判断)

- 最初の対象ゲーム (推奨: Bestia → KonbiniDominant)。
- オートプレイヤーの実行形態 (ネイティブは別プロセス推奨)。
- Web 編集画面の優先度 (段 7。CLI + Markdown レビューで先に回せる)。
- 書き換えの `auto_apply` の既定 (本設計は true。保守的にするなら false で承認待ち)。
