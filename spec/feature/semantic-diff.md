# 攻略本の意味差分 (段 7I)

設計 §14.I。`guide diff --explain <before-dir> <after-dir> [--knowledge player|full] [--json] [--out <file>]`。

## 何をするか

2 つの攻略本を **同じ knowledge** で書き出し (`buildExport`)、ID で対応付けて意味の差分を出す。

| 記録 | 対応付けのキー |
|---|---|
| エンティティ / 内部値 (masked) / ルール / 状態機械 / 定石 | `id` |
| ステージ | ステージ文書の `id` |
| 設計意図 | `<stage>#<intended item id>` |

ファイルの移動は変更にならない。変更の種類:

- `added` / `removed`: 記録の追加・削除。
- `replaced`: 定石の `superseded_by` が新しく別の定石を指した (置換)。
- `changed`: 葉ごとの変更。値ノード (`value` を持つもの) は 1 つの葉で、payload と境界ラベルを持つ。配列は丸ごと 1 つの葉 (順序に意味がある: 経路・do 列)。
  - `value`: 前後の値。両方数値なら `delta` (後 − 前)。
  - `boundary`: 境界ラベルの変化。shown 側へ寄れば `promoted` (昇格)、masked 側へ寄れば `demoted` (降格)。定石・意図項目の `knowledge` も同じ扱い。
  - `added-field` / `removed-field`: 葉の追加・削除。

## 内部用と公開用

- `--knowledge full`: 内部用。masked を含む。
- `--knowledge player` (既定): 公開用。両側を player view で書き出してから比べるので、masked の値は差分に入らない (C-78)。
  アップデート説明の素材にできる。
- knowledge の異なる書き出し同士は比べない (例外)。

## 文章化

Markdown の文面は固定の言い回しで、数値はすべて差分から機械的に出す。設計 §14.I の「LLM は文章化だけ」は任意の後段で、
この実装は LLM を呼ばない (数値が文章から漂わないことを優先)。LLM で言い換える場合も入力はこの差分 (公開用なら player 差分) だけにする。

## 限界

- 配列の中の 1 要素だけの変更も「配列全体の変更」として出る。
- 記録の ID を変えた場合は「削除 + 追加」になり、改名とは判定しない。
