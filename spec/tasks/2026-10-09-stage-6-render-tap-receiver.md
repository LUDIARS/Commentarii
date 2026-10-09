# 段階 6: 描画命令タップの受信・正規化・render_signature 照合 (Commentarii 側) + 6F 敵 AI としての再利用

設計正本: `spec/architecture/design.md` §7.1 (観測経路 3 段、段 2 の仕組み)、§7.2 (Observation)、§7.3 (アダプタ契約)、§14.F (敵 AI)、§11 の段 6 / 6F。段階 1〜5 はマージ済み。使う既存部品: アダプタ契約と JSON Lines プロトコル (`spec/feature/adapter-protocol.md`、段階 3)、`render_signature` (段階 1 のスキーマ)、sim アダプタ (段階 3)。Pictor 側のフレームタップと Bestia 側の実機アダプタは別 run (別リポ) が同時に進める。本 run のコードは `src/adapters/render-tap/` と `src/engine/enemy/` に閉じる。Augur 契約 ID は **C-80 番台**。

## 補正 (Astra レビュー P0-2 / P1-7、2026-10-09、`feat/astra-review-completion` で確定)

本文より次が優先する。

- 描画リストの契約は **確定済み**: `spec/feature/render-tap-contract.md` (`render-tap/1`)、`schema/render-frame.schema.json`、golden
  `tests/fixtures/render-tap/golden-v1.jsonl`。行列は列優先、画面は左上原点、`seq` / `frame` / `t` / `tick`、`instance` + `generation`、
  可視性の根拠、`alpha` / `clip` / `ui` (bar / glyph)、`identity` (count-hash は識別不能)、`dropped` と end 行を含む。成果物 1 は作り直さない。
- raw tap ≠ player 観測。受信アダプタは `src/render-tap/select-player-draws.ts` (`selectPlayerDraws`) の結果だけから Observation を組む
  (遮蔽・透明・clip 外・非表示 UI・影 / 反射 pass・同じ外見の別種・アセット ID を観測に入れない)。根拠の無い draw は `unknown` で入れない。
- 観測経路の CLI は `--frames <frames.jsonl|pipe>`。既存の `--observe` は reflect の出力先なので **変えない**
  (`guide run --adapter render-tap --frames <...> --act stdio|none`)。
- 観測に置く値は `spec/feature/observation-boundary.md` の許可表に従う (UI から読んだ値のうち `self.hp` 以外は manifest `observation.fields` に宣言)。
- 受入の負例に「壁の裏の敵」「同じ外見の別種」「非表示 UI」「影・反射」を必ず含める。sim 2 体や型検査だけで実証済みにしない
  (最終受入は実物 tap → 判断 → 入力 → 次フレーム)。

## 成果物

1. **描画リストの契約** `spec/feature/render-tap-contract.md` + `schema/render-frame.schema.json`: Pictor 側が出すフレームごとの描画リストの形を Commentarii が定める (Pictor 側はこれに合わせる)。
   - 1 フレーム 1 行 (JSON Lines): `frame`, `t`, `pass` ごとの配列 (`scene` / `ui` を区別、ポストプロセスは含めない)、draw ごとに `mesh` / `material[]` / `instance` / `world` (4x4 または位置+回転+スケール) / `screen_bbox` [x, y, w, h] / `depth_order` / `tags[]` (任意)。カメラ (view / projection) を 1 フレーム 1 回。
   - 出力経路: stdout の JSON Lines か名前付きパイプ / ファイル追記。画素の読み戻しはしない。
   - ID の安定性: mesh / material の ID はアセット名由来で、ビルド間で安定していること。
2. **受信アダプタ** `src/adapters/render-tap/`: 描画リストを読み、`render_signature` で entity に引き (`bundle.json` の逆引き索引を使う)、§7.2 の Observation (`source: "render-tap"`) に正規化する。
   - 位置: world 変換から world 座標、`screen_bbox` から画面座標の両方。地図照合は world。
   - 状態推定: 同じ instance の連続フレームから速度と、状態機械の遷移条件に合う `state_guess` を出す (確度つき)。
   - UI pass: `glossary` のグリフ表と UI 対応表で HP バー・数字・残り時間を読む (無いものは「不明」)。
   - masked 値は構造上入りようがないが、`find-masked-pointers` の検査は通す。
   - 攻略本に無い署名は `unknown-entity` 観測として出す (段階 4 の reflect が雛形を起こす)。
3. **行動の送り先**: 描画タップは観測だけなので、行動は別経路 (stdio アダプタの `action` 行、またはゲームが用意する入力注入) に送る。`guide run --adapter render-tap --frames <frames.jsonl|pipe> --act stdio|none` の形で (補正: `--observe` は reflect の出力先のまま)、観測経路と行動経路を別々に指定できるようにする。
4. **6F 敵 AI としての再利用** `src/engine/enemy/`: 同じ `utility-bt` エンジンを敵個体の脳として動かすための視点切替。アダプタの `self` を敵個体に、`entities[]` にプレイヤーを含める。敵用の定石は攻略本の `actors/` 視点 (または別バンドル) から引く。`player` モードを既定にし、全知の敵は `omniscient` と明示。sim アダプタで敵 2 体 + プレイヤー 1 (汎用行動) を動かし、Bestia の固定 BT と同等の振る舞い (Return / Dodge / Retreat / Attack / Chase 相当の定石 5 本) をデータで再現するテストを書く。
5. **フィクスチャ**: samples/bestia 向けの手書き描画リスト (20 フレーム程度、敵 2 体、UI の HP バー、未知の署名 1 つ)、期待 Observation。
6. `spec/domains/*.domain.json` に `src/adapters/render-tap/`, `src/engine/enemy/` の所属を足す (`(^|/)` 形式)。README に観測経路の節を足す。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- フィクスチャの描画リストから、署名で entity が引け、world / 画面座標の両方が出て、未知の署名が `unknown-entity` になる (テスト)。
- UI pass から HP バーの値が読める (テスト)。
- 敵 AI の視点切替で、sim 上の敵が定石 5 本で Bestia の固定 BT と同じ分岐をする (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-6-render-tap`)。`main` を直接編集しない。
- 共有ファイル (`src/cli/*`, `augur.contracts.json`) への追加は自分の分の最小行に留める。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
