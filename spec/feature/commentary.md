# 判断ログの実況 (段 7J、LLM 解説者)

設計 §14.J。`guide commentary <run.jsonl> --game <bundle-dir> [--narrator <program>] [--out <dir>]`。

## 何をするか

記録した run の判断ログ (候補・効用値・選んだ候補) から、「なぜその判断か」の実況を作る。定石のレビューと、
面白いズレの人間判定を助ける補助で、**判断には一切関与しない (読み取り専用)**。

出力は `<bundle>/observations/commentary/<run>.md` と、narrator に渡した入力そのもの `<run>.input.json`。
正本 (entities / tactics / intent など) には書かない。

## 入力の境界 (player-filter)

narrator (外部 LLM を含む) に渡すのは `buildCommentaryInput` の結果だけ (C-79)。

- `player` モードの run だけを読む。`omniscient` の run は拒否する。
- 観測 (observation) は渡さない。渡すのは「選んだ候補が切り替わった瞬間」の、選んだ候補・次点 2 つ・効用値・差だけ。
- player view に無い定石 (masked) を指す候補は `(非公開の定石)` に置き換える。名前も ID も渡さない。
- 定石の表示名は player view にあるものだけを付ける。
- run が意図支援モード (`decision_mode: intent-assisted`) なら、それを入力に含め、実況にも明記する (ペルソナ本来の実力ではない)。

## narrator

- 既定: 組み込みの固定文面 (数値は入力から機械的に出す)。
- `--narrator <program>`: シェルを介さず起動し、入力 JSON を stdin に渡し、stdout を本文にする。
  ほかの情報 (ファイルパス・攻略本) は渡さない。非 0 終了・タイムアウト (120 秒) は失敗。
- どちらの場合も、見出しと注意書き (読み取り専用、正本ではない、非公開の定石を伏せたこと) は Commentarii 側が付ける。

外部 LLM への送信は利用者が `--narrator` で明示したときだけ起こる。送った内容は `<run>.input.json` に残るので、後から確認できる。

## 限界

- 候補文字列に masked の定石 ID を含むものは伏せるが、ID を含まない形で masked の知識を表す候補 (ゲーム側の独自名) は判別できない。
  そうした候補を出すアダプタは、候補名を player の語彙にすること。
- 実況の質 (説明の正しさ) は narrator 次第で、Commentarii は検証しない。
