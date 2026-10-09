# 段階 5K: Praeforma 連携 (意図とシーン・仕様の双方向リンク)

設計正本: `spec/architecture/design.md` §14.K、§8.3 (意図ズレ)、§9 (Praeforma は仕様の正本)、§11 の 5K 行。段階 1〜5 はマージ済み。使う既存部品: `intent/` スキーマと `intent import` (段階 1 / 2)、`verify intent` のレポート (段階 5)。5C (バランス回帰ゲート) は別 run が同時に進めるので `src/bench/`, `src/gate/` には触らない。本 run のコードは `src/verify/pf-*` と `src/adapters/praeforma/` に閉じる。Augur 契約 ID は **C-70 番台** (5C は C-60 番台)。

Praeforma 側 (別リポ、Pf) の表示実装は本段ではやらない。本段は Commentarii 側の **ID の保持・取り込み・レポートへの付与・公開契約** まで。

## 成果物

1. **スキーマ拡張**: `intent/<stage>.json` の各 `intended[]` と `allowed_divergences[]` に任意の `praeforma: { scene_id, spec_id, project_code }` を足す (`schema/intent.schema.json` の後方互換な拡張)。`stage.json` にも `praeforma.scene_id` を足せるようにする。
2. **取り込み** `guide intent import --from <Pf 文書> --praeforma <scene-id>`: 段階 2 の LLM 下書き経路に、Praeforma の UX 文書 (Markdown) からシーン ID と仕様 ID を抽出して付ける。Praeforma の API を叩く場合はアダプタ `src/adapters/praeforma/` に閉じ、テストではフェイクに差し替える (実呼び出しをテストに入れない。Praeforma のローカル API は Origin 必須・ドメイン必須なので、アダプタは `PRAEFORMA_URL` と Origin ヘッダを設定から読む。無ければ API を使わず Markdown だけから抽出する)。
3. **レポートへの付与**: `verify intent` の JSON レポートに、意図ごとの `praeforma` (scene_id / spec_id) を含める。`feasibility` と `report feasibility` の JSON にもステージの scene_id を含める。
4. **公開契約** `spec/feature/praeforma-link.md`: Praeforma 側が読む JSON の形 (レポートのパス、scene_id → 意図ズレ分類・帯・2 軸の対応)、更新タイミング、Praeforma へ持ち込む表示 PR の範囲 (Praeforma のシーン画面に「意図ズレ」「帯」を出す) を書く。実装は Praeforma 側の別 run。
5. **フィクスチャ**: samples/bestia の intent に `praeforma` を付け、レポートに出ることを確認する。Praeforma の Markdown 断片のフィクスチャ (scene_id の抽出)。
6. `spec/domains/*.domain.json` に `src/adapters/praeforma/` の所属を足す (`(^|/)` 形式)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- `praeforma` 無しの既存バンドルがそのまま validate を通る (後方互換、テスト)。
- `verify intent` / `report feasibility` の JSON に scene_id が載る (テスト)。
- Praeforma API 設定が無いときは Markdown だけで動く (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-5k-praeforma-link`)。`main` を直接編集しない。
- 5C run と同時進行。共有ファイル (`src/cli/*`, `augur.contracts.json`, `schema/intent.schema.json`) への変更は自分の分の最小行に留める。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
