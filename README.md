# Commentarii (Cm)

攻略本ツクール + 汎用オートプレイヤー。

- **攻略本 (Guide Bundle)**: ゲーム 1 本分の構造化知識 (敵・アイテム・スキル・ステージ地図・ルール・状態機械・定石)。JSON が機械正本、人間向け Markdown はツクールが生成する。
- **攻略本ツクール (Guide Maker)**: 取り込み・検証・描画・書き出し・学習結果の統合を行う CLI と Web 編集画面。
- **オートプレイヤー (Auto Player)**: Utility AI で定石を選び、Behavior Tree で手順を実行し、観測との差分を攻略本へ戻す。ゲーム差はゲームアダプタに閉じ込める。

## 第一原則: マスク原則

攻略本の全ての値は「プレイヤーが知りうる (`shown` / `discoverable`)」か「知ってはならない (`masked`)」かの境界を必ず持つ。既定は `masked`、昇格には根拠と人間承認が要る。`masked` は別ファイルに分離し、書き出し・公開・オートプレイヤーの既定動作に混ざらない。オートプレイヤーは人間と同じ情報だけで判断するのが既定。

設計正本: [spec/architecture/design.md](spec/architecture/design.md)

攻略本バンドルは各ゲームリポの `guide/<game-id>/` に置く。このリポはゲーム固有情報を持たない (同梱サンプルは public ゲーム Bestia のみ)。

## 現在の段階

段階 1 (設計 §11): 共通スキーマ・`validate`・`render`・`report knowledge`。
段階 2: 取り込み `import masters` (CSV / JSON / SQLite + mapping)・`import map` (grid / navgraph / zones)・`import spec` / `intent import` (LLM 下書き)。仕様は [spec/feature/import.md](spec/feature/import.md)。
段階 3 (+3E): `export` (`bundle.json` + 索引、既定 player)、判断エンジン (Utility が狙いを選び BT が手順を実行、decider `utility-bt`)、アダプタ契約 (TypeScript + JSON Lines プロトコル + C++ 最小ヘッダ)、模擬アダプタ `sim`、ペルソナ (`novice` / `expert` / `explorer`)、`run` / `bench`。仕様は [spec/feature/engine.md](spec/feature/engine.md) と [spec/feature/adapter-protocol.md](spec/feature/adapter-protocol.md)。
段階 4D: 人間プレイログの取り込み `import plays` (テレメトリ → リプレイ形式、HMAC で匿名化、別解候補 `candidates.json`) と `report plays` (人間 vs オートプレイヤーの数表)。仕様は [spec/feature/human-plays.md](spec/feature/human-plays.md)。

| 置き場所 | 中身 |
|---|---|
| `schema/` | JSON Schema (draft 2020-12)。`value` (共通フィールド) / `manifest` / `glossary` / `entity` / `entity.masked` / `stage` / `map` / `events` / `rule` / `state` / `tactic` / `intent` / `observation`、ID 形式は `id` |
| `samples/bestia/` | Bestia の archetype を手で起こした最小バンドル (敵 3・ステージ 1・ルール 2・状態機械 1・定石 2・意図 1・masked ファイル 1) |
| `spec/feature/validate-checks.md` | `validate` の検査項目 V01〜V12 の固定リスト |
| `samples/bestia/masters/` | 取り込みの入力例 (`archetypes.csv` / `mapping.json` / `ring.grid.txt`)。`validate` の対象外 |
| `prompts/` | `import spec` / `intent import` の LLM プロンプト |
| `personas/` | ゲーム非依存のペルソナ (`schema/persona.schema.json`)。バンドル内 `personas/` の同名が優先 |
| `adapter/cpp/` | プロセス分離アダプタの C++ 最小ヘッダ (宣言のみ、ビルドしない) |

## 使い方

Node 24 以上。

```sh
npm install --include=dev
npm run build            # tsc -> dist/
```

```sh
# 検査 (V01〜V12)。error があれば終了コード 1、warning だけなら 0、使い方の誤りは 2
node dist/cli/main.js validate samples/bestia
node dist/cli/main.js validate samples/bestia --json

# 人間向け Markdown を生成。既定 (--knowledge player) は masked を一切出さない
node dist/cli/main.js render samples/bestia --out out/bestia
# 内部レビュー用に masked を別節 (masked.md) で出す
node dist/cli/main.js render samples/bestia --out out/bestia-full --knowledge full

# 知識境界レポート (Markdown、--json で JSON)
node dist/cli/main.js report knowledge samples/bestia
node dist/cli/main.js report knowledge samples/bestia --json
```

```sh
# マスターデータ取り込み (既定 masked、masked は .masked.json へ)。--dry-run で差分だけ
node dist/cli/main.js import masters --game samples/bestia --from samples/bestia/masters/archetypes.csv --map samples/bestia/masters/mapping.json --dry-run
# 地図取り込み (grid は mapping の grid 凡例が要る)
node dist/cli/main.js import map --game <bundle> --stage <slug> --from samples/bestia/masters/ring.grid.txt --kind grid --map samples/bestia/masters/mapping.json
# 仕様書 / 意図の LLM 下書き (claude -p。draft: true・masked で書く。COMMENTARII_CLAUDE_BIN で実行ファイルを指定可)
node dist/cli/main.js import spec --game <bundle> --from <spec.md> --kind rules
node dist/cli/main.js intent import --game <bundle> --stage <slug> --from <intent.md>
```

```sh
# 機械向け書き出し: <out>/bundle.json (全文書 + 索引)。既定 player は masked を一切含まない
node dist/cli/main.js export samples/bestia --out out/runtime
# エンジンを模擬アダプタで 1 回走らせ、リプレイを記録 (同じ seed なら同じ判断)
node dist/cli/main.js run --game samples/bestia --adapter sim --persona novice --seed 1 --record replay/bestia-novice-s1.jsonl
# 記録した run をエンジンで再判定 (決定性の検証)
node dist/cli/main.js replay play replay/bestia-novice-s1.jsonl --decider utility-bt --game samples/bestia
# ベンチ: クリア率・時間・被ダメージ・定石の使用割合 (JSON)。--no-tactics で汎用行動だけ
node dist/cli/main.js bench --game samples/bestia --runs 20 --persona novice --seed 1
```

```sh
# 人間のプレイログ取り込み: observations/human/<player-hash>/<run>.jsonl と別解候補 candidates.json。
# プレイヤー識別子は salt との HMAC だけを書く (salt が無ければ失敗)。mapping に無い列 (名前・メール等) は捨てる
COMMENTARII_PLAYER_SALT=<secret> node dist/cli/main.js import plays --game <bundle> --from tests/fixtures/plays/telemetry.jsonl --map tests/fixtures/plays/plays-mapping.json
# 人間 run と observations/runs/ のオートプレイヤー run (run --record) をステージ別に並べる (Markdown、--json で JSON)
node dist/cli/main.js report plays --game <bundle>
```

`npm run guide -- validate samples/bestia` でも同じ。パッケージとして入れた場合は `guide` コマンドになる。

`render` が書くファイル: `README.md` (目次) / `enemies.md` (敵図鑑) / `catalog.md` (アイテム・スキル・アクター) / `stages/<slug>.md` (目標・出現表・イベント・地図: grid は ASCII、navgraph は Mermaid、zones は隣接表) / `rules.md` (式と検算例) / `states.md` (Mermaid stateDiagram) / `tactics.md` (定石一覧と実測) / `intents.md` / `knowledge.md` (知識境界レポート)。`--knowledge full` のときだけ `masked.md`。

## 開発

```sh
npm run typecheck        # tsc --noEmit (src + tests)
npm test                 # tsc で build-test/ に出力して node --test
```

- `src/domain/` 値・知識境界・ID・式評価の純関数 / `src/schema/` スキーマ検証 / `src/bundle/` ローダ・参照索引・player view / `src/validate/checks/` 検査項目 (1 ファイル 1 項目) / `src/render/` / `src/report/` / `src/cli/` / `src/import/` 取り込み (masters / map / spec) / `src/adapters/fs/` ファイル I/O / `src/adapters/sqlite/` `node:sqlite` / `src/adapters/llm/` `claude -p`。`tests/` は `src/` と対。
- 受け入れ条件は Augur の契約 (`augur.contracts.json`、述語は `src/contracts/`)。`npm test` は `VESTIGIUM_LOGS_DIR=<repo>/logs` で契約の観測を記録する。CLI を普段使うときは記録しない。
- 復旧: ビルド成果物がおかしいときは `dist/` と `build-test/` を消して `npm run build` / `npm test` をやり直す。生成物はどちらも git 管理外。

## サービス (Excubitor)

`excubitor.catalog.yaml` / `excubitor.bootstrap.json`。

- `scripts/site/setup.mjs`: `npm ci --include=dev` → `typecheck` → `build`。再実行可能。
- `scripts/site/export-data.mjs --output <絶対パス>` / `import-data.mjs --input <絶対パス> --sha256 <64 桁>`: Commentarii は永続データを持たないので、所有サービス ID と形式版を含む「明示した空の形式」(`{"service":"commentarii","format":"commentarii-data","version":1,"persistentData":false,"data":{}}`) を書き出し / 検証する。
- `npm run dev`: `127.0.0.1:${COMMENTARII_PORT:-4410}` で `/health` だけを返す (Web 編集画面は段階 7)。事前に setup (build) が要る。
