# リプレイ記録と再生 (段階 2A)

設計正本: `spec/architecture/design.md` §7.2 (Observation)、§7.5 (1 ティック)、§14.A (リプレイ)。
依頼文: `spec/tasks/2026-10-09-stage-2a-replay.md`。実装は `src/replay/` と `src/adapters/fs/replay-*.ts`、テストは `tests/replay/`、
フィクスチャは `tests/fixtures/replay/`。

判断エンジン (Utility / BT) は段階 3 で作る。本段は記録形式・記録器・再生器・差分器と、エンジンを受ける型
(`src/replay/decider.ts` の `Decider`: 観測 → 判断ログ + 行動) を用意する。段階 3 以降のエンジンのテストはリプレイを正本にする。

## 1. 記録形式 `replay/<run-id>.jsonl`

- ファイル名は run ID (`run:<slug>`) の `run:` を落としたもの (`replay/<slug>.jsonl`)。Windows のファイル名に `:` が使えないため。
- UTF-8、1 行 1 JSON、改行は LF (読み込みは CRLF と末尾改行なしも受ける)。各行はスキーマ `schema/replay.schema.json` に適合する。
- 観測ログと同じく、固有名・パスを入れない (ID と数値のみ、設計 §10)。

| 行 | `type` | 必須フィールド | 任意 |
|---|---|---|---|
| 先頭 1 行 | `header` | `run_id`, `seed` (非負整数か文字列), `game_id`, `manifest_version`, `adapter_id`, `mode` (`player` / `omniscient`), `purpose` (`efficiency` / `coverage` / `human`), `started_at` (ISO 8601) | `persona`, `source` (`human`: `guide import plays` が取り込んだ人間のプレイ、`spec/feature/human-plays.md`) |
| 以後 1 ティック 1 行 | `tick` | `tick`, `t`, `observation`, `decision`, `action` | |
| 末尾 1 行 | `footer` | `ended_at`, `result` (`success` / `fail` / `abort`), `summary` (オブジェクト) | |

- `observation` は §7.2 の完全な Observation (`schema/observation-frame.schema.json`)。段階 1 の `schema/observation.schema.json`
  はオーバーレイ (`observations/runs/*.jsonl`、reflect の結論 1 行) で別物。値の `knowledge` 付きの観測値は `{value, knowledge}`
  (出典は run 自体なので `source` を持たない)。ゲーム固有の観測は `extra` に置く。
- `decision` は判断ログ: 候補ごとの `{candidate, utility, chosen}`。段階 3 までは空配列可。
- `action` は抽象アクション (§7.3): `move_to` / `attack` / `use_item` / `use_skill` / `wait` / `interact` / `custom` のちょうど 1 つ
  (+ 任意の `target`, `params`)。被演算子は ID・インスタンス番号・座標、`wait` は秒 (0 = 1 ティック)。

## 2. 不変条件

スキーマに加え、読み込み (`parseReplay`) と記録器 (`RecordingSink`) が同じ検査 (`src/replay/tick-invariants.ts`) を使う。
したがって記録器が書いたファイルは必ず読め、読めるファイルは記録器でも書けた。

| ID | 不変条件 |
|---|---|
| R1 | 先頭行が `header`、末尾行が `footer`、その間は全て `tick` |
| R2 | `tick` は狭義単調増加、`t` は減らない |
| R3 | tick 行の `tick` / `t` は `observation.tick` / `observation.t` と一致 |
| R4 | `observation.mode` / `observation.purpose` は header の `mode` / `purpose` と一致 (player の run に omniscient の観測を混ぜない) |
| R5 | `decision` の候補は重複せず、`chosen: true` は高々 1 つ |
| R6 | **`mode: player` の run には、どの行のどの深さにも `knowledge: masked` が無い** (設計原則 2、§7.2) |

R6 は第一原則の構造上の担保: 記録器は player モードで masked を含む観測を decider に渡す前に拒否し、decider の出力
(判断ログ・行動) とフッタの `summary` に masked があれば書く前に拒否する (`RecordingError`、`isMaskedInPlayer`)。拒否した行は書かない。
`omniscient` の run は masked を含んでよい (検算・デバッグ専用、§7.6)。

## 3. 記録器 `RecordingSink`

`openRecording({header, decider, writer, now?})` が header を書き、`step(observation)` が
「観測の検査 → `decider.decide` → tick 行の検査 → 追記 → 行動を返す」を 1 ティック分行い、`finish({result, summary?})` が footer を書く。
以後の `step` / `finish` はエラー。`writer` は 1 行ずつ追記するポート (`ReplayLineWriter`)。ファイル版
`createReplayFileWriter(path)` は既存ファイルを再利用しない (2 つの run を 1 ファイルに繋げない)。`now` はテストの決定性のための注入口。

## 4. Decider

`Decider = { id, decide(observation) → {decision, action} }`。同じ観測列に同じ行動を返すこと (決定性) が play の前提。

| id | 中身 | 用途 |
|---|---|---|
| `recorded` (既定) | run に記録された同じティックの判断ログと行動を返す | 記録自体の検算、段階 3 のエンジンが入るまでの既定 |
| `wait` | 常に `{wait: 0}`、判断ログは空 | 最弱の基準、記録器のテスト |

段階 3 で Utility / BT の decider を `src/replay/decider-registry.ts` に足す。

## 5. コマンド

### `guide replay play <run.jsonl> [--until <tick>] [--decider <id>] [--json]`

記録した観測列をティック順に decider へ流し、記録された行動と一致するかを検証する (決定性テスト、アダプタ不要)。
`--until` はそのティックまで (含む)。最初の不一致で止める (以後の観測は記録時の行動の結果なので照合に意味が無い)。
出力: 照合したティック数と、不一致なら最初のティック・記録行動・再生行動。`--json` は `PlayReport`。
終了コード: 一致 0、不一致 1、読めないファイル 1 (issue を stderr)、引数誤り 2。

### `guide replay diff <a.jsonl> <b.jsonl> [--limit <n>] [--json]`

2 本の run をティック番号で揃えて比べる。

- **最初の分岐**: 行動が異なる・選ばれた候補が異なる・片方にしかティックが無い、のいずれかが起きた最初のティック (理由つき)。
  そのティックの候補ごとの効用値 (A / B / 差 B − A / 選択) を出す。定石の書き換え前後の比較に使う。
- **以後の行動差分**: 最初の分岐以後で行動が異なる (または片方にしか無い) ティックの件数と、先頭 `--limit` 件 (既定 10)。

既定は Markdown、`--json` は `ReplayDiff`。読めないファイルは 1、差分の有無にかかわらず 0。

## 6. フィクスチャ

`tests/fixtures/replay/` に Bestia サンプル (ドームアリーナ) の手書き run を 2 本置く。どちらも player / efficiency、10 ティック。

| ファイル | 内容 |
|---|---|
| `dome-arena-base.jsonl` | 中央へ接近 (tick 0〜4) → 被弾後もワイヤースパイダーを攻撃 (tick 5〜9) |
| `dome-arena-branch.jsonl` | tick 0〜4 の行と tick 5 の観測は base と同一。定石の書き換え後を想定し、tick 5 で `tactic:bestia:kite-wire-spider` が攻撃を上回って外周へ下がる (分岐)、tick 8 から攻撃に戻る |

base と branch の diff は tick 5 で分岐し、以後の行動差分は 3 件 (tick 5〜7)。
