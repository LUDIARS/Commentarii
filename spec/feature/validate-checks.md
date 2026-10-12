# `guide validate` 検査項目 (固定リスト)

設計 §6 「validate の検査項目は固定リストとして spec に置き、1 項目 1 テスト」の正本。
実装は `src/validate/checks/vNN-*.ts` (1 ファイル 1 項目)、テストは `tests/validate/checks/vNN-*.test.ts`、
壊したフィクスチャは `tests/fixtures/broken/vNN-*/` (`samples/bestia` への上書き差分)。

「値」= `value` キーを持つ JSON オブジェクト (設計 §4.3)。V03〜V07 はスキーマ不適合のファイルも生 JSON のまま走査する。

| ID | 項目 | 重さ | 判定 |
|---|---|---|---|
| V01 | スキーマ違反 | error | 各ファイルが `schema/` の JSON Schema に適合する。読めない JSON・配置規則 (設計 §4.2) 外の `.json`・`manifest.json` 欠落も含む |
| V02 | 参照整合 | error | ID の一意性、ID とファイル配置 (種別ディレクトリ・slug・manifest の game_id) の一致、entity / stage / map / events / rule / state / tactic / glossary / intent.stage が指す ID・状態 (`#sub`)・フィールドパス (`.stats.hp`)・地図ノードが存在する。バンドル外の種別 (`attr:` `mesh:` `run:` `lexicon:` など) は対象外 |
| V03 | `.masked.json` 以外に masked が無い | error | `knowledge: masked` を持つ値・レコードが `.masked.json` 以外に無い。定石自身の `knowledge` は伝播で決まる派生値なので対象外 (V10 が担う) |
| V04 | `.masked.json` に masked 以外が無い | error | `.masked.json` 内の `knowledge` が全て `masked` |
| V05 | knowledge 無しの値が無い | error | ネストした全ての値が既知の `knowledge` を持つ |
| V06 | source 無しの値が無い | error | 全ての値が `source.kind` と空でない `source.ref` を持つ |
| V07 | llm-draft なのに draft: false | error | `source.kind = llm-draft` の値は `draft: true` |
| V08 | ルールの式が評価できる | error | 各変数の `example` が `range` 内で、その例で式を 1 回評価して有限の数になる。評価器は四則 + `min` `max` `floor` `ceil` `abs` `clamp` だけ (`eval` / `Function` 不使用)。rule 文書は `expr/1` として読み、比較・論理など `expr/2` の形は誤り (式言語 v2 の導入前と同じ) |
| V09 | 単位の整合 | error | 同じ stat 名の単位が (masked 付随ファイルを含め) バンドル全体で一致する |
| V10 | 定石の knowledge が参照先の最も厳しい値と一致 | error | `when` / `do` / `expect` / `because` の参照先の knowledge のうち最も厳しいものと定石の `knowledge` が一致する。素のエンティティ ID は制約を加えず、フィールドパス・ルール・状態機械・地図ノードが制約を加える |
| V11 | カバレッジ | warning | 状態機械 (`behavior`) の無い敵、意図 (`intent/`) の無いステージ |
| V12 | intent の参照が存在する | error | `teach.tactic` が定石に、`forbid.area` と `route.path` の各ノードが当該ステージの地図にある |
| V13 | ルールブックの式が構文どおり | error | `mechanics/` の全ての式 (変数の `range` / `init` / `derive`、集合の `where`、行動と masked 上書きの `pre` / `duration` / `cooldown` / `cost` / `motion` / 効果の `when` と `assign`、過程、挙動モデル、目標、状態機械の遷移の `when` / `hold`) が `expr/2` として構文解析できる (`spec/feature/rulebook.md` §1) |
| V14 | ルールブックの参照が解決する | error | 式の中の関数・変数・集合・`$param`・ID が既知で、所有者を取る引数が `self` / `actor` / `$param` / 個体 ID (`hp(node:center)` は誤り)、引数の数が合う。式以外の参照も: `assign` の変数が宣言済みで所有者の有無が宣言と合う、`assign.of` / `motion.goal` / `motion.of` が `self` / `actor` / 宣言済み `$param` / 存在する ID、過程の `rate` の変数、`targeting.var`、変数の `machine` |
| V15 | 効果の確率の合計が 1 | error | 行動と masked 上書きの各効果で `outcomes[].p` の和が 1 (誤差 1e-9)。和が 1 に満たない見える定義は隠れた分岐の余地を残すので「不明」ではなく誤り |
| V16 | 行動の maps_to が抽象アクションの語彙 | error | `maps_to` のキーは `replay.schema.json#/$defs/action` の動詞 (`move_to` `attack` `use_item` `use_skill` `wait` `interact` `custom`) と `target` / `params` だけで、動詞はちょうど 1 つ。渡す `$param` は宣言済み。`actor` に `self` を含む行動は `maps_to` を持つ |
| V17 | masked の上書きが見える行動と分離している | error | `actions/<slug>.masked.json` の隣に見える `actions/<slug>.json` があり、ID が一致する。上書きできるキーと `knowledge: masked` はスキーマ (V01) が担い、見える側の完結は V13〜V16・V18〜V20 が単独で検査する |
| V18 | ルールブックの knowledge が参照先から伝播している | error | 行動・過程・挙動モデル・状態機械・集合・目標・進捗尺度の `knowledge` が、参照する変数・集合・rule・状態機械・行動の最も厳しい knowledge 以上 (shown の行動が discoverable の変数を読めば誤り)。変数の宣言は自分の値の境界を宣言するので対象外 |
| V19 | 挙動モデルの参照が切れていない | error | `machine` が存在し、`act` のキーがその状態機械の状態で、`act` / `timeline` / `tree` / `candidates` / `actions` の行動が存在して `actor` に `entity` を含み、渡すパラメータを行動が宣言している |
| V20 | player 側の定義に隠れた分岐の痕跡が無い | error | `.masked.json` 以外のルールブック文書 (variables / actions / processes / behaviors / objectives / states / rules) に `override` `masked` `hidden` などのキーや `.masked.json` を指す文字列が無く、masked 上書きを持つ行動が `effects_known: false` を宣言していない (未モデル化の宣言は公開側の独立宣言であり、masked ファイルの影にしない) |
| V21 | エンジン出力がスキーマどおり | error | バンドルの隣のエンジン出力 (`observations/planning/{method-report,proposals,approved-budget-table}.json`、`observations/selection/method-bandit.json`、`observations/opponents/<slug>.json`、SDK 0.5.0) が JSON として読めて、それぞれのスキーマに適合する。正本の文書ではないので V01 は見ない ([engine-planning-formats.md](engine-planning-formats.md)) |
| V22 | 予算表の変更案のハッシュと ID が整合する | error | 変更案 (`proposals.json` と `approved-budget-table.json` の中の写し) の `proposals_hash` が一覧の内容ハッシュに一致し (作った後で書き換えていない)、各案の ID が `<cell>:<planner>` で重複せず、`from` と `to` が違う |
| V23 | 承認済み予算表の承認が変更案と一致する | error | `approved-budget-table.json` の `approval.proposals_hash` が中の変更案の `proposals_hash` と一致する (誰もレビューしていない変更を通さない) |
| V24 | 相手モデルのファイルと entity が一致する | error | `observations/opponents/<slug>.json` の `entity` の最後の区切りが `<slug>` で、ID のゲームが manifest の `game_id` |
| V25 | オンライン補正の報酬合計が回数以下 | error | `method-bandit.json` の各腕で報酬の合計 `total` がエピソード数 `n` 以下 (1 回の報酬は 0..1) |
| V26 | 方式レポートの回数と割合が整合する | error | `method-report.json` の行のエピソード数の和が `episodes` に一致し、予算表の行ごとの提案者の割合・全体の提案者の割合・選択器の規則の割合がそれぞれ 1 になる (各値が 1e-4 に丸めてある分の誤差は許す) |

終了コード: error が 1 項目でもあれば 1、warning だけなら 0、使い方の誤りは 2。

## 知識境界の出力規則

- `render` の既定 (`--knowledge player`) は player view (masked の値・レコード・定石を構造的に除いたバンドル) からだけ描画する。`--knowledge full` で `masked.md` (内部用) を別節として足す。
- `report knowledge` と `render` の `knowledge.md` は件数・ID・ファイル位置だけを出し、masked の値も masked 項目名も出さない。masked を参照する定石は ID と masked 参照数で示す。
