# 人間プレイログの取り込み (段階 4D)

設計正本: `spec/architecture/design.md` §14.D (人間プレイログ)、§7.2 (Observation)、§8.2〜8.3 (学習と意図ズレ)、§10 (秘匿)。
依頼文: `spec/tasks/2026-10-09-stage-4d-human-plays.md` (Actio: `actio:2545d09b-6926-49d1-9c91-9df9507a9eb9`)。
実装は `src/import/plays/` と `src/adapters/fs/plays-read-runs.ts`、テストは `tests/import/plays/`、フィクスチャは `tests/fixtures/plays/`。
受け入れ条件は Augur 契約 C-40 (`planPlaysImport`)・C-41 (`extractCandidates`)・C-42 (`buildPlaysReport`)・C-43 (`hashIdentifier`)。

ゲームのテレメトリ (人間の実プレイ) を段階 2A のリプレイ形式に変換して攻略本のオーバーレイ側 (`observations/human/`) に置く。
用途は 2 つ: (1) 人間が見つけた別解を `learned` 定石の候補にする、(2) 意図ズレ検証で人間とオートプレイヤーを並べる。
正本 (`entities` / `tactics` / `intent`) には一切書かない。

| コマンド | 入力 | 出力 |
|---|---|---|
| `guide import plays --game <bundle> --from <jsonl\|csv\|json> --map <plays-mapping.json> [--player-salt <secret>]` | テレメトリ + mapping | `observations/human/<player-hash>/<run>.jsonl`、`observations/human/candidates.json` |
| `guide report plays --game <bundle> [--json]` | `observations/human/` と `observations/runs/` のリプレイ | ステージ別の数表 (Markdown / JSON、標準出力) |

失敗 (入力・mapping の誤り、salt 無し、masked の混入、生の識別子の混入) は終了コード 1 で、何も書かない。引数の誤りは 2。

## 1. 入力形式

| 拡張子 | 形式 | 行の参照 |
|---|---|---|
| `.jsonl` | 1 行 1 オブジェクト (空行は無視) | `<ファイル名>#row=<n>` |
| `.csv` | `guide import masters` と同じ読み取り (ヘッダ行、RFC 4180) | 同上 |
| `.json` | オブジェクトの配列 | 同上 |

- 構造を持つ列 (位置 `[x, y, z]`、エンティティの配列、複数のイベント名) は、JSON / JSONL ではそのまま、CSV ではセルに JSON テキストで書く。
- 行は (プレイヤー, run) の組でまとめ、`tick` 列があればその順、無ければ時間順 (同値はファイル順) に並べる。

## 2. mapping (`schema/plays-mapping.schema.json`)

mapping が名指しした列だけを読む。**名指しされない列は全て捨てる** (名前・メール・端末 ID・IP・自由記述を含む。捨てた列の名前だけを標準エラーに出す)。
mapping が名指しした列がテレメトリに無ければ、何も読まずに失敗する。

| 項目 | 意味 |
|---|---|
| `player.column` / `run.column` (必須) | 生のプレイヤー識別子 / セッション識別子。ハッシュにするだけで書かない (§3) |
| `tick.column` | フレーム番号 (非負整数、run 内で狭義単調増加)。省略時は run 内の行順 |
| `t` (必須) | `column` と `scale` (秒への倍率、ミリ秒なら 0.001)。run の先頭行からの相対秒にする |
| `started_at.column` | 開始時刻 (ISO 8601 か epoch ミリ秒、先頭行)。省略時は取り込み時刻 |
| `stage` (必須) | ステージ列。`values` (ゲームの値 → ステージ ID) → バンドルのステージ ID → ステージ slug の順で解決。解決しなければ失敗 |
| `node` | 地図ノード列。`values` → そのステージの地図のノード ID → ノード slug の順。解決しなければ書かない (件数を報告) |
| `self.pos` | 位置。1 列 (`[x, y, z]`) か 3 列 |
| `self.hp` | HP。`max` か `max_column` で割って比率 (0〜1) にする。`knowledge` |
| `self.resources.<名>` | 資源。`column` と `knowledge` |
| `entities` | 見えているエンティティの配列を持つ列と、各要素のキー (`entity` = ゲーム内の識別子、`instance`、`pos`) |
| `events` | イベント名の列。`values` に挙げた名前だけを攻略本のイベント種別にし、他は捨てる (件数を報告) |
| `action` | 入力の列と `verbs` (入力 → `move_to` / `attack` / `use_item` / `use_skill` / `wait` / `interact` / `custom`、被演算子の列 `operand` か位置 `operand_pos`、`custom` の名前、`wait` の秒) |
| `result` | 結果の列 (最後に値のある行) と `values` (→ `success` / `fail` / `abort`)。無ければ `abort` |
| `identify` | ゲーム内の識別子 → 攻略本のエンティティ ID (§2.1) |
| `extra` | `observation.extra` に入れてよい列 (明示的な許可)。固有名を含みうる自由記述は、確認してから許可する |

### 2.1 identify

設計 §7.3 の `identify` と同じ表。次の順で引く。

1. `identify.table`: ゲーム内の識別子 → エンティティ ID の明示表。
2. `identify.masters`: `guide import masters` の mapping (`mapping` はこの mapping からの相対パス) の 1 テーブル (`table`) の ID 規則を再利用する。識別子を ID の slug として読み (そのテーブルが `id.slugify` なら slug 化)、テーブルの `kind` で `<kind>:<game>:<slug>` にし、バンドルに実在するときだけ採る。`kind` を列で分けるテーブルは全種別を試し、一意に決まるときだけ採る。

どちらでも決まらないエンティティは `entity` を持たない観測 (未識別、`instance` と位置だけ) として残し、生の識別子は書かない (件数を報告)。

### 2.2 行動の被演算子

数 (整数) はエンティティのインスタンス番号、位置は `[x, y, z]`。文字列は identify → ノード → バンドルのエンティティ ID の順で解決し、
解決しなければその行の行動を `wait 0` にする (件数を報告)。空の入力・mapping に無い入力も `wait 0`。生のゲーム文字列が行動に残ることはない。

## 3. 匿名化

- salt: `--player-salt` があればそれ、無ければ環境変数 `COMMENTARII_PLAYER_SALT`。**どちらも無い (空も含む) と失敗する** (推測しやすい識別子のハッシュは総当たりで戻せるため、既定の salt は持たない)。
- プレイヤー: `HMAC-SHA256(salt, 生のプレイヤー識別子)` の 16 進先頭 16 桁 (`<player-hash>`)。同じ識別子と同じ salt なら同じ値。
- run: `run:human-<HMAC-SHA256(salt, "run\0" + プレイヤー + "\0" + セッション) の先頭 16 桁>`。セッション識別子はプレイヤー内でしか一意でないので両方を入れる。
- 書き出す前に、全ての出力の JSON のキーと文字列値が生のプレイヤー / セッション識別子と一致しないことを検査し、一致すれば失敗する (`extra` で識別子の列を許可した場合など)。エラー文にも識別子そのものは出さない。

## 4. 出力 `observations/human/<player-hash>/<run>.jsonl`

段階 2A のリプレイ形式 (`spec/feature/replay.md`) そのもの。`parseReplay` で読めること (スキーマと不変条件 R1〜R6) を書く前に検査する。

| 行 | 中身 |
|---|---|
| header | `run_id` (§3)、`seed: "human"`、`game_id` / `manifest_version` (manifest)、`adapter_id: "telemetry"`、`mode: "player"`、`purpose: "human"`、`source: "human"`、`started_at` |
| tick | 観測 (`source: "telemetry"`、`mode: "player"`、`purpose: "human"`、`stage.elapsed` はそのステージに入ってからの秒)、`decision: []`、行動 |
| footer | `result`、`ended_at` (`started_at` + 最後の `t`、`started_at` 列が無ければ取り込み時刻)、`summary: { player: <player-hash>, ticks, time_sec }` |

- `purpose` の語彙に `human`、観測の `source` に `telemetry`、header に任意の `source: "human"` を足した (`schema/replay.schema.json`、`schema/observation-frame.schema.json`)。
- **masked の禁止**: 人間の観測は `player` モードなので masked を含められない (設計原則 2)。境界を宣言しない値は masked (原則 1) なので、`hp` / `resources` の `knowledge` を書き忘れた mapping、`masked` と書いた mapping は、`find-masked-pointers` で検出して失敗する (mapping の誤り)。
- 同じテレメトリと同じ salt で再実行すると同じファイルを同じ内容で書き直す (`started_at` 列があるとき)。
- 人間の観測を昇格根拠に使うか (§14.D「manifest で選ぶ」) は段階 4 の consolidate の判断で、本段は `mode: player` として置くだけ。

## 5. 別解候補 `observations/human/candidates.json`

取り込みのたびに、`observations/human/` の全ての人間 run (今回の分を含む。読めないファイルは報告して除く) から作り直す。
スキーマ `schema/human-candidates.schema.json` に適合しなければ書かない。

1. **エピソード**: run を「同じ状況が続くティックの区間」に分ける。状況は `when` に相当する観測の述語で、
   `{ "all": [ {"stage": {"id"}}, 見えている識別済みエンティティごとに {"entity", "visible": true}, HP 比 < 0.5 なら {"self": {"hp_ratio_lt": 0.5}} ] }`。
   エンティティは ID 順に `$<kind>`、2 体目以降の同種は `$<kind>_2` … に束縛する (`as`)。
2. **行動列**: 区間内の行動を定石の手順 (`do`) にする。`wait` は手順にしない、連続する同じ手順は 1 つ、インスタンス番号は束縛名 (`$enemy`) に、
   位置や状況外のインスタンスへの行動は手順にできないので除く。先頭 4 手 (`MAX_STEPS`) まで。手順が空の区間は捨てる。
3. **既存定石との照合**: バンドルの全ての定石 (境界・draft・superseded を問わない。既知の解法なので) について、`when` がその区間の最初の観測で成り立ち
   (エンジンの `matchCondition` をそのまま使う)、かつ `do` が束縛を解いて同じ手順列 (wait と連続重複を除く、先頭 4 手) なら「既存定石と一致」として候補にしない。
4. **候補**: 残った区間を (状況, 手順列) でまとめ、1 まとまり 1 候補にする。
   - `tactic`: `id` = `tactic:<game>:human-<(状況, 手順列) の SHA-256 先頭 10 桁>`、`when` = 状況、`do` = 手順列、`expect.within_sec` = 区間の長さの中央値 (最小 0.1 秒)、
     `because` = ステージ ID と状況のエンティティ ID、`knowledge: masked` (境界は人間が決める、原則 1)、`confidence: learned`、`draft: true`、`superseded_by: null`。
   - `source`: `{ kind: "human", ref: "<run ID 群> x<件数>" }`。
   - `evidence`: `stage`、`occurrences` (区間数)、`runs`、`players`、`run_ids`、`success_rate` (その run のうち成功した割合)。
5. 正本には書かない。採否は段階 4 の `learn consolidate` か人間が行う。

## 6. `guide report plays`

- 人間: `observations/human/**/*.jsonl` のうち header が `source: human` の run。
- オートプレイヤー: `observations/runs/**/*.jsonl` のうちリプレイとして読める run (`guide run --record` の出力を置く)。段階 4 の 1 行形式の観測 (`observation.schema.json`) はリプレイではないので読み飛ばし、`skipped_files` に出す。
  `omniscient` の run は比較に入れず件数だけ出す (原則 2)。置き場所と出所が合わない run (runs/ の人間 run など) も読み飛ばす。
- ステージごと・側 (人間 / オートプレイヤー) ごとに:
  - `runs`: そのステージに入った run 数。
  - `reached`: 通過した run 数。通過 = その後に別のステージへ進んだ、または run の最後のステージで run が `success`。同じステージに 2 度入った run は 1 run として数える。
  - `reach_rate`: `reached / runs` (run が無ければ null)。
  - `time_sec`: 通過した run の滞在秒 (入ってから次のステージの最初のティック、最後のステージなら最後のティックまで) の p50 / p90 (最近順位法)。通過が無ければ null。
  - `routes`: 地図ノード列 (連続重複を除く) と run 数。多い順に 5 件。
- グラフ描画は段階 5H に任せ、ここは数表まで。

## 7. フィクスチャ (`tests/fixtures/plays/`)

| ファイル | 内容 |
|---|---|
| `telemetry.jsonl` | Bestia ドームアリーナの架空テレメトリ。2 人 3 run (行はプレイヤーをまたいで混ぜてある)。名前・メール・端末 ID・IP・自由記述 (名前やメールを含む) の列を持ち、全て捨てられることをテストで文字列検索する |
| `telemetry.csv` | 上の 1 run を CSV にしたもの (構造は JSON テキストのセル) |
| `plays-mapping.json` | 上の mapping。`identify` は明示表 (`SPIDER_W`) と samples/bestia の masters mapping の再利用 (`bomber-dragonfly`) の両方を使う。未識別の `MYSTERY_X` を 1 つ含む |
| `masked-mapping.json` | `self.hp` を masked と宣言した誤った mapping (失敗する) |

期待出力はテストに書いた: run 3 本 (プレイヤーディレクトリ 2 つ)、候補 3 つ (中央へ寄ってトンボを撃つ ×3 run / 2 人、低 HP でダッシュして外へ逃げてから撃つ、スパイダーだけを撃つ)。
低 HP で外周へ下がって撃つ手順は `tactic:bestia:kite-wire-spider` と一致するので候補にならない。

## 8. 仮定

- **仮定**: `--player-salt` は値を直接受ける (依頼文の `<secret-from-env>` を「環境変数から渡す値」と解釈)。既定は環境変数 `COMMENTARII_PLAYER_SALT`。
- **仮定**: オートプレイヤー側の比較材料は `observations/runs/` に置いたリプレイ形式の run (`guide run --record`) とした。段階 4 が同じディレクトリに書く 1 行形式の観測は経路を持たないので比較に使わない。
- **仮定**: 「別解」の照合は「同じ状況で同じ手順列」(完全一致、先頭 4 手) とした。手順の一部一致や順序違いは別の候補になる。
- **仮定**: 候補定石の `knowledge` は `masked` から始める (人間のプレイヤーが使えた手でも、境界の決定は人間承認の対象のため)。
