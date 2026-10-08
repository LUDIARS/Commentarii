# 攻略本ツクール + 汎用オートプレイヤー 設計 (2026-10-09)

neco 指示 (2026-10-09):

- 汎用的オートプレイヤーを作るための「攻略本ツクール」を用意する。
- オートプレイヤーの基本判断は Utility AI か BT に置き、ゲームの基本仕様を学習しておき、何が起きているかを再帰ループしながら賢くなる。
- ゼロから学習させるのは非効率なので、攻略本 (敵のマスターデータやステージのマップ) を作って食わせる。
- データは構造化し、人間と AI のそれぞれが処理しやすい形にする。
- まずは設計から。

## 指示の解釈 (本文書の前提)

- 「汎用」= 特定ゲームのコードに依存しない。ゲームごとの差は **攻略本データ** と **ゲームアダプタ** に閉じ込め、判断エンジンは共通にする。
- 「攻略本」= 人間がゲームを理解するための資料と同じ構造 (敵図鑑・アイテム・ステージ地図・仕組みの解説・定石) を、機械可読にしたもの。
- 「ツクール」= 攻略本を作る・育てる道具一式 (取り込み・編集・検証・書き出し・学習結果の取り込み)。
- 「再帰ループ」= 予測と観測の差分を攻略本へ戻し、次のプレイで使う。LLM の再学習ではなく **データの更新** で賢くする。
- 対象ゲームは LUDIARS のゲーム (KonbiniDominant / KuzuSurvivors / Bestia / Pagus など) を第一とし、外部ゲームはアダプタ追加で対応する。

## 全体構成

3 つの部品に分ける。判断エンジンとデータを分けることが「汎用」の要。

| 部品 | 役割 | 形 |
|---|---|---|
| 攻略本 (Guide Bundle) | ゲーム 1 本分の構造化知識。正本はファイル (git 管理) | JSON (機械正本) + 生成 Markdown (人間向け) |
| 攻略本ツクール (Guide Maker) | 取り込み・編集・検証・書き出し・学習結果の統合 | CLI + Web 編集画面 |
| オートプレイヤー (Auto Player) | 攻略本を読み、観測→判断→行動→反省を回す | ライブラリ + ゲームアダプタ |

```
ゲームのマスターデータ / マップ / 仕様書 (Ludus, Praeforma)
        │ import (ツクール)
        ▼
  Guide Bundle (JSON 正本) ──render──▶ Markdown (人間が読む・直す・レビュー)
        │ export (圧縮索引)
        ▼
  Auto Player  ◀──observe/act──▶ ゲーム (アダプタ経由)
        │ reflect (予測と観測の差分)
        ▼
  Observation Overlay (学習結果) ──consolidate (ツクール, 人間レビュー)──▶ Guide Bundle へ反映
```

## 攻略本 (Guide Bundle) のデータモデル

### 置き場所と形式

- 1 ゲーム = 1 バンドル。ディレクトリ `guide/<game-id>/` に **1 エンティティ 1 ファイル** の JSON を置く (Ludus の辞書が 1 機能 1 TOML なのと同じ考え)。
- 機械正本は JSON。全ファイルに JSON Schema を付け、ツクールの `validate` で検証する。
- 人間向けには Markdown を **生成** する (`docs/<game-id>/enemies.md` など)。人間は Markdown を読んでレビューし、直すときはツクールの編集画面か JSON を直接編集する。生成 Markdown は手で直さない (再生成で消える)。
- JSON を選ぶ理由: ゲーム側のマスターデータ (CSV/JSON) からの取り込みと、オートプレイヤー (TypeScript / C++) 双方からの読み込みが一番楽。TOML は Ludus 辞書との整合では有利だが、ネストした地図データに向かない。
- ID: `<kind>:<game-id>:<slug>` (例 `enemy:kd:shoplifter`)。Ludus の辞書 ID は `lexicon:<id>` で参照する。

### ファイル構成

```
guide/<game-id>/
├── manifest.json        # ゲーム ID、版、対応するゲームのビルド/コミット、参照する Ludus 辞書の版
├── glossary.json        # 用語 → Ludus 辞書 ID / 自前定義。人間と AI の語彙合わせ
├── entities/
│   ├── enemies/<slug>.json
│   ├── items/<slug>.json
│   ├── skills/<slug>.json
│   └── actors/<slug>.json      # プレイヤー・NPC
├── stages/<slug>/
│   ├── stage.json       # 概要、目標、クリア条件、出現表、推奨順路
│   ├── map.json         # 空間 (グリッド / ナビグラフ / 3D ゾーン) と注記 (危険地帯、資源、ショートカット)
│   └── events.json      # 時間・条件で起きること (ウェーブ、ギミック)
├── mechanics/
│   ├── rules/<slug>.json       # ルール (ダメージ式、状態異常、経済、クールダウン) を式と単位つきで
│   └── states/<slug>.json      # 状態機械 (フェーズ、ボス行動パターン)
├── tactics/<slug>.json  # 定石: 前提条件 → 手順 → 期待結果 → 根拠 (どのルール/エンティティから導いたか)
├── observations/        # オートプレイヤーが書く学習結果 (後述)。人間レビュー前は正本に混ぜない
└── schema/              # 上記全部の JSON Schema (ツクールが同梱する共通スキーマへの参照)
```

### 各ファイルの要点

- **entities**: 数値 (HP、攻撃力、速度、報酬) は単位と出典 (`source`: マスターデータのファイル名と行、または「観測」) を必ず持つ。行動パターンは `mechanics/states` の状態機械 ID を参照する。弱点・耐性は `glossary` の属性 ID で書く。
- **stages/map.json**: 空間表現は 3 種類から選ぶ (`grid` / `navgraph` / `zones`)。どれも「ノード + 辺 + 注記」に正規化でき、オートプレイヤーは経路探索をこの共通形で行う。座標系と単位は manifest に書く。
- **mechanics/rules**: 式は文字列 (例 `"damage = max(1, atk * mult - def)"`) に加えて、変数の定義と値域を持つ。ツクールは式を評価して例を Markdown に出す (人間が読んで検算できる)。
- **tactics**: `when` (条件: エンティティ / 状態 / 数値の述語)、`do` (行動列: アダプタの抽象アクション)、`expect` (観測で検証できる期待値)、`because` (根拠となるルール ID と出典)、`confidence` (`authored` / `derived` / `learned`)。これが Utility AI の考慮項目 (consideration) と BT のサブツリーの両方の種になる。
- **glossary**: 人間の言葉 (「雑魚」「安地」「DPS チェック」) と機械 ID の対応表。LLM 補助で攻略本を書くときの語彙統制に使う。Ludus 辞書に同じ概念があれば必ず参照し、自前定義は Ludus に無いものに限る。

### 人間と AI の二重表現

- 機械: JSON 正本 + 書き出し時に 1 ファイルへ結合した索引 (`bundle.json`) + 任意で tactics / glossary の埋め込みベクトル (検索用、正本ではない)。
- 人間: 生成 Markdown。敵図鑑表、ステージ地図 (grid は ASCII、navgraph は Mermaid)、ルールの検算例、定石の一覧。レビューは Markdown の差分で行う。
- 両者の同期はツクールの `render` だけが行う。手書きの Markdown は入力として受け付けない (取り込みたいときは `import --from-notes` で LLM 下書きの JSON にし、`draft` 印をつける)。

## 攻略本ツクール (Guide Maker)

CLI (`guide`) を中心に、編集画面は Web (Excubitor 配下のローカルサービス)。

| コマンド | 役割 |
|---|---|
| `guide init <game-id>` | バンドル骨格と manifest を作る。Ludus 辞書の版を固定する |
| `guide import masters --from <path> --map <mapping.json>` | ゲームのマスターデータ (CSV/JSON/SQLite) を entities へ。列→フィールドの対応は mapping ファイル (ゲームごとに 1 つ、再実行可能) |
| `guide import map --from <path> --kind grid\|navgraph\|zones` | タイルマップ / ナビメッシュ / ゾーン定義を `stages/*/map.json` へ |
| `guide import spec --from <Ludus/Pf の文書>` | 仕様書からルール・状態機械の **下書き** を LLM で起こす。必ず `draft: true` |
| `guide validate` | スキーマ、参照整合 (無い ID を指していない)、単位、式の評価可能性、カバレッジ (敵に状態機械が無い等) を報告 |
| `guide render` | Markdown 生成 |
| `guide export --target <runtime>` | オートプレイヤー向け `bundle.json` と索引を書き出す |
| `guide learn ingest <observations.jsonl>` | オートプレイヤーの観測ログを `observations/` に取り込み、正本との差分 (値のずれ、未知の敵、失敗した定石) を一覧化 |
| `guide learn consolidate` | 差分から正本の更新案 (JSON パッチ) を作る。適用は人間の承認 (PR) |
| `guide diff <a> <b>` | バンドル版間の意味差分 (敵の HP が変わった、定石が増えた) |

- 編集画面: エンティティ表の編集、地図の注記付け、定石の条件・手順の編集、観測差分の採否。保存先は JSON 正本 (画面はファイルを書くだけ、独自 DB を持たない)。
- LLM の使いどころは「下書き」と「観測差分の説明文」に限定する。数値や ID を LLM に作らせない (出典のある値だけ正本に入る)。

## オートプレイヤー (Auto Player)

### 判断エンジン: Utility AI を土台、BT を手順の実行器にする

- **Utility AI (何を狙うか)**: 攻略本の tactics を候補にし、各候補の効用を考慮項目 (距離、HP 比、残り時間、資源、定石の `confidence` と過去の成功率) の重み付き合成で点数化して選ぶ。定石が無い状況では汎用の考慮項目 (生存、目標接近、資源確保) だけで動く = 攻略本ゼロでも動くが弱い。
- **BT (どう実行するか)**: 選ばれた定石の `do` を BT のサブツリーに展開して実行する。移動・攻撃・回避などの葉はゲームアダプタの抽象アクション。Bestia の BT (Selector / Sequence / Condition / Action、固定配列) を一般化し、サブツリーをデータから組み立てる。
- 2 層にする理由: Utility は「状況が変わったら狙いを変える」のに強く、BT は「手順を途中で破綻させない」のに強い。1 層で両方やると定石が増えたとき手に負えない。

### ループ (1 ティック)

1. **observe**: アダプタからゲーム状態を共通スキーマで受け取る (自分、見えている敵、位置、資源、タイマー)。
2. **match**: 観測を攻略本に照合する。敵 ID が引ければその entity と状態機械を取り、現在フェーズを推定する。引けなければ「未知」として記録する。
3. **decide**: Utility で定石を選ぶ (直前の定石を継続するか切り替えるかもここ)。
4. **act**: BT で手順を進め、アダプタへ行動を送る。
5. **reflect**: 定石の `expect` と実際の観測を比べ、差分を observation として書く (予測ダメージとの差、敵の HP が表と違う、定石失敗、未知の敵の出現)。

### 学習 = 攻略本の更新 (再帰ループ)

- プレイ中はパラメータの軽い更新だけ行う (定石ごとの成功率、考慮項目の重みの微調整)。これは `observations/` の **オーバーレイ** に書き、正本 (`entities`, `tactics`) は触らない。
- プレイ後、ツクールの `learn ingest` → `consolidate` で正本の更新案を作り、人間が承認する。これで「賢くなった」内容が人間に読める形で残る。
- 未知の敵・未知のステージは entity の雛形を自動で起こし `draft` にする。次回以降は観測値で埋まっていく。
- 大きな変更 (新しい定石の発見) は LLM に観測列から定石案を書かせ、`learned` として提案する。採否は人間。

### ゲームアダプタ契約

汎用性はここで担保する。アダプタはゲームごとに 1 つ。

- `observe(): Observation` — 共通スキーマ。少なくとも `self` (位置、HP、資源)、`entities[]` (ID、種別、位置、推定 HP)、`stage` (ID、経過時間)、`events[]`。ゲーム固有の値は `extra` に入れ、定石から参照できる。
- `act(action: AbstractAction)` — `move_to`, `attack`, `use_item`, `use_skill`, `wait`, `interact` の最小集合。ゲーム固有の行動は `custom` で名前を付け、攻略本側で宣言する。
- `identify(gameEntity) → guide entity ID` — ゲーム内のオブジェクトと攻略本の ID の対応。マスターデータ取り込み時の mapping と同じ表を使う。
- 時間: ティックはアダプタが呼ぶ (リアルタイムなら固定周期、ターン制なら手番ごと)。
- 実装先: ゲームが Node 連携できるなら TypeScript、Pictor/Ergo 系のネイティブゲームには C++ の同契約を用意する (プロトコルは JSON Lines で、プロセス分離も可)。

## 既存資産との関係

- **Ludus (Lu)**: 汎用の辞書 (ジャンル・機能・用語) の中央正本。攻略本はゲーム固有なので Ludus には置かず、参照 (版 + 安定 ID) だけ持つ。Ludus のデータフィードバック方針 (辞書の複製禁止、固有名・未公開情報の混入禁止、汎化した知識だけ PR で戻す) に従う。
- **game-knowledge-graph**: ジャンルの「必要な機能」グラフ。攻略本の `glossary` と `mechanics` の分類語彙として参照候補。
- **Bestia**: 固定 BT の実装例。エンジンの BT 実行器の原型にする。Bestia 自身をアダプタの最初の対象にすると、マスターデータ (`archetype`) と状態機械が小さく、動作確認しやすい。
- **Omnipotens / Discutere**: メカニクス・経済分析は攻略本の `mechanics/rules` の下書き元になり得る (仕様→ルール抽出)。
- **Praeforma (Pf)**: 仕様の正本。`guide import spec` の入力元。

## 公開・秘匿

- 攻略本バンドルはゲームと同じ可視性で扱う (private ゲームの攻略本は private)。
- ツクールとオートプレイヤーのエンジンはゲーム固有情報を含まないので public 可。サンプルバンドルは public ゲーム (Bestia 等) のものだけ同梱する。
- 観測ログには固有名・パスを入れない (ID と数値のみ)。

## 所属と名前 (neco 決定 2026-10-09: 新規リポ Commentarii、略称 Cm)

- **採用**: 新規リポ `LUDIARS/Commentarii` (Cc 略称 `Cm`) 1 本 (ツクール + エンジン + 共通スキーマ + アダプタ SDK)。攻略本バンドルは各ゲームリポの `guide/` に置く。エンジンとデータの分離が構造で担保され、ゲームリポ側は JSON を置くだけで済む。
- 不採用: Ludus 配下に `tools/` として置く。辞書と近いが、Ludus は公開辞書の正本であり、ゲーム固有バンドルやランタイムを抱えると公開境界が崩れる。
- 名前の由来: Commentarii (戦記・覚書)。Cm は Concordia の project-code registry で空きを確認済み (2026-10-09)。

## 実装の分割 (フルセット、MVP で縮めない)

1. **共通スキーマと検証**: JSON Schema 一式、`guide validate`、`guide render`。テスト = スキーマ違反・参照切れ・式評価のケース。
2. **取り込み**: `import masters` (CSV/JSON/SQLite + mapping)、`import map` (3 種)、`import spec` (LLM 下書き、draft 印)。テスト = Bestia の archetype と KonbiniDominant のマスターデータから生成。
3. **書き出しとエンジン**: `export`、Utility 選択器、BT 実行器、アダプタ契約 (TS + C++ ヘッダ)、Bestia アダプタ。テスト = 固定観測列に対する決定の再現性、Bestia 既存 BT と同等以上の勝率。
4. **学習ループ**: observe/reflect の観測出力、`learn ingest`、`learn consolidate` (JSON パッチ生成)、オーバーレイ (成功率・重み)。テスト = 攻略本の値をわざとずらした状態から観測で差分が検出・提案されること。
5. **編集画面**: Web (Excubitor 配下)、エンティティ・地図注記・定石・観測差分の採否。テスト = 保存が JSON 正本と一致、画面スクショの確認。
6. **2 本目のアダプタ** (KonbiniDominant または KuzuSurvivors) で汎用性を実証。攻略本側の変更だけで動くことが受入条件。

## 受入条件 (設計段階で確定するもの)

- 攻略本の全ファイルがスキーマ検証を通り、人間向け Markdown が自動生成される。
- 同じエンジンが、アダプタと攻略本の差し替えだけで 2 本のゲームで動く。
- 攻略本ゼロでも動き、攻略本ありで明確に強くなる (勝率・クリア時間で比較)。
- プレイ後の観測から正本の更新案が生成され、人間の承認なしに正本が変わらない。
- 攻略本の値はすべて出典 (マスターデータ / 観測 / 人間) を持つ。LLM 生成値は `draft` を外すまで判断に使わない。

## 未決事項

- 最初の対象ゲーム (推奨: Bestia → KonbiniDominant の順)。
- オートプレイヤーの実行形態: ゲーム内プロセス (ライブラリ) か別プロセス (JSON Lines) か。ネイティブゲームは別プロセスから始めるのが安全。
- Web 編集画面の優先度 (CLI + Markdown レビューだけで回し始めることもできる)。
