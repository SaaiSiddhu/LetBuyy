# 13 — Final Repository Tree

Captured after Stage 9's deletion, `HEAD` `00894cc5`. One canonical git root; `Ecommerce/LetBuyy` and its nested `Agrimore` are gone from disk (fully preserved in the Stage 1 bundles/patches, see `14_recovery_and_rollback.md`).

## `apps/` — 14 entries

| Path | Class | Notes |
|---|---|---|
| `apps/customer_app` | Six-app-model, cross-repo (System A) | Play Store `com.letbuyy.letbuyy`; not a Dart pub workspace member yet (see `17_remaining_migration_backlog.md`) |
| `apps/customer_web` | Six-app-model, renamed (was `storefront-runtime`) | ACTIVE |
| `apps/merchant_app` | Six-app-model, renamed (was `apps/mobile/merchant-app`) | ACTIVE, SUPPORTING tier; sole Dart pub workspace member |
| `apps/merchant_web` | Six-app-model, renamed (was `merchant-control-plane`) | ACTIVE |
| `apps/admin_app` | Six-app-model, cross-repo (System A) | Not production-signed (debug keystore); not a Dart pub workspace member yet |
| `apps/admin_web` | Six-app-model, renamed (was `platform-console`) | ACTIVE, SUPPORTING tier |
| `apps/phase_2/rider_app`, `apps/phase_2/store_ops_app` | New structural tier, cross-repo (System B) | Not ACTIVE/RESERVED/FROZEN; not production-ready; not Dart pub workspace members yet |
| `apps/identity-platform` | Auxiliary tier (authorized, not yet physically relocated) | ACTIVE, sole token issuer |
| `apps/marketing-site` | Auxiliary tier (authorized, not yet physically relocated) | ACTIVE |
| `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace` | FROZEN | Untouched this phase |
| `apps/platform-operations-portal` | FROZEN, non-survivor | Constitutionally pre-decided MIGRATE-then-DELETE into `admin_web`, gated on a smoke-path proof this phase could not run — untouched |
| `apps/mobile/{shopper-app,operator-app}` | RESERVED | Confirmed still empty (`runtime.manifest.json` + `AGENTS.md` only), untouched |

## `services/` — 12 entries

| Path | Class | Notes |
|---|---|---|
| `services/api-gateway`, `services/queue-workers`, `services/mobile-bff`, `services/webhook-service` | ACTIVE | Untouched this phase (verified in Stage 8) |
| `services/checkout-runtime`, `services/event-bus`, `services/notification-service`, `services/analytics-pipeline`, `services/media-service`, `services/search-service` | RESERVED | Untouched, confirmed still manifest-only |
| `services/compatibility/{firebase_bridge,agrimore_bridge,cloudflare_bridge}` | New — bounded compatibility bridges (Stage 5) | Explicitly NOT wired into any ACTIVE runtime; established this phase |
| `services/lcis-api` | TOOLING (Constitution amendment Gap 3, Stage 2) | Central Intelligence System's own tooling — classified, not moved |

## `packages/` — unchanged this phase

Still holds `packages/dart/{core,api_client,models,ui_kit}` (System C's own, sole Dart workspace packages), the 17 domain packages, `packages/typescript/*`, `packages/infrastructure`, and the 19 `packages/lcis-*` (TOOLING-classified, Stage 2). System A's `packages/{core,models,services,ui_kit}` and System B's `packages/agrimore_*`/11 packages were **never copied into this repository** — see the backlog document.

## What did NOT change structurally this phase

`database/`, `config/` (beyond the documented Stage 6/8 path-string fixes), `infrastructure/`, `scripts/`, `tests/`, `tools/`, root workspace/config files (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.*`, `.github/workflows/*` beyond the 3 deploy-matrix fixes), and every `docs/` directory outside `docs/migration/repository_consolidation/` and `docs/governance/`.

## Repository-root file count

`git ls-files | wc -l` and full byte-size accounting were not re-run as part of this document (Stage 8's checks cover build/test correctness, not a full inventory diff against `01_source_inventory.md`) — see `12_final_verification.md`'s explicit "NOT RUN" note on that specific check.
