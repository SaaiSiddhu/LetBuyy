# packages/dart/marketplace_core

Core utilities, constants, and extensions for the marketplace-channel Flutter apps (`customer_app`; `admin_app` was retired to a RESERVED root in phase FB-1, 2026-09-05).

## Provenance

This package's history lives outside this repository's `.git`. It was established by copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `packages/core`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (SHA-256 `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358`)
- **Original package name:** `letbuyy_core` — renamed to `letbuyy_marketplace_core` on import because this repository's own `packages/dart/core` (`letbuyy_core`) is a different, independently-evolved implementation. See `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`'s Stage 2 for the full collision evidence (near-identical lineage; this repo's version consolidated `responsive/` into one file and dropped Firebase-specific constants).

**Namespaced, not merged.** This package and `packages/dart/core` (`letbuyy_core`) are two implementations of the same original package, kept deliberately separate — see the journal for why (Phase N brief's explicit scope: make buildable without answering package unification or D-0).
