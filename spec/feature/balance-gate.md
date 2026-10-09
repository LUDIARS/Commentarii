# バランス回帰ゲート (段階 5C)

設計正本: `spec/architecture/design.md` §14.C、§8.3、§14.A。Astra レビュー P1-6 (2026-10-09) を反映。
Actio: `actio:7ab9fce8-4e31-4a97-9fe7-62db95bea1f7` (引継ぎ run の範囲。旧依頼文 `spec/tasks/2026-10-09-stage-5c-balance-gate.md` は要求の履歴)。
コード: `src/bench/` (結果の保存形式)、`src/gate/` (比較・ゲート・判断回帰)、`src/autoplay/save-bench-result.ts`。

## 1. 2 種類の結果を混ぜない

| 結果 | コマンド | 何を示すか | 何を示さないか |
|---|---|---|---|
| **live balance** (`kind: live-balance`, `evidence: sim`) | `guide bench --save` → `guide bench compare` / `guide gate balance` | 同じ条件 (ペルソナ・seed・予算) で sim を実走させたときの、クリア率・時間・被ダメージ・意図ズレの変化 | 実機での変化、人間の体験 |
| **decision regression** (`kind: decision-regression`, `evidence: replay`) | `guide bench replay` | 記録済みの観測列に対して、今のエンジンと攻略本が同じ判断をするか (一致率と分岐した run) | バランス・体験。判断が変わった後にゲームがどう動いたかは replay では分からない |

固定 replay の一致は判断の回帰であって、live のバランス回帰ではない。replay が一致しても「体験は検証済み」とは扱わない。
sim の実走結果は sim の証跡として出し (`evidence: sim`)、実機の証跡とは呼ばない。

## 2. `guide bench --save <bench/label.json>` (結果の保存、`schema/bench-result.schema.json`)

- `compatibility` (比較できる条件。base と head で全て同じでなければ比較しない): `adapter`、`persona` + `persona_hash` (ペルソナ文書の内容ハッシュ)、
  `seed` + `seeds` (各 run の seed)、`runs`、`ticks` (予算)、`mode`、`purpose`、`decision_mode` (`player-knowledge` / `intent-assisted`)、`tactics` (`guide` / `none`)。
- `versions` (測る対象。base と head で違ってよい): `manifest_version`、`game_builds`、`bundle_hash` (正本の全文書の内容ハッシュ)、`overlay_hash`
  (エンジンが読んだオーバーレイ、無ければ null)、`engine_version`。
- `metrics`: クリア率と 95% Wilson 区間、クリア時間の p50 / p90、被ダメージ p50、定石の採用割合。
- `divergences`: `purpose: coverage` のベンチだけ、ベンチの run を `guide verify intent` と同じ規則で分類した件数と、未許容の望ましくないズレの ID。それ以外は null。
- 固有名・パスは入れない (ID と内容ハッシュだけ)。書く前に schema で検査する。保存先は攻略本ディレクトリ相対 (ゲームリポなら `guide/<game-id>/bench/`)。

## 3. 比較 `guide bench compare <base> <head> [--game <bundle-dir>] [--json]` と閾値

- `compatibility` が 1 つでも違えば **比較不能** として理由を並べ、指標も候補も出さない (exit 1)。違う条件の差分は見せない。
- 比較できるとき、`versions` の違い (攻略本・オーバーレイ・エンジン・ビルド) を「測った変更」として並べ、指標ごとの変化を出す。
- 閾値 (manifest `bench.thresholds`、無ければ既定):

| 項目 | 既定 | 候補になる条件 |
|---|---|---|
| `clear_rate_drop` | 0.1 | クリア率が 10 ポイントを超えて下がった |
| `time_p50_increase` | 0.2 | クリア時間 p50 が 20% を超えて増えた |
| `time_p90_increase` | 0.2 | クリア時間 p90 が 20% を超えて増えた (p50 では隠れる遅い裾) |
| `damage_p50_increase` | 0.2 | 被ダメージ p50 が 20% を超えて増えた |
| `new_undesirable_divergence` | 1 | head に base に無い未許容の望ましくないズレがこの件数以上ある (coverage ベンチ) |

閾値を超えた指標と新しいズレだけが「体験ブロック候補」。候補は **sim 上の実測変化** であり、人間の体験が変わったことの検証ではない。

## 4. `guide bench replay --game <bundle-dir> --runs <dir|files...> [--json]` (CI 向けの短い判断回帰)

記録済みリプレイを今の攻略本 (オーバーレイ込み) と、header の persona / `decision_mode` のエンジンで `play` し、全ティック一致した run の割合、
ティック一致率、最初に分岐した run と tick を出す。出力には常に「判断回帰であってバランス・体験の検証ではない」と書く。

## 5. `guide gate balance --game <bundle-dir> --base <base.json> --head <head.json> [--fail-on block|none] [--json]`

Revisor の審査に貼る JSON / Markdown。先頭に判定 (`pass` / `candidates` / `incomparable`)、次に候補、指標表、測った変更、「この判定が示さないこと」。

- `--fail-on block` (既定): 候補があれば exit 1。`--fail-on none`: 候補では落とさない。
- **比較不能は常に exit 1**。条件の違う比較を通すと偽の緑になるため。

## 6. ゲームリポへの組み込み

1. ゲームリポの `guide/<game-id>/bench/` に基準の結果を置く (`guide bench --game guide/<game-id> --persona <slug> --runs N --seed S --save bench/main.json`)。
   基準は main のマージ時に夜間ジョブで作り直す。seed・run 数・予算は基準と PR で同じにする (違うと比較不能で落ちる)。
2. Revisor の登録テストには速い `guide bench replay --game guide/<game-id> --runs guide/<game-id>/replay/` を足す (判断回帰)。
3. 夜間または手動で `guide bench ... --save bench/<commit>.json` を走らせ、`guide gate balance --base bench/main.json --head bench/<commit>.json` を Revisor に出す (live balance)。
4. 閾値は基準を同じ条件で 2 回走らせた差 (同じ seed なら 0、seed を変えた揺れ) より大きく決める。小さい run 数の p50 / p90 は揺れるので、run 数を増やすか閾値を広げる。

## 7. テストで確かめたこと (`tests/gate/balance-gate.test.ts`)

- 閾値を超えた指標だけが候補、`--fail-on block` で非 0、`--fail-on none` で 0、比較不能は常に非 0。
- ペルソナ・seed・予算・purpose・decision_mode・アダプタが違う結果は拒否し、指標を出さない。
- sample のコピーで base を保存 → kite 定石を待機だけに弱めた head を保存 → ゲートが候補を出して落ちる (sim 実測: time p50 20.6 → 21.6 秒、damage p50 110.4 → 122.7)。
- 別 seed の結果は「比較不能 (seed differs)」で落ちる。
- `bench replay` は記録済み run の一致率と分岐 run を出し、判断回帰の注記を付ける。
- 結果 JSON に固有名・パスが無い。
