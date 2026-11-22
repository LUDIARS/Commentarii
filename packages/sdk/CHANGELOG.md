# Commentarii SDK 変更履歴

## 0.7.0

- `intent/1` の route と teach に、課題の解法・腕前・スタイル、判断点の選択肢数、乱数源、手触り、開示を記録する任意の `level` 欄を追加。player view では除く。
- `observations/divergences.json` に評価レポート由来の食い違いと課題・対象 ID を追加。`observations/approvals.json` は `level-design:` の提案を受け付ける。
- `level-principles/1` の写しを出典とともに同梱。旧文書は引き続き読み込める。

## 0.6.0

- ステージに `order`、`introduces`、`teaches` を追加。manifest に `level.profile` と `level.target_persona` を追加。
- `intent/1` の `teach` に評価器用の `hints` を追加。正本と full export が保持し、player view と判断器の入力から除く。
- replay と `bench-result/1` の初期知識に `staged` を追加。
- 文書の新しい欄は任意。既存の SDK 0.5.0 文書は引き続き読み込める。

0.5.0 以前はリポジトリの `COMPAT.md` を参照。
