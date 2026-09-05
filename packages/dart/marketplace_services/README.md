# packages/dart/marketplace_services

Shared backend-integration services (Firebase, payment, notifications, location) for the marketplace-channel Flutter apps (`customer_app`; `admin_app` was retired to a RESERVED root in phase FB-1, 2026-09-05).

## Provenance

This package's history lives outside this repository's `.git`. It was established by copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `packages/services`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (SHA-256 `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358`)
- **Original package name:** `letbuyy_services` — renamed to `letbuyy_marketplace_services` on import. This repository has no existing `packages/dart/services` to collide with, but the rename keeps the `marketplace_*` naming consistent with its three sibling packages.

## Bounded compatibility package — NOT the canonical service layer

This package is Firebase-coupled (`firebase_core`, `firebase_auth`, `cloud_firestore`, `cloud_functions`, `firebase_storage`, `firebase_messaging`, `firebase_analytics`) and exists solely so `customer_app` can resolve, analyze and test (`admin_app` was retired to a RESERVED root in FB-1, 2026-09-05). It is:

- **Not** the canonical service layer for LetBuyy. The canonical commerce backend question (D-0) was **answered on 2026-09-04: System C** — see `LETBUYY_CONSTITUTION.md` and `docs/migration/repository_consolidation/11_backend_consolidation.md`.
- **Not** to be extended, imported by any other package/app, or treated as a template for new backend integration.
- **Disposition: SCHEDULED FOR DELETION.** D-0 selected System C (Supabase/Postgres) on 2026-09-04, and the owner decided on 2026-09-05 to retire Firebase completely. This package's only remaining consumer is `apps/customer_app`; phases FB-2 (data), FB-3 (auth) and FB-4 (storage/core) move that app onto the canonical gateway, after which this package has no consumer and goes. `services/compatibility/firebase_bridge`, which bounded it in Phase M, was already deleted in FB-1.

See `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`, Stage 3.7.
