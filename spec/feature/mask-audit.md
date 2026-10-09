# `guide audit mask` — マスク境界の監査 (CI lint)

設計 §1 (第一原則)・§5 (知識境界)・§14.B の具体化。攻略本の `.masked.json` (プレイヤーが知ってはならない値) を正本にして、
ゲームリポの「プレイヤーに届く面」(UI 文字列・ローカライズ表・ネットワーク応答のスキーマ・ログ出力・セーブ形式) に
masked の値や名前が出ていないかを検査する。第一原則をゲーム実装側へ延長するもの。

実装は `src/audit/` (1 ファイル 1 責務)、テストは `tests/audit/`、フィクスチャは `tests/fixtures/audit/`。
Actio タスク: `actio:b274b218-d572-4cb9-bc66-62ac128cb9c4`。依頼文: `spec/tasks/2026-10-09-stage-2b-mask-audit.md`。

## コマンド

```
guide audit mask --game <bundle-dir> --scan <path>... [--format json|md] [--fail-on hit|none]
```

| オプション | 既定 | 意味 |
|---|---|---|
| `--game` | (必須) | 攻略本バンドル (`guide/<game-id>/`) |
| `--scan` | (必須、複数可) | 走査するディレクトリまたはファイル。`--scan a --scan b` でも `--scan a b` でもよい |
| `--format` | `md` | `md` (Revisor に貼る Markdown) / `json` (機械向け) |
| `--fail-on` | `hit` | `hit`: hits が 1 件以上なら終了コード 1。`none`: 報告だけで常に 0 |

終了コード: 0 = 通過 (warnings と allowed は影響しない)、1 = `--fail-on hit` で hits あり、または攻略本が監査に使えない (下記)、2 = 使い方の誤り。

### 攻略本が監査に使えない場合 (安全側で止める)

次のどれかがあると、`--fail-on` に関係なく報告を出さずに終了コード 1 で止まる。
壊れた manifest は `audit` 節ごと、壊れた `.masked.json` はその値ごと落ちるので、黙って検査範囲が狭くなるのを防ぐ。

- `manifest.json` が無い、またはスキーマ違反 (根拠 `rationale` か決めた人 `decided_by` の無い `audit.allow[]` を含む)。
- `*.masked.json` が読めない、またはスキーマ違反。

## 走査対象

- 拡張子で判定する。既定: `.json` `.csv` `.po` `.resx` `.yaml` `.yml` (UI 文字列・ローカライズ表)、`.proto` `.ts` (`.d.ts` を含む) (ネットワーク応答のスキーマ・型定義)、`.js` `.cs` `.cpp` `.h` (ログ出力・セーブ形式)。
- manifest の `audit.scan.extensions` を書くと既定を **置き換える**。
- `node_modules/` `dist/` `.git/` の中は常に除外。NUL 文字を含むファイル (バイナリ) は読み飛ばす。
- 報告のファイルパスは `--scan` に渡したパスにその下の相対パスをつないだもの (区切りは `/`)。CI ではゲームリポのルートから相対パスで渡すと、`audit.allow[].pattern` が安定する。

## 検出規則

masked の値 = バンドルの全 `.masked.json` の `stats` と `fields` の値。入れ子 (配列・オブジェクト・多言語テキスト) は葉まで展開し、
各葉に参照 (`enemy:<game>:<slug>.stats.<name>` / `.fields.<name>[.<key>...]`) を付ける。

| 種別 | 重さ | 判定 |
|---|---|---|
| `value-hit` | hit | masked の値が走査対象に現れる。**数値**: 同じ値の数値リテラル (`18` = `18.0`、符号は無視)。masked 値に単位があれば、リテラルが単位なしか同じ単位 (大文字小文字は区別しない、`18 kg` `18kg`) のときだけ一致し、別の単位 (`18 m`) は一致しない。**文字列**: 完全一致 (大文字小文字を区別、より長い識別子の一部は除く)。**ID** (`<kind>:<game-id>:<slug>`): slug 部分 (前後が slug 文字 `[A-Za-z0-9_-]` でない位置) |
| `key-hit` | hit | `audit.forbidden_keys[]` のキー名が識別子として現れる (JSON / YAML のキー、型・proto のフィールド、プロパティ)。snake_case で書いたキーは camelCase と PascalCase の表記も探す (`rng_seed` → `rngSeed` `RngSeed`)。より長い識別子の一部 (`drop_rate_ui`) は除く |
| `undefined-exposure` | warning | 攻略本に無い数値 (バンドルのどのファイルの数値とも一致しない) が UI 文字列・ローカライズ表 (`.json` `.csv` `.po` `.resx` `.yaml` `.yml`) に直書きされている。`.json` は文字列値の中だけを見る (素の JSON 数値はデータであって UI 文言ではない)。「攻略本で境界が未定義の露出候補」 |

数値リテラルの取り方: 識別子の一部 (`v2` `item_180`) と、点で連なる数字列 (版番号 `1.2.3`) は数値として扱わない。数値の直後 (空白 1 つまで) の英字列を単位として読む (`7 m/s`)。

### 短い整数の誤検出の抑制

`audit.min_numeric_length` (既定 3) 未満の有効桁数の数値は比較しない。有効桁数は符号・小数点・先頭の 0 を除いた桁数
(`180` → 3、`18` → 2、`0.24` → 2、`1.35` → 3)。masked 値 (value-hit) と UI 中の数値 (undefined-exposure) の両方に効く。

## 除外規則 (`audit.allow[]`)

誤検出は攻略本側で宣言して除外する。除外した所見は消えずに報告の `allowed[]` に移り、根拠とともに残る。

```json
"audit": {
  "min_numeric_length": 3,
  "forbidden_keys": ["drop_rate", "rng_seed"],
  "allow": [
    { "pattern": "src/ui/legacy-*.json", "rationale": "デバッグ表示専用の旧 HUD 表で、リリースビルドでは読み込まれない", "decided_by": "neco" },
    { "pattern": "**/*.proto", "kind": "key-hit", "ref": "forbidden_keys:rng_seed", "rationale": "サーバ間専用のメッセージでクライアントに届かない", "decided_by": "neco" }
  ]
}
```

- `pattern` (必須): 報告のファイルパスに対する glob。`**` はディレクトリをまたぎ、`*` と `?` は 1 階層の中だけ。`/` を含まないパターンは任意の深さのファイル名に一致する。
- `kind` / `ref` (任意): その種別・その参照の所見だけに絞る。`ref` は所見の `ref` と完全一致 (masked 値の参照、`forbidden_keys:<key>`、`literal:<数値>`)。
- `rationale` (根拠) と `decided_by` (決めた人) は必須。空白だけも不可。**根拠の無い allow はエラー** (スキーマで拒否し、監査は止まる)。
- 先に一致した規則が採用される。

## 報告形式

masked の値そのものは報告に出さない (第一原則)。所見が示すのは位置と、一致した攻略本の値の参照だけ。
`key-hit` のキー名と `undefined-exposure` の数値は masked ではないので出す。

JSON (`--format json`):

```json
{
  "summary": { "game_id": "bestia", "scanned_files": 4, "hits": 8, "warnings": 1, "allowed": 2,
               "by_kind": { "value-hit": 6, "key-hit": 2, "undefined-exposure": 1 } },
  "hits": [ { "kind": "value-hit", "file": "ui/strings.en.json", "line": 3, "column": 42,
              "ref": "enemy:bestia:bazooka-beetle.stats.body_mass", "reason": "数値リテラルが masked の数値と同じ値・同じ単位" } ],
  "warnings": [ { "kind": "undefined-exposure", "file": "ui/strings.en.json", "line": 7, "column": 22, "ref": "literal:750", "reason": "…" } ],
  "allowed": [ { "kind": "value-hit", "file": "ui/legacy-hud.json", "…": "…",
                 "allow": { "pattern": "**/ui/legacy-*.json", "rationale": "…", "decided_by": "neco" } } ]
}
```

- `hits[]` は value-hit と key-hit、`warnings[]` は undefined-exposure。並びはファイル・行・列の順。
- `by_kind` は除外後 (hits + warnings) の内訳。

Markdown (既定): 先頭の「要約」節が Revisor の所見にそのまま貼れる短さ (結果の一行、件数、上位 10 件)。続いて hits / warnings / allowed の全件表。

## ゲームリポへの組み込み (Revisor の PR ゲート)

1. 攻略本バンドル (`guide/<game-id>/`) の manifest に `audit` 節を書く (`forbidden_keys` と、必要なら `allow`)。
2. Commentarii をビルドしておく (`npm install --include=dev && npm run build`。`guide` は `dist/cli/main.js`)。
3. ゲームリポの Revisor 登録テストに次を足す (ゲームリポのルートから実行):

   ```
   node <Commentarii>/dist/cli/main.js audit mask --game guide/<game-id> \
     --scan <UI 文字列・ローカライズ表のディレクトリ> --scan <ネットワークスキーマのディレクトリ> --scan <ログ・セーブ形式のソース> \
     --fail-on hit
   ```

   終了コード 1 でゲートが止まる。所見の Markdown は stdout に出るので、そのまま Revisor の所見に貼れる。
4. 誤検出は攻略本の `audit.allow[]` に根拠つきで足して再実行する (ゲーム側のコードに抑制コメントを書く方式は取らない。除外の判断は攻略本の差分としてレビューされる)。
5. `warnings` (undefined-exposure) はゲートを止めない。攻略本に値を足して境界 (`shown` / `discoverable` / `masked`) を決めるか、allow で除外する。

## 限界

- 走査は字句の一致で、言語ごとの構文解析はしない。数値の直後の英単語は単位として読むので、`18 of` のような文は単位 `of` と見なされ、単位つきの masked 値とは一致しない。
- masked 項目の名前 (`aim_lead_divisor` など) は自動では露出禁止キーにしない (ゲームの内部コードには正当に現れるため)。プレイヤーに届く面で禁じたい名前は `forbidden_keys` に明示する。
- 攻略本に無い値は value-hit では検査できない。数値の直書きだけは undefined-exposure として拾う。
