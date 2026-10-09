# 段階 6B: Bestia 実機アダプタ (Bestia リポ側)

対象リポ: `E:/Document/Ars/Bestia` (public、C++、Pictor 上の 3D モンスターバトルロイヤル。プレイヤー + 固定 BT の 4 体、`--random-ai` で 5 体 AI)。設計正本は Commentarii の `E:/Document/Ars/Commentarii/spec/architecture/design.md` §7.3 (アダプタ契約)、§9 (Bestia は最初のアダプタ対象)。契約の正本は `E:/Document/Ars/Commentarii/spec/feature/adapter-protocol.md` (JSON Lines、stdin/stdout: `hello` → `observation` ↔ `action` → `bye`) と C++ ヘッダ `E:/Document/Ars/Commentarii/adapter/cpp/commentarii_adapter.hpp` (宣言のみ。コピーして使う。Commentarii を submodule にしない)。攻略本は `E:/Document/Ars/Commentarii/samples/bestia/` (entity ID と `render_signature` はここに合わせる)。

## 補正 (Astra レビュー P1-7 / P0-1、2026-10-09)

- 起動主体と方向を統一した (`spec/feature/adapter-protocol.md` §2「起動主体・方向・mode」): **Bestia が** 起動オプション
  `--commentarii-adapter=stdio --commentarii-mode=player|omniscient` を受け、`guide run --adapter stdio --mode <同じ mode>` を子プロセスで起動する。
  mode は Bestia の起動オプションで決まり、`hello` で **宣言** する (ゲーム → エンジン)。本文の「`mode` は `hello` で受け取り」は誤り。
  エンジンは自分の `--mode` と違えば `bye {reason: mode-mismatch}` で止める。
- player の観測は `spec/feature/observation-boundary.md` の許可表に従う。クールダウン・武器・リング半径など基本項目に無い値は
  `extra.<key>` / `self.resources.<name>` として samples/bestia の manifest `observation.fields` に `knowledge` と出所つきで宣言する
  (宣言は Commentarii 側の後続 PR)。宣言の無い場所が 1 つでもあるとエンジンは run を止める。
- 本アダプタは段 1 (ゲーム内 API) の経路。描画タップ (段 2) の契約 `render-tap/1` とは別で、player 観測を「見えている個体だけ」に
  絞る判定は Bestia 側の責務 (視界判定の根拠をテストで示す)。

## 目的

Bestia のプレイヤー (または任意の 1 体) を外部の Commentarii オートプレイヤーが操作できるようにする。観測経路は段 1 (ゲーム内 API、`omniscient` 用) と、`player` モードでは「見えている個体だけ」に絞った観測の両方を出す。

## 成果物

1. **起動オプション** `--commentarii-adapter[=stdio]` (Bestia の慣例に合わせる): 指定された 1 体 (既定はプレイヤー) の操作を、stdin から来る `action` 行で行い、ティックごとに `observation` 行を stdout へ出す。ヘッドレス (描画無し) で回せるとなお良いが、既存の構成で難しければ描画ありのまま。
2. **観測** (契約の Observation): `self` (位置、HP 比、クールダウン、武器)、`entities[]` (他個体: `entity` は samples/bestia の ID、`instance`、位置、推定 HP は `omniscient` のときだけ実値、`player` のときは **視界内の個体だけ** を出し HP は出さない)、`stage` (リング半径・経過時間)、`events[]` (被弾、撃破)。`mode` は `hello` で受け取り、`player` では内部値 (HP 実値、乱数) を一切出さない (Commentarii 側が `find-masked-pointers` で検査する)。
3. **行動**: `move_to` (方向か座標)、`attack`、`wait`、`custom:charge` 等 Bestia 固有の行動は `custom` で名前を付け、samples/bestia の攻略本側 (`glossary` / tactic の `do`) と名前を揃える (必要なら samples/bestia への追記は Commentarii 側の後続 PR で。本 run は Bestia 側だけ)。
4. **`identify`**: Bestia の種別 (`Species`) → samples/bestia の entity ID の対応表を 1 か所に置く。
5. **固定 BT との比較**: 既存の `behavior.cpp` の BT はそのまま残す (6F で Commentarii 側が同等の定石をデータで再現する)。アダプタ経由の個体と固定 BT の個体を同じリングで走らせられること。
6. **テスト**: Bestia のテスト慣例 (`src/tests.cpp`) に、フェイクの stdin / stdout で `hello` → 数ティック → `bye` の往復と、`player` モードで視界外の個体と HP 実値が出ないことを足す。GCC で通ること。
7. **文書**: Bestia の README / spec に「Commentarii アダプタ」の節 (起動方法、観測と行動の対応、`player` / `omniscient` の違い)。

## 受入条件

- Bestia の既存ビルドとテストが通る (GCC)。アダプタ未指定で挙動が変わらない。
- `player` モードの観測に HP 実値・視界外の個体・乱数が含まれない (テスト)。
- `hello` の `mode` で観測の出し分けが変わる (テスト)。
- PR 説明に: 変更した境界 / 復旧方法 / 実施した検証 / 未実施。

## 作業の進め方

- 作業場所は親が渡した worktree とブランチ (`feat/commentarii-adapter`)。Bestia の `main` を直接編集しない。ヘッダ変更後はクリーンビルド (`rm -rf build`)。
- Bestia は public: 秘匿語・private ゲームの固有名を入れない。
- ビルドとテストはフォアグラウンドで待つ。
- 完了 = コミット → Revisor local PR 提出 (`node E:/Document/Ars/command-runner.mjs rv:submit --repo <worktree>`。Bestia の Cc 略称は `Bestia`) → **PR 番号と検証結果を報告してから** 終了指示を待つ。マージはしない。ブロック所見は直して再提出する。
