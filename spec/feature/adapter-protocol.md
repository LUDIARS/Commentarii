# ゲームアダプタ契約とプロセス分離プロトコル (段階 3)

設計正本: `spec/architecture/design.md` §7.1〜7.3、§7.5。判断側は [engine.md](engine.md)。

## 1. 責務の分け方

| 側 | 持つもの |
|---|---|
| アダプタ (`src/adapter/game-adapter.ts` の `GameAdapter`) | 観測 (`observe`) と行動 (`act`)、ゲーム側の entity → 攻略本 ID (`identify`)、`player` モードで masked を観測に出さない責務 |
| エンジン (`src/engine/driver.ts`) | ティック駆動のループ、player モードの masked 二重検査 (見つけたら停止)、リプレイ記録 |

```ts
interface GameAdapter {
  hello(): Promise<{ game_id; adapter_id; mode }>;        // mode はアダプタが従うモード (要求と違えば停止)
  observe(): Promise<{ type: 'observation'; frame } | { type: 'end'; end: { result; summary } }>;
  act(action: ReplayAction): Promise<void>;                 // 直前に観測したティックの行動
  identify(gameEntity: string): string | undefined;         // 取り込み時の mapping と同じ表
  close(reason): Promise<void>;                             // ドライバが必ず 1 回呼ぶ
}
```

- 観測は `schema/observation-frame.schema.json` (§7.2)。`tick` は狭義単調増加、`t` は減らない。
- 行動は抽象アクション 1 つ (`move_to` / `attack` / `use_item` / `use_skill` / `wait` / `interact` / `custom`、+ `target` / `params`)。
  被演算子は攻略本 ID / ノード ID、entity のインスタンス番号、座標 `[x, y, z]`、`wait` は秒 (0 = 1 ティック)。
- 実時間のゲームは固定周期で、ターン制は手番ごとに観測を出す。エンジンは観測 1 つに行動 1 つで答える。

### 観測の慣例 (エンジンが読むもの)

| 場所 | 意味 |
|---|---|
| `self.hp.value` | HP バーの比 (0〜1)。`knowledge` は通常 `shown` |
| `self.resources.<name>` | 資源の量 (数値か `{value, knowledge}`)。player では manifest `observation.fields` に宣言したものだけ |
| `extra.reach` | 自分の基本攻撃が届く距離 (shown) |
| `extra.ready_skills` | 今使えるスキル ID の配列 |
| `extra.items` | 所持アイテム ID → 個数 |
| `entities[].state_guess` | 状態機械の状態参照 (`state:<game>:<id>#<state>`)。状態機械が masked なら player では出さない |

### mode の責務

- `player`: `knowledge: masked` の値を観測のどこにも入れない (段 1 のゲーム内 API アダプタは mode を見て落とす)。
  ドライバは全観測を検査し、1 つでもあれば decider に渡す前に止め、run を `abort` (`stopped: masked-in-player`、pointer のみ記録) にする。
  観測項目の許可表 ([observation-boundary.md](observation-boundary.md)) に無い場所 (宣言の無い `extra.<key>` など) も同じく止める
  (宣言の無い値は masked、原則 1)。ゲーム固有の項目は manifest `observation.fields` で宣言する。
- `omniscient`: 検算・デバッグ専用。masked を含んでよいが、スコア・昇格根拠には使わない (原則 2)。

## 2. プロセス分離プロトコル (JSON Lines)

ネイティブゲームは別プロセスから始める (§7.3)。ゲームが `guide run --adapter stdio ...` を子プロセスとして起動し、その
stdin / stdout をつなぐ。

### 起動主体・方向・mode (Astra レビュー P1-7 で統一、2026-10-09)

| 項目 | 決まり |
|---|---|
| 起動主体 | **ゲーム**。ゲームが自分の起動オプション (Bestia なら `--commentarii-adapter=stdio --commentarii-mode=player|omniscient`) を受けて、`guide run --adapter stdio --mode <同じ mode> ...` を子プロセスとして起動する |
| mode を決める側 | ゲームの起動オプション。ゲームはその mode で観測を出し分け、`hello` で **宣言** する。エンジンは自分の `--mode` と比べ、違えば `bye {reason: mode-mismatch}` で止める。エンジンからゲームへ mode を送る行は無い |
| ゲーム → エンジン | `hello` (最初に 1 回) → `observation` (毎ティック) → `bye` (ゲームが終わったとき) |
| エンジン → ゲーム | `action` (観測 1 つにちょうど 1 回) → `bye` (エンジンが先に止めたとき) |
| player の観測の中身 | [observation-boundary.md](observation-boundary.md) の許可表に従う。表に無い場所はエンジンが masked と同じ扱いで止める |

描画タップ (段 2) はこのプロトコルとは別の流れで、[render-tap-contract.md](render-tap-contract.md) に従う (`--frames` で受け、行動は `--act` で別経路)。

- 1 行 1 JSON オブジェクト、UTF-8、改行は LF (エンジンは読み込みで末尾の CR を捨てる)。空行は無視。
- エンジンの stdout はプロトコル専用。エンジンの診断・run の結果は stderr に出す。
- 版: `protocol: 1`。

### ゲーム → エンジン

| type | フィールド | いつ |
|---|---|---|
| `hello` | `protocol` (1)、`game_id`、`adapter_id`、`mode` (`player` / `omniscient`)、任意 `identities` (ゲーム側キー → entity ID) | 最初に 1 回 |
| `observation` | `frame` (Observation) | 毎ティック |
| `bye` | `result` (`success` / `fail` / `abort`)、任意 `summary` | ゲームが終わったとき |

### エンジン → ゲーム

| type | フィールド | いつ |
|---|---|---|
| `action` | `tick` (答えた観測の tick)、`action` | 観測 1 つにちょうど 1 回 |
| `bye` | `reason` (`tick-limit` / `masked-in-player` / `mode-mismatch` / `error`) | エンジン側が先に止めたとき |

```text
game  -> {"type":"hello","protocol":1,"game_id":"bestia","adapter_id":"bestia-api","mode":"player"}
game  -> {"type":"observation","frame":{"tick":0,"t":0,"source":"game-api","mode":"player",...}}
guide -> {"type":"action","tick":0,"action":{"move_to":"node:center"}}
game  -> {"type":"observation","frame":{"tick":1,...}}
guide -> {"type":"action","tick":1,"action":{"attack":2}}
game  -> {"type":"bye","result":"success","summary":{"time_sec":41.2}}
```

- ゲームが `bye` 無しで入力を閉じたら run は `abort` (`stopped: game-closed-channel`)。
- 不正な行 (JSON でない・未知の type・版違い・`frame` の構造不足) はプロトコル誤りとしてエンジンが例外で止まり、記録中なら footer (`abort`) を書く。

## 3. C++ 側

`adapter/cpp/commentarii_adapter.hpp`: 構造体 (Hello / ObservationFrame / Action / Bye) と JSON 行の読み書き関数の宣言だけ。
依存ライブラリ無し、ビルドはしない (実装はゲーム側 = Bestia リポの PR)。TypeScript の契約が正本で、ヘッダは同じ形を写す。

## 4. 実装済みのアダプタ

| ID | 置き場所 | 用途 |
|---|---|---|
| `commentarii-sim` | `src/adapters/sim/` | 模擬アダプタ (テスト・ベンチ)。[engine.md](engine.md) §8 |
| stdio | `src/adapters/stdio/` | 上のプロトコルで別プロセスのゲームとつなぐ |

Bestia 実機アダプタ (段 1: ゲーム内 API) は Bestia リポ側の次の run で作る。
