# 互換表 (Commentarii SDK × 形式の版 × Ingenium)

`@ludiars/commentarii-sdk` (`packages/sdk`) の版と、SDK が所有する形式の版、それを読む Ingenium の版の対応を 1 表で持つ。
両リポの CI はこの表を読み、対応外の組み合わせのテストを「スキップ」ではなく「失敗」にする (黙った非互換を作らない。設計: `spec/plan/2026-10-11-autoplayer-paradigms-fable.md` §10.2、`spec/plan/2026-10-11-ingenium-integrated-design.md` §4)。

| SDK 版 (`packages/sdk/package.json`) | 取り出し元 | bundle `format_version` (`bundle.json`) | replay header 版 (`replay.schema.json`) | Ingenium 版 | 備考 |
|---|---|---|---|---|---|
| 0.1.0 | `sdk-v0.1.0` (マージ後に作成) | 1 | 1 (header に版の欄は未導入。現行の `replay.schema.json` を版 1 とみなす) | なし (Ingenium は 0.2.0 から) | R0-A: Commentarii 内で SDK を切り出した初版 |
| 0.2.0 | Ingenium `vendor/commentarii-sdk.json` に記録した commit | 1 | 2 (header に任意の `engine` / `sdk_version` / `bundle_format` / `bundle_hash` / `stance`。版 1 の記録もそのまま読める) | 0.2.0 (Ingenium #2697、`ae02821`) | R0-B: 実行側を Ingenium へ移した版。bench の比較キーに任意の `stance` / `decider` / `engine_version` / `sdk_version` を足した (無い旧結果は Ingenium の結果と比較不能) |

- SDK 版は `packages/sdk/package.json` の `version`、bundle の版は `EXPORT_FORMAT_VERSION` (`packages/sdk/src/export/exported-bundle.ts`)。どちらかを上げたら同じ PR でこの表に行を足す。
- Ingenium は `packages/sdk` を `npm pack` した tarball を自分の `vendor/commentarii-sdk-<版>.tgz` に置き、`file:` 依存で読む (npm の git 依存はリポ内サブディレクトリを扱えないため、タグ依存はやめた)。取り出し元 commit と sha256 は Ingenium の `vendor/commentarii-sdk.json` にあり、`scripts/update-sdk.mjs <Commentarii のパス> <commit>` で作り直す。
- `guide run / bench / gate / replay / report signatures` は Commentarii 0.2.x の 1 版だけ `ingenium` へ委譲する (PATH に無ければ終了コード 2)。0.3.0 で委譲を撤去する。
