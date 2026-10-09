# Astra レビュー補正 (初回 PR) と攻略本ツクール完成までの引継ぎ記録

- Actio: `actio:7ab9fce8-4e31-4a97-9fe7-62db95bea1f7` (本 run の正本。状態は Actio が正、本文は Actio から取得し複製しない)
- 人間指示: neco 2026-10-09「攻略本ツクールの作業を引き継ぐ。このセッションの設計を Astra でレビューし、残った実装セッションの管理と、
  未実装項目を Opus に委託して完成させる」。同日「テストと実機確認を許可」(単体・回帰・統合・対象ゲーム起動を伴う実機確認。破壊的データ操作・公開範囲拡大は含まない)。
- 作業ブランチ: `feat/astra-review-completion` (worktree `Commentarii-feat-astra-review-completion`)。基点はローカル main `6143e0b` に origin/main `2911e60` (段階 5 = Revisor #2622 マージ) を merge。

## 1. 引継ぎ時点の照合結果 (2026-10-09)

| 対象 | 実状態 (照合元) |
|---|---|
| 段階 5 / 5H / 5P (run `209a584a`、Actio `actio:1cf5d580-…`) | 実装 commit `dca29ce` → Revisor local PR **#2622 merged (2026-10-09T12:09Z)**、origin/main `2911e60`。run は **failed** (`completed rejected: no completion evidence — Augur report execution or parsing failed`)、子セッション ended。Actio は in_progress / worker=null (Revisor の実状態と食い違い) |
| 段階 5 担当への連絡 | 最初の inject (成功 0 ≠ 不可能) は 200。以後の Astra 全所見・分担の inject は **409 `child_session_not_connected` で未配送**。担当はそれを受けずに終了した。P1-3 / P1-4 / P2-8 は段階 5 の成果に未反映 |
| 段階 5 の completion 失敗の原因 | Concordia が completed 判定で読む共有ログ `E:/Document/Ars/logs/contracts.jsonl` が **1,079 MB** あり、`augur contracts report` が `Cannot create a string longer than 0x1fffffe8 characters` で落ちる (本 run でも再現)。成果物の欠陥ではない。worktree の `logs/` に向けた集計では全契約が met |
| 旧タスクの PR | #2585 / #2591 / #2593 / #2595 / #2599 / #2600 / #2606 / #2607 / #2622 merged、#2590 / #2594 / #2601 closed (同内容が後続 PR でマージ済み) |

段階 5 の領域 (`src/verify/`、`src/render/heatmap/`) は本 PR で編集していない。段階 5 の Actio は既存 ID のまま扱い、新しい段階 5 run は起こしていない。

## 2. Astra 所見の処置

| 所見 | 処置 | 本 PR |
|---|---|---|
| P0-1 観測境界 (未ラベル extra / 裸の resources が通る) | 観測項目の許可表と既定拒否。ドライバ・記録器・読み込み (R7)・人間ログ取り込みで同一判定。互換移行 (header 宣言) と負例 | ✅ `spec/feature/observation-boundary.md` |
| P0-2 raw tap ≠ 人間可視 | `render-tap/1` 契約で観測者・pass・可視性の根拠・外見の識別可否を固定し、raw tap と player 観測を分離 (`selectPlayerDraws`)。厳密な可視性は約束しない | ✅ `spec/feature/render-tap-contract.md` |
| P1-7 段 6 接続契約 | `--frames` (既存 `--observe` 維持)、hello の方向・起動主体・mode を adapter-protocol で統一、版つき schema + golden。6 / 6P / 6B の依頼文に補正 | ✅ |
| P1-5 学習 | 全意図種別の影響判定、relax は自動反映しない、basis (版・ビルド・条件・単位) + 内容ハッシュ、承認 (`guide learn approve`) と失効、人間候補 → 提案 → 承認 → 正本 | ✅ `spec/feature/learning.md` §4 |
| P1-3 成功 0 ≠ 不可能 / 分母・区間 | 段階 5 (マージ済み) の補正。段階 5 の Actio で後続 PR | ⏳ 残件 |
| P1-4 intent を bot に与えて人間能力と呼ばない | 段階 5 の補正 (評価器と判断器の分離、意図支援試験の別モード、「ペルソナモデル上の推定」表記) | ⏳ 残件 |
| P2-8 許容ズレの照合と confusion | 段階 5 の補正 (署名・版・条件に紐付け、同値関係のクラスタ、観測と解釈の分離) | ⏳ 残件 |
| P1-6 5C は decision regression | 段階 5C の実装時に反映 (live balance と別結果、互換性情報の保存と非互換比較の拒否、sim 証跡の明示) | ⏳ 残件 (5C) |

## 3. 変更した境界

- player 観測: 表に無い場所 (宣言の無い `extra.*` / `self.resources.*` / イベント項目、未知のトップレベル) を拒否する。
  ドライバは `masked-in-player` で止め、記録器・読み込みは `unregistered-in-player`。header に宣言の無い旧リプレイは基本項目だけで検査される。
- `guide import plays`: header に `observation_fields` を書く。生の識別子検査を読み込み検査より先にした (漏れの名指しを優先)。
- `guide learn consolidate`: サンプル (time 範囲 + `design_stance: open`) では効率の書き換えも承認待ちになる。`--apply` は自動反映案と有効な承認を持つ案だけを書く。
- 新コマンド `guide learn approve`、新ファイル `observations/approvals.json`、新スキーマ `approvals` / `observation-fields` / `render-frame`、manifest `observation.fields`。

## 4. 復旧方法

本 PR の revert で元に戻る。データ移行は無い (`observations/approvals.json` は新規ファイルで、無ければ「承認なし」)。
旧リプレイを読むには header に `observation_fields` を足す (`spec/feature/observation-boundary.md` §4)。

## 5. 実施した検証 (2026-10-09、許可: neco「テストと実機確認を許可」)

- `npm ci --include=dev`、`npx tsc --noEmit` 成功。
- `npm test`: 329 件 pass / 0 fail (着手前 302 件 pass)。
- `augur inject check`: pending=0 orphaned=0。
- `augur contracts report --acceptance` (VESTIGIUM_LOGS_DIR を worktree の `logs/` に向けて集計): 47 項目すべて met (C-60〜C-67 含む)。

## 6. 未実施・前提未確定

- 実機確認 (Pictor / Bestia の起動) は本 PR の範囲に無い (契約と受信側の判定まで)。段 6 / 6P / 6B で行う。
- Concordia 側の completed 判定は共有ログ 1 GB のため本 run でも失敗する見込み。共有ログのローテーションは他セッションの証跡に関わるので本 run では行わず、委託元に判断を求める。
- 人間 run を境界の昇格根拠に数える段 (人間リプレイからの値の推定) は未実装。manifest の選択肢はその段と同時に置く。

## 7. 完成までの残件 (順番)

1. 段階 5 補正 (P1-3 / P1-4 / P2-8) — 段階 5 の Actio `actio:1cf5d580-…` の後続として。
2. 5C バランス回帰ゲート (P1-6 を反映) → 5K Praeforma 連携 (`2026-10-09-stage-5c-balance-gate.md` / `2026-10-09-stage-5k-praeforma-link.md`)。
3. 段 6 render-tap 受信・正規化 + 6F 敵 AI (確定契約に固定) と、6P Pictor フレームタップ・6B Bestia 実機アダプタ (各リポの別 Opus 委託、契約参照を同梱)。
4. 段 7 Web 編集 (エンティティ / 地図注記 / 定石 / 意図 / 観測差分の採否 / ズレ判定)、7G ゲーム内図鑑・解放済み知識 export、7I 意味差分説明、
   7J read-only LLM 解説 (player-filter 済み入力のみ)、Praeforma 側シーン表示、段 8 第 2 ゲームアダプタ。
5. 最終受入: 実物 tap → 判断 → 入力 → 次フレーム、Bestia 5 体敵 AI、同一エンジン 2 ゲーム差し替え、情報境界、学習提案 → 承認 → 正本反映。
