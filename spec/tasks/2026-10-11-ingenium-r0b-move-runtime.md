# Ingenium R0-B: 実行側を Commentarii から Ingenium へ移す

設計正本: `spec/plan/2026-10-11-ingenium-integrated-design.md` (§4 境界、§5 の R0)。移管ファイルの対応表は `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §10.3 (段階 1〜2) を正本にし、アダプタのプロトコル定義 (`src/adapter/**`、JSON Lines、C++ ヘッダ) は Ingenium 所有とする (統合設計 §2)。前提: R0-A (Commentarii の `packages/sdk` = `@ludiars/commentarii-sdk` の切り出し) がマージ済みで、タグ `sdk-v0.1.0` が打たれていること。段 6 (描画タップ受信) の扱いは親が先に決める。

本段は 2 リポにまたがるので、**PR を 2 本** 出す (Ingenium 側 1 本、Commentarii 側 1 本)。Ingenium 側を先にマージし、Commentarii 側は Ingenium の版が出てから。

## 成果物

### Ingenium (`E:/Document/Ars/Ingenium`, private)

1. Fable 案 §10.3 の「Ls 行」のファイル (判断エンジン `src/engine/**` の実行側、`src/adapter/**`、`src/adapters/{sim,stdio}/**`、`adapter/cpp/**`、replay の実行側 (decider / registry / recorded / wait / recording-sink / play / diff / format / command)、`src/bench/**`、`src/gate/**`、`src/autoplay/**`、ペルソナ (`personas/**`、`schema/persona.schema.json`)、fs アダプタの実行側、対応する `tests/**`、`spec/feature/{engine,adapter-protocol,balance-gate}.md` と `replay.md` の実行側) を移す。履歴は `git filter-repo` か `subtree split` で切り出して持ち込んでよい (できなければ通常のコピーで、移管元 commit を PR 説明に書く)。
2. `@ludiars/commentarii-sdk` を `github:LUDIARS/Commentarii#sdk-v0.1.0` (`packages/sdk`) の git タグ依存で読む。Commentarii の内部パスを import しない (検査テスト 1 本)。
3. CLI `ingenium` (`run` / `bench` / `gate` / `replay play|diff` / `adapters`)。引数・stdout プロトコル・終了コードは現行の `guide run / bench / gate / replay` と同じ。
4. リプレイの header の `engine` を `{name: "ingenium", version}` にし、`sdk_version` / `bundle_format` / `bundle_hash` / `stance` を記録する。既定の構えは `guided` のまま (自律構えは R2。`autonomous` 既定化は R2 の受入で行う)。
5. Augur 契約は Ingenium 側で `L-` ではなく `IG-` 接頭の ID に振り直す (ID 空間を Commentarii と分ける)。
6. `spec/domains/` に移したディレクトリのドメイン (pathPattern は `(^|/)` 形式)。Anatomia への登録。
7. `COMPAT.md` の Ingenium 列を埋める PR は Commentarii 側に含める。

### Commentarii

8. 移した実行側を `src/` から削除。`guide run / bench / gate / replay play|diff` は **1 版だけ** 委譲として残す: `ingenium` が PATH にあれば引数をそのまま渡し、無ければ「Ingenium に移った」と出して終了コード 2。
9. README・`spec/architecture/design.md` §7 / §14.A・C・E・F の冒頭に「実装は Ingenium」と所在を書く。`COMPAT.md` に Ingenium 0.2.0 の行。

## 受入条件

- 両リポで `npm install --include=dev && npm run typecheck && npm test` が通る。
- **同じ seed・同じ bundle で、移管前 (Commentarii の現行 main) と移管後 (Ingenium) の判断ログが一致する** (`guided` 構え、`tests/fixtures/replay/*.jsonl` と sim の固定 seed run で比較するテスト)。
- Ingenium から Commentarii の内部パスへの import が 0 件。
- 既存の bench 基準値は比較可能性キーで「比較不能」になるので、Ingenium で `guided` の基準値を取り直し、旧基準値と同 seed で判断ログが一致することを 1 回示す (PR 説明に記録)。
- PR 説明に: 変更した境界 / 復旧方法 (Commentarii 側は委譲を外して旧実装を戻す revert 1 本で戻ること) / 実施した検証 / 未実施。

## 作業の進め方・注意

- 作業場所は親が渡した worktree とブランチ。`main` を直接編集しない。
- サービスの起動はしない (CLI と単体テストだけ)。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = 2 本の Revisor local PR 提出 → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。
