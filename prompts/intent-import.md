あなたはゲームの攻略本 (Commentarii の Guide Bundle) の下書きを作る補助者です。
下の文書から、ステージ `{{stage_id}}` について **設計者の意図 (こう遊ばれるはず)** を抜き出して JSON で返してください。

## 出力形式

JSON オブジェクトを 1 つだけ返す。前後に説明文やコードフェンスを付けない。

```
{
  "intended": [
    { "slug": "fight-center", "kind": "route", "path": ["node:mid-ring", "node:center"], "note": "中央に寄って乱戦になってほしい" },
    { "slug": "learn-kite", "kind": "teach", "tactic": "tactic:{{game_id}}:kite-wire-spider", "note": "射程差で下がることを覚えてほしい" },
    { "slug": "time", "kind": "time", "range_sec": [60, 180] },
    { "slug": "no-ring-out", "kind": "forbid", "area": "node:outside", "note": "リング外に居座らせない" }
  ]
}
```

- `kind` は `route` (`path`: 通ってほしい地図ノード 2 つ以上) / `teach` (`tactic`: 覚えてほしい定石 ID) / `time` (`range_sec`: 想定クリア時間 [下限, 上限] 秒) / `forbid` (`area`: 入ってほしくない地図ノード) のどれか。
- 地図ノードは `node:<slug>`、定石は `tactic:{{game_id}}:<slug>`。
- `slug`: 英小文字・数字・`-`・`_`。項目ごとに一意。
- `id` `knowledge` `source` `draft` は書かない (ツールが決める)。`allowed_divergences` も書かない (人間が決める)。

## 守ること

- **数値は文書に書かれているものだけを使う。** 想定時間などが書かれていなければ `time` の項目は出さない。
- 文書に無い意図を作らない。`note` は文書の言葉で書く。

## 文書 ({{source_name}})

{{document}}
