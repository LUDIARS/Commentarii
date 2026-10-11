# 互換表 (Commentarii SDK × 形式の版 × Ingenium)

`@ludiars/commentarii-sdk` (`packages/sdk`) の版と、SDK が所有する形式の版、それを読む Ingenium の版の対応を 1 表で持つ。
両リポの CI はこの表を読み、対応外の組み合わせのテストを「スキップ」ではなく「失敗」にする (黙った非互換を作らない。設計: `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §10.2、`spec/plan/2026-10-11-ingenium-integrated-design.md` §4)。

| SDK 版 (`packages/sdk/package.json`) | git タグ | bundle `format_version` (`bundle.json`) | replay header 版 (`replay.schema.json`) | Ingenium 版 | 備考 |
|---|---|---|---|---|---|
| 0.1.0 | `sdk-v0.1.0` (マージ後に作成) | 1 | 1 (header に版の欄は未導入。現行の `replay.schema.json` を版 1 とみなす) | 未対応 (R0-B で埋める) | R0-A: Commentarii 内で SDK を切り出した初版 |

- SDK 版は `packages/sdk/package.json` の `version`、bundle の版は `EXPORT_FORMAT_VERSION` (`packages/sdk/src/export/exported-bundle.ts`)。どちらかを上げたら同じ PR でこの表に行を足す。
- Ingenium は `github:LUDIARS/Commentarii#sdk-vX.Y.Z` のタグで SDK を参照する (タグはマージ後に作る)。
