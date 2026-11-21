# 非公開タイトルの登録 (ゲームリポに書けないとき)

設計正本: `spec/architecture/design.md` §4.2 (バンドルは各ゲームリポの `guide/<game-id>/`)。Actio: `actio:6fa8ca3d-a884-4d2b-8de2-b45ea7b28c43`。

## 1. 置き場所の規則

通常のバンドルはゲームリポの `guide/<game-id>/` に置く。次のどちらかに当たるタイトルは、このリポにもゲームリポにも置かず、ワークスペースの git 管理外に置く。

- ゲームリポが他の作業者の checkout で使用中、または読み取り専用で、`guide/` を足せない。
- タイトルが非公開 (このリポは公開前提なので、ゲーム固有の値を含めてはならない)。

```text
<workspace>/.commentarii/games/<game-id>/
├── guide/      # バンドル本体 (manifest.json から。設計 §4.2 の構成そのまま)
├── render/     # `guide render` の出力 (再生成物。手で直さない)
└── README.md   # 出典・カバレッジ・未達の一覧 (人間向け)
```

- `<workspace>` 直下は `.gitignore` が既定で全てを無視するので、置いただけでは追跡されない (`git check-ignore` で確認する)。
- 各値の `source.ref` は元のゲーム仕様書の相対パスで書く (マスタ値の取り込みと同じ書式)。ゲームリポの内容を外部サービスへ送らない。
- 後でゲームリポに `guide/<game-id>/` を足せるようになったら、ディレクトリごと移す (ID は `<kind>:<game-id>:<slug>` でパス非依存)。

## 2. 登録の手順

1. `game_id` (slug) を決め、`guide/manifest.json` を書く (`observation.fields` はプレイヤーが画面で見られる値だけ、`origin` に画面と仕様書を書く)。
2. 仕様書から数式・数値を拾って `mechanics/rules/` と `entities/` に入れる。**プレイヤーに見えない値 (抽選の比重、内部確率など) は `knowledge: masked` で `.masked.json` に分け**、rule と定石には入れない。
3. 定石は `draft: true`・`confidence: authored` から始め、参照先 (`because`) の最も厳しい knowledge に揃える (V10)。
4. `node dist/cli/main.js validate <guide>` が全項目 OK になること。式は四則と `min max floor ceil abs clamp` だけ (`round` / `pow` / `exp` は使えない。指数部などは変数に切り出す)。
5. `render` (player) の出力に masked の値が無いことを確認する。

## 3. オートプレイヤー (Ingenium) へ向ける

- `ingenium run / bench --game <guide-dir>` はバンドルのディレクトリをそのまま読む。Commentarii 側の設定は不要。
- 実際に動かすにはゲームアダプタ (stdio / render-tap のどちらか。ゲーム側の実装) が要る。アダプタが無いタイトルは、バンドルを読んで検査・描画するところまでで止まる。
- ルールブック (`mechanics/variables.json` / `actions/` / `objectives.json`) と行動語彙はゲーム固有で、Ingenium のタイトル別テンプレート側で作るので、本段の初版 (rules / entities / tactics / glossary) には含めない。
