# 判断エンジン・ペルソナ・模擬アダプタ・export (段階 3 / 3E)

設計正本: `spec/architecture/design.md` §4.4 (tactic / intent / manifest)、§7 (オートプレイヤー)、§11 段 3 と 3E、§14.A (リプレイ)、§14.E (ペルソナ)。
依頼文: `spec/tasks/2026-10-09-stage-3-engine.md`。アダプタ境界は [adapter-protocol.md](adapter-protocol.md)。

| 置き場所 | 中身 |
|---|---|
| `src/export/` | `guide export` (`bundle.json` と索引) |
| `src/engine/` | 判断エンジン (ゲーム非依存、純関数中心)。`decide-tick.ts` が 1 ティック、`utility-bt-decider.ts` が `Decider` 実装、`driver.ts` がティック駆動 |
| `src/engine/match/` | 定石の `when` と観測の照合 |
| `src/engine/candidates/` | 候補生成 (定石・汎用行動・探索) |
| `src/engine/utility/` | 効用の考慮項目 (1 項目 1 ファイル) と合成 |
| `src/engine/bt/` | BT (Selector / Sequence / Condition / Action)、組立器と実行器 |
| `src/engine/persona/` | ペルソナの型と解決 (バンドル優先) |
| `src/adapter/` | アダプタ契約 (TypeScript) と JSON Lines プロトコル |
| `src/adapters/sim/` | 模擬アダプタ (決定的な小さいシミュレータ) |
| `src/adapters/stdio/` | プロセス分離アダプタ (stdin / stdout) |
| `src/bench/`, `src/autoplay/` | `guide bench` / `guide run` |
| `personas/`, `schema/persona.schema.json` | 同梱ペルソナとスキーマ |

## 1. export

`guide export <bundle-dir> --out <dir> [--knowledge player|full] [--target runtime]` は `<dir>/bundle.json` を 1 つ書く。

- `knowledge=player` (既定) は `toPlayerView` (render と同じ masked の無い view) を通す。masked の付随ファイル・masked の定石は入らず、
  `.masked.json` 以外に紛れた masked 値も落ちる。`full` は内部用で全文書を含む。
- 内容: `format` (`commentarii.bundle`)、`format_version` (1)、`game_id`、`manifest_version`、`knowledge`、`target`、`documents`
  (manifest / glossary / entities / masked_entities / stages / rules / states / tactics / intents。各文書は `{path, doc}`)、`index`。
- 索引 `index`:
  - `ids`: entity / stage / rule / state / tactic / intent 項目の ID → `{kind, path, pointer}` (`pointer` は bundle.json 内の JSON pointer)。
  - `render_signatures`: `render_signature` の mesh / sprite ID → entity ID (描画命令 → entity の逆引き、§7.1)。
  - `adjacency`: ステージ ID → ノード ID → 隣接ノード ID (無向辺は両向き、`directed: true` は片向き)。
- `--target` は `runtime` だけ (§14.G の `ingame` は段階 7G)。
- 契約 C-17: player の出力に masked が無く、索引が文書を指す。

## 2. 1 ティック (decideTick)

設計 §7.5 の observe → match → decide → act → reflect のうち、match・decide・act と reflect の期待判定を 1 つの純関数で行う。
前の状態・観測・乱数 2 個 (探索判定と誤操作判定) を受け、判断ログ・行動・次の状態を返す。

1. **知覚**: ペルソナの `reaction_delay_ticks` だけ古い観測で判断する (直近 n+1 個を状態に持つ)。
2. **期待の判定 (reflect)**: 実行中の定石と、終わった / 切り替えられた定石の `expect` を判定する。
   - `met`: `entity_state` の全項目で、束縛したインスタンスの `state_guess` が期待どおり。
   - `broken`: `within_sec` を過ぎても met でない。→ その定石を `HOLD_BACK_SEC` (5 秒) 候補から外し、実行中なら即中断して再評価。
   - `pending`: それ以外 (観測できない状態は「不明」で、破れたとは扱わない)。
   - 判定が出ていない定石は再提案しない (結果を見る前に同じ定石を繰り返さない)。met なら即座に再提案できる。
3. **候補生成** (§3)、**効用** (§4)、**選択**: 効用の高い順に BT を 1 歩進め、行動を出せた最初の候補を選ぶ。行動を出せない候補
   (束縛した敵が消えた・目的地に既に居る) は `skipped` として次点へ。どれも行動を出せなければ `wait 0`。
4. **誤操作**: ペルソナの `misplay_rate` の確率で、選んだ行動を `wait 0` に置き換える (判断ログは選んだまま)。
5. **判断ログ**: 全候補を ID 順に `{candidate, utility, chosen}` で返す (リプレイの `decision` 列)。効用は小数 6 桁に丸める。

契約 C-19: 候補は 1 回ずつ・効用は有限・chosen は高々 1 件・chosen より効用の高い候補は skipped・行動の verb は 1 つ。

### 決定性

- 乱数は `src/engine/rng.ts` (mulberry32、seed は整数か文字列) だけ。Math.random と時刻は使わない。
- `utility-bt` decider は毎ティック必ず 2 回だけ乱数を引く。乱数列は seed とティック数だけで決まり、同じ seed と同じ観測列なら
  同じ判断になる。`guide replay play <run> --decider utility-bt --game <bundle>` が run の header の seed とペルソナで再判定する
  (`--persona` で上書き可。別ペルソナでは一致しない)。
- sim は run の seed から導いた別系列 (`deriveSeed(seed, 'sim')`) を使い、エンジンの乱数列を乱さない。

## 3. 候補生成

| 種類 | ID | 内容 |
|---|---|---|
| 定石 | 定石 ID | `world.tactics` のうち、ペルソナの信頼下限以上で、保留・判定待ちでなく、`when` が成り立つもの。BT は `do` の Sequence |
| 汎用: 生存 | `generic:survive` | HP 比 < 0.3 で敵が見えるとき、最寄りの敵から 8 離れた点へ移動 |
| 汎用: 目標接近 | `generic:approach` | 最寄りの敵を `$target` に束縛し、射程 (`extra.reach`、無ければ 10) 内なら攻撃・外なら接近 (Selector)。敵が見えなければ意図の `route` の未訪問ノードへ |
| 汎用: 資源確保 | `generic:gather` | 地図の `resource` 注記ノードのうち最寄りへ移動 |
| 探索: 未訪問 | `explore:<node>` | 現在ノードの未訪問の隣接ノード (無ければ最寄りの未訪問ノード) へ移動 |
| 探索: 変種 | `variant:<定石 ID>` | 成り立った定石の手順を回転 (最後の手順を先頭へ) した変種。新しい参照を足さないので知識境界は元の定石と同じ |

- **エンジンが使える定石** (`buildEngineWorld`): `draft: true` と `superseded_by` 付きは常に除外。player モードはバンドルを
  `toPlayerView` 経由で読み、さらに `knowledge: masked` の定石を明示的に除外する (二重)。omniscient (検算・デバッグ) は masked も使える。
- **信頼の順**: `authored` > `derived` > `learned`。ペルソナの `min_confidence` 未満の定石は候補にしない。
- 実行中の計画は `when` が成り立たなくなっても候補に残す (`continuing`、ヒステリシス加点)。
- 候補は ID 順に並べる (判断ログと同点時の順位を生成順に依存させない)。
- 契約 C-18: 候補 ID は一意かつ ID 順、player モードで masked / draft / superseded 由来の候補 (変種を含む) が無い、信頼下限未満が無い。

### `when` の語彙 (`src/engine/match/`)

合成: `all` (左から束縛を引き継ぐ) / `any` (最初に成り立った枝) / `not` (束縛しない)。照合は貪欲 (後戻りしない)。

| 葉 | キー | 意味 |
|---|---|---|
| entity | `entity` (ID か `$束縛`)、`visible`、`distance_lt`、`distance_gt`、`state` (状態参照)、`min_confidence`、`as` | ID はキー全てを満たす最寄りの可視インスタンスを `as` (既定 `$<kind>`、例 `$enemy`) に束縛。`$束縛` は束縛済みインスタンスを再検査。`visible: false` は満たすものが無いとき成立 |
| self | `self: {hp_ratio_lt, hp_ratio_gt, skill_ready, has_item, resource_gte, resource_lt, at_node}` | 全キー必須。HP 比は `self.hp.value` (0〜1)、スキルは `extra.ready_skills`、所持品は `extra.items` |
| stage | `stage: {id, node, elapsed_gt, elapsed_lt}` | 経過秒は `stage.elapsed` (無ければ `t`) |
| event | `event: "<kind>"` | その種類のイベントが今回の観測に来た |

語彙外のキー・葉は成立しない (未知の条件で定石が発火しない)。

## 4. 効用 (`src/engine/utility/`)

効用 = (何かを言える考慮項目の 重み × 値 の和) / (その重みの和) + (継続中なら `hysteresis`)。値は全て 0〜1、何も言えない項目
(`undefined`) は分子にも分母にも入れない。重みはペルソナ、`metrics` の内訳の重みは manifest の
`learning.policy.rewrite.metric_weights`。

| 項目 | 値 |
|---|---|
| distance | 対象までの距離 d に対し 1 / (1 + d / 20) |
| hp | 安全を求める候補は 1 − HP 比、押す候補は HP 比 |
| time | 制限時間 (ステージの `time_limit`、無ければ意図 `time` の上限) に対する経過の割合 p。押す候補は 0.5 + 0.5p、それ以外は 0.5 − 0.5p |
| resource | 定石の `metrics.resource` を払えれば 1・払えなければ 0。資源確保は 1 / (1 + 平均所持量 / 50) |
| confidence | authored 1 / derived 0.75 / learned 0.5、汎用 0.4、探索 0.2 |
| metrics | 0.5 × 成功率 + 0.5 × (時間・リスク・資源を manifest の重みで合成、未計測の数値は 0.5) |
| intent | 教えたい (`teach`) 定石と意図ルート上のノードは 1、`forbid` のノードは 0 (`coverage` では何も言わない) |
| exploration | 探索ティックでは新しさ (未試行・未訪問 1、試した変種 0.3、既知 0)。探索ティック以外は探索候補に 0、他は何も言わない |

- **探索ティック**: `purpose=coverage` では常に、`efficiency` ではペルソナの `exploration_rate` の確率で探索ボーナスが有効。
- **継続 / 切替**: 実行中の BT は `hysteresis` の加点で続きやすい。`expect` が破れたら即中断 (§2)。

## 5. BT (`src/engine/bt/`)

- ノードは Selector / Sequence / Condition / Action の 4 種。木はデータ (関数を持たない)、id は前順、`last` は部分木の最大 id。
- 状態は木の外に `BtMemory` (ノード id → カーソル / 開始時刻) として明示的に持ち、`stepTree(tree, memory, context)` が新しい memory を返す。
- 1 ティックに行動は高々 1 つ。Sequence は覚えた位置から再開し、行動した子でそのティックを終える。Selector は毎ティック先頭から
  試す (反応型) で、別の子に移ったら前の子の部分木を忘れる。Condition は `when` の語彙で判定し行動しない。
- 葉 (抽象アクション §7.3): `move_to` は到着 (ノード一致、またはインスタンス / 座標から 2 以内) まで `move_to` を出し続け、
  到着時は行動なしで成功。`wait n` は観測時刻で n 秒経つまで `wait 0` を出す。`attack` / `use_item` / `use_skill` / `interact` /
  `custom` は 1 回出して成功。`$束縛` が解決できない葉は失敗。
- 契約 C-20: running は必ず行動を持ち、failure は持たず、行動の verb は 1 つ、memory はその木のノードだけ。

## 6. ペルソナ (3E)

`personas/<slug>.json` (`schema/persona.schema.json`): `weights` (§4 の 8 項目)、`exploration_rate`、`reaction_delay_ticks`、
`misplay_rate`、`min_confidence`、`hysteresis`、任意で `links` (Discutere / Histrio のペルソナ ID)。

| slug | 性格 |
|---|---|
| `novice` | 反応遅延 4 ティック、誤操作 8%、authored の定石だけ、探索 3% |
| `expert` | 遅延なし・誤操作なし、learned まで使い実測 (metrics) を重視、探索 10% |
| `explorer` | 探索 50%・探索の重み 2、derived まで使う |

- 解決順: `<bundle>/personas/<slug>.json` → 同梱 `personas/<slug>.json`。見つからない・スキーマ不適合・slug 不一致はエラー
  (黙って別のペルソナにしない)。バンドルの `personas/` はローダの対象外 (攻略本の文書ではない)。
- `--persona` の既定は `expert`。

## 7. ドライバ (`src/engine/driver.ts`)

`runDriver({adapter, decider, mode, maxTicks, record?})`: hello → (observe → decide → act) を、ゲームが終わるか `maxTicks` まで回す。

- hello の `mode` と各観測の `mode` が要求と違えば停止 (`mode-mismatch`)。
- player モードでは各観測を `findMaskedPointers` で検査し、masked が 1 つでもあれば **decider に渡す前に** 停止する
  (`masked-in-player`、結果 abort)。アダプタ自身の責務 (masked を出さない) との二重化。停止理由には JSON pointer だけを残し値は複写しない。
- `record` を渡すと hello の game_id / adapter_id で header を作り、RecordingSink (段階 2A) で 1 ティック 1 行を記録し、最後に footer
  (`result` と `summary`) を書く。例外で止まっても footer (`abort`) を書いてから例外を投げる。
- アダプタの `close(reason)` は必ず 1 回呼ぶ (stdio では engine 側の `bye`)。
- 契約 C-21。

## 8. 模擬アダプタ `sim` (`src/adapters/sim/`)

テストとベンチ用の小さな決定的ゲーム。攻略本 (地図・entity・状態機械・ルール) だけで動き、ゲーム固有のコードを持たない。

- **配置**: grid はセル × `gridCell`、navgraph は `pos`、zones (と座標の無い地図) は最初のノードを中心に幅優先の深さごとの同心円
  (`nodeSpacing` = 12 間隔)。位置の所属ノードは半径が最も近い円 (zones) / 最寄り点。
- **出現**: ステージの最初の `spawns` のノードに自機、各 spawn の `count` 分の敵。自機の能力は最初の `actor` entity の stats
  (`health` / `speed` / `range` / `cooldown` / `power`)、無ければ sim の既定値。敵は entity の stats (masked も含む。sim はゲームなので全部知っている)。
- **敵 AI**: 乱戦 (Bestia は「最後の 1 体まで生き残る」)。各敵は最寄りの他の戦闘者 (自機か他の敵) を狙う。状態機械の遷移は
  `on` (人向けの文) ではなく遷移先の状態 id の慣例で読む: `attack` (射程内)、`chase` (射程外 / 回避終了 / 後退時間終了 /
  リング内に戻った)、`dodge` (撃たれたとき `dodgeChance` で、継続時間は遷移の rule、`closing_time` = 距離 / 弾速)、`retreat`
  (HP が遷移の rule の値以下 (`max_health` = 自分の最大 HP)、無ければ 25% 以下で、対象が射程内)、`return` (hazard 注記のノードに居る)。
  それ以外の遷移先は sim では発火しない。状態機械の無い敵は射程内なら攻撃・外なら接近。
- **ダメージ**: バンドルに `rule:<game>:damage` があればその式 (変数 `power`, `cooldown`, `distance`, `range`、無い変数は自分の stats →
  rule の example)、無ければ sim の `damageExpression` (`power * cooldown`、つまり `power` は DPS)。式は全て `evaluateExpression`。
- **自機**: `move_to` (ノード / インスタンス / 座標へ歩く)、`attack` (射程内・クールダウン明けの敵、回避中の敵には外れる)。
  移動したティックの被弾は `movingEvasion` (50%) で外れる (偏差射撃は止まった的を狙う)。被弾後 `regenDelaySec` 経てば回復。
  `use_item` / `use_skill` / `interact` / `custom` は sim では何もしない。
- **終了**: 敵が全滅で success、自機の HP 0 か制限時間 (ステージ / 意図) 切れで fail。
- **観測**: player は `sightRange` 内の生存敵 (状態機械が masked でなければ `state_guess`)、自機 HP は shown の比、`extra.reach`。
  masked 値は出さない。omniscient は全敵と `extra.enemy_hp` / `extra.masked_stats` (masked 印つき)。
- 既定値 (`src/adapters/sim/sim-config.ts`) は、samples/bestia で汎用行動だけでも一定割合クリアでき、定石の差が測れる強さに合わせてある
  (自機 HP 150・DPS 30、敵の DPS 8)。

## 9. ベンチ (`guide bench`)

`guide bench --game <bundle> --runs N --persona <slug> --seed <n> [--ticks n] [--mode] [--purpose] [--no-tactics]` は sim で N 回走らせ JSON を出す。
run i の seed は `deriveSeed(seed, "bench-run-i")`。

- `clear_rate` (success の割合)、`time_sec` (クリアした run の平均と中央値、0 件なら null)、`damage_taken`、`candidate_share`
  (候補ごとの選択ティックの割合)、`tactic_share` (定石だけ)、`exploration_share` (`explore:` / `variant:` の割合)、`per_run`。
- `--no-tactics` は定石を全部外した攻略本で走らせる (汎用行動だけ。§7.4 「攻略本の効果はこの差で測る」)。
- 閾値との比較 (回帰ゲート) は段階 5C。契約 C-22。

samples/bestia (seed 1、20 run、2000 ティック) の実測:

| ペルソナ | 定石 | クリア率 | クリア時間 (平均) |
|---|---|---|---|
| novice | あり | 1.0 | 27.7 s |
| novice | なし | 0.85 | 31.1 s |
| expert | あり | 1.0 | 18.5 s |
| expert | なし | 1.0 | 19.1 s |

探索候補の採用割合は explorer ≈ 0.23、expert ≈ 0.07、novice ≈ 0.04 (テスト `tests/bench/run-bench.test.ts`)。

## 10. `guide run`

`guide run --game <bundle> [--adapter sim|stdio] [--persona <slug>] [--mode player|omniscient] [--purpose efficiency|coverage] [--seed <n>] [--ticks <n>] [--record <out.jsonl>]`

- 既定: `sim`、`expert`、`player`、`efficiency`、seed 1、1200 ティック。run ID は `run:<game>-<persona>-s<seed>`。
- `--record` は新しいファイルに段階 2A の形式で記録する (既存ファイルは拒否)。
- 結果 (JSON) は stdout、`--adapter stdio` のときは stdout がプロトコル専用なので stderr。
- 終了コード: masked 検出・mode 不一致で止まったら 1、それ以外 (ゲームの勝敗・ティック上限) は 0。
