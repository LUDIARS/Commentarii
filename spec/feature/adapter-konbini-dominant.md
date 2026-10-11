# 2 本目のアダプタ: KonbiniDominant (段 8) — 接続契約

設計 §12 段 8「攻略本とアダプタの差し替えだけで動く」。対象は §15 の推奨どおり KonbiniDominant (KD)。
この文書は KD 側の stdio アダプタと Commentarii の攻略本 (`samples/konbini-dominant/`) が守る契約で、
プロトコル自体は `adapter-protocol.md` (JSON Lines、hello の向きと mode 宣言は P1-7 で統一済み) に従う。

## 1. 経路と役割

- KD の自動プレイは `PlaytestPilot` (BT、`src/app/playtest_pilot.cpp`) が `RenderSnapshot` → `PlayerCommand` を毎 tick 決めている。
  アダプタはこの位置に入り、判断だけを Commentarii に外出しする (BT と同じ入出力)。
- 観測経路は `game-api` (snapshot を直接読む)。render-tap ではないので、**player モードで出すのは §2 で宣言した項目だけ**
  (観測境界: 許可表 + 既定拒否、`observation-boundary.md`)。
- headless で動く (`KONBINI_BUILD_RENDER=OFF` の構成)。固定 tick (HUD の `ticksPerSecond`、既定 10)。
- 範囲は Phase 1。headless の既定 content は `phase1.json` (Phase 1 のみ)。キャンペーン (Phase 2 以降、反転店、次元) は攻略本が扱うまで範囲外。

## 2. 観測 (player モード)

| 観測の場所 | KD の出どころ | 境界 |
|---|---|---|
| `self.resources.cash` | `HudViewModel::cashCredits` | shown (HUD) |
| `self.resources.stores` | `HudViewModel::storeCount` | shown (HUD) |
| `self.resources.customers` | 自チェーンの `ChainMatchView::customers` (HUD の `CUSTOMERS <自分>/<総人口>`) | shown (HUD) |
| `self.resources.population` | `HudViewModel::totalPopulation` (同じ表示の分母) | shown (HUD) |
| `self.resources.domination` | `floor(customers * 100 / population)` (population 0 なら 0)。勝利条件の `dominationPercent` (定数 60) ではない | shown (HUD の表示から計算) |
| `self.resources.ticks_remaining` | `HudViewModel::ticksRemaining` | shown (HUD) |
| `self.resources.economy_in` | `HudViewModel::ticksUntilEconomy` | shown (HUD) |
| `entities[]` (店) | `RenderStore` (自分のいる次元のもの): `entity` = 自チェーンは `actor:konbini-dominant:own-store`、他チェーンは `enemy:konbini-dominant:store-<chain>` (攻略本にあるチェーンだけ。aion など無いものは entity を付けず instance だけ = 未知の個体)、`instance` = StoreId、`pos` = positionMeters | shown (地図に描画) |
| `entities[]` (空き区画) | `RenderFacility` で `isBuildable` かつ自分のいる次元でどのチェーンの店も建っていないもの。**チェーン選択中は出さない**。`entity` = `actor:konbini-dominant:lot`、`instance` = FacilityId、`pos` | shown (地図に描画) |
| `entities[].state_guess` | 店の `isEncircled` → `state:konbini-dominant:store#encircled`、そうでなく `captureTicksRemaining > 0` → `#capturing`、どちらでもなければ `#open` | shown (店の表示) |
| `stage.id` / `stage.elapsed` | `stage:konbini-dominant:first-playable`、`phaseTicks / ticksPerSecond` | meta |
| `self.resources.chain_selected` | `phase != ChainSelect` なら 1、それ以外 0 (定石の条件に使う) | shown (チェーン選択画面が閉じた) |
| `extra.phase` | `HudViewModel::phase` (`chain_select` / `phase1` / `result` ...) | shown (HUD) |
| `extra.chain` | `HudViewModel::playerChain` | shown (HUD) |

manifest の `observation.fields` で上の `self.resources.*` と `extra.phase` / `extra.chain` を宣言する。

**出さないもの (player モード)**: 人口セル (`RenderPopulationCell`)、他チェーンの `customers` / `buildCost` (KD の HUD はプレイ中に他チェーンの顧客数を出すが、契約はより厳しい側に置く)、`revenuePermille`、
`faith`、`aiPeriodTicks`、内部 RNG。人口が画面でどう見えるかは KD 側で確認できるまで未宣言 (既定拒否) にする。
`omniscient` モードはこれらを `extra.*` に出してよいが、その run は player の能力の根拠にしない。

## 3. 行動

| Commentarii の行動 | KD の `PlayerCommand` |
|---|---|
| `{"custom": "select_chain", "params": {"chain": "<chain>"}}` | `SelectChainCommand{chain}` |
| `{"interact": <lot instance>, "params": {"slot": <n>}}` | `PlaceStoreCommand{chain=playerChain, facilityId=instance, verticalSlot=slot}` (slot 既定 0) |
| `{"custom": "campaign", "params": {"action": "image_strategy\|invert_store\|view_dimension\|escape\|choose_skill", "facility": <id>, "slot": <n>, "dimension": <n>}}` | `CampaignCommand` |
| `{"wait": <sec>}` | 何も出さない |

不正な行動 (存在しない区画、所持金不足) は KD の検証にそのまま任せ、結果は次の観測と `events[]` (`place-rejected`) で返す。

## 4. 起動・hello・終了

`adapter-protocol.md` §2 のとおり、起動主体はゲーム。KD は `--commentarii-adapter=stdio --commentarii-mode=player|omniscient` を受けて
`guide run --adapter stdio --mode <同じ mode> --game <KD 攻略本> ...` を子プロセスとして起動する。

- hello: `{"type":"hello","protocol":1,"game_id":"konbini-dominant","adapter_id":"konbini-dominant-stdio","mode":"player"}`。
- 観測: `{"type":"observation","frame":{...}}` を毎 tick。`source` は `game-api`、`self.pos` はカメラの注視点 (ワールド座標)。
- 終了: `MatchOutcome` が None 以外になったら `{"type":"bye","result":"success|fail","summary":{"outcome":"win|lose|draw","domination":<%>,"stores":<n>}}`。
  Win → success、Lose → fail、Draw (時間切れで首位が並ぶ) → fail (`outcome: draw`)。`domination` は §2 と同じ定義。

ゴールデン: `tests/fixtures/konbini-dominant/session.jsonl` (Commentarii 側)。KD 側のアダプタは同じ局面で同じ形の行を出す。
局面は HUD・施設・店を手で組み立てた入力でよい (値は実ゲームに寄せる: seban_ileban の初期資金 4000 = 5 店分、建設費 800)。

## 5. 受入

1. Commentarii 側 (この PR 系列): KD の攻略本 `samples/konbini-dominant/` が validate を通り、記録フレーム (KD 側の golden) で
   同じエンジン (`createUtilityBtDecider`) が §3 の行動を返す。Bestia 用コードを変えずに攻略本の差し替えだけで動く。
2. KD 側 (子委託、KD リポ): §1–§4 のアダプタ実行ファイルと golden フレーム、BT (`PlaytestPilot`) と同じ局面で同じ種類の行動が出ることの試験。
3. 実機: KD を headless で起動し、Commentarii が判断 → 入力 → 次の観測、が 1 試合通ること (段 8 の最終受入)。
