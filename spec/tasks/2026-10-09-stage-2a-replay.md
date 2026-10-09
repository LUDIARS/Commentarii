# 段階 2A: リプレイ記録と再生

設計正本: `spec/architecture/design.md` §7.2 (Observation スキーマ)、§7.5 (1 ティック)、§14.A (リプレイ)、§11 の 2A 行。段階 1 はマージ済み (`src/` の責務分担に従う)。段階 2 (import) と 2B (監査) は別 run が同時に進めるので `src/import/`, `src/audit/` には触らない。本 run のコードは `src/replay/` と `src/adapters/fs/replay-*` に閉じる。

判断エンジン (Utility / BT) は段階 3 で作る。本段では **記録形式・再生器・差分器・決定性テストの枠** を作り、エンジンは「観測を受けて行動を返す関数」のインターフェース (`src/replay/decider.ts` の型) として抽象化する。固定の最小 decider (常に `wait` を返す / 記録された行動をそのまま返す) をテスト用に同梱する。

## 成果物

1. **記録形式** `replay/<run-id>.jsonl` (スキーマ `schema/replay.schema.json`):
   - 先頭行 `header`: `run_id`, `seed`, `game_id`, `manifest_version`, `adapter_id`, `mode` (player|omniscient), `purpose` (efficiency|coverage), `persona` (任意), `started_at`。
   - 以後 1 ティック 1 行: `tick`, `t`, `observation` (段階 1 の `observation.schema.json` ではなく §7.2 の完全な Observation。必要なら `schema/observation-frame.schema.json` を新設して段階 1 の 1 行形式と区別する), `decision` (候補ごとの効用値の配列 `{candidate, utility, chosen}`、段階 3 までは空配列可), `action`。
   - 末尾行 `footer`: `ended_at`, `result` (success|fail|abort), `summary`。
2. **記録器** `RecordingSink`: 任意の decider を包み、観測・判断・行動を追記する。`player` モードの記録に `knowledge: masked` の値が含まれていたら記録時に失敗する (原則 2 の担保。テストあり)。
3. **`guide replay play <run.jsonl> [--until <tick>] [--decider <id>]`**: 記録した観測列を decider に流し、記録された行動と一致するかを検証する (決定性テスト)。不一致の最初のティックを報告。
4. **`guide replay diff <a.jsonl> <b.jsonl>`**: 判断が分岐した最初のティックと、その時の候補ごとの効用値の差、以後の行動列の差分 (件数と先頭 N 件) を JSON と Markdown で出す。
5. **フィクスチャ**: `tests/fixtures/replay/` に Bestia サンプルの手書き短い run (10 ティック程度) を 2 本 (同一と分岐) 置き、play / diff のテストに使う。
6. **仕様**: `spec/feature/replay.md` (形式・不変条件・コマンド)。`spec/domains/*.domain.json` に `src/replay/` の所属を足す。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- 記録 → play で一致、分岐フィクスチャで diff が最初の分岐ティックを正しく報告する (テスト)。
- `player` モードの記録に masked 値を入れると記録器が拒否する (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/stage-2a-replay`)。`main` を直接編集しない。
- `src/cli/parse-command.ts` 等の共有ファイルへの変更は、自分のサブコマンド登録の最小行に留める (他 run と衝突させない)。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
