# FOUNDATION_REPO_STATE

Generated: 2026-06-09T19:21:18Z  
Branch: `stepup/main`  
Baseline commit: `c2547049c0b5666661536d076046415714fb7d03`  
Mode: PHASE A repository truth audit, no code changes.

## Executive Findings

- The working tree was dirty before PHASE A began. Pre-existing user-owned tracked modifications include two frozen auth paths: `apps/identity-platform/src/app/api/auth/switch/route.ts` and `apps/identity-platform/src/lib/auth/cookies.ts`. They were not staged by PHASE A.
- The live migration chain contains 89 SQL migrations from `000_baseline.sql` through `159_identity_foundation_core.sql`; this drifts from the generated root `AGENTS.md` summary that mentioned only `073` through `090`.
- Migration prefix `129` is duplicated: `129_internal_os_executive_analytics_rollups.sql` and `129_mobile_customer_segments.sql`.
- Generated/build artifacts are tracked under `artifacts/shopify-ux/**`, directly conflicting with the V2 delete-from-VCS rule for generated artifacts.
- Local generated pollution exists in the working tree: `node_modules`, `.pnpm-store`, `.turbo`, `.dart_tool`, `build`, and `test-results`.
- Several V2 quarantine targets are active build or source dependencies at HEAD. They cannot be quarantined by assertion; each requires rewiring plus a fresh 0-importer proof.

## Authority Table Reconciliation

| Target | V2 disposition | Current repository state | Drift |
|---|---|---|---|
| `services/api-gateway` | KEEP+REWRITE | Present, package-managed, Cloudflare Worker manifest + wrangler config, active deploy target. | None. |
| `apps/merchant-control-plane` | KEEP+REWRITE | Present, package-managed, Vercel config, production workflow deploy target. | None. |
| `apps/storefront-runtime` | KEEP+REWRITE | Present, package-managed, Vercel config, production workflow deploy target, imports `@letbuyy/runtime-composition`. | `runtime-composition` cannot be assumed dormant. |
| `apps/identity-platform` | KEEP+REWRITE | Present, package-managed, Vercel config, production workflow deploy target. | Working tree has user-owned frozen-path edits. |
| `apps/platform-console` | KEEP+REWRITE | Present, package-managed, Vercel config, production workflow deploy target. | None. |
| `apps/platform-operations-portal` | KEEP+REWRITE | Present, package-managed, Vercel config, production workflow deploy target. | None. |
| `apps/developer-portal` | KEEP+REWRITE | Present and production workflow deploy target. | No local `vercel.json` found. |
| `apps/marketing-site` | KEEP+REWRITE | Present, package-managed, Vercel config, production workflow deploy target. | None. |
| `apps/app-marketplace` | KEEP-DORMANT | Present, package-managed, Vercel config, production workflow deploy target. | Dormant status conflicts with deploy topology. |
| `apps/theme-marketplace` | KEEP-DORMANT | Present, package-managed, Vercel config, production workflow deploy target. | Dormant status conflicts with deploy topology. |
| `apps/mobile/merchant-app` | KEEP+REWRITE | Present Flutter app. | Not a TS package; Flutter build still must be verified in later waves. |
| `services/queue-workers` | KEEP | Present, package-managed, Cloudflare Worker manifest + wrangler config, active deploy target. | None. |
| `services/webhook-service` | KEEP | Present, package-managed, Cloudflare Worker manifest + wrangler config, active deploy target. | None. |
| `services/mobile-bff` | KEEP | Present, package-managed, Cloudflare Worker manifest + wrangler config, active deploy target in staging/production workflows. | None. |
| `services/analytics-pipeline` | QUARANTINE | Present as manifest-only reserved service and referenced by topology/config/tests. | Not in Worker deploy target, but not 0 references. |
| `services/checkout-runtime` | QUARANTINE | Present as manifest-only reserved service and referenced by topology/config/tests. | Not 0 references; `packages/runtime-composition` also references checkout-runtime text. |
| `services/event-bus` | QUARANTINE | Present as manifest-only reserved service and referenced by every runtime manifest/topology. | Not 0 references. |
| `services/media-service` | QUARANTINE | Present as manifest-only reserved service and referenced by topology/config/tests. | Not 0 references. |
| `services/notification-service` | QUARANTINE | Present as manifest-only reserved service and referenced by topology/config/tests. | Not 0 references. |
| `services/search-service` | QUARANTINE | Present as manifest-only reserved service and referenced by topology/config/tests. | Not 0 references. |
| `apps/mobile/operator-app` | QUARANTINE | Present as manifest + AGENTS root; referenced by topology validators/tests and one theme-marketplace source string. | Not 0 references. |
| `apps/mobile/shopper-app` | QUARANTINE | Present as manifest + AGENTS root; referenced by topology validators/tests. | Not 0 references. |
| `packages/distributed-runtime` | QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by `orchestration` and `projection-runtime`. | Active dependency. |
| `packages/projection-runtime` | QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by `runtime-composition`. | Active dependency. |
| `packages/orchestration` | QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by `application-services`, `api-gateway`, and `queue-workers`. | Active dependency. |
| `packages/application-services` | QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by API gateway execution adapters. | Active dependency. |
| `packages/app-engine` | QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by storefront and API gateway. | Active dependency. |
| `packages/extension-host` | QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by merchant/storefront/gateway. | Active dependency. |
| `packages/runtime-composition` | conditional QUARANTINE | Present, in `tsconfig.workspace.json`, package-managed, source-imported by storefront, API gateway, and queue-workers. | KEEP minimal unless rewired; 0-importer proof fails. |
| `legacy/` | QUARANTINE | Present and referenced by generated intelligence, manifests, AGENTS files, and migration text. | Not 0 references. |
| `chaos/` | QUARANTINE | Present with scripts/scenarios, referenced by validators/topology. | Not 0 references. |
| `load/` | QUARANTINE | Present with k6/Gatling/Locust assets, referenced by workflows, validators, source strings, and tests. | Not 0 references. |
| `artifacts/` | DELETE-from-VCS | Present and tracked under `artifacts/shopify-ux/**`. | Direct violation; requires quarantine/delete protocol or explicit cleanup wave. |
| `build/` | DELETE-from-VCS | Local generated root exists; no tracked files found in `git ls-files build`. | Local pollution only. |
| `test-results/` | DELETE-from-VCS | Local generated root exists; no tracked files found in `git ls-files test-results`. | Local pollution only. |

## Frozen Path Baseline

Locked paths from `FOUNDATION_REPO_LOCKS.md` exist at HEAD. PHASE A did not edit or stage them.

Pre-existing dirty locked paths:

- `apps/identity-platform/src/app/api/auth/switch/route.ts`
- `apps/identity-platform/src/lib/auth/cookies.ts`

Frozen migrations present:

- `database/supabase/migrations/139_executable_foundation_ledger_core.sql`
- `database/supabase/migrations/141_executable_inventory_reservations.sql`
- `database/supabase/migrations/147_executable_order_state_risk.sql`

Other frozen source paths present:

- `packages/theme-engine/src/theme-registry.ts`
- `packages/typescript/ui/src/tokens.ts`

## Working Tree Baseline

Tracked modifications present before PHASE A:

- `apps/identity-platform/src/app/api/auth/switch/route.ts`
- `apps/identity-platform/src/app/check-email/page.tsx`
- `apps/identity-platform/src/app/forgot-password/page.tsx`
- `apps/identity-platform/src/app/globals.css`
- `apps/identity-platform/src/app/login/page.tsx`
- `apps/identity-platform/src/app/lookup/page.tsx`
- `apps/identity-platform/src/app/onboarding/page.tsx`
- `apps/identity-platform/src/app/reset-password/page.tsx`
- `apps/identity-platform/src/app/select/page.tsx`
- `apps/identity-platform/src/app/set-password/page.tsx`
- `apps/identity-platform/src/app/signup/page.tsx`
- `apps/identity-platform/src/lib/auth/cookies.ts`
- `apps/identity-platform/src/lib/rate-limit.ts`
- `apps/platform-console/src/lib/console-session.ts`
- `database/supabase/migrations/090_custom_domains_and_store_access.sql`
- `database/supabase/migrations/100_app_discovery_foundation.sql`
- `docs/governance/skipped-human-decisions.md`
- `packages/typescript/ui/src/theme-provider.tsx`
- `services/api-gateway/src/lib/crypto.ts`
- `services/api-gateway/src/routes/auth.ts`

Untracked foundation/audit/control docs are present. PHASE A will stage only its own output/control files unless a later wave explicitly owns additional docs.

## Migration Baseline

- Migration count: 89 SQL files.
- First migration: `000_baseline.sql`.
- Last migration by lexicographic sort: `159_identity_foundation_core.sql`.
- Duplicate numeric prefix: `129`.
- V2 frozen migration files `139`, `141`, and `147` are present and must remain unmodified.

## Generated Artifact Baseline

Tracked generated artifacts found:

- `artifacts/shopify-ux/**` PNG screenshot artifacts are tracked.

Local generated roots found:

- `.turbo`
- `.dart_tool`
- `.pnpm-store`
- `build`
- `node_modules`
- `test-results`

## Phase A Gate

PHASE A is an audit only. It intentionally does not resolve drift. Later waves must use this file as a baseline and re-prove 0 importers at HEAD before any quarantine/delete move.
