# Praeforma 連携 — 意図とシーン・仕様の双方向リンク (段階 5K)

設計正本: `spec/architecture/design.md` §14.K、§8.3、§9 (Praeforma は仕様の正本)。Actio: `actio:7ab9fce8-4e31-4a97-9fe7-62db95bea1f7`。
本段は Commentarii 側の **ID の保持・取り込み・レポートへの付与・公開契約** まで。Praeforma の画面に出す実装は Praeforma 側の別 PR。

## 1. 保持する ID (`schema/praeforma-ref.schema.json`)

`praeforma: { scene_id?, spec_id?, project_code? }` (1 つ以上、各値は空白・引用符・山括弧を含まない 1〜120 文字の不透明な文字列)。
Commentarii は ID を解釈も解決もしない (Praeforma の ID のまま持つ)。

| 置き場所 | 意味 |
|---|---|
| `intent/<stage>.json` の `intended[].praeforma` | その意図項目が由来する Praeforma のシーン / 仕様 |
| `intent/<stage>.json` の `allowed_divergences[].praeforma` | 許容したズレをどのシーン / 仕様の上で判断したか |
| `stages/<slug>/stage.json` の `praeforma` | ステージに対応する Praeforma のシーン |

すべて任意 (後方互換)。無い攻略本はそのまま `validate` を通る。

## 2. 取り込み `guide intent import --game <dir> --stage <slug> --from <ux.md> [--praeforma <scene-id>]`

Praeforma の UX 文書 (Markdown) から ID を読み、LLM が下書きした全ての意図項目に同じ `praeforma` を付ける。ID は **文書と CLI からだけ** 取り、LLM の返答に
`praeforma` があっても捨てる (原則 3: ID を LLM に決めさせない)。

文書が ID を書く形 (Praeforma 側の書き出しはこれに合わせる):

```markdown
---
scene_id: <scene-id>
spec_id: <spec-id>
project_code: <project-code>
---
<!-- praeforma:scene=<scene-id> -->   (front matter が無いときの代わり。種類ごとに最初の 1 つ)
<!-- praeforma:spec=<spec-id> -->
```

- front matter がマーカーより優先、`--praeforma` が文書のシーン ID より優先。どこにも無ければ `praeforma` を付けない。
- Praeforma の HTTP API は使わない (本段は Markdown だけで動く)。API から引く経路が要るときは `src/adapters/praeforma/` に閉じ、
  `PRAEFORMA_URL` と Origin を設定から読み、テストではフェイクにする (未実装。Praeforma が読み取り API を公開した時点で足す)。

## 3. Praeforma 側が読む JSON (公開契約)

| ファイル | 中身 | ID |
|---|---|---|
| `guide verify intent --json` の出力 (レポート) | `stages[]`: ステージごとの意図分類、ズレ、帯の要約、2 軸 | `stages[].praeforma` (ステージのシーン)、`stages[].intents[].praeforma` (意図のシーン / 仕様) |
| `feasibility/<stage-slug>.json` | 解法ごとの帯と標本、ペルソナ別の 2 軸と観測値 | `praeforma` (ステージのシーン) |
| `guide report feasibility --json` | 全ステージの `feasibility/*.json` の配列 | 各文書の `praeforma` |

scene_id からの対応:

- **意図ズレ分類**: `stages[].intents[]` のうち `praeforma.scene_id` が一致する項目の `classification` (`match` / `interesting` / `undesirable` /
  `impossible` / `not-reproduced` / `unverified`)、再現率の区間、`proof`。ズレ (`stages[].divergences[]`) は `intent` で意図に結ぶ。
- **帯**: そのシーンを持つステージの `feasibility` 文書の `solutions[]` (`band`、`evidence`、`unwalkable`)。`insufficient-evidence` / `not-observed` は
  分類ではなく実測状態として出すこと。
- **2 軸**: 同じ文書の `axes[]` (`breadth`、`confusion_depth`、`observed`)。「ペルソナモデル上の推定」であることを画面にも出すこと。

更新タイミング: `guide verify intent` を走らせたとき (coverage 実走・人間ログの取り込み後)。Commentarii は Praeforma へ書き込まない
(Praeforma が JSON を読みに来る)。

## 4. Praeforma へ持ち込む表示 PR の範囲 (Praeforma 側の別 run)

- シーン画面に「意図ズレ」(分類と件数、未許容の望ましくないズレ) と「帯」(解法ごとの帯と標本数・区間) を出す。
- 判定は Commentarii の JSON をそのまま表示し、Praeforma 側で分類を作り直さない。「良い / 悪い」の推奨文を足さない (設計 §8.5)。
- UX 文書の書き出しに §2 の front matter を付ける。

## 5. テスト (`tests/praeforma/praeforma-link.test.ts`)

- front matter / マーカー / `--praeforma` の優先順位、ID の形の検査、参照の無い文書。
- intent import が文書の参照を全項目に付け、LLM の返答の参照を捨てる。
- `praeforma` の無い intent が通り、形の崩れた参照 (空白入り・空) は schema で落ちる。
- `verify intent` のレポートにステージと意図の scene_id / spec_id が、feasibility 文書にステージの scene_id が載る (サンプルの ID は `sample-` で始まる架空の値)。
