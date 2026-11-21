# レベルデザイン評価器が読む攻略本の形式

Actio `actio:76e14970-0b9e-4c63-a116-8ba10668f6fa`。Ingenium のレベルデザイン設計 §19.1 に対応する SDK 0.6.0 の入力形式。

| 文書 | 任意欄 | 意味 |
|---|---|---|
| `stages/<slug>/stage.json` | `order` | ステージの順序を表す整数。省略時の並べ方は読み手が決める |
| 同上 | `introduces[]` | `action` (行動 ID) と `target_kind` (観測の `entities[].entity` に対応する攻略本の entity ID) の組 |
| 同上 | `teaches[]` | 同じ組と `method` (`demonstration`、`safe-trial`、`text`) |
| `intent/<slug>.json` | `intended[].hints[]` | `kind: teach` の項目に置く。`when` は観測に対する expr/2 の述語。`kind` は `rule` または `solution`、`target` は評価器が照合する対象の非空の識別子 |
| `manifest.json` | `level` | 任意の `profile` (`general`、`puzzle`、`strategy`、`action`) と `target_persona` (空でないプレイヤー像の説明) |
| replay header / `bench-result/1` | `curriculum.kind` / `compatibility.curriculum` | 初期知識の列挙に、ステージに応じて初期知識を変える `staged` を追加 |

`target_kind` は複数の観測個体に共通する種類を指す。観測の `instance` は使わない。V02 は組に含まれる行動と entity の参照を確認し、V12 は `when` を expr/2 として構文解析する。述語が真になるかと、`target` の照合は評価器が担当する。

ステージの宣言は player view と full export の両方に残る。`hints` は正本と full export で保持し、player view およびどのモードの判断器入力からも除く。既存の `teach.tactic` や intent-assisted 用の意図の項目は従来どおり扱う。`guide verify intent --accept` は `allowed_divergences` を更新するときもヒントを保持する。

新しく追加した欄を持たない文書には SDK 0.5.0 と同じ読み込み規則を適用する。bundle と replay の形式番号は 2、bench の形式は `bench-result/1` のまま。SDK 0.5.0 で同じ文書を読む必要がある場合は、今回の任意欄を付けず、0.5.0 が対応する初期知識を使う。
