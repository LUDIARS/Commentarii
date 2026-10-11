# Ingenium (Ig) 統合設計: 判断方式の使い分けとルール駆動の自律オートプレイヤー

2026-10-11。親 (Opus 5.5) が 2 つの独立設計を突き合わせて決めた版。Ingenium リポを作るまではここが正本で、R0 で Ingenium の `spec/architecture/design.md` へ移す。

- 指示 (neco 2026-10-11): 「オートプレイヤーは BT、FSM、Utility AI および GOAP、MCT(S) などの行動選択 AI の判断系アルゴリズムを理解しており、それを決定するためのベースのルール / メカニクス (仕様) をデータとして持つ。攻略法については仕様に依存せず自分で行動し、能力的にできる事を判断・解釈して行動する。」「Commentarii から切り離して運用する。」「名前は Ingenium (思想に近い)。」
- 材料: Fable 案 `spec/plan/2026-10-11-autoplayer-paradigms-fable.md`、Astra 案 `spec/plan/2026-10-11-autoplayer-paradigms-astra.md`、親の叩き台 (Commentarii `spec/architecture/design.md` §16 の初版)。詳細 (JSON 例、式言語 v2 の文法、予算表の初期値、移管ファイル表) は 2 案の該当節を正本として参照し、本書は **採否と、2 案が食い違った点の決定** を書く。

## 1. 結論

1. **独立プロジェクト Ingenium (`Ig`)**。Commentarii (`Cm`) は「ゲームが何か」を書き・検証し・人に見せ・正本を更新する側、Ingenium は「それを読んで遊び、記録する」側。Ingenium は Cm のサービスが動いていなくても、書き出された攻略本 (`bundle.json`) とアダプタだけで動く。
2. **5 方式は固定の層ではなく役割で持つ** (2 案一致、叩き台の固定層は撤回)。外部契約は既存の `Decider.decide(observation)` を互換の入口として残し、内部を **Policy (FSM / BT / Utility: 構え・反応・目標選択) / Planner (GOAP / MCTS: 有界の探索) / Executor (BT: 実行監視・中断・再計画)** に分ける。同じ 5 つの実装を、相手 (敵・NPC) の挙動モデルの **解釈器** としても使う。
3. **方式の選択は「適格性 → 予算配分 → 共通評価器での調停」**。局面の特徴 (危険の切迫、モデルの確からしさ・予測誤差、有限抽象の可否、相手モデルの有無、論理予算) で各方式の適格性を判定し、適格なものに予算表 (データ) で計算を配る。提案は GOAP の費用や MCTS の Q 値のまま比べず、同じ前向きモデルで予測した達成確率・時間・資源・被害・情報価値を Utility で比べる。
4. **ルールブックは「型・単位・時間・空間・確率・観測可能性」を持つデータ**。STRIPS 風の前提 / 効果に加え、持続時間つき行動、毎ティックの連続変化 (過程)、運動プリミティブ、相手の挙動モデル、勝敗条件と進捗尺度を持つ。前向きモデルは副ステップで相手と過程を同時に進め、確率は枝 / 標本で扱う (期待状態は作らない)。
5. **攻略法に依存しない = 入力型で分離**。`autonomous` 構えの判断器は、定石・意図・定石由来の重みを **型として受け取れない**。目標は公開の勝敗条件・進捗尺度と利用者の目的だけ。成功した手は Cm へ定石候補として返し、自律構えがそれを読み戻すことはしない。
6. **マスク原則は「存在の分離」で担保**。player のルールブックには masked の行動・効果・分岐の **痕跡を残さない** (「何か隠れている」ことも漏らさない)。真の定義は `.masked.json` の上書きで持ち、omniscient だけが適用する。ずれは実験と観測で推定され、推定値は仮説として返す (正本への昇格は Cm の承認)。
7. **決定性 = 論理予算 + ティック別乱数ストリーム**。予算は壁時計でなく反復数 (論理 work quantum) で決め、壁時計は測って記録するだけ。乱数は `deriveSeed(seed, "<用途>:<tick>")` の派生ストリームから引き、既存の毎ティック 2 回の列を乱さない。リプレイで判断が再現する。

## 2. 2 案の食い違いと決定

| 論点 | Fable 案 | Astra 案 | 決定 | 理由 |
|---|---|---|---|---|
| 新リポ名 | Lusor (`Ls`) | Auriga (仮称) | **Ingenium (`Ig`)** | neco 決定 |
| データ形式 (契約) の所有 | 全部 Cm が SDK (`@ludiars/commentarii-sdk`) で所有。依存は Ig → Cm の一方向 | 実行時の契約は Ig の契約パッケージが所有し、Cm がそれに依存 | **Fable 案 (Cm SDK が所有、Ig → Cm の一方向)。ただし adapter プロトコル (adapter/2) は Ig が所有** | マスク原則の検査 (観測境界・replay 不変条件) を原則の所有者に置く。依存を一方向にすれば両リポの版の対応が 1 表で済む。SDK はライブラリなので Cm のサービス無しで Ig は動く (Astra 案の要件も満たす) |
| アダプタのプロトコル | `protocol: 2` で `hello` に任意 `actions[]` | adapter/2 = capability handshake、時間意味、`command_id`、開始 / 拒否 / 完了 / 取消の receipt | **Astra 案の adapter/2 を採る** (Fable の `actions[]` 宣言を含める) | 旧 `act(): Promise<void>` は「受付」で完了を保証しない。実験・効果学習には行動と結果の対応 (receipt) が要る |
| 方式選択の学習 | オンライン補正はしない。方式別成績は bench でオフライン集計し、予算表の変更は承認制 | 固定規則 → オフライン補正 → 制約付きオンライン (contextual bandit) | **R2 は固定規則、R3 でオフライン補正 (承認制) を完成させ、制約付きオンライン補正は R3 に実装するが既定は無効** | フルセットで作るが、未校正の補正を既定で効かせない。原則 5 (学習は人が読める差分) に合う |
| 自分の頭の FSM (構え) | 置かない (レジームは資源配分だけ) | 公開能力と目標から成立する構えだけ有効化 | **既定は置かない。ペルソナのデータとして任意に置ける** (判断ログに「構えが候補を絞った」と残す) | 全ゲーム共通の交戦 / 回収 FSM は攻略法の埋め込みになる (2 案とも指摘) |
| 段分け | R0 分離 → R1 モデル → R2 自律 (反応 + GOAP) で Bestia を定石なしにクリア → R3 MCTS・相手 5 方式・オフライン評価・敵 AI | R0 → R1 → R2 5 方式 → R3 選択・実験・学習・統合 | **Fable 案** | 毎段の終わりに動くプレイヤーがある。全体はフルセット (MVP で削らない) |
| 不明値 | 区間 `[lo, hi]` (三値論理を min / max で) | 型付きの unknown、仮説、根拠 | **区間を基本にし、効果推定は仮説 (条件・根拠 run・信頼区間・撤回可) として持つ** | 2 案は補い合う。区間は評価器が単純、仮説は学習の説明責任 |
| 共通カリキュラム (初期知識) | 記述なし | approved-guide / fresh-player を明示し、初期知識 hash を記録 | **採る** | 「初心者として遊ぶ」と「承認済み知識で遊ぶ」の成績を混ぜない |
| live の時間目標 | 壁時計は判断に効かせない | 60 Hz、p99 2 ms / 期限 4 ms を初期較正点 (SLA ではない) | **両方採る**: 判断は論理予算、壁時計は記録して較正点と比べる | 決定性を守りつつ実機の遅延を測る |

## 3. 2 案が一致した点 (そのまま採る)

- 5 方式は役割で使い分け、全方式を毎ティック競わせない (並列比較はオフライン bench 用)。
- `MCT` は MCTS と読む。ターン制・決定的・2 人には深さ制限 minimax を同じ Planner 契約で足せる。
- MCTS は根の 1 手を返し、探索木を長い BT に変換しない (receding horizon + 実行監視)。
- GOAP は「予算切れ」と「到達不能」を区別して返す。
- 期待状態で遷移しない (存在しない状態・勝敗を作る)。確率は枝 / 標本 / 集合、期待値は集計だけ。
- アフォーダンスは「今できる / 要実験 / k 手で可能 (witness つき) / 見つからない / 不可能 (根拠つき)」を区別する。入力として送れるかと、効果が分かるかは別の軸。
- 実験は観測差を因果効果とみなさない。交絡・欠測・holdout・撤回を持つ。discoverable は真値昇格の許可ではない。
- 構え `autonomous` (既定) / `guided` (既存の Utility + BT、比較基準) / `hybrid` (自分の計画と定石を同じ評価器で比べる)。`player` / `omniscient`、`efficiency` / `coverage` とは独立の軸。`autonomous` と `intent-assisted` は併用不可。
- 既存の bench 基準値は `guided` のもの。bench 結果に構え・エンジン版・SDK 版・初期知識 hash を記録し、同じ組同士でだけ比べる。
- 敵 AI への再利用は「self の差し替え」だけで完了にしない。相手視点のビューで私有情報にアクセスできないことを担保する。
- 叩き台の R1 依頼文 (`spec/tasks/2026-10-11-stage-r1-rulebook-forward-model.md`) は所有者が Cm 前提で、R0 と矛盾する。R0 の後に書き直す。

## 4. リポの境界 (Fable 案 §10 を基本に、adapter/2 を Ig へ)

| Commentarii (Cm) に残す | Ingenium (Ig) へ移す |
|---|---|
| 攻略本ツクール `guide` (import / validate / render / export / report / diff / intent / learn ingest・consolidate・approve / verify intent / audit mask) | オートプレイヤー CLI `ingenium` (run / bench / gate / replay play・diff / adapters) |
| 攻略本バンドルのスキーマ全部 + ルールブックのスキーマ (variables / actions / processes / behaviors / objectives) | 判断エンジン (Policy / Planner / Executor、5 方式、選択器、相手モデル解釈器) |
| 実行時データの形式: observation-frame / observation-fields / replay / bench-result / render-frame のスキーマと不変条件、マスク検査 | 信念・前向きモデルの実行・アフォーダンス・実験・reflect (観測行の書き出し) |
| 式言語 (v2 含む) の構文・評価・静的検査 | アダプタ契約 adapter/2 (TS + C++ ヘッダ + JSON Lines)、sim、stdio、描画タップの受信 |
| `@ludiars/commentarii-sdk` (`packages/sdk`): schemas / types / bundle reader / expression / rulebook ビュー / replay / observation / fixtures | リプレイの記録・再生、bench、balance gate、ペルソナ |
| 学習の正本側、意図ズレ検証、feasibility、ヒートマップ、Praeforma 連携、人間プレイログ取り込み、Web 編集画面 | |

- 依存は Ig → Cm SDK の一方向。SDK は Cm リポの `packages/sdk` を `npm pack` した tarball を Ingenium の `vendor/` に置いて `file:` 依存で読む (npm の git 依存はサブディレクトリを扱えないため。2026-10-11 R0-A マージ後に変更)。取り出し元 commit と sha256 を記録する。
- 版の対応は Cm の `COMPAT.md` に 1 表 (SDK 版 × bundle `format_version` × replay header 版 × Ingenium 版)。対応外の組み合わせのテストは「スキップ」ではなく「失敗」にする。
- 移管ファイルの対応表は Fable 案 §10.3 を正本にする (ただし `src/adapter/**` のプロトコル定義は Ig 所有)。

## 5. 実装の分割 (フルセット)

| 段 | 内容 | 受入の要点 |
|---|---|---|
| R0 | 分離: Cm に `packages/sdk` を切り出す (全テスト不変) → Ingenium リポを作る (service-bootstrap、Revisor / Cc / Excubitor / Anatomia 登録、略称表) → 実行側を移し `guided` で現行と同じ判断を再現 → Cm に `guide run/bench/replay/gate` の委譲を 1 版だけ残す | 同 seed・同 bundle で移管前後の判断ログが一致。Cm と Ig の両方で全テスト緑。段 6 (描画タップ受信) はマージ後に一緒に移す |
| R1 | ルールブック (Cm SDK 側: スキーマ・validate・render・式 v2・player / full ビュー、Bestia のルールブック) + 信念・前向きモデル・アフォーダンス (Ig 側) + 相手モデルの fsm / scripted 解釈器 | 既存 rule の評価が不変。player に masked の痕跡が無い。独立 oracle で複数ステップ・確率・可視射影を検証 (1 ステップ sim 一致だけにしない) |
| R2 | 自律構え: 反応 (Utility / BT) + GOAP + 実験 + Executor + 調停 + 予算表 (固定規則) + adapter/2 | sim の Bestia を **定石なし** の `autonomous` でクリアし、ルールブック無し (アダプタの抽象アクションだけ) より明確に強い。masked の効果を実験で推定できる。リプレイで再現 |
| R3 | MCTS (+ 任意で minimax) + 相手モデル 5 方式 + `hybrid` + 方式評価のオフライン補正 (承認制) + 制約付きオンライン補正 (既定無効) + 敵 AI 再利用 + 定石候補の書き出し | 局面ごとに想定の方式が選ばれる。単方式・組合せ・選択器なしの対照より良い。敵視点で私有情報に触れない |

段 8 (2 本目のアダプタ) の受入に「`autonomous` でも動く」を足す。

## 6. neco の決定 (2026-10-11)

1. **既定の構えは `autonomous`** (`guided` は `--stance guided` で残す。§14.C の基準値は構え別に取り直す)。
2. **Ingenium リポは private** (GitHub `LUDIARS/Ingenium`、非公開)。Cm (public) の SDK を読む向き (Ig → Cm) は変わらない。Ig 側の成果物 (bench 結果・リプレイ) を Cm の public リポへ書き戻すときは、ゲーム固有の値を含めない既存の観測ログ規則 (§10) に従う。

それ以外の論点 (Fable 案 §9 の 15 項目、Astra 案 §10) は上の決定表と 2 案の推奨どおりに進め、実装中に人の判断が要るものが出たらその時に聞く。
