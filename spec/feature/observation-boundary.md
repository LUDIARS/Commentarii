# 観測境界 — 観測項目の許可表と既定拒否

設計正本: `spec/architecture/design.md` §1 (原則 1 マスク原則・原則 2 プレイヤー条件)、§7.2 (Observation)。
Astra レビュー P0-1 (2026-10-09) の補正。Actio: `actio:7ab9fce8-4e31-4a97-9fe7-62db95bea1f7`。

## 1. 何を直したか

§1 は「境界の無い値は存在できない、既定は masked」と定めるが、観測フレーム (`schema/observation-frame.schema.json`) は
`self.resources` に裸の数値を、`extra` と `events[]` に任意の値を許していた。リプレイの R6 は `knowledge: masked` という
**ラベルの存在**しか検査しないため、ラベルの無い `extra.secret_hp: 87` は player の観測・リプレイ・オーバーレイ・レポートへ
素通りしていた。

本仕様は観測フレームの **場所** に許可表を置き、表に無い場所は中身を問わず拒否する (既定拒否)。

## 2. 許可表 (`src/observation/observation-fields.ts`)

player の観測フレームが持ってよい場所は次の 3 種だけ。

| 種類 | 場所 | 意味 |
|---|---|---|
| 境界不要のメタデータ (`meta`) | `tick` `t` `source` `mode` `purpose` `stage.id` `stage.elapsed` `stage.node` `entities[].instance` `entities[].confidence` `events[].kind` | フレーム自身の帳簿。ゲームの値ではない (プレイヤーは自分がどのステージの何秒目にいるかを知っている) |
| 構造上見えているもの (`shown`) | `self.pos` `self.hp` (ラベル必須) `entities[].entity` `entities[].pos` `entities[].screen` `entities[].state_guess` `extra.reach` `extra.ready_skills` `extra.items` `extra.signatures` `events.hit.instance` `events.miss.instance` `events.kill.instance` `events.damage-dealt.instance` `events.damage-dealt.amount` | プロトコルの慣例 ([adapter-protocol.md](adapter-protocol.md) §1)。出所は表の `origin` に書く |
| ゲームの宣言 | `self.resources.<name>` `extra.<key>` `events.<kind>.<field>` | manifest `observation.fields` で `knowledge` と `origin` (プレイヤーが何で知るか) を宣言したものだけ |

- 宣言 (`schema/observation-fields.schema.json`): `{ "path", "knowledge", "origin" }`。`path` は上の 3 形式だけで、基本項目は宣言できない
  (Commentarii が固定する)。
- 宣言の `knowledge` が `masked` の場所は player の観測に現れてはならない (`declared-masked`)。
- 宣言済みの場所の値は裸でも `{value, knowledge}` でもよい。ラベルが宣言より緩い (宣言 discoverable にラベル shown) ときは矛盾 (`label-contradicts`)。
- 表に無い場所は `unregistered`。値が `{value: 87, knowledge: "shown"}` と自己申告していても拒否する (アダプタの自己保証は登録ではない)。
- `omniscient` の観測は検査しない (検算・デバッグ専用、§7.6)。

## 3. 同じ規則をどこで使うか

判定関数は `observationBoundaryProblems(frame, declarations)` の 1 つ (契約 C-60)。全経路がこれを呼ぶ。

| 経路 | 宣言の出所 | 違反したとき |
|---|---|---|
| エンジンのドライバ (`src/engine/driver.ts`) | manifest `observation.fields` (`guide run` / `guide bench` が渡す) | 未登録は masked と同じ扱い (原則 1) で run を止める (`stop: masked-in-player`、pointer のみ記録)。decider は見ない |
| 記録器 / 読み込み (`src/replay/tick-invariants.ts` の R7) | リプレイ header の `observation_fields` (記録時の宣言の写し) | `unregistered-in-player`。記録器は書かず、読み込みはその行を issue にする |
| 人間プレイの取り込み (`guide import plays`) | manifest の宣言 + plays mapping が `knowledge` を明示した resource (`src/import/plays/observation-declarations.ts`) | 書く前の読み込み検査で失敗し、何も書かない。`knowledge` を書かない resource は masked と宣言される |
| オーバーレイ・レポート | 上の経路を通ったフレームからだけ作られる (reflect はドライバの検査の後、verify / feasibility / report plays は `parseReplay` 経由) | — |

`export` は攻略本 (正本) の書き出しで観測フレームを扱わない。正本側の境界は V03 / V04 と `player-view` が担う。

## 4. 互換移行

- この仕様より前に記録したリプレイは header に `observation_fields` を持たない。そのまま読むと**基本項目だけ**で検査され、
  裸の `resources` や独自の `extra` / イベント項目は `unregistered-in-player` で読めない。黙って通さない (原則 1)。
- 移行は「そのゲームの宣言を header に足す」こと。宣言は manifest `observation.fields` と同じ内容。同梱フィクスチャ
  (`tests/fixtures/replay/*.jsonl`) は `self.resources.boost` (HUD のブーストゲージ) と `events.hit-taken.instance` (攻撃してきた見えている個体のヒット表示) を宣言して移行した。
- 宣言を足せない (出所を説明できない) 値は masked であり、そのリプレイは player の記録として使えない。

## 5. 負例 (テスト `tests/observation/observation-boundary.test.ts`)

- ラベルの無い `extra.secret_hp` は `unregistered` (driver は止まり、記録器は書かず、読み込みは issue)。
- `extra.secret_hp: {value, knowledge: shown}` の自己申告も `unregistered`。
- 宣言の無い `self.resources.stamina` / `events.stunned.instance` は拒否、宣言すれば裸でもラベル付きでも通る。
- masked と宣言した場所、宣言より緩いラベルは拒否。未知のトップレベル (`debug`) は拒否。omniscient は検査しない。
- header に宣言の無い旧リプレイは裸の `resources.boost` で読めない。
- plays mapping で `knowledge` を書かない resource は masked と宣言される。manifest の宣言が mapping より優先する。
