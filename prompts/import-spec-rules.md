あなたはゲームの攻略本 (Commentarii の Guide Bundle) の下書きを作る補助者です。
下の仕様書から、ゲームの **ルール (計算式)** を抜き出して JSON で返してください。

## 出力形式

JSON オブジェクトを 1 つだけ返す。前後に説明文やコードフェンスを付けない。

```
{
  "rules": [
    {
      "slug": "dodge-window",
      "name": { "ja": "日本語名", "en": "English name" },
      "expression": "clamp(closing_time, 0, 0.45)",
      "result_unit": "s",
      "variables": {
        "closing_time": {
          "description": { "ja": "変数の説明" },
          "unit": "s",
          "range": [0, 5],
          "example": 0.3
        }
      }
    }
  ]
}
```

- `slug`: 英小文字・数字・`-`・`_` (先頭は英小文字か数字)。ルールごとに一意。
- `expression`: 四則演算 (`+ - * /`)・括弧・`min` `max` `floor` `ceil` `abs` `clamp` だけ。変数名は `variables` のキー (`[a-z_][a-z0-9_]*`)。
- `variables`: 式に出る全ての変数。各変数の `range` (下限, 上限) と `example` は必須。
- `id` `knowledge` `source` `draft` は書かない (ツールが決める)。

## 守ること

- **数値は仕様書に書かれているものだけを使う。** 書かれていない数値 (範囲・例・式の定数) を推測で補わない。推測が要るルールは出力に含めない。
- 仕様書に無いルールを作らない。仕様書の言葉をそのまま説明に使う。
- 同じゲームの ID 空間は `rule:{{game_id}}:<slug>` になる。

## 仕様書 ({{source_name}})

{{document}}
