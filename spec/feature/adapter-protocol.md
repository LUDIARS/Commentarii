# ゲームアダプタ契約とプロセス分離プロトコル

> **実装は Ingenium (`LUDIARS/Ingenium`、private、`E:/Document/Ars/Ingenium`)** (R0-B、2026-10-11)。

アダプタ契約 (TypeScript・JSON Lines・C++ ヘッダ `adapter/cpp/commentarii_adapter.hpp`) は Ingenium 所有 (統合設計 §2)。観測フレームと行動の形 (`observation-frame.schema.json`、`replay.schema.json#/$defs/action`) と観測境界の許可表は Commentarii SDK にあり、`spec/feature/observation-boundary.md` が正本。

- 実装の正本: Ingenium `spec/feature/adapter-protocol.md`
- 移管元 (この文書の最後の全文): Commentarii `10244822e83f2095ed5ea9d90dedeb2ffbc10d63` の `spec/feature/adapter-protocol.md`
