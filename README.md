# Commentarii (Cm)

攻略本ツクール + 汎用オートプレイヤー。

- **攻略本 (Guide Bundle)**: ゲーム 1 本分の構造化知識 (敵・アイテム・スキル・ステージ地図・ルール・状態機械・定石)。JSON が機械正本、人間向け Markdown はツクールが生成する。
- **攻略本ツクール (Guide Maker)**: 取り込み・検証・描画・書き出し・学習結果の統合を行う CLI と Web 編集画面。
- **オートプレイヤー (Auto Player)**: Utility AI で定石を選び、Behavior Tree で手順を実行し、観測との差分を攻略本へ戻す。ゲーム差はゲームアダプタに閉じ込める。

設計正本: [spec/architecture/design.md](spec/architecture/design.md)

攻略本バンドルは各ゲームリポの `guide/<game-id>/` に置く。このリポはゲーム固有情報を持たない。