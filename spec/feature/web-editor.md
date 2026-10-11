# Web 編集画面 (段階 7)

設計正本: `spec/architecture/design.md` §6 (「Web 画面はファイルを書くだけで独自 DB を持たない」、Excubitor 配下、port 4410)、§11 の段 7。
Actio: `actio:7ab9fce8-4e31-4a97-9fe7-62db95bea1f7`。コード: `src/web/`、`src/health/main.ts`、`src/cli/main-io.ts`。

## 1. 起動

`COMMENTARII_BUNDLE=<攻略本ディレクトリ> npm run dev` (Excubitor の `commentarii` サービス、127.0.0.1:4410)。`COMMENTARII_BUNDLE` が無ければ
`/health` だけを返す (従来どおり)。サービスの起動・再起動は Excubitor と cc-test の claim / release を通し、本体 checkout から行う。

## 2. 画面でできること

| タブ | 中身 | 書き込み先 |
|---|---|---|
| 文書 | 攻略本の全文書 (エンティティ・`.masked.json`・ステージ・地図・イベント・ルール・状態機械・定石・意図・manifest・glossary) を JSON で編集 | その文書ファイル 1 つ |
| 地図注記 | 選んだ `stages/<slug>/map.json` の `annotations` を表で編集 (対象ノード・種類・参照・メモ・境界) | その map.json |
| 観測差分の採否 | `guide learn consolidate` の提案一覧 (自動反映可 / 承認待ち / 承認済み / 承認失効)、承認、反映 | `observations/approvals.json` / 正本 (反映時) |
| ズレ判定 | `observations/divergences.json` のズレ一覧、許容 / 却下 | 許容: `divergences.json` と intent の `allowed_divergences` / 却下: `divergences.json` だけ |

保存のたびにスキーマ検査の結果と攻略本全体の validate (V01〜V12) を返す。画面は状態を持たない (再読み込みでファイルのとおりに戻る)。

## 3. API (`src/web/editor-api.ts`)

| メソッド・パス | 動き |
|---|---|
| `GET /` | 画面 (外部スクリプトなしの 1 枚の HTML) |
| `GET /api/bundle` | ゲーム ID・版・文書パス一覧・validate の結果 (所見は 200 件まで) |
| `GET /api/doc?path=<相対パス>` | 文書 1 つ |
| `PUT /api/doc?path=<相対パス>` `{doc}` | そのパスのスキーマで検査 → 通れば `JSON.stringify(doc, null, 2)` + 改行で書く → validate を返す。違反は 422 で書かない |
| `GET /api/proposals` | `guide learn consolidate --game <dir> --json` |
| `POST /api/proposals/approve` `{proposal, by, reason}` | `guide learn approve` |
| `POST /api/proposals/apply` | `guide learn consolidate --apply --json` |
| `GET /api/divergences` | `observations/divergences.json` |
| `POST /api/divergences/accept` / `reject` `{id, by, note?}` | `guide verify intent --accept` / `--reject` |

- 判断の操作は **CLI そのもの** を同じプロセスで呼ぶ (CLI が正本の操作口。Web と CLI がずれない)。却下のために `guide verify intent --reject` を CLI に足した。
- 読み書きできるのは、攻略本ローダーが文書として認めるパス (`classifyPath`) だけ。絶対パス・`..`・`observations/` 等は 400 (契約 C-76)。
- 書き込み (GET 以外) は JSON の本文を要し、ブラウザが Origin を送るときはエディタ自身の origin (`http://127.0.0.1:<port>` / `http://localhost:<port>`) だけを受ける (別サイトからの書き込みを拒否)。本文は 2 MB まで。
- エディタは作り手のローカル道具であり、player 書き出しを配信する面ではない (`.masked.json` も編集できる)。

## 4. テスト (`tests/web/editor-api.test.ts`)

- 保存した文書がファイルの中身と一致し、読み直しても同じ。スキーマ違反は書かれない。地図注記の追加が保存される。
- 攻略本外のパス・別 origin・JSON でない書き込みを拒否。
- ズレの却下は判断だけを記録し、許容は intent に版つきで足される (CLI 経由)。overlay が無いときの提案一覧は失敗として返す。

## 5. 未実施

- ブラウザでの画面確認 (スクリーンショット)。Excubitor 経由で本体 checkout から起動して確認する手順で、マージ後に行う。
