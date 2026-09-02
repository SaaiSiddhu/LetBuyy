# packages/dart/marketplace_ui_kit

Shared UI components, themes, and widgets for the marketplace-channel Flutter apps (`customer_app`, `admin_app`).

## Provenance

This package's history lives outside this repository's `.git`. It was established by copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `packages/ui_kit`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (SHA-256 `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358`)
- **Original package name:** `letbuyy_ui_kit` — renamed to `letbuyy_marketplace_ui_kit` on import because this repository's own `packages/dart/ui_kit` (`letbuyy_ui_kit`) is a separately-tracked implementation. See `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`'s Stage 2 — this is the closest pair of the three collisions: 19 of 23 files are byte-for-byte identical between the two.

**Namespaced, not merged.** Of the three colliding package names, this pair is the cheapest to unify in a future phase — see the journal's Stage 2 evidence before starting that work, so it isn't rediscovered from scratch.
