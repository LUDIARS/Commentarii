# 描画タップ契約 render-tap/1 — raw tap と player 観測の分離

設計正本: `spec/architecture/design.md` §7.1 (観測経路の段 2)、§7.2、§11 の段 6。Astra レビュー P0-2 / P1-7 (2026-10-09) の補正。
Actio: `actio:7ab9fce8-4e31-4a97-9fe7-62db95bea1f7`。スキーマ `schema/render-frame.schema.json`、golden `tests/fixtures/render-tap/golden-v1.jsonl`。
Pictor (段 6P) と Bestia (段 6B) はこの契約に合わせる。契約を変えるときは版 (`contract`) を上げる。

## 1. 原則

**描画に出したもの (raw tap) は、プレイヤーが見たもの (player 観測) ではない。** 壁の裏で深度テストに落ちた draw、透明な draw、
UI パネルの clip 外の文字、影・反射・深度 pass の draw、アセット名そのものは、提出されても人間には見えない (あるいは見えても
名前は分からない)。受信側は raw tap から「player のカメラに映ったと示せる draw」だけを選び、外見から分かる範囲でだけ
entity を名付けて Observation (`source: render-tap`) を組む。示せない draw は `unknown` として観測に入れない。

GPU と同期して厳密な可視性を保証することは約束しない。タップは画素を読み戻さず GPU を待たないので、遮蔽の根拠は
前フレームのクエリ結果 (`visibility_lag_frames`) でありうる。厳密でない分は「見えたと示せない = 入れない」側に倒す。

## 2. 行の形 (JSON Lines、1 行 1 オブジェクト、UTF-8、LF)

- **frame**: `contract: "render-tap/1"`、`seq`、`frame`、任意 `tick`、`t`、`observer {id, viewport}`、`camera {view, projection}`、
  任意 `visibility_lag_frames`、`passes[] {name, kind, draws[]}`、任意 `dropped {draws, reason}`。
- **end**: `contract`、`seq`、`end: shutdown | error`。end 行無しで流れが閉じたら切断。

### 2.1 固定する約束

| 項目 | 約束 |
|---|---|
| 行列 | 4x4、**列優先** (要素 12〜14 が平行移動)、右手系、Y 上、単位は manifest `coordinates.unit` |
| 画面座標 | viewport のピクセル、原点左上、y 下向き。矩形は `[x, y, w, h]` |
| フレームと時刻 | `frame` は描画器のフレーム番号で狭義単調増加。`t` はゲーム内時刻 (秒、壁時計ではない) で減らない。`tick` はゲームが描画器に伝えたときだけ、減らない |
| `seq` | タップが作ったフレームごとに +1 (出せずに捨てたものも数える)。飛び = 背圧で失ったフレーム |
| インスタンス | `instance` は描画器のハンドル。別の物に使い回すときは `generation` を +1 する。同じ generation で外見が変われば契約違反 (`instance-reuse`) |
| pass の種類 | `scene` / `ui` だけが観測者の画面に出うる。`shadow` / `reflection` / `depth-prepass` / `postprocess` / `other` は診断用に出してよいが観測にならない |
| 可視性の根拠 | draw ごとに `occlusion-passed` / `occlusion-failed` (遮蔽クエリ) / `frustum-only` (視錐台内だが遮蔽不明) / `unknown` |
| 透明度 | `alpha` (material × instance の最終不透明度、無ければ 1) |
| UI | ui pass の draw は任意で `clip` (所属パネルの矩形) と `ui` (`{role: bar, element, fill}` = HP バー等の充填率、`{role: glyph, element, glyph}` = 数字・文字) |
| 名前の付け方 (`identity`) | `asset-name` (アセット名由来の安定 ID) / `content-hash` (頂点・インデックス・テクスチャ内容のハッシュ) / `count-hash` (頂点数 + インデックス数だけ。衝突するので識別に使えない) |
| 欠損 | フレーム内で記録しきれなかった draw は `dropped` (そのフレームは不完全: 映っていない個体は「消えた」ではなく「不明」) |

## 3. 流れの不変条件 (`src/render-tap/render-frame-sequence.ts`)

`loss` (seq の飛び) / `frame-order` / `time-order` (t・tick の逆行) / `instance-reuse` / `generation` (世代の逆行) /
`after-end` / `disconnect` (end 行無しの終端)。受信側は報告し、補わない。

## 4. 見えたかの判定 (`classifyDraw`、契約 C-61)

| 判定 | 条件 |
|---|---|
| 除外 `pass-not-visible` | scene / ui 以外の pass |
| 除外 `transparent` | `alpha` が 0 |
| 除外 `off-viewport` | 矩形が viewport と重ならない (面積 0 を含む) |
| 除外 `hidden-ui` | ui pass で `hidden` タグ |
| 除外 `clipped` | ui pass で矩形が `clip` と重ならない |
| 見えた (ui) | 上のどれにも当たらない ui draw |
| 除外 `occluded` | scene で `occlusion-failed` |
| 見えた (scene) | scene で `occlusion-passed` |
| 不明 `no-occlusion-evidence` | scene で `frustum-only` / `unknown`。観測に入れない |

## 5. 外見からの識別 (`identifyAppearance`、契約 C-62)

- 外見の鍵は `mesh` + 並べ替えた `material[]`。攻略本の `render_signature` から逆引き索引を作る。
- 鍵がちょうど 1 entity にだけ対応するときだけ entity ID を付ける。2 種以上が同じ外見なら `ambiguous` で名前を付けない
  (プレイヤーが見分けられないものの正体を漏らさない)。
- `count-hash` は常に `unidentifiable`。索引に無ければ `unknown-signature` (段階 4 の reflect が雛形を起こす)。
- 描画器のアセット ID は識別関数より先へ出さない。Observation に載るのは entity ID か、何も無いか。

## 6. 分離の境界 (`selectPlayerDraws`、契約 C-63)

`observer.id` が `player-camera` のフレームだけを受ける (他のカメラは `ObserverError`)。結果は
`seen[]` (見えた scene draw: instance、一意なら entity、識別の種類、world 位置、画面矩形)、`ui[]` (見えた ui の bar / glyph)、
`excluded` (理由別の件数)、`unknown` (件数)、`incomplete` (`dropped` があった)。受信器はこの結果だけから Observation を組む。

## 7. 負例 (テスト `tests/render-tap/render-tap-contract.test.ts`)

- 壁の裏: `occlusion-failed` は除外、`frustum-only` は不明。どちらも観測に入らない。
- 同じ外見の別種: `ambiguous` で entity 無し。`count-hash` は識別されない。
- 非表示 UI: `hidden` タグのボス HP バーと clip 外の敵 HP 数字は除外され、値 (0.35 / "87") は結果に現れない。
- 影・反射: shadow pass の draw と reflection pass に映った (遮蔽された) トンボは観測にならない。
- 選択結果にアセット ID (`mesh:` / `mat:` / 指紋) が現れない。
- 流れ: seq の飛び、frame・t・tick の逆行、世代を上げないハンドル再利用、end 後の行、end 無しの切断。

## 8. 段 6 以降への引き継ぎ

- 段 6 の受信アダプタ (`src/adapters/render-tap/`) は `selectPlayerDraws` の結果から Observation を組む。入力の CLI は
  `guide run --adapter render-tap --frames <frames.jsonl|pipe> --act stdio|none` とし、既存の `--observe` (reflect の出力先) は変えない。
- UI の値 (HP バーの fill、数字の glyph) を観測のどの場所に置くかは `glossary` の UI 対応表で決め、[observation-boundary.md](observation-boundary.md)
  の許可表 (`self.hp` は基本項目、それ以外は manifest 宣言) に従う。
- 6P (Pictor) は §2 の形を出す。アセット名が取れない draw は `content-hash` を優先し、取れなければ `count-hash` (識別不能) にする。
- 6B (Bestia) の観測は段 1 (ゲーム内 API) の経路であり、render-tap 契約ではなく [adapter-protocol.md](adapter-protocol.md) に従う。
