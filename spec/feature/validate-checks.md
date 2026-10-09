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
| V08 | ルールの式が評価できる | error | 各変数の `example` が `range` 内で、その例で式を 1 回評価して有限の数になる。評価器は四則 + `min` `max` `floor` `ceil` `abs` `clamp` だけ (`eval` / `Function` 不使用) |
| V09 | 単位の整合 | error | 同じ stat 名の単位が (masked 付随ファイルを含め) バンドル全体で一致する |
| V10 | 定石の knowledge が参照先の最も厳しい値と一致 | error | `when` / `do` / `expect` / `because` の参照先の knowledge のうち最も厳しいものと定石の `knowledge` が一致する。素のエンティティ ID は制約を加えず、フィールドパス・ルール・状態機械・地図ノードが制約を加える |
| V11 | カバレッジ | warning | 状態機械 (`behavior`) の無い敵、意図 (`intent/`) の無いステージ |
| V12 | intent の参照が存在する | error | `teach.tactic` が定石に、`forbid.area` と `route.path` の各ノードが当該ステージの地図にある |

終了コード: error が 1 項目でもあれば 1、warning だけなら 0、使い方の誤りは 2。

## 知識境界の出力規則

- `render` の既定 (`--knowledge player`) は player view (masked の値・レコード・定石を構造的に除いたバンドル) からだけ描画する。`--knowledge full` で `masked.md` (内部用) を別節として足す。
- `report knowledge` と `render` の `knowledge.md` は件数・ID・ファイル位置だけを出し、masked の値も masked 項目名も出さない。masked を参照する定石は ID と masked 参照数で示す。
