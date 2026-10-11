# Ingenium R2: 自律構え (定石なしで Bestia をクリアする)

設計正本: `spec/plan/2026-10-11-ingenium-integrated-design.md` (§1〜§5)。詳細は Fable 案 `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §3.6〜§3.9 (提案者・調停者・実行者・予算表)、§3.11〜§3.15 (実験と効果の学習、定石の書き出し、構え、判断ログ、1 ティックの流れ)、§7.2 (R2 の受入)。Astra 案 `spec/plan/2026-10-11-autoplayer-paradigms-astra.md` §4.1〜§4.2 (内部契約 Policy / Planner / Executor、方式選択の優先表)、§4.6・§4.8 (アフォーダンスと計画生成、実験)、§6 (有界計算・決定性)、§7.2 の adapter/2 を受入に加える。

前提: R0-B (実行側の Ingenium 移管) と R1 (ルールブック・前向きモデル・アフォーダンス) がマージ済み。作業は Ingenium リポ (private)。形式 (スキーマ) の追加が要る場合は Commentarii SDK 側の PR を先に出す。

## 成果物 (Ingenium)

1. **内部契約**: `DecisionContext` (actor、許可された knowledge view、信念、目標、論理予算、乱数。full bundle / intent / 定石は **型として入らない**)、`Policy.step`、`Planner.advance` (solved / partial / budget-exhausted / unsupported / proven-unreachable を区別)、`PredictionModel.step` (R1 の前向きモデル)、`Executor.step` (前提・継続条件・完了を検査して 1 コマンドか待機、取消・拒否・完了を区別)。外部の `Decider.decide(observation)` は互換の入口として残す。
2. **提案者**: 反応 (Utility の即時候補と BT の反応枝)、**GOAP** (A*、費用 = 時間 + 資源 + 危険、許容誤差、到達不能と予算切れの区別、計画は根の数手と前提列を返す)、実験 (`experiment:<action>`、価値 = 情報量 × 危険の低さ、ペルソナの探索率で重み)。
3. **調停者** (Utility v2): 全提案を同じ前向きモデルで予測した達成確率・時間・資源・被害・情報価値で比べる。GOAP の費用を直接比較しない。利用者の硬い制約を先に通す。
4. **実行者** (BT v2): 計画を Sequence / Selector / Condition / Action の木にし、各手に `expect` (前向きモデルの予測)。破れたら再計画。継続にヒステリシス。
5. **予算表 (データ、固定規則)**: 局面レジーム (calm / threat / critical) × 実行形態 (realtime / turn) × モデル信頼度 → 各提案者の反復数。壁時計は判断に効かせず記録だけ (60 Hz で p99 2 ms / 期限 4 ms を較正点として bench に出す)。オンライン補正は R3。
6. **目標**: `objectives` の `win` / `lose` / `progress[]` と利用者の目的 (efficiency = 達成・生存、coverage = 損失予算内の情報取得) だけ。勝利条件が読めないときは生存・情報取得の暫定目標で動き、「クリアを保証できない」と記録する。
7. **実験と効果の学習**: 試した前後の観測差から効果の仮説 (条件・根拠 run・信頼区間・holdout・撤回可) を `observations/rules/<action>.json` に積む (形式は Commentarii SDK の overlay)。観測差をそのまま因果効果とみなさない。正本への昇格は Commentarii の承認経路。
8. **adapter/2**: capability handshake、時間の意味、`command_id`、開始 / 拒否 / 完了 / 取消の receipt、actor、観測の由来。protocol 1 の受付だけのアダプタは bridge で受け、receipt を捏造せず「可視観測からの完了推定」と「取消非対応」を宣言する。sim と stdio を adapter/2 に上げる。
9. **構え**: `--stance autonomous|guided|hybrid`。**既定を `autonomous` にする** (neco 決定)。`guided` は既存の Utility + BT。`autonomous` と `intent-assisted` の併用は拒否。初期知識 (curriculum: approved-guide / fresh-player) を明示し hash を記録、混ぜた比較を拒否。
10. **判断ログ**: 局面署名、選ばれた提案者と理由 (予算表の行)、各提案の予測値、計画、実験、receipt をリプレイに残す。`replay diff` が方式・計画の分岐したティックも出す。
11. **定石の書き出し**: 成功した計画を `learned` 定石の候補として Commentarii の書き換え経路 (§8.2) の入力形式で出す。`autonomous` は自分の出した定石を読み戻さない。
12. bench に構え・エンジン版・SDK 版・初期知識 hash を記録し、同じ組同士でだけ比べる。`autonomous` の基準値を取る。

## 受入条件

- `npm install --include=dev && npm run typecheck && npm test` が通る。
- **sim の Bestia を、定石なし (tactics を空にした書き出し) の `autonomous` でクリアする** (固定 seed の複数 run でクリア率と時間を bench で示す)。
- ルールブック無し (アダプタの抽象アクションだけの最小ルールブック) の `autonomous` より、ルールブックありが明確に強い (クリア率・時間の差を bench で示す)。`guided` との差も並べて出す。
- masked の効果を実験で推定できる (omniscient の正本と比べた推定誤差を示すテスト。スコアには使わない)。
- `autonomous` の判断器が定石・意図に触れない (型で担保し、リプレイに定石 ID が現れないことのテスト)。
- 同じ seed で判断が再現する (リプレイ検証)。予算は反復数で決まり、壁時計に依存しない。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ。`main` を直接編集しない。Commentarii の内部パスを import しない。
- ビルドとテストはフォアグラウンドで待つ。サービスは起動しない。
- 完了 = Revisor local PR 提出 → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。
