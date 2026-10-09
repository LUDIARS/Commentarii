# 段階 6P: Pictor フレームタップ (Pictor リポ側)

対象リポ: `E:/Document/Ars/Pictor` (Pc、public、C++、CI は GCC)。設計正本は Commentarii の `E:/Document/Ars/Commentarii/spec/architecture/design.md` §7.1 (段 2 の仕組み) と、Commentarii 段階 6 が定める契約 `E:/Document/Ars/Commentarii/spec/feature/render-tap-contract.md` + `schema/render-frame.schema.json`。契約がまだ main に無い場合は、段階 6 の依頼文 `E:/Document/Ars/Commentarii/spec/tasks/2026-10-09-stage-6-render-tap-receiver.md` の「1. 描画リストの契約」を仕様として読む (同じ内容)。

## 補正 (Astra レビュー P0-2 / P1-7、2026-10-09)

契約は Commentarii に **確定済み** (`spec/feature/render-tap-contract.md` = `render-tap/1`、`schema/render-frame.schema.json`、golden
`tests/fixtures/render-tap/golden-v1.jsonl`)。本文の出力内容より契約が優先する。追加で必須の項目:

- 行ごとに `contract: "render-tap/1"` と `seq` (捨てたフレームも数える)、`observer {id, viewport}` (プレイヤーのカメラは `player-camera`)、
  任意 `tick`、遮蔽クエリ結果が何フレーム前か (`visibility_lag_frames`)、記録しきれなかった draw の `dropped`、終了時の end 行。
- draw ごとに `identity` (`asset-name` / `content-hash` / `count-hash`)、`generation` (ハンドル再利用で +1)、`visibility`
  (`occlusion-passed` / `occlusion-failed` / `frustum-only` / `unknown`。GPU を待たずに取れる範囲。取れなければ `frustum-only` か `unknown`)、
  `alpha`、ui pass では `clip` と `ui` (`bar` の fill / `glyph` の文字)。pass の `kind` は `scene` / `ui` / `shadow` / `reflection` / `depth-prepass` / `postprocess` / `other`。
- アセット名が取れない draw は内容ハッシュ (`content-hash`) を優先する。頂点数 + インデックス数の指紋は `count-hash` とし、Commentarii 側では識別に使われない。
- テストは golden と同じ形の行を出すこと (Commentarii の `schema/render-frame.schema.json` で検証できる形)。

## 目的

Pictor がコマンドバッファを組む場所に「フレームタップ」を 1 つ足し、フレームごとの描画リストを構造化データで外へ出す。画素の読み戻し (readback) をしない。既定は OFF で、フレームレートに影響しない。

## 成果物

1. **タップの API** (Pictor の既存の責務分担と命名規約に従う): 有効化 / 無効化、出力先 (stdout の JSON Lines、またはファイル追記、または呼び出し側のコールバック)。環境変数か起動オプションで有効化できること (`PICTOR_FRAME_TAP=stdout|<path>` 等、Pictor の慣例に合わせる)。
2. **出力内容** (契約どおり): 1 フレーム 1 行。`frame`, `t`, カメラ (view / projection)、`pass` ごとの draw 配列 (`scene` / `ui` を区別、ポストプロセス pass は含めない)、draw ごとに `mesh` / `material[]` / `instance` / `world` / `screen_bbox` / `depth_order` / `tags[]`。
   - `mesh` / `material` の ID はアセット名由来の安定した文字列 (ハンドル番号ではない)。アセット名が取れない draw は指紋 (頂点数 + インデックス数のハッシュ) で代用し、`tags` に `unnamed` を付ける。
   - `screen_bbox` は world の AABB を投影して求める (頂点全走査はしない)。
   - 文字列組み立ては依存ライブラリを足さない (Pictor に既に JSON 出力の仕組みがあればそれを使う)。
3. **コスト**: タップ OFF 時は分岐 1 つ以外のコストが無いこと。ON 時も GPU 同期を増やさない (CPU 側の記録だけ)。
4. **テスト**: Pictor のテスト慣例に従い、固定シーン (メッシュ 2 つ + UI 矩形 1 つ) でタップ出力が契約どおりの行になること。GCC で通ること (MSVC だけで緑にしない)。
5. **文書**: Pictor の spec / README にタップの節を足す (有効化方法、出力形式、Commentarii の契約への参照)。

## 受入条件

- Pictor の既存ビルドとテストが通る (GCC)。タップ OFF で挙動が変わらない。
- 固定シーンの出力が `schema/render-frame.schema.json` に適合する (Commentarii 側で `node` の簡易検証を走らせるか、JSON の形をテストで確認)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/frame-tap`)。Pictor の `main` を直接編集しない。ヘッダ変更後はクリーンビルド。
- Pictor は public: 秘匿語・private ゲームの固有名を入れない。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree> --project Pc`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
