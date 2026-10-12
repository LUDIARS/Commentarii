# Ingenium R4 (Commentarii 側): R3 の出力形式の正式化 (SDK 0.5.0)

依頼: Actio `actio:0e901f09-281b-42a5-af51-901a28e514ae` (Ingenium R4: R3 の出力形式の正式化と未実施の検証)。この PR は 2 本のうちの
Commentarii 側 (形式) で、マージ後に Ingenium 側 (取り込みと検証) を出す。前提: Commentarii `48bfcc8` = SDK 0.4.0、Ingenium `0f85895` = R3。
ブランチ `feat/ingenium-r4-sdk` (Commentarii ローカル main `c8aeb25` 起点)。公開契約 `spec/feature/engine-planning-formats.md`、
ドメイン `spec/domains/engine-planning.domain.json`。

## 実装記録

| # | 成果物 | 置き場所 |
|---|---|---|
| 1 | 5 形式のスキーマ・型・読み書き関数・置き場所 (`method-report/1`・`planning-proposals/1`・`approved-budget-table/1`・`opponent-model/1`・`method-bandit/1`) | `packages/sdk/schema/*.schema.json`、`packages/sdk/src/planning/`、`packages/sdk/src/overlay/opponent-model.ts` |
| 1 | ローダーがエンジン出力を `LoadResult.outputs` に分けて持つ (正本の文書・V01 の issue にしない) | `packages/sdk/src/bundle/load-bundle.ts`、`bundle.ts` |
| 2 | 承認経路: 変更案を consolidate の提案 `budget-table:<表の版>` (常に承認待ち) にし、approve → `--apply` で `approved-budget-table.json` を書く | `src/learn/budget/`、`src/learn/consolidate/`、`src/learn/cli/run-learn-command.ts`、`approvals.schema.json` |
| 3 | validate V21〜V26 (1 項目 1 テスト、壊したフィクスチャ、正常な出力一式) | `src/validate/checks/v2[1-6]-*.ts`、`tests/validate/checks/`、`tests/fixtures/broken/v2[1-6]-*`、`tests/fixtures/engine-outputs/` |
| 4 | `COMPAT.md` の 0.5.0 行、公開契約、`learning.md` §4.4、`validate-checks.md` の V21〜V26、ドメイン宣言 | `COMPAT.md`、`spec/` |
| 契約 | Augur C-105 (readEngineOutput)・C-106 (budgetTableProposal)・C-107 (approvedBudgetTable)、C-1 (V01〜V26)・C-32 (予算表の書き込み) の更新 | `augur.contracts.json`、`src/contracts/`、`packages/sdk/src/contracts/` |

### 再利用の採否

| 候補 | 採否 | 理由 |
|---|---|---|
| consolidate / approve / `--apply` と `approvals.json` (定石の書き換え §8.2) | 採用 | 依頼が「既存の承認の流れに合わせる」。内容ハッシュ・版での失効・承認者と理由の記録をそのまま使う。予算表の案は正本の文書ではないので、JSON Patch ではなく承認済みの写しを書く分岐だけを足した |
| `src/learn/approval/proposal-hash.ts` の `contentHash` | 採用 (V22 と変更案の読み込み) | Ingenium の `contentHash` と同じ規則 (正規化 JSON の SHA-256)。R3 の bench の変更案のハッシュが一致することを確かめた |
| `readChecked` (`read-approvals.ts`) | 不採用 | `game_id` の照合を前提にしている。変更案には `game_id` が無い (項目を増やさない) ので、SDK の `readEngineOutput` で読む |
| `classifyPath` の `ignored` | 採用 (変えない) | `observations/` は正本ではないまま。エンジン出力は別の分類 (`engineOutputSchemaOf`) で拾う |
| `assertDetects` / 壊したフィクスチャ | 採用 | 1 項目 1 テストの既存の形。正常側をサンプル + 正常なエンジン出力にして、V21〜V26 が正常な出力を誤検出しないことも同じ形で見る |

### 判断した点 (前提未確定を含む)

- **項目は R3 の出力のまま**。`method-report/1` は `aggregateMethods` の出力 (`format`・`episodes`・`rows`・`proposer_share`・`rule_share`)。
  Ingenium の `bench/bestia/r3-method-report.json` は bench の記録用に外側へ `evidence` などのキーを足した証跡ファイルで、形式そのものではない。
  そのため、フィクスチャはこの 5 キーだけにした。
- **変更案と承認済みの表の置き場所を決めた** (`observations/planning/proposals.json`・`approved-budget-table.json`)。R3 の Ingenium は
  `--propose <path>` で任意の場所へ書いていた。承認経路は決まった場所の変更案を読む (Ingenium は `--propose observations/planning/proposals.json` で合わせる)。
- **承認済みの表は Commentarii が書く**。中身は変更案ファイルそのものと `approval` (`proposals_hash`・`approved_by`・`approved_at`)。R3 の形に無い
  理由 (`rationale`) は `approvals.json` 側にだけ残る。
- **予算表の変更案は常に承認待ち** (`auto` にしない)。予算表はエンジンの判断の仕方を変えるので、効率差だけの定石の書き換えのような規則による反映の対象にしない。
- **承認は攻略本の版 (`manifest.version`) にも紐付く** (既存の承認と同じ basis)。攻略本の版が上がったら再承認が要る。
- **オーバーレイが無くても consolidate できる** (変更案だけのとき)。どちらも無ければ従来どおり「先に ingest」。

## PR 説明 (Revisor local PR)

Ingenium R4 の Commentarii 側 (Actio `actio:0e901f09-281b-42a5-af51-901a28e514ae`)。Ingenium R3 が独自に出していた 5 形式を SDK 0.5.0 の形式にし、
予算表の変更案を定石の書き換えと同じ承認経路で確定できるようにした。作業記録 `spec/tasks/2026-10-12-ingenium-r4-sdk.md`、
公開契約 `spec/feature/engine-planning-formats.md`。

- **変更した境界**:
  - SDK 0.4.0 → 0.5.0: スキーマ 5 本、型、`readEngineOutput` / `writeEngineOutput` / `engineOutputSchemaOf`、置き場所の定数、`opponentModelPath`。
    `LoadResult` に任意の `outputs` (エンジン出力。無ければキー自体が無い)。既存の形式・bundle 形式 2・replay 版 2 は変えていない。
  - validate: V21〜V26 を足した (26 項目)。バンドルの隣にエンジン出力が無ければ全て ok。
  - `guide learn consolidate` / `approve` / `--apply`: `observations/planning/proposals.json` があれば `budget-table:<表の版>` の提案を出す。承認済みなら
    `--apply` で `observations/planning/approved-budget-table.json` を書く。`approvals.json` の提案 ID に `budget-table:` を許した。
- **復旧方法**: この PR の revert で SDK 0.4.0 に戻る。Ingenium は `vendor/` の tarball を読むので、この PR の取り込み (Ingenium 側 PR) より前なら
  Ingenium には影響しない。取り込み後に戻すときは Ingenium 側も revert する。書いた `approved-budget-table.json` は消せば未承認に戻る。
  `approvals.json` の `budget-table:` の行は 0.4.0 のスキーマに合わないので、revert するときはその行を消す。
- **再利用探索の採否**: 作業記録の表のとおり (承認経路と内容ハッシュは既存を採用、`readChecked` は不採用)。
- **実施した検証**: `npm install --include=dev && npm run typecheck && npm test` が全件緑 (337 件、うち R4 で 16 件追加: schema 5・読み書きとパス 2・ローダー 1・V21〜V26 各 1・承認経路 2。既存の 3 件は検査項目数 20 → 26 の期待値だけ更新)。Augur の C-1・C-32・C-105〜C-107 が met (リポの `logs/`)。形式ごとに schema のテスト
  (正常な出力が通り、壊した形が通らない) と V21〜V26 の 1 項目 1 テスト、承認経路を端から端まで (レビュー → 承認なしでは書かない → 承認 →
  書く → validate が通る、新しい変更案で失効、書き換えた変更案は拒否) 通すテストを足した。フィクスチャの方式レポートと変更案は Ingenium R3 の
  bench の実出力 (`bench/bestia/r3-*.json`) から作った。
- **未実施**: Ingenium 側の取り込み (この PR のマージ後に別 PR)。サービスの起動テスト (サービスに触れない変更)。
