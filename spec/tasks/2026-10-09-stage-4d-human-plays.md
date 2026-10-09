# 段階 4D: 人間プレイログの取り込み

設計正本: `spec/architecture/design.md` §14.D (人間プレイログ)、§7.2 (Observation)、§8.2〜8.3 (学習と意図ズレ)、§10 (秘匿)、§11 の 4D 行。段階 1〜3 はマージ済み。段階 4 (学習ループ、`src/learn/`、`src/engine/reflect/`、`observations/overlay.json`) は別 run が同時に進めるので、それらのディレクトリとファイルには触らない。本 run のコードは `src/import/plays/` と `src/adapters/fs/plays-*` に閉じる。

## 目的

ゲームのテレメトリ (人間の実プレイ) を Observation 形式に変換して攻略本のオーバーレイ側に置き、(1) 人間が見つけた別解を `learned` 定石の候補源に、(2) 意図ズレ検証で人間 vs オートプレイヤーを並べられるようにする。

## 成果物

1. **`guide import plays --game <bundle-dir> --from <path> --map <mapping.json> [--player-salt <secret-from-env>]`**
   - 入力: テレメトリの JSONL / CSV / JSON 配列。mapping (スキーマ `schema/plays-mapping.schema.json`) で、列 → `tick` / `t` / `self` / `entities[]` / `stage` / `events[]` / 行動 の対応と、ゲーム内の識別子 → 攻略本 ID の対応 (段階 2 の masters mapping と同じ `identify` 表を再利用できること) を宣言する。
   - 出力: `observations/human/<player-hash>/<run-id>.jsonl` (段階 2A のリプレイ形式を使う。header に `source: "human"`、`mode: "player"`、`purpose: "human"` を入れる。`purpose` の語彙に `human` を足す場合は `schema/replay.schema.json` の enum を広げる)。
   - **匿名化**: プレイヤー識別子は `--player-salt` (環境変数 `COMMENTARII_PLAYER_SALT` から。無ければ失敗) との HMAC-SHA256 の先頭 16 桁だけを使う。名前・メール・端末 ID・IP・生の識別子は出力に入れない (テストで文字列検索)。固有名を含みうる自由記述列は mapping で明示的に許可しない限り捨てる。
   - 人間の観測に masked 値が混ざるのは mapping の誤りなので、`find-masked-pointers` で検査して失敗にする。
2. **別解候補の抽出** `src/import/plays/extract-candidates.ts`: 人間 run の行動列をステージ・状況 (`when` に相当する観測の述語) でまとめ、既存の定石と一致しない行動列を `learned` 定石候補 (`confidence: learned`、`source.kind: human`、`draft: true`) として `observations/human/candidates.json` に出す。正本には書かない (採否は段階 4 の consolidate か人間)。
3. **比較の材料**: `guide report plays --game <bundle-dir>`: ステージ別に、人間 run とオートプレイヤー run (`observations/runs/`) の到達率・時間・経路 (地図ノード列) を並べた JSON と Markdown。グラフ描画は段階 5H に任せ、ここは数表まで。
4. **フィクスチャ**: samples/bestia 向けの架空テレメトリ (固有名を含む列を入れて、捨てられることを確認する)、mapping、期待出力。
5. **仕様**: `spec/feature/human-plays.md` (入力形式、mapping、匿名化規則、候補抽出の規則)。`spec/domains/*.domain.json` に `src/import/plays/` の所属を足す (`(^|/)` 形式)。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- 出力のどこにも生の識別子・固有名が無く、同じ識別子 + 同じ salt は同じハッシュになる (テスト)。salt 無しは失敗 (テスト)。
- 既存定石と一致しない行動列だけが候補になる (テスト)。
- masked が混ざった mapping は失敗する (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-4d-human-plays`)。`main` を直接編集しない。
- 段階 4 run と同時進行。**共有ファイル** (`src/cli/parse-command.ts`, `src/cli/run-cli.ts`, `src/cli/cli-io.ts`, `src/cli/main.ts`, `augur.contracts.json`) への追加は自分の分の最小行に留め、Augur 契約 ID は **C-40 番台** を使う (段階 4 は C-30 番台)。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
- 不明点は推測で埋めず、報告に「仮定」として書く。

## 実装記録 (段階 4D run)

仕様は `spec/feature/human-plays.md`。受け入れ条件は Augur 契約 C-40〜C-43。

### 変更した境界

- 新規: `src/import/plays/` (取り込み・匿名化・identify・候補抽出・report)、`src/adapters/fs/plays-read-runs.ts`、`schema/plays-mapping.schema.json`、`schema/human-candidates.schema.json`、`src/contracts/*` の C-40〜C-43、`tests/import/plays/`、`tests/fixtures/plays/`。
- 語彙の拡張 (後方互換): リプレイ / 観測の `purpose` に `human`、観測の `source` に `telemetry`、header に任意の `source: "human"`。既存の run はそのまま読める。
- 共有ファイルは最小行: `src/cli/{parse-command,run-cli,cli-io,main}.ts` (コマンドの振り分けと `playsIo` ポート)、`augur.contracts.json` (C-40〜C-43 の追加のみ)、`src/schema/schema-names.ts` (スキーマ 2 件の登録)、`src/adapters/fs/replay-open-file.ts` (`replaySchema` を export)。
- `src/learn/`・`src/engine/reflect/`・`observations/overlay.json` には触れていない。エンジンからは `matchCondition` と `hpRatio` を読み取り専用で再利用した。

### 復旧方法

段階 4D のコミットを revert すれば元に戻る。取り込みが書くのはバンドルの `observations/human/` だけなので、取り込み結果を消すにはそのディレクトリを削除する (正本は変わらない)。

### 実施した検証

- `npm install --include=dev && npm run typecheck && npm test`: 245 件すべて成功。
- `npm run build` 後の実 CLI (`dist/cli/main.js`) で、salt 無しの失敗、JSONL 取り込み、`report plays`、`run --record` したオートプレイヤー run との並置、取り込み後の `validate` (OK) を一時ディレクトリで確認。
- `augur contracts report --acceptance`: C-1〜C-22・C-40〜C-43 すべて covered・違反 0。

### 未実施

- 実ゲームのテレメトリでの取り込み (フィクスチャは架空)。サービスの起動・起動テスト (常駐サービスの変更なし)。
- 人間の観測を昇格根拠に使うかの manifest 設定 (§14.D) は段階 4 の consolidate 側の判断として残した。
