# バランス回帰ゲート (段階 5C)

> **実装は Ingenium (`LUDIARS/Ingenium`、private、`E:/Document/Ars/Ingenium`)** (R0-B、2026-10-11)。

bench の実行・保存 (`ingenium bench --save`)・比較 (`bench compare`)・判断回帰 (`bench replay`)・ゲート (`gate balance`) は Ingenium。`bench-result.schema.json` は Commentarii SDK。coverage bench の divergences は `guide verify intent --json` の出力を Ingenium の `--intent-report` に渡す。移管前の基準値は比較キー (stance / decider / engine_version / sdk_version、SDK 0.2.0) を持たないので Ingenium の結果とは比較不能で、`guided` の基準値は Ingenium で取り直した。

- 実装の正本: Ingenium `spec/feature/balance-gate.md`
- 移管元 (この文書の最後の全文): Commentarii `10244822e83f2095ed5ea9d90dedeb2ffbc10d63` の `spec/feature/balance-gate.md`
