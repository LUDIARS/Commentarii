# export と、判断エンジンの所在 (段階 3 / 3E)

> **実装は Ingenium (`LUDIARS/Ingenium`、private、`E:/Document/Ars/Ingenium`)** (R0-B、2026-10-11)。 判断エンジン・ペルソナ・模擬アダプタ・bench・`ingenium run` (旧 §2〜§11) の正本は Ingenium `spec/feature/engine.md`。本書に残すのは §1 export (`guide export`、Commentarii の機能) だけ。攻略本が何を可能に見せるかを読む部品 (world / match / candidates の型と定石候補・変種 / persona の型) は Commentarii SDK `knowledge`。

設計正本: `spec/architecture/design.md` §4.4 (tactic / intent / manifest)、§7 (オートプレイヤー)、§11 段 3 と 3E、§14.A (リプレイ)、§14.E (ペルソナ)。
依頼文: `spec/tasks/2026-10-09-stage-3-engine.md`。アダプタ境界は [adapter-protocol.md](adapter-protocol.md)。

| 置き場所 | 中身 |
|---|---|
| `src/export/` | `guide export` (`bundle.json` と索引) |

## 1. export

`guide export <bundle-dir> --out <dir> [--knowledge player|full] [--target runtime]` は `<dir>/bundle.json` を 1 つ書く。

- `knowledge=player` (既定) は `toPlayerView` (render と同じ masked の無い view) を通す。masked の付随ファイル・masked の定石は入らず、
  `.masked.json` 以外に紛れた masked 値も落ちる。`full` は内部用で全文書を含む。
- 内容: `format` (`commentarii.bundle`)、`format_version` (1)、`game_id`、`manifest_version`、`knowledge`、`target`、`documents`
  (manifest / glossary / entities / masked_entities / stages / rules / states / tactics / intents。各文書は `{path, doc}`)、`index`。
- 索引 `index`:
  - `ids`: entity / stage / rule / state / tactic / intent 項目の ID → `{kind, path, pointer}` (`pointer` は bundle.json 内の JSON pointer)。
  - `render_signatures`: `render_signature` の mesh / sprite ID → entity ID (描画命令 → entity の逆引き、§7.1)。
  - `adjacency`: ステージ ID → ノード ID → 隣接ノード ID (無向辺は両向き、`directed: true` は片向き)。
- `--target` は `runtime` だけ (§14.G の `ingame` は段階 7G)。
- 契約 C-17: player の出力に masked が無く、索引が文書を指す。

## 2〜11. 判断エンジン・ペルソナ・sim・bench・run・敵 AI

Ingenium `spec/feature/engine.md` §2〜§11 (移管元の全文は Commentarii `10244822e83f2095ed5ea9d90dedeb2ffbc10d63` の本書)。
