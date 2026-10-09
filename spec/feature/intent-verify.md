# 意図ズレ検証・行動可能性の帯・良い遊びの 2 軸・ヒートマップ (段階 5 / 5P / 5H)

設計正本: `spec/architecture/design.md` §8.3、§8.5、§14.E、§14.H、§11 の段 5 / 5H / 5P。
コード: `src/verify/` (読み込み・分類・帯・2 軸・レポート・CLI)、`src/render/heatmap/` (SVG 描画)。

## 1. コマンド

```
guide verify intent --game <bundle-dir> --runs <dir|file> [--runs ...] [--persona <slug>] [--json]
guide verify intent --game <bundle-dir> --accept <divergence-id> --by <name> [--note <text>] [--json]
guide report feasibility --game <bundle-dir> [--json]
```

- `--runs` は繰り返し指定できる。値はリプレイ (`replay.schema.json` の 1 run = 1 ファイル) か、それを含むディレクトリ (配下の `*.jsonl` を再帰的に読む)。位置引数で並べてもよい (`--runs <dir> <file> ...`)。
- 読めないファイル・リプレイでないファイル (段階 4 の 1 行観測など) は件数と名前だけ報告して飛ばす。
- 検証が書くのは overlay 側 (`observations/`) と `feasibility/` だけ。正本 (`intent/` を含む) を書くのは `--accept` だけ。

### 1.1 `verify intent` (検証) が書くもの

| パス | 中身 |
|---|---|
| `observations/divergences.json` | ズレ候補と人間の判定欄 (スキーマ `schema/divergences.schema.json`) |
| `feasibility/<stage-slug>.json` | 行動可能性の帯と 2 軸 (スキーマ `schema/feasibility.schema.json`) |
| `observations/verify/report.json` | 検証レポート (JSON。`--json` の標準出力と同じ) |
| `observations/verify/report.md` | 検証レポート (Markdown。既定の標準出力と同じ) |
| `observations/verify/<stage-slug>.heatmap.svg` | 経路・死亡ヒートマップ (群ごとのパネルを横に並べる) |
| `observations/verify/good-play.svg` | 良い遊びの 2 軸の散布図 (ステージ × ペルソナ) |

Markdown の SVG 参照は `observations/verify/` からの相対パス。`feasibility/` は bundle loader が無視する (`classify-path.ts` の除外接頭辞)。

### 1.2 `--accept`

- `observations/divergences.json` の `<divergence-id>` を `decision: allow`、`decided_by: <name>` (と `note`) にし、そのステージの `intent/<stage-slug>.json` の `allowed_divergences` に 1 件足す: `run` (根拠 run の先頭)、`summary`、`decided_by`、`tactic` (署名の定石列の先頭。無ければ省略)、`intent`、`reason`、`divergence` (ID)、`signature` (定石列 + 経路)。書く前に intent スキーマで検査する。
- 既に許容済み (同じ `divergence` の項目がある) なら intent は書き換えない。
- 許容したズレの署名に `confidence: learned` の定石があれば「`authored` への昇格候補」として報告する。**正本の定石は書き換えない** (昇格は人間が行う)。
- ID が無い、そのステージの intent が無い・スキーマ不適合のときは終了コード 1 で何も書かない。

### 1.3 `report feasibility`

`feasibility/*.json` を読み、帯の一覧 (`illusory` を最優先、次に `impossible`・`extreme`・`feasible`。`illusory_by_design` は `illusory` の後に別表)、2 軸の散布 (ペルソナ別の表) と「収束」の報告を出す。`--json` は読み込んだ文書の配列。

## 2. 対象にする run

| run | 扱い |
|---|---|
| `purpose: coverage` かつ `mode: player` | 分類・帯・2 軸・ヒートマップに使う |
| `source: human` (`purpose: human`) | 同上。群は `human` (ペルソナ扱い)。人間 vs オートプレイヤーの並置に使う |
| `mode: omniscient` | **どこにも使わない** (原則 2)。件数と run ID だけ報告する |
| `purpose: efficiency` | 使わない (意図ズレの検証は coverage 実走で行う)。件数を報告する |
| `decision_mode: intent-assisted` | **使わない**。設計者の意図を判断器に渡した試験 (答えを渡した bot) はペルソナの能力ではない (Astra P1-4、[engine.md](engine.md) §4.1)。件数を報告する |
| `--persona <slug>` 指定時 | header の `persona` がそれと一致する run だけ (人間 run は外れる) |

群 (persona key) は header の `persona`、無ければ `default`、人間 run は `human`。

## 3. ステージの足跡 (stage trace)

run ごと・ステージごとに次を取る (`src/verify/runs/stage-trace.ts`)。到達・時間・経路は段階 4D の `stageVisits` をそのまま使う (同じ規則: 次のステージへ移ったか、最後のステージで run が success なら到達)。

- `tactics`: そのステージのティックで `chosen` だった候補のうち定石 (`tactic:...`) と変種 (`variant:<定石>--<変異>` → `<定石>--<変異>`) の ID 列。連続する同じ ID は 1 つ。判断ログの無い run (人間 run) は `decisions: false` とし、`teach` の判定に使わない。
- `nodes`: 地図ノードごとの到達回数 (そのノードへ入った回数)、滞留秒 (そのノードにいたティックの時間幅の和)、死亡回数。
- 死亡: `self.hp.value` が 0 になったティックのノード、または `kind` が `death` / `self-death` のイベントがあったティックのノード (同じティックで 2 重に数えない)。
- `edges`: ノード間の移動 (from → to) の回数。
- `stall_sec`: 同じノードに連続で `stall_after_sec` (既定 10 秒) を超えていた分の和。到達した run の最後の区間 (ステージを終えた場所) は数えない。

## 4. 意図ズレの分類 (§8.3)

意図の項目ごとに、そのステージの足跡を突き合わせる。

| kind | run の一致 | ズレ (到達した run だけ) |
|---|---|---|
| `route` | 到達し、経路が `path` を順序どおりに含む (部分列) | 到達したが経路が違う → **面白いズレ** (`alt-route`、別解) |
| `teach` | 到達し、定石列に `tactic` がある | 到達したが使っていない → **望ましくないズレ** (`teach-skipped`、学習意図の飛ばし) |
| `time` | 到達時間が `range_sec` の範囲内 | 下限未満 → **面白いズレ** (`shortcut`)、上限超過 → **望ましくないズレ** (`over-time`) |
| `forbid` | `area` に入っていない | 入った → **望ましくないズレ** (`forbid-entered`。到達しなくても数える) |

- 意図項目の分類は次の順で決める (Astra P1-3 で補正): `不可能` (**証明がある**: `route` の経路がステージの地図上で歩けない = 地図に無いノード、または辺をたどって次のノードへ行けない / `teach` の定石が攻略本に無い) → `未検証` (対象 run が 0 本) → `再現されず` (`route` / `teach` で一致した run が 0 本だが証明が無い。対象 run 数と再現率の 95% Wilson 区間を出す) → `望ましくないズレ` → `面白いズレ` → `一致`。
- 「どの run も再現しなかった」は実測であって証明ではない。`不可能` は地図の構造か明示的な制約 (攻略本に無い定石) にだけ使う。
- `teach` は判断ログのある run だけで数える。
- JSON の値: `match` / `interesting` / `undesirable` / `impossible` / `not-reproduced` / `unverified`。判定には `reproduced_interval` と、`impossible` なら `proof` が付く。

### 4.1 ズレの署名と ID

- 署名 = (意図 ID, 理由, 定石列, 経路)。同じ署名の run は 1 件のズレにまとめ、根拠 run を並べる。
- ID = `div-` + SHA-256(JSON `[intent, reason, tactics, route]`) の先頭 12 桁。run 集合が増えても ID は変わらない。

### 4.2 許容済みのズレ (再報告しない)

許容は「何を判定したか」に紐付ける (Astra P2-8 で補正)。`allowed_divergences` の項目は次の 3 状態でズレと照合する (`src/verify/intent/allowed-match.ts`、契約 C-69)。

| 状態 | 条件 | 扱い |
|---|---|---|
| 一致 | `divergence` (ID。意図・理由・署名から作るので 3 つを束ねる) が一致する、または `intent` と `signature` (定石列 + 経路) が一致する。かつ `manifest_version` が無いか今の攻略本の版と同じ | 再報告しない (件数だけ「許容済み」) |
| 再判定要 | `run` や `tactic` だけを名指しする (署名も意図も無い旧い記録)、または別の攻略本の版で許容された | **再報告する** (`recheck` に理由)。黙って抑えない |
| 無関係 | どちらでもない | — |

- `--accept` は許容した時点の攻略本の版を `manifest_version` に書く。版が上がった後に同じズレを許容し直すと、その版の項目が足される (旧い項目は履歴として残る)。
- ゲーム版・条件・経路の正規化 (段階 4D の `stageVisits`) が変わると署名も変わるので、旧い許容は一致しなくなり、新しいズレとして判定し直される。

許容されたズレの定石列に `learned` の定石があれば、検証レポートにも「昇格候補」として出す。

### 4.3 `observations/divergences.json` の更新

- 新しいズレは `decision: pending` で足す。既存の項目は人間の欄 (`decision`、`decided_by`、`note`) を保ち、根拠 run とペルソナを今回の分で和集合にする。今回現れなかった項目も消さない (判定の履歴)。
- 並び: `pending` → `allow` → `reject`、その中は望ましくないズレ → 面白いズレ、次に ID。過去の判定は並べ替えにだけ使う (§8.3「ツールは候補を出し、過去の判定を並べ替えに使うだけ」)。

## 5. 検証レポート

ステージごとに: 意図ごとの分類と到達可否 (到達 run / 対象 run)、使われた定石 (回数)、想定との時間差 (到達時間の中央値と `range_sec` の差。範囲内なら 0)、未使用の仕組み (攻略本にあるのに 1 度も使われなかった rule / skill / 定石)、人間 vs オートプレイヤーの到達率、ズレ一覧、ヒートマップ (SVG 参照)、帯と 2 軸の要約。

- 使われた rule: 使われた定石の `because` に現れる rule ID (`rule:x` または `rule:x.<field>`)。使われた skill: 行動 `use_skill` の operand、または使われた定石の `do` の `use_skill`。
- omniscient で除いた run、efficiency で除いた run、読めなかったファイルは冒頭に件数を出す。

## 6. 行動可能性の帯 (5P)

### 6.1 解法のまとまり (クラスタ化、決定的)

- **順序に依らない同値関係** (Astra P2-8 で補正): 定石列と経路が同じ足跡を 1 つの同値類にする。失敗だけの同値類で、その経路を真に延長する「同じ定石列で成功を含む同値類」がちょうど 1 つあるときだけ、その解法の途中で止まった試行としてそこへ入れる (0 個や 2 個以上なら独立したまとまり)。結果は足跡の集合だけで決まり、並び順に依らない。
- 意図の想定解 (`route` の `path`、`teach` の `tactic`) は、どの run も一致しなければ run 0 本のまとまりとして足す (帯の `impossible` / `illusory` 判定の対象)。
- 成功が 0 で定石列も空のまとまり (歩き回って失敗しただけ) は解法として帯を付けない (迷いの深さにだけ数える)。
- ID は `sol:<stage-slug>:<n>` ((定石列, 経路) の辞書順の 1 始まり)。

### 6.2 帯の判定 (`player` の run だけ)

ペルソナごと: 試行 = そのまとまりに入った足跡のうち **完了したもの** (到達した、または run が success / fail で終わった。tick 上限やエラーで `abort` した run は打ち切りであって失敗の証拠ではないので分母に入れず `aborted` に数える)、成功 = 到達した足跡、成功率 = 成功 / 試行。全ての帯に標本 `evidence` (試行・成功・成功率・95% Wilson 区間・seed・tick 予算・中断数) を付ける (Astra P1-3)。

| 帯 | 判定 (上から順に) |
|---|---|
| `impossible` | 地図が経路を歩けないと証明する (`unwalkable` に理由)。成功 0 だけでは付けない |
| `not-observed` | 完了した試行が 0 (分類外の実測状態) |
| `feasible` | 完了試行 `min_runs` 以上のペルソナが 1 つ以上あり、その全てで成功率 ≥ `feasible_success` |
| `skill-gated` | 判定対象のペルソナのうち、成功率 ≥ `feasible_success` のものと下回るものがある (上級者は成功、初心者は失敗) |
| `extreme` | 成功が 1 以上あるが上のどれでもない |
| `illusory` | 成功が 0、「見えている」(下記)、かつ成功率の 95% 上限が `zero_success_upper` 未満 (完了試行が十分) |
| `insufficient-evidence` | 成功が 0 だが上の条件を満たさない (試行が少ない、または見えていないが証明も無い。分類外の実測状態) |

- 見えている (生成される): まとまりの定石が全て、そのステージの `player` run のどれかのティックで、段階 3 のエンジンの `tacticCandidates` (`buildEngineWorld(bundle, 'player')`、つまり `player` 書き出しの情報だけ) から候補として出る。変種は元の定石が出れば出るとみなす。定石列が空のまとまりは、経路のノードが全て `player` 書き出しの地図にあれば見えている。
- ペルソナ別の帯も同じ規則 (そのペルソナの試行だけ) で付ける。
- `intent.illusory_by_design` に宣言した定石 / 経路のまとまりは、`illusory` のとき `by_design` (根拠・判定者) を付けて別扱いにする (最優先の一覧から外し、別表に出す)。
- 許容したズレ (`allowed_divergences`) の根拠 run も普通の run として帯に入る (許容で `illusory` が `feasible` に変わり得る)。

### 6.3 閾値 (manifest `feasibility.thresholds`、無ければ既定値)

| 項目 | 既定 | 意味 |
|---|---|---|
| `feasible_success` | 0.5 | `feasible` に要る成功率 |
| `min_runs` | 1 | ペルソナを判定に入れる最低試行数 |
| `illusory_weight` | 3 | 迷いの深さで `illusory` のまとまりに費やした失敗の重み |
| `stall_after_sec` | 10 | 滞留とみなすまでの連続秒 |
| `stall_weight` | 0.1 | 滞留 1 秒あたりの迷いの深さ |
| `zero_success_upper` | 0.2 | 成功 0 のまとまりを `illusory` と呼べる成功率 95% 上限 (完了試行 16 本以上で到達) |

## 7. 良い遊びの 2 軸 (ステージ × ペルソナ)

- `breadth`: 成功したまとまりの数 (そのペルソナで成功 ≥ 1、かつ帯が `illusory` / `impossible` でないもの)。
- `observed` (観測、Astra P2-8): 失敗した試行数、往復 (2 歩前のノードへ戻った回数)、滞留秒、失敗した試行が踏んだ意図の経路外ノード数の合計。解釈 (`confusion_depth`) と分けて出す。
- `confusion_depth` (解釈): 足跡ごとに (失敗なら 1、`illusory` のまとまりなら `illusory_weight`) + `stall_sec × stall_weight` + 往復 + 失敗した試行の経路外ノード数を足し、足跡の数で割った平均。小数 3 桁。**到達した別解の経路の長さは迷いに数えない** (別解は breadth であって迷いではない)。
- `design_stance` (`intent` の `open` / `refined` / `mixed`、無ければ `unspecified`) を並べて出す。`refined` 以外で `breadth` が 1 のとき `convergence: true` とし、レポートは「成功した解法は 1 つに収束している」と事実だけを書く。良い・悪い、どちらへ寄せるべきかは書かない (§8.5。判断は人間)。
- 2 軸は常に並べて出し、片方だけで評価しない。
- **ペルソナモデル上の推定**: 帯と 2 軸は sim のペルソナ (反応遅延・誤操作率・探索率・信頼する定石の下限) による推定で、人間ログで較正するまでは人間の能力の測定ではない。ペルソナは入力の抽象化 (抽象行動 1 つ / ティック)、照準・移動の物理的制約、知覚の遅れの分布を模していない (限界)。レポートはこの前提を明記する。

## 8. ヒートマップ (5H)

- 群: `all`、ペルソナごと、`human`。群ごとに地図ノード単位で到達回数・死亡回数・滞留秒・移動回数を集計し、1 ステージ 1 枚の SVG に群のパネルを横に並べる (人間 vs オートプレイヤー、ペルソナ別の並置)。
- 描画 (`src/render/heatmap/`、依存ライブラリなし、文字列組み立て):
  - `grid`: `size` の格子。セル (`cell`) を到達回数の濃さで塗る。
  - `navgraph`: ノード `pos` を枠に収めて円 (半径と濃さが到達回数)、辺は線。
  - `zones`: 位置が無いので、ノードを文書順に横 1 列の領域矩形に並べ、辺は矩形の中心を結ぶ線。
  - 共通: 移動 (run の経路) は太さが回数の線 `class="run-path"`、死亡は赤い印と数 `class="death"`、意図の `route` は破線 `class="intent-route"`、`forbid` は赤枠 `class="forbid"`。
- 散布図: x = `breadth`、y = `confusion_depth`、点 = ステージ × ペルソナ (`class="point"`、ラベル付き)。
- `guide render` は `observations/verify/report.json` があれば、ステージの頁に「経路・死亡ヒートマップ」(`stages/<slug>.heatmap.svg` を書き、Markdown から参照) と帯の要約を足す。無ければ従来どおり。

## 9. 契約 (Augur)

| ID | 対象 |
|---|---|
| C-50 | `classifyIntents`: omniscient の run を使わない、分類は規則どおり、許容済みは再報告しない |
| C-51 | `mergeDivergences`: 人間の判定欄を保ち、項目を消さず、許容済みを新規に足さない |
| C-52 | `acceptDivergence`: 正本で変わるのは対象ステージの `allowed_divergences` だけ、定石は書かない |
| C-53 | `assignBands`: `impossible` は地図の証明があるときだけ、完了試行 0 は `not-observed`、成功があれば `feasible` / `skill-gated` / `extreme`、`illusory` は見えていて完了試行が十分な成功 0 のときだけ、他は `insufficient-evidence`、中断 run は分母に入らない |
| C-68 | `sampleEvidence`: 分母は完了した試行だけ、成功率は 95% 区間に入る |
| C-69 | `matchAllowed`: 許容がズレを抑えるのは ID か意図 + 署名が一致し、別の版でないときだけ |
| C-70 | `selectRuns`: omniscient と意図支援の run は数えない |
| C-54 | `buildFeasibility`: omniscient を数えない、breadth は成功まとまりの数、収束は `refined` 以外で breadth 1 のときだけ |
| C-55 | `drawHeatmap`: well-formed で、forbid 領域と経路の要素を含む |
| C-56 | `clusterSolutions`: 全足跡がちょうど 1 つのまとまりに入り、まとまりの中は定石列が同じで経路が前方一致 |
