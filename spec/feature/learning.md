# 学習ループ (段階 4): reflect・オーバーレイ・learn ingest / consolidate

設計正本: `spec/architecture/design.md` §1 原則 2・5、§4.4 (tactic の metrics / superseded_by、manifest の learning.policy、observation)、
§5 (境界の昇格)、§7.5 (reflect)、§8.1〜8.2、§8.4、§11 段 4。依頼文: `spec/tasks/2026-10-09-stage-4-learning.md`。
Actio タスク: `actio:d7e96340-f8ed-407c-a864-7c2505a11b9d`。

| 置き場所 | 中身 |
|---|---|
| `src/engine/reflect/` | reflect: 1 ティックの最後に観測行を作る純関数 (`reflect-tick.ts`) と、ドライバから呼ぶ書き込み口 |
| `src/engine/candidates/tactic-variants.ts`, `variant-candidates.ts` | 探索候補の変種 (並べ替え・条件の緩和・1 要素差し替え) |
| `src/learn/ingest/` | `guide learn ingest`: run の観測 → オーバーレイと差分一覧 |
| `src/learn/consolidate/` | `guide learn consolidate`: オーバーレイ → 正本の更新案 (JSON Patch + Markdown)、`--apply` |
| `src/learn/overlay/` | オーバーレイの型・読み書き・エンジン起動時の適用 |
| `src/learn/patch/`, `src/learn/values/`, `src/learn/stats/` | JSON Patch (RFC 6902)、正本値の解決と一致率、分位数 |
| `schema/overlay.schema.json` | `observations/overlay.json` のスキーマ |

4D (人間プレイログ、`src/import/plays/` と `observations/human/`) は別段階で、ここでは扱わない。

## 1. reflect の観測 (`observations/runs/<run-slug>.jsonl`)

`guide run ... --observe <path>` で、ドライバが毎ティックの行動の後に reflect を呼ぶ (`runDriver({reflect})`)。1 行は設計 §4.4 の形式
(`schema/observation.schema.json`)。どの行もその観測フレームの `t` / `tick` / `source` / `mode` / `purpose` を持つ。ID と数値だけで、固有名・パスは入れない。

| kind | いつ | 中身 |
|---|---|---|
| `tactic-outcome` | 定石 (または変種) が動き始めたティックに `start`。`expect` が判定されたら `success` (met) / `failure` (broken)。run の終わりに未判定なら `unresolved` | `observed`: `outcome`、`ticks`、`time_sec`、`damage_taken` (HP バーの減少の合計、満タン = 100。回復で相殺しない)、`resource` (資源ごとの減少の合計)、`nodes` (通った地図ノード、初訪問順)。変種は `variant: {of, mutation}` |
| `mismatch` | `expect` が破れた (`within_sec` を過ぎても met でない) | `expected`: その `expect`、`observed`: `entity_state` (束縛した各インスタンスの見えた状態、見えなければ null) と `elapsed_sec` |
| `unknown-entity` | 攻略本に無い entity を初めて見た (run ごと・キーごとに 1 回) | ID があれば `entity`。ID が無ければ `observed.signature` (アダプタが `extra.signatures` にインスタンス → `{mesh, sprite, material}` で出す描画の指紋。ID 文法に合う値だけ採る) をキーにする。どちらも無ければ `unidentified` |
| `value-estimate` | 与ダメを積算した敵が倒れた | `entity`、`observed`: `quantity` (`hp`)、`value` (与ダメの合計)、`basis` (`damage-dealt`)、`hits`、`instance` |

- 期待の判定はエンジンと同じ `check-expect` を、そのティックに観測したフレームで行う。判定の後に同じプランが動き続けても開き直さない。
- 与ダメの慣例: アダプタはプレイヤーが当てたダメージを `{kind: "damage-dealt", instance, amount}` (画面のダメージ数字)、撃破を
  `{kind: "kill", instance}` のイベントで出す。当てた時点で ID が分かったインスタンスだけ数える。sim は現状 `damage-dealt` を出さない (未実装)。
- **マスク原則**: 行はドライバが masked 検査を済ませた player フレームだけから作る。さらに書き込み口 (`observation-sink.ts`) が player の
  行を 1 行ずつ `findMaskedPointers` で検査し、masked があれば `MaskedObservationError` で拒否して書かない (構造の二重化)。契約 C-30。

## 2. オーバーレイ (`observations/overlay.json`)

`guide learn ingest` だけが書く。正本 (entities / tactics / intent) には混ぜない (ローダは `observations/` を読まない)。

| 項目 | 中身 |
|---|---|
| `runs` | `player`: 取り込んだ player run の ID。`ignored_omniscient`: 無視した omniscient run の ID |
| `tactics[]` | 定石・変種ごとの標本 (`samples`: run・成否・時間・被ダメ・資源) と実測 `metrics` (`runs` = 判定の出た試行数、`success`、`time_sec` の p50 / p90 (成功した試行の時間)、`resource` (資源ごとの p50)、`risk.damage_taken_p50`)、通ったノード。変種は `variant` |
| `values[]` | (entity, quantity) ごとの推定値 (run・値・ヒット数) |
| `unknown_entities[]` | 未知 entity と雛形 `draft` (`path`、`draft: true`、`source.kind: observed`、`doc`) |
| `mismatches[]` | 定石ごとの期待外れの件数と run |
| `rewrites[]` | 書き換え候補 (§3) の変種を、実測つきの `learned` 定石文書として |
| `weights` | 考慮項目の重みの係数 (§3 の微調整) |

エンジンは `guide run` / `guide bench` の起動時にオーバーレイを読み、メモリ上だけで適用する (`apply-overlay.ts`、契約 C-33):
player run で実測した定石は `metrics` をオーバーレイの値に差し替え (正本の値より優先)、`rewrites` の定石を `learned` として足し
(信頼下限が authored のペルソナは使わない)、ペルソナの重みに `weights` の係数を掛ける。正本ファイルは書かない。

## 3. `guide learn ingest --game <bundle-dir> <runs...> [--json]`

run の観測ファイルを取り込み、オーバーレイを更新し、差分一覧を Markdown (`--json` で JSON) で出す。正本は読むだけ (契約 C-31)。

- **数える run**: run ID は `run:<ファイル名から .jsonl を除いたもの>`。全行が player の run だけを学習に使う。omniscient の行が 1 つでも
  あれば run 全体を omniscient として無視し、件数を報告する (原則 2)。オーバーレイに載っている run は二重に数えない。
- **値のずれ**: 推定値ごとに正本の値を引く。quantity と同名の stat、無ければ `unit` が quantity の stat (`hp` → `stats.health`)。
  entity ファイルと `.masked.json` の両方を見る (ツクールは全知のバンドルで動く。報告に knowledge を併記する)。run ごとの推定の平均が
  正本の値から 5% 以内 (`AGREEMENT_TOLERANCE`) なら一致。一致率 = 一致した run / 推定のある run。1 run でも外れれば「ずれ」。
- **未知の entity**: キーごとの run 数と目撃数、雛形のパス。
- **失敗が続く定石**: 最後の 3 回 (`FAILING_STREAK`) 以上が連続で失敗している定石と、期待外れの件数。
- **効率の良い変種**: 変種 (同じ元の定石 = 同じ状況に対する別案) を元の定石と比べ、次を全て満たせば書き換え候補:
  - 試行数が `learning.policy.rewrite.min_runs` 以上、
  - 合成ゲインが `min_gain` 以上 (下記)、
  - 成功率が元の定石以上 (効率のために確実さを落とさない。合成指標には成功率を入れないので別に見る)。
  元の定石の基準はオーバーレイの実測 (player run で測れていれば)、無ければ正本の `metrics`。
- **合成ゲイン**: 次元ごとの節約率 `(元 - 変種) / max(元, 変種)` (-1〜1、0 でも定義できる) を `metric_weights` で加重平均する。次元は
  時間 (`time_sec.p50`)、資源 (消費の合計)、リスク (被ダメの p50)。両方が測った次元だけを使い、1 つも無ければ候補にしない。
- **即時反映**: 候補はオーバーレイの `rewrites` に入り、次のプレイからエンジンが使う (§2)。
- **重みの微調整**: `min_runs` 以上測った変種のうち、`min_gain` を満たしたものを勝ち、ゲインが負のものを負けとして、探索の重みに
  `1 + 0.2 × (勝ち - 負け) / 比べた数` を掛ける (0.8〜1.2 に収める)。比べられる変種が無ければ係数を置かない。

## 4. `guide learn consolidate --game <bundle-dir> [--apply] [--json]` / `guide learn approve`

オーバーレイから正本の更新案を出す。各案はファイルごとの JSON Patch (RFC 6902、新規ファイルはルートへの `add`) と、Markdown
(旧 → 新、実測比較、根拠 run) を持つ。`--json` は案の一覧と JSON Patch をそのまま出す。契約 C-32。

| 種類 | 中身 | 自動反映 |
|---|---|---|
| 定石の書き換え (`rewrite:<元の定石>`) | 変種を `tactics/<変種の slug>.json` (learned、実測つき) として足し、元の定石の `superseded_by` を変種の ID にする (旧定石は消さない。`test` で `superseded_by: null` を確かめてから置き換える)。1 つの定石に候補が複数あればゲイン最大のもの | `learning.policy.rewrite.auto_apply: true` で、`relax` でなく、かつ意図に触れないものだけ |
| 境界の昇格候補 (`promotion:<値の参照>`) | `.masked.json` の値で、player run の推定が `promotion.discoverable_requires` (`player_runs` 本以上、一致率 `agreement` 以上) を満たしたもの。値を `.masked.json` から entity ファイルへ `discoverable` として移し、`source.ref` に根拠 run を足す | しない (人間承認) |
| 未知 entity の雛形 (`entity-draft:<キー>`) | `entities/<group>/<slug>.json` の新規。ID の無いものは `enemy:<game>:observed-<キーのハッシュ 8 桁>` (仮定: 画面に映る正体不明のものは敵として起こす) | しない (人間承認) |
| 人間プレイの別解 (`human-tactic:<定石 ID>`) | `observations/human/candidates.json` の候補を `tactics/<slug>.json` (learned、`draft: false`) として足す。既にある定石 ID は出さない (§4.3) | しない (人間承認) |

- **昇格の根拠**: オーバーレイが player run として載せた run の推定だけを数える。omniscient の観測は根拠にならない (原則 2)。
- **`--apply`**: 自動反映できる案と、**有効な承認** (§4.2) を持つ承認待ちの案だけを書き、何を書いたか・何を残したか・失効した承認を出す。
  パッチは全て当たるか全く当たらないか (`JsonPatchError`、契約 C-35)、書く前に全文書をそのパスのスキーマで検査する。
  バンドルにスキーマ違反があれば `--apply` を拒否する。`--apply` なしでは何も書かない。

### 4.1 自動反映の条件 (Astra レビュー P1-5 で補正、2026-10-09)

効率差だけの書き換えは規則で反映してよいが、設計者の意図に関わる更新は人間が行う (設計原則 5)。teach / forbid だけでなく、
**全ての種類の意図** への影響を判定する (`src/learn/consolidate/intent-touch.ts`、契約 C-65)。

| 意図 | 触れる条件 |
|---|---|
| `teach` | 旧 / 新の定石を参照している |
| `forbid` | 旧 / 新の定石がその領域を通る (`do` の `move_to`、`when` の `at_node` / `stage.node`、新定石の実測で通ったノード) |
| `route` | 旧と新で、想定経路上のどのノードを踏むか (`move_to` / `at_node`) が変わる |
| `time` | ステージに時間の範囲があり、変種の実測時間 (`time_sec.p50`) が旧定石と違う (クリア時間が設計者の範囲に対して動く) |
| `design_stance` | `open` / `mixed` のステージで旧定石を `superseded_by` にする (解法の広さ breadth を削る)。`refined` は絞り込みが意図なので触れない |
| `illusory_by_design` | 旧 / 新の定石、またはそのノードが宣言された「見かけ上の解」に含まれる |
| `allowed_divergences` | 許容したズレが旧 / 新の定石を名指ししている |

- 意図はそのステージで定石が使えるときだけ数える。`when` が `stage.id` を名指しする定石はそのステージだけ、名指ししない定石は全ステージ (安全側)。
- **`relax` の変種は自動反映しない**: `when` を緩めた変種は、元の定石が動かない状況でも動く。ゲインは同じ条件での効率比較ではないので、
  規則の範囲外 (人間承認)。`reorder` / `substitute` は同じ `when` の上での比較。
- ドラフトの意図も含めて見る (安全側)。

### 4.2 承認と失効 (`guide learn approve`)

```
guide learn approve --game <bundle-dir> --proposal <id> --by <name> --reason <text>
```

- 各提案は **basis** (ゲーム ID、攻略本の版 `manifest.version`、`builds`、比較した条件 = 元の定石の `when`、指標の単位) と
  **内容ハッシュ** (`sha256:` + 正規化 JSON。パッチ・根拠 run・実測比較・basis を含み、ツールの判定 `status` / `reason` は含めない) を持つ (C-66)。
- `approve` は今の consolidate を作り直し、指定の提案の内容ハッシュと版を、承認者・理由・時刻とともに `observations/approvals.json`
  (`schema/approvals.schema.json`) に追記する。正本には触らない。自動反映の案と存在しない ID は承認できない。
- `consolidate --apply` は、最新の承認が **提案の現在の内容ハッシュと版の両方に一致** するときだけその案を書く (C-64)。根拠 run が増えた、
  パッチが変わった、攻略本の版が上がった、などで一致しなくなった承認は **失効** (`stale`) として報告し、書かない。再承認が必要。
- 単位 (`METRIC_UNITS`): 時間 = 秒 (`time_sec.p50`)、資源 = 消費量の合計、リスク = 被ダメ (HP バーの % 、満タン 100) の p50、成功率 = 期待を満たした割合。

### 4.3 人間の別解の正本化

`guide import plays` (段階 4D) が作る `observations/human/candidates.json` を consolidate が読み、候補ごとに `human-tactic` 提案を出す。
人間の解法は「意図した経路か・釣りか・不具合か」の設計判断なので常に承認待ち (C-67)。承認 → `--apply` で `tactics/` に
`draft: false` の learned 定石として入る (承認がドラフトを外すレビューに当たる)。境界の昇格根拠には人間 run を数えない
(人間 run から値の推定を作る段が未実装。[human-plays.md](human-plays.md) §4)。

## 5. 探索の混入 (段階 3 の確認と補い)

段階 3 のエンジンは探索候補を毎ティック生成し、`purpose=coverage` では常に、`efficiency` ではペルソナの `exploration_rate` の確率で
探索ボーナスを効かせる (候補の生成は毎ティック、混ぜる割合は効用で決まる)。段階 4 で変種を「手順の回転」だけから 3 種
(`reorder` / `relax` / `substitute`) に広げ、由来 (`variant: {tactic, of, mutation}`) を候補に持たせて reflect が計測できるようにした
([engine.md](engine.md) §3)。元の定石が保留中 (期待の判定待ち・破れた直後) の間は、その変種も出さない。

## 6. 仮定

- `rewrite.min_runs` は試行 (判定の出た定石の実行) の数として数える (設計 §8.2「min_runs 以上の試行」)。
- `damage_taken` は HP バーの比 (満タン = 100) で測る。正本の `risk.damage_taken_p50` と単位が揃う保証はないため、ゲインの基準は
  元の定石がオーバーレイで実測されていればその値を優先する。
- 正体不明の未知 entity は敵 (`enemies/`) として雛形を起こす。
- フィクスチャ `tests/fixtures/learn/drifted/` は手書きの run を短く保つため、`min_runs` 4・`player_runs` 3 に下げてある。
