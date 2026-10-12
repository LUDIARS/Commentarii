# エンジンの計画・相手モデルの出力形式 (SDK 0.5.0、Ingenium R4)

Ingenium R3 が独自に出し始めた 5 つの形式を Commentarii SDK の形式にした公開契約。形式 (スキーマ・型・読み書き関数・置き場所) は SDK が持ち、
中身を作るのは Ingenium (実行側) である。依存は Ingenium → SDK の一方向 (統合設計 `spec/plan/2026-10-11-ingenium-integrated-design.md` §4)。
項目は R3 の Ingenium の出力 (src と tests の fixture) のまま。足した項目は無い。

どれも **正本ではない**。バンドルのディレクトリの `observations/` 配下に置き、`loadBundle` は正本の文書として読まない
(`LoadResult.files` / `issues` に入らない)。代わりに `LoadResult.outputs` にスキーマ違反とともに分けて持ち、validate V21〜V26 が検査する。
回数・数値・ID だけを持ち、ゲーム固有の値や masked の値を持たない。

## 1. 形式と置き場所

| 形式 | スキーマ | 置き場所 | 書く側 | 中身 |
|---|---|---|---|---|
| `method-report/1` | `method-report.schema.json` | `observations/planning/method-report.json` (bench の標準出力に出すだけのときは置かない) | Ingenium `bench --report methods` | 予算表の行 (`<form>/<regime>/<band>-trust`) × 提案者ごとのエピソード数・tick 数・行内の割合・予測と実現の進捗の平均・予測誤差・達成率・クリア率・判断の壁時計 (記録のみ)、全体の提案者の割合・選択器の規則の割合。測定だけで表は変えない |
| `planning-proposals/1` | `planning-proposals.schema.json` | `observations/planning/proposals.json` (`bench --propose observations/planning/proposals.json`) | Ingenium (オフライン補正) | 予算表の変更案。1 件 = 1 つの区画 (`realtime/<regime>` または `turn/any`) の 1 つの計画器 (`goap` / `mcts`) の予算 `from → to` と、根拠の方式レポートの行。元の表の版 `table_version` と内容ハッシュ `table_hash`、変更案の一覧の内容ハッシュ `proposals_hash` を持つ |
| `approved-budget-table/1` | `approved-budget-table.schema.json` | `observations/planning/approved-budget-table.json` | Commentarii `guide learn consolidate --apply` (§3) | 変更案ファイル (そのまま) + 承認 (`proposals_hash`・`approved_by`・任意の `approved_at`) |
| `opponent-model/1` | `opponent-model.schema.json` | `observations/opponents/<entity ID の最後の区切り>.json` (`opponentModelPath`) | Ingenium `run --learn` | 挙動モデルを持たない相手の、文脈 (`<near\|mid\|far>\|own:<moved\|still>`) ごとの動きの分類 (`approach` / `retreat` / `strafe` / `attack` / `still`) の観測回数と run 数 |
| `method-bandit/1` | `method-bandit.schema.json` | `observations/selection/method-bandit.json` | Ingenium (制約付きオンライン補正を有効にしたときだけ) | 版 (予算表 + 初期知識) → 局面署名 → 腕 (`goap` / `mcts`) ごとのエピソード数 `n` と報酬の合計 `total` (1 回の報酬は 0..1) |

- 内容ハッシュは `sha256:` + 正規化 JSON (キー整列・空白なし・undefined のキーを除く) の SHA-256。consolidate の提案の内容ハッシュ
  (`learning.md` §4.2) と同じ規則。
- 型: `MethodReport` / `MethodReportRow`、`PlanningProposals` / `BudgetProposal` / `BudgetPlannerId`、`ApprovedBudgetTable` / `BudgetTableApproval`、
  `OpponentModel` / `OpponentMotionClass`、`MethodBandit` / `BanditArmStats` (`@ludiars/commentarii-sdk/types`)。
- 定数: 各 `*_FORMAT`、`PLANNING_DIR`・`METHOD_REPORT_PATH`・`PLANNING_PROPOSALS_PATH`・`APPROVED_BUDGET_TABLE_PATH`・`METHOD_BANDIT_PATH`・
  `OPPONENT_MODELS_DIR`、`OPPONENT_MOTION_CLASSES`、`BUDGET_PLANNERS`。

## 2. 読み書き関数

- `readEngineOutput(schema, text, registry)`: JSON として読み、スキーマで検査して型つきの文書を返す。読めない・適合しない文書は
  `EngineOutputError` (スキーマ名と違反の一覧) で丸ごと拒否する。半端に読まない (契約 C-105)。
- `writeEngineOutput(schema, document, registry)`: スキーマで検査してから 2 スペースの JSON + 末尾改行の文字列を返す
  (R3 の Ingenium の書き方と同じ文字列)。
- `engineOutputSchemaOf(path)`: バンドルからの相対パスがどの形式の置き場所か (どれでもなければ undefined)。

## 3. 予算表の変更案の承認経路

定石の書き換え (設計 §8.2、`learning.md` §4) と同じ流れで、人が変更案をレビューし、承認済みの表として確定する。

1. Ingenium が bench の方式レポートから変更案を作り `observations/planning/proposals.json` に置く。
2. `guide learn consolidate --game <dir>`: 変更案を `budget-table:<table_version>` という提案 1 件として示す (常に承認待ち。
   予算表の変更はエンジンの判断を変えるので規則では反映しない、契約 C-106)。Markdown の「予算表の変更案 (人間承認)」節に、区画・計画器・
   `from → to`・根拠の行・書くファイル・内容ハッシュを出す。オーバーレイが無くても変更案だけで動く。
   変更案ファイルの `proposals_hash` が一覧のハッシュと合わない (作った後で書き換えた) ときは読まずに終了コード 1。
3. `guide learn approve --game <dir> --proposal budget-table:<table_version> --by <name> --reason <text>`: 既存どおり
   `observations/approvals.json` に提案の内容ハッシュと攻略本の版を記録する。
4. `guide learn consolidate --game <dir> --apply`: 承認が今の変更案の内容ハッシュと版に一致するときだけ
   `observations/planning/approved-budget-table.json` を書く (変更案はそのまま、承認は `proposals_hash` と承認記録の承認者・時刻、契約 C-107)。
   承認が無い・失効した (新しい変更案が来た) ときは書かない。正本には触らない。
5. Ingenium は `--budget-table <approved-budget-table.json>` でこれを選択器の予算表として読む。承認の無い・一致しない・別の表に対する変更案は拒否する
   (Ingenium の契約)。

## 4. validate の検査 (V21〜V26)

`validate-checks.md` の表のとおり。V21 がスキーマ、V22〜V26 は形式ごとの整合 (変更案のハッシュと ID、承認と変更案、相手モデルの置き場所と ID、
オンライン補正の報酬合計、方式レポートの回数と割合)。スキーマに適合しない出力は V21 だけが報告し、V22〜V26 は読み飛ばす。
