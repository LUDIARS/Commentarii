
# レベルデザインの作成と反証

Actio `actio:d4e32d98-1227-40da-b063-6c77728b5157`。Ingenium の「レベルデザインの質の検知」§15・§19.2 に対応する。

## 骨格

`intent/1` の `route` と `teach` は任意の `level` を持つ。同じ課題を異なる意図から記述できる。正本は既存の `intent/` ディレクトリにあり、SDK の検証、`guide validate` の V12、既存の JSON エディターと full export が扱う。player view では評価用の `hints` と `level` を除く。

- `challenge` は評価レポートの課題 ID。比較時はステージも照合する。
- `solutions[]` は ID、使う `rules`、腕前の段 `skills` (1〜5)、スタイル ID の `styles` を持つ。各ルールは行動 ID `action`、見える対象の署名の集合 `targets`、前提・効果条件の真偽列 `conditions` (真 1、偽 0、不明 ?) で記述する。対象を取らない行動は `targets: []`。レポートのルール ID と同じハッシュに変換して集合を照合する。
- `decisions[]` は判断点の ID、意味のある選択肢の想定数 `options`、局面 `regime` (`calm` / `threat` / `critical`) を持つ。
- `random[]` は乱数源の ID、管理の種類 `management` (`bounded` / `bag` / `previewed` / `narrow` / `unmanaged`)、同じ結果に作用する他の乱数源 `overlaps` を持つ。
- `feel` は結果の手触り (`flat` / `responsive` / `uncontrolled`)、`disclosure` は狙う開示 (`rule-taught` / `late` / `discovery`) を表す。

`guide level check --game <攻略本>` は、宣言から比較できる原則と参照を調べる。解法の複数性と想定層 (P1・P2)、発見とヒント (P3)、判断点の選択肢の帯 (P4)、手触り (P8)、未管理の乱数の重なり (P9) を所見にする。物理的な下振れ (P5)、実際の一貫性 (P6)、日常の規則との整合 (P7) は計測・確認の対象。P10 は以下の提案経路で扱う。

SDK の `principles/level-design.json` は `level-principles/1` の写しで、元ファイルのリポジトリ・コミット・改行を LF に正規化した SHA-256 を隣の `level-design.source.json` に記録する。正本を更新したら `guide level check --game <攻略本> --principles <新しい正本のJSON>` で照合する。更新を採用する場合は写しと出典を一緒に更新する。

## 実物との照合

`guide level verify --game <攻略本> --probe <level.json>` が同じ攻略本版の `level-quality/1` を読み、`observations/divergences.json` に分類を追記する。想定解法の不成立、想定外の成立、腕前、開示、選択肢の数、手触りを区別する。観測のない項目は保留し、既存の判定を保持する。レポートに個別の run が対応しない所見では、課題と対象 ID を根拠とする。これらの許容・却下は観測記録に残る。

`level-quality/1` の確認試行は腕前別で、クラスごとのスタイルや判断点 ID 別の実数を出さない。スタイルは静的チェックに使う。選択肢は全測定点で 2 択の境界をまたいだ場合を比較する。未計測の項目に対して結果を推定しない。

## 提案を反証する手順

評価器に SDK 0.7.0 の攻略本を読める版を用意する。下記はシェルや人が明示的に両方の CLI を実行する手順。新しい `guide level` コマンドはローカルファイルを読み書きする。

1. `ingenium level probe --game <攻略本> --save <base.json>` を実行する。対象の finding と「直す手」を選び、作者が変更後の文書を `[{"path":"intent/1.json","document":{…}}]` の形で用意する。ルール・ステージなど変更に必要な攻略本の正本文書も指定できる。入力 JSON は攻略本ディレクトリの外に置く。
2. `guide level propose --game <攻略本> --probe <base.json> --stage <stage-id> --challenge <challenge-id> --finding <finding-id> --edit <edits.json>` で差分を出す。ステージ全体の finding では `--challenge` を省く。`--priors` のルール所見では `--rule <action-id>` を指定し、写しの計測にも同じ priors 設定を使う。原則に記載の修正方針と作者の文書を、攻略本版に束縛した承認待ちの JSON Patch にする。
3. `guide learn approve --game <攻略本> --proposal <level-design:id> --by <承認者> --reason <理由>` で承認する。次に `guide level prepare --game <攻略本> --proposal <level-design:id> --out <新規ディレクトリ>` で写しを作る。写しは攻略本外に作り、既存ディレクトリとの上書きを拒む。
4. 同じ設定で `ingenium level probe --game <写し> --save <head.json>` を実行する。そこで得た **この組** に対して `ingenium gate level --base <base.json> --head <head.json> --json` を実行し、標準出力を UTF-8 の `gate.json` に保存する。ゲートが回帰候補を返したときもその JSON を渡す。
5. `guide level review --game <攻略本> --proposal <level-design:id> --base <base.json> --head <head.json> --gate <gate.json>` で採否を記録する。前後の攻略本ハッシュと計測条件が一致し、対象が計測され、所見が解消しており、ゲートに回帰候補がないときだけ採用候補の差分を `observations/level-design/reviews/` に残す。ゲート形式は入力のハッシュを出さないため、手順 4 で出した結果を同じ組に渡す。

承認・検査による書き込みは観測記録と写しに限る。採用差分を正本へ取り込むのは作者の編集作業となる。提案を取り消す場合は写しを片付け、観測記録を保管方針に従って整理する。CLI 更新自体の取り消しでは、旧 SDK で読む攻略本から任意の `level` 欄を先に移し、追加の観測記録は別途保管する。
