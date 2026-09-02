# packages/dart/marketplace_models

Shared data models for the marketplace-channel Flutter apps (`customer_app`, `admin_app`) — catalog, cart, orders, ads, loyalty, coupons, and the social-commerce "reels" domain.

## Provenance

This package's history lives outside this repository's `.git`. It was established by copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `packages/models`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (SHA-256 `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358`)
- **Original package name:** `letbuyy_models` — renamed to `letbuyy_marketplace_models` on import because this repository's own `packages/dart/models` (`letbuyy_models`) is a different, narrower package (merchant-app/store-builder-scoped only 15 files, vs. this package's 52-file full marketplace domain model set). See `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`'s Stage 2 — only 6 filenames overlap between the two, and only one of those six is byte-identical.

**Namespaced, not merged.** This package assumes Firestore-shaped data in several models (imports `cloud_firestore` types per its own `pubspec.yaml`) — a direct consequence of System A's Firebase backend. This is a genuinely different domain scope from `packages/dart/models`, not just a different implementation of the same scope; unifying them is a real design decision left open, see the journal.
