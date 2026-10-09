# `guide import` — 取り込み (段階 2)

設計正本: `spec/architecture/design.md` §4 (データモデル)・§5 (知識境界)・§6 (コマンド表)・§11 段階 2。
タスク: `spec/tasks/2026-10-09-stage-2-import.md` (Actio: `actio:4b6c4d33-05b7-4514-9ab6-25be4b48d20a`)。

取り込みは全て第一原則 (マスク原則) に従う: **宣言の無い境界は `masked`**。`masked` の値は `.masked.json` にだけ書く。
取り込みが失敗したときは何も書かない (入力の誤りは終了コード 1、使い方の誤りは 2)。

| コマンド | 入力 | 出力 |
|---|---|---|
| `guide import masters --game <bundle> --from <path> --map <mapping.json> [--dry-run]` | CSV / JSON / SQLite | `entities/<group>/<slug>.json` と `<slug>.masked.json` |
| `guide import map --game <bundle> --stage <slug> --from <path> --kind grid\|navgraph\|zones [--map <mapping.json>] [--neighbors 4\|8]` | 文字格子 / 2 次元配列 JSON / ノード + 辺 JSON / 領域 + 隣接 JSON | `stages/<slug>/map.json` |
| `guide import spec --game <bundle> --from <md> --kind rules\|states` | 仕様書 Markdown | `mechanics/rules/<slug>.json` / `mechanics/states/<slug>.json` (draft) |
| `guide intent import --game <bundle> --stage <slug> --from <md>` | 意図を書いた Markdown | `intent/<stage>.json` (draft) |

ゲーム ID・座標系・単位は常にバンドルの `manifest.json` から取る (manifest が無ければ失敗)。

## 1. import masters

### 入力形式

| 形式 | 判定 | 行 | `source.ref` |
|---|---|---|---|
| CSV | 拡張子 `.csv` | 1 行目がヘッダ、UTF-8 (BOM 可)、RFC 4180 の引用符、CRLF / LF。空行は行に数えない | `<ファイル名>#row=<n>` (データ行を 1 から数える) |
| JSON | 拡張子 `.json` | 平らなオブジェクトの配列 | `<ファイル名>#row=<n>` (配列の 1 始まり) |
| SQLite | 拡張子 `.sqlite` / `.sqlite3` / `.db` | mapping の `tables` に書いたテーブル全部を Node 24 の `node:sqlite` で読み取り専用に開く (依存追加なし) | `<ファイル名>#table=<テーブル>&rowid=<rowid>` |

- `ref` はファイル名だけ (ディレクトリを含めない。固有のパスを攻略本に入れない)。
- **仮定**: SQLite の `ref` は依頼文の `#rowid=` に、複数テーブルを区別するため `table=` を足した。
- 空のセル (欠落・`null`・空白だけ) は「値なし」として値ごと書かない。数値列に数として読めない値があれば失敗。

### mapping (`schema/mapping.schema.json`)

ゲームごとに 1 ファイル。`tables` のキーは CSV / JSON ならファイル名の拡張子を除いた部分、SQLite ならテーブル名。

| 項目 | 意味 |
|---|---|
| `tables.<名>.kind` | entity の種別 (`enemy` / `item` / `skill` / `actor`)。列で分けるときは `{ "column": "type", "values": { "<セルの値>": "<種別>" } }` (対応の無い値は失敗) |
| `tables.<名>.id` | `{ "column": "<列>" }` が ID の slug。`"slugify": true` で表示名などの自由文を slug にする (`Bazooka Beetle` → `bazooka-beetle`)。ID は `<種別>:<manifest の game_id>:<slug>` |
| `tables.<名>.name` | 言語 → 列 (`{ "ja": "name_ja", "en": "name_en" }`)。全て空の行は失敗 |
| `tables.<名>.behavior` | 状態機械の参照を持つ列 |
| `tables.<名>.render_signature` | `mesh` / `sprite` / `material` の列。`material` は `material_separator` (既定 `|`) で分割 |
| `tables.<名>.stats.<キー>` | `{ "column", "unit"?, "knowledge"? }`。`knowledge` の初期値、**省略時 `masked`** |
| `grid` | `import map --kind grid` の凡例 (§2) |

mapping が名指しした列がテーブルに無ければ、行を読む前に失敗する。

### 出力と再実行の規則

- `knowledge` が `masked` の値は `<slug>.masked.json` の `stats`、それ以外は `<slug>.json` の `stats` に書く。
- 既存ファイルがあれば統合する (再実行可能):
  - 上書きするのは今の `source.kind` が `master` の値だけ。`observed` / `human` / `llm-draft` の値はそのまま残す。
  - 既存の master 値の `knowledge` は、既存と mapping のうち **緩い方** を採る。取り込み後に昇格した境界 (masked → discoverable など) を取り込みで戻さない。境界を厳しくしたいときは人間がファイルを直す。
  - mapping が出さない項目 (他のマスターから来た値、`weak_to` など人間が書いた項目、`.masked.json` の `fields`) は残す。
  - `name` / `behavior` / `render_signature` (mapping が宣言した部分) はマスターの値で上書きする。
  - 統合の結果 `.masked.json` に値が 1 つも残らなければ、そのファイルを消す。
  - 同じ stat が `<slug>.json` と `.masked.json` の両方にあるバンドルは不整合として失敗する (人間が片方に寄せてから再実行)。
- 内容の変わらないファイルは書かない。同じ入力で 2 回目を走らせると変更 0。
- 書く前に全ての出力をバンドルのスキーマで検査し、1 つでも不適合なら何も書かない。読めない (JSON として壊れた) 既存ファイルを上書きする場合も失敗する。
- `--dry-run` はファイル単位・項目単位の差分 (`+` 追加 / `-` 削除 / `~` 変更、新規ファイルは `(new)`、削除は `(removed)`) を標準出力に出し、何も書かない。

### マスターデータと mapping の置き場所

バンドル直下の `masters/` は取り込みの入力置き場として `validate` の対象外 (`observations/` / `schema/` と同じ扱い)。
サンプル: `samples/bestia/masters/archetypes.csv` + `mapping.json` (段階 1 の手書き敵 3 体と、出典 `ref` 以外が一致する)。

## 2. import map

| `--kind` | 入力 | 変換 |
|---|---|---|
| `grid` | テキスト (1 行 1 列、1 文字 1 セル、末尾の空行は無視、行の長さが不揃いなら欠けたセルは通れない) か、拡張子 `.json` の 2 次元配列 (セルは文字列か数) | 通れるセルを `node:x<x>-y<y>` (`cell: [x, y]`、y は上から) にし、4 近傍の辺 (`cost: 1`) を張る。`--neighbors 8` で斜め (`cost: √2`) も足す。斜めは両側の直交セルが通れるときだけ (角抜け無し)。`size` は `[幅, 高さ]` |
| `navgraph` | `schema/import-navgraph.schema.json`: `nodes[]` (`id`, `pos`, `label?`, `knowledge?`)・`edges[]`・`annotations[]?` | そのまま正規化。ID の `node:` は省略可 |
| `zones` | `schema/import-zones.schema.json`: `zones[]` (`polygon` か `rect {min, max}`)・`adjacency[]`・`annotations[]?` | 領域をノード (位置は頂点の平均 / 矩形の中心)、隣接を辺にする。領域の輪郭自体は `map.json` に持たない |

- grid の凡例は mapping の `grid`: `legend` (セル → `walkable`、`annotation?` (`hazard` / `resource` / `shortcut` / `spawn` / `wanted` / `unwanted`)、`note?`、`knowledge?`)、`knowledge?` (ノードと辺)、`unit?`。凡例に無いセルは失敗。通れないセルに注記は付けられない。
- `knowledge` を省略したノード・辺・注記は `masked`。注記は凡例の `knowledge`、無ければ `grid.knowledge`、無ければ `masked`。
- 座標系と単位は manifest が正: 入力が `coordinates {system, unit}` を宣言して manifest と違えば失敗。`pos` と多角形の頂点の軸数が manifest の系 (`grid` / `world-xy` は 2、`world-xyz` は 3) と違えば失敗。grid の `unit` を宣言した場合は manifest の単位と一致が必要。
- 辺の端点・注記の対象が存在しないノード、ノード ID の重複は失敗。
- 出力は `source: { kind: "master", ref: "<ファイル名>" }`、`map.schema.json` に適合しなければ書かない。
- 既存の `map.json` が master 以外 (human / observed など) から来ていれば上書きせず失敗する (人間の地図を取り込みで消さない)。
- **仮定**: grid のセルは world 座標に変換しない (`pos` を付けない)。世界座標が要る地図は navgraph / zones で入れる。

## 3. import spec / intent import (LLM 下書き)

- LLM 呼び出しは `src/adapters/llm/claude-cli-llm.ts` に閉じる: `claude -p --output-format text` をシェルを介さず起動し、プロンプトは標準入力、返答は標準出力 (UTF-8)。API キーは持たない。実行ファイルは `COMMENTARII_CLAUDE_BIN` (既定 `claude`)。見つからなければ即失敗し、代替経路に逃げない。作業ディレクトリは OS の一時ディレクトリ (呼び出し側リポの指示を下書きに混ぜない)。
- ドメイン層 (`src/import/spec/`) は「文書 → 下書き JSON」の契約 (`draftFromDocument(request, deps)`) と `DraftLlm` ポートだけを持つ。テストはフェイクの LLM を渡し、実呼び出しを含めない。
- プロンプトは `prompts/import-spec-rules.md` / `prompts/import-spec-states.md` / `prompts/intent-import.md`、再試行の追記は `prompts/retry.md`。

### 下書きの扱い

1. 返答から JSON オブジェクトを取り出す (コードフェンスや前置きは無視)。返答の形は `{"rules": [...]}` / `{"states": [...]}` / `{"intended": [...]}`、各要素は `slug` を持つ。
2. ツールが固定する項目は返答の値を捨てて上書きする: ID (`rule:<game>:<slug>` / `state:<game>:<slug>` / `intent:<game>:<stage>:<slug>`)、`knowledge: "masked"` (intent は各項目)、`source: { kind: "llm-draft", ref: "<文書のファイル名>" }`、`draft: true`。intent の `allowed_divergences` は常に空 (許容は人間が決める)。
3. 文書種別のスキーマ (`rule` / `state` / `intent`) で検証する。返答が JSON でない・スキーマ不適合・slug の重複なら、問題点を添えて **1 回だけ** 再試行し、それでも駄目なら失敗 (何も書かない)。
4. **数値の選別**: JSON の数とルール式の数値リテラルは、文書に書かれた数 (NFKC 正規化後、絶対値で照合) だけを許す。文書に無い数を含むルール・状態機械は丸ごと、intent は該当項目だけを落とし、落とした ID と理由を標準エラーに出す。項目が 1 つも残らない intent は書かない。
   - 説明文 (`note` / `on` / ラベル) の中の数字は対象外 (判断に使われない文字列)。
5. 書き込みは「ファイルが無い」か「既存が `draft: true`」のときだけ。人間が引き取った文書 (`draft` が true でない) は上書きせず、標準エラーに `kept` と出す。

### validate との関係

下書きは `knowledge: masked` で正本の位置に書かれるので、人間が境界を決める (または削除する) まで `validate` の V03 が止める。これは意図したレビューの関門: LLM の下書きが境界未決のまま公開・判断に使われない。intent は `source` / `draft` を持てるよう `schema/intent.schema.json` を拡張した (`source.kind = llm-draft` なら `draft: true` が必須)。

## 4. 実装の配置

| 場所 | 中身 |
|---|---|
| `src/import/` | mapping の型と読み込み、入力の JSON / スキーマ検査、`ImportError` |
| `src/import/masters/` | CSV / JSON の行化、セルの型読み、slug、行 → entity、既存との統合、変更計画 |
| `src/import/map/` | grid 文字格子の読み込み、grid / navgraph / zones → map.json、座標の照合 |
| `src/import/spec/` | `DraftLlm` ポート、下書き契約、種別ごとの組み立てと数値選別、再試行、上書き保護 |
| `src/import/plan/` | 変更 (`FileChange`)、差分表示、書き込み前のスキーマ検査 |
| `src/adapters/sqlite/` | `node:sqlite` でテーブルを読む |
| `src/adapters/llm/` | `claude -p` アダプタ、プロンプトの読み込み |
| `src/cli/run-import-*.ts` | コマンドごとの配線 (I/O → ドメイン → 書き込み) |

受け入れ条件は Augur 契約 C-12 (`planMasterImport`)・C-13 (`buildGuideMap`)・C-14 (`draftFromDocument`)。
