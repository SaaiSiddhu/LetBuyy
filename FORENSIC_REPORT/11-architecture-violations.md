# Phase 11 — Architecture Violation Report

Investigation date: 2026-06-05

## Method

- Read the declared rules first: root `AGENTS.md` (generated 2026-05-25 by `scripts/generate-repository-intelligence.mjs`), `CLAUDE.md` (canonical runtime map + deprecated alias policy), and `docs/governance/` (117 files; primary boundary authorities read in full: `runtime-boundaries.md`, `import-governance.md`, `architecture-enforcement.md`).
- Derived the workspace dependency graph from `pnpm-workspace.yaml` plus every `package.json` under `apps/`, `services/`, `packages/` (34 manifests).
- Grep-based import scans across `apps/`, `services/`, `packages/` for: app→app imports, package→runtime imports, deep relative imports crossing workspace roots (`../../../{apps,services,packages,legacy,infrastructure}/`), `legacy/` references, deprecated alias references (`apps/admin|auth|checkout|internal|merchant|storefront|analytics` not followed by `-`), `@supabase/supabase-js` in apps, `service_role`, secret patterns (`sk_live_`, `sk_test_`, `rzp_live_`, `rzp_test_`, `whsec_`, `AIza…`, `eyJhbGciOi`), CORS configuration, auth-bypass flags, `localStorage` auth-token use, module-level mutable state, raw `error.message` exposure, and table-write ownership (`.from('<table>')` / Supabase REST helpers per workspace).
- Ran the repository's own governance suite: `node scripts/validate-governance.mjs` → **"Governance validation passed (128 validators)"** on 2026-06-05 (in the isolated workspace; tasks/todo.md records that the same suite fails on developer machines only at the Stale artifact validator over local `node_modules`/`.turbo`).
- Spot-read the largest/highest-risk source files cited below. Excluded: `node_modules`, `.git`, `dist`, `.next`, `build`, `.dart_tool`, `test-results`, `artifacts`, `coverage`.

Severity scale: **Critical** = breaks declared platform model or creates exploitable exposure; **High** = contradicts a written rule with concrete operational cost; **Medium** = drift/coupling with measurable cost; **Low** = hygiene.

---

## 1. Declared rules (summary of what violations are measured against)

From `AGENTS.md`:
- Import direction: `apps → packages`, `apps → services by API`, `services → packages`, `packages → packages` only (AGENTS.md:214). Apps never import apps; services never import apps; packages never import runtimes; active runtimes never import `legacy/*` or `infrastructure/*` (AGENTS.md:119-124, 247-256).
- `services/api-gateway` is "the sole Commerce API backend… not app-local business logic or direct database clients" (AGENTS.md:61).
- Never expose service-role keys to client components (AGENTS.md:65); never store auth tokens in localStorage (AGENTS.md:66); payments must recalculate prices server-side with idempotency (AGENTS.md:67).
- Generated outputs (`build`, `dist`, `*.tsbuildinfo`, Flutter output) must remain ignored/untracked (AGENTS.md:134-139). "Temporary root scripts and debug outputs are forbidden" (AGENTS.md:196).
- Errors: "Unexpected errors must log internally and return sanitized `INTERNAL_ERROR` responses" (AGENTS.md:301).
- "Do not duplicate auth logic between Next handlers and the worker without documenting the canonical owner" (AGENTS.md:311); accounts app is the documented owner of merchant login (AGENTS.md:307).
- Deprecated aliases forbidden (AGENTS.md:88-89; CLAUDE.md "Deprecated Runtime Policy").

From `docs/governance/runtime-boundaries.md`: canonical app/service list including `apps/developer-portal` (line 9) and seven *reserved* service roots (lines 22-28); "No package may import a runtime"; mobile package layering `core → models → services/ui_kit` (lines 32-41).

From `docs/governance/import-governance.md`: forbidden directions table (lines 20-30); enforcement validator `scripts/validators/import-validator.mjs` (line 53).

From `CLAUDE.md`: the canonical runtime map is **13 runtimes** (8 web apps, 3 mobile apps, 2 services) — it does **not** include `apps/developer-portal` or any reserved service.

---

## 2. Boundary rules checked and found CLEAN (for calibration)

| Rule | Result | Evidence |
|---|---|---|
| App→app source imports | 0 found | grep `from '@letbuyy/<app-name>'` and `(../)+apps/` across apps/services/packages — no matches |
| Package→runtime imports | 0 found | same scan; `packages/*/package.json` declare only package deps |
| Deep relative imports crossing workspace roots | 0 found | grep `from '(\.\./)+(apps|services|packages|legacy|infrastructure)/'` — no matches (the only 4-level relatives are intra-app: `apps/platform-operations-portal/src/app/(dashboard)/operations/communications/page.tsx:17`) |
| Active code importing `legacy/` | 0 found | grep `legacy/` in apps/services/packages — only `scripts/generate-repository-intelligence.mjs` (a scanner) references the path |
| Deprecated alias references in active source/config | 0 found | grep `apps/(admin|auth|…)(?![-a-z])` over apps/services/packages/scripts/config/infrastructure/database/tests — no matches; remaining hits are docs/FORENSIC_REPORT history |
| Direct `@supabase/supabase-js` imports in apps | 0 found | grep — no matches; all DB access flows through `@letbuyy/infrastructure/supabase-adapter` consumed by services only (e.g. `services/api-gateway/src/lib/supabase.ts:1-5`, `services/webhook-service/src/index.ts:11-17`) |
| Auth tokens in localStorage | 0 found | all `localStorage` use is theme/lang/wishlist/cart preference state (e.g. `apps/storefront-runtime/src/context/customer-auth-context.tsx:185-198` wishlist sync; `apps/identity-platform/src/app/check-email/page.tsx:89-116` theme/lang) — compliant with AGENTS.md:66 |
| Hardcoded live secrets (`sk_live_`, `rzp_live_`, `whsec_`, JWTs, AIza keys) | 0 found | repo-wide grep over ts/tsx/js/mjs/dart/json/toml/sql/env — no matches |
| Tracked env files | only templates | `git ls-files | grep .env` → 6 files, all under `config/env/*.example|*.template` with `replace-with-…` placeholders (`config/env/templates/next-app.env.example:19-39`) |
| Auth bypass flags (`SKIP_AUTH`, `BYPASS_AUTH`, `DISABLE_AUTH`, …) | 0 found | grep — no matches |
| `console.log` in production source | 0 files | grep (excluding tests/stories) — AGENTS.md:71 said 45 files at generation time; since cleaned |
| Server-side price recalculation + idempotency | implemented | checkout order create takes only productId/qty (`services/api-gateway/src/routes/storefront.ts:2334-2353`, idempotency claim at 2260-2271); payment endpoints read `order.total` from DB and reject client amount mismatches (`services/api-gateway/src/routes/payments.ts:297, 320-323, 674-677`) |
| Plan entitlement enforcement | implemented | product create quota check `services/api-gateway/src/execution/product-execution.adapter.ts:334-352`; frozen-store block `services/api-gateway/src/middleware/store-context.ts:102-115` |

The repo passes its **own** 128-validator suite. Every violation below is therefore either (a) drift between two governance authorities, (b) something the validators do not measure, or (c) a rule stated in prose but not encoded.

---

## 3. Violations

### CRITICAL

**AV-C1 — Constitution describes a database that no longer exists (governance authority is stale on schema and migrations).**
`AGENTS.md` (the binding constitution per CLAUDE.md) declares: "Supabase migrations: 65" (AGENTS.md:381), "Tables detected: 228 / Indexes 376 / RLS statements 227 / Duplicate prefixes: none" (AGENTS.md:316-320), and "persisted operational control evidence lives in migration `065_enterprise_sdlc_lifecycle.sql`" (AGENTS.md:362). Reality: `database/supabase/migrations/` contains **10 files** — `000_baseline.sql` (a pg_dump squash, header lines 1-6) plus `073, 074, 075, 076, 077, 078, 084, 088, 089` with **gaps at 079-083 and 085-087**; file `065_enterprise_sdlc_lifecycle.sql` now lives under `database/supabase/verification/`, not `migrations/`. The 72 pre-squash migrations are in `docs/archive/migrations-history/` (72 files counted). The constitution also requires "New migrations must be sequential" (AGENTS.md:320) — the live sequence is non-contiguous. Anyone (human or AI) obeying AGENTS.md first, as CLAUDE.md instructs, is operating on a falsified schema/migration model. Severity Critical because AGENTS.md is the declared top of the authority chain and its database section is wholesale wrong.

**AV-C2 — Two canonical runtime inventories disagree; reality matches neither exactly.**
`CLAUDE.md` "Canonical Runtime Map" = 13 runtimes and omits `apps/developer-portal` and all reserved services. `docs/governance/runtime-boundaries.md:9` declares `apps/developer-portal` canonical, and lines 22-28 declare seven reserved service roots. On disk: `apps/` has 10 roots (incl. developer-portal — real Next app, 6 routed pages, `apps/developer-portal/runtime.manifest.json:1-12`), `services/` has 9 roots of which **6 are two-file scaffolds** (AGENTS.md + runtime.manifest.json only: `analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service` — directory listings confirm exactly 2 files each), and `queue-workers` is a real worker not present in CLAUDE.md's map. `pnpm-workspace.yaml` additionally registers packages absent from AGENTS.md's package inventory: `packages/payments`, `packages/app-engine`, `packages/extension-host` (lines 9, 12-13) and `packages/dart/api_client` exists on disk. Three sources of truth (CLAUDE.md, AGENTS.md, runtime-boundaries.md + disk) give three different platform inventories. Per CLAUDE.md's own ordering ("AGENTS.md first, then local AGENTS.md, then docs/governance"), the conflict is unresolvable by reading the documents.

### HIGH

**AV-H1 — Dual write ownership of `orders`, `products` (stock), `subscriptions`, `sites` by two independently deployed workers.**
`services/webhook-service/src/index.ts` writes directly via Supabase REST: `orders` (patches at lines 430, 468, 503), `products` stock (line 412 after select at 399), `subscriptions` (patch 622, insert 630, patch 702), `sites` (patch 650), `billing_history` (insert 655), `outbox_events` (upsert 321), `payment_webhook_events` (upsert 64, patch 84). `services/api-gateway` writes the same `orders`/`products`/`subscriptions`/`sites` tables across 30 modules (grep `.from('orders'|'products'|'subscriptions'|'sites')` → `src/execution/order-execution.adapter.ts`, `payment-execution.adapter.ts`, `product-execution.adapter.ts`, `routes/orders.ts`, `routes/payments.ts`, `routes/inventory.ts`, etc.). The mermaid in AGENTS.md:283 sanctions "Webhooks worker → Supabase", so the topology is *declared* — but the domain-ownership rule "Application-services own… transaction boundaries" (AGENTS.md:95) is bypassed: webhook-service does not route mutations through `packages/application-services` order/payment workflows; it re-implements order state transitions and inventory release inline (`webhook-service/src/index.ts:360-503`). Two writers, two state machines, one table set. Tagged High (not Critical) because both writers verify signatures and use idempotency (`payment_webhook_events` upsert on `provider,provider_event_id`, index.ts:64-75), and the split is partially documented.

**AV-H2 — Merchant password verification executes in the Next app, with `password_hash` shipped over the service boundary.**
`apps/identity-platform/src/app/api/auth/login/route.ts:50-87`: the app POSTs to gateway `/auth/custom/users/by-email`, receives `password_hash` in the response, and runs `verifyPassword(password, user.password_hash)` in the Next handler (line 85). Gateway side: `services/api-gateway/src/routes/auth.ts:143-165` selects `password_hash` from `users_custom` and returns it, gated only by `verifyInternalAppRequest(c, 'accounts')` (line 144 → `requireAccountsInternal`, lines 47-50). AGENTS.md:307 documents the accounts app as the canonical merchant-login owner, so the *split* is documented per AGENTS.md:311 — but the consequence is that password hashes transit HTTP between two runtimes on every login attempt, and the same auth primitive exists twice: `getOrCreateDevice` in `services/api-gateway/src/routes/auth.ts:89-121` AND `apps/identity-platform/src/lib/auth/device.ts:48-60` (app version delegates persistence but duplicates fingerprinting at lines 8-16 and `parseDeviceName` at 22-42 vs the gateway's `parseAuthDeviceName` import at auth.ts:27). AGENTS.md:369 itself lists this as an open risk: "active Next route handlers for auth and payments in addition to the Hono worker, so ownership must be clarified before refactors." High: credential material on the wire + duplicated security-relevant logic.

**AV-H3 — God file: `services/api-gateway/src/routes/storefront.ts` = 4,826 lines, 60 route handlers.**
Largest source file in the repo (`wc -l` table; next: `routes/app-store.ts` 2,721 lines / 45 handlers, `routes/operations.ts` 1,436). It contains the entire public shopper surface: store resolution, products, search, cart pricing, checkout order creation (line 2245), customer auth (login at 3924, password at 3642, by-email lookup at 3866-3867), order contact lookup, reviews. The route module count and the inline customer-auth code contradict the layering claim that "Core domain contracts belong in `packages/*-core`… not service route modules" (AGENTS.md:113) in spirit — the `*-core` packages hold contracts (`packages/commerce-core/src/index.ts` = 1,075 lines of types/schemas) while the behavior is concentrated here. Coupling/maintainability: every storefront change funnels through one file; 9 other files also exceed 1,500 lines (`app-store.ts` 2,721; `packages/theme-engine/src/theme-bundle.ts` 2,100; `packages/shared-types/src/index.ts` 2,090; merchant theme editor page 2,067; `graphql/schema.ts` 1,835; `packages/app-engine/src/index.ts` 1,778; `packages/typescript/api-client/src/index.ts` 1,698; `create_store_wizard.dart` 1,635; `legacy/.../sellerAuth.ts` 1,629; `webhook-service/src/index.ts` 1,511).

**AV-H4 — `@letbuyy/utils` exports a service-role admin DB client into the app dependency graph, and the package violates its own layer.**
`packages/typescript/utils/src/supabase.ts:34-46` exports `getSupabaseAdmin()` reading `SUPABASE_SERVICE_ROLE_KEY` and constructing a service client via `@letbuyy/infrastructure/supabase-adapter`. The `utils` package is declared as a dependency by **7 apps** (`apps/{app-marketplace,identity-platform,marketing-site,merchant-control-plane,platform-console,platform-operations-portal,storefront-runtime,theme-marketplace}/package.json`). This collides with three declared rules: AGENTS.md:61 ("Apps must reach commerce… through versioned gateway contracts… not direct database clients"), AGENTS.md:160 ("Provider SDK use belongs in `packages/infrastructure` adapters only" — utils re-exports them to the app layer), and AGENTS.md:177 ("provider execution uses `packages/infrastructure` adapters" inside services). Mitigating: grep proves **zero** source files import `@letbuyy/utils` anywhere — the capability is latent, not exercised. High rather than Critical for that reason: a single import line in any of 7 apps would put a service-role client in app server code with no validator catching it (`import-validator` checks runtime paths, not which package exports what).

**AV-H5 — Root-level generated Flutter `build/` output and root report directories sit in the working tree against the constitution's artifact and root-hygiene rules.**
Disk: root `build/` contains Flutter outputs (`build/ios/XCBuildData`, `build/native_assets/macos`, `build/unit_test_assets/NOTICES.Z`…), and `apps/developer-portal/tsconfig.tsbuildinfo` exists. AGENTS.md:136 lists `build`, `*.tsbuildinfo` as generated outputs that "must remain ignored, untracked"; AGENTS.md:196 forbids root debug outputs. These are untracked (git status shows only `.claude/`, two `.gitignore` changes), so the *tracked-artifact* validator passes — but `tasks/todo.md:242-260` records that the Stale artifact validator **fails on developer machines** for exactly this class (local `node_modules`/`.turbo`/`dist`), i.e., the repo's primary governance command exits 1 in normal local use, training operators to ignore it. Additionally the root carries 73 tracked top-level `.md` files (40+ `CODEX_*` mission/ledger files, `Audit/` directory with 6 report parts) — process residue at the root that AGENTS.md:196's "short-lived analysis belongs under ignored `.codex/`, `.analysis/`…" was written to prevent.

### MEDIUM

**AV-M1 — Credentialed CORS for every wildcard tenant subdomain on the central API.**
`services/api-gateway/src/index.ts:297-327`: the CORS origin callback allows any `https://[a-z0-9-]+.letbuyy.store` (regex at line 318) with `credentials: true` (line 325). Any merchant-controlled storefront (a tenant-authored site on a platform subdomain) can therefore make credentialed cross-origin requests to `api.letbuyy.store`. Auth on protected routes still requires bearer/session validation, and storefront customer cookies are store-scoped, but the design extends cookie-bearing CORS trust to mutually-untrusting tenants — a documented multi-tenant trade-off that is not written down in `docs/governance/` (no governance doc mentions the wildcard-credentials decision; grep `Access-Control-Allow-Origin` → only this file plus the identity logout allowlist at `apps/identity-platform/src/app/api/auth/logout/route.ts:5-21`, which is allowlist-only and clean).

**AV-M2 — Per-isolate in-memory state on hot request paths in the worker.**
`services/api-gateway/src/middleware/rateLimit.ts:39-41`: module-level `memoryStore`/`queryCostMemoryStore` Maps + `lastCleanupAt`. The header comment (lines 6-11) scopes memory fallback to "local/non-production runtimes only" with Redis→KV→memory fallback, and `isLocalRuntime` (43-49) gates it — compliant by design, but three more module-level mutable singletons exist without that documentation: `services/api-gateway/src/extensions/app-functions-runtime.ts:92` (`wasmModuleCache` Map — benign cache), `services/api-gateway/src/graphql/rest-shim.ts:15` (`activeRestShimSubrequests` Map — per-isolate concurrency accounting that silently under-counts across isolates), and `services/queue-workers/src/platform-queue-consumer.ts:167` (`queueCircuitBreakers` Map — circuit-breaker state that resets on isolate recycle and is not shared across isolates, weakening the breaker under exactly the load conditions it protects against). Scaling-risk class, bounded blast radius.

**AV-M3 — 121 route sites return raw DB `error.message`, protected only by a single post-hoc middleware keyed to 3 error codes.**
grep `code: 'DB_ERROR', message: error.message` → 121 occurrences across 19 route files (top: `app-store.ts` ×19, `shipping-tax.ts` ×12, `blog.ts` ×11, `admin.ts` ×10, `ai.ts` ×4). These are rewritten at the boundary by `errorResponseSanitizer` (`services/api-gateway/src/middleware/security.ts:98-128, 130-169`) — but the sanitizer only maps `DB_ERROR`, `INTERNAL_ERROR`, `PAYMENT_PROVIDER_ERROR` (lines 98-102). One existing miss: `services/api-gateway/src/routes/employee.ts:60` returns `code: 'AUTH_ERROR', message: error.message` (raw Supabase auth error) which the map does not cover. The pattern means AGENTS.md:301's rule is enforced by a denylist of codes rather than at the call sites; any new code string silently leaks provider messages.

**AV-M4 — `tenant-core` (domain layer) depends on `theme-engine`, inverting the declared layering of tenancy beneath presentation.**
`packages/tenant-core/package.json` depends on `@letbuyy/theme-engine`; AGENTS.md:32 defines Tenant Core as "Tenant resolution, site/store ownership, subdomain… tenant isolation contracts" — the tenancy primitive now cannot compile without theme contracts. Conversely `packages/typescript/api-types` declares 14 internal package deps (`package.json`) but has exactly **1** source importer in the whole repo (`services/api-gateway/src/execution/schema-registry-execution.adapter.ts` — grep) — a maximal-fan-out/near-zero-fan-in facade. AGENTS.md:220 sanctions api-types as "backward compatibility only", so it is documented; the cost is 14 edges in the build graph for one consumer. Fan-in extreme on the other side: `@letbuyy/shared-types` is depended on by 23 of 27 internal TS packages/runtimes (manifest census) and its `src/index.ts` is 2,090 lines — the classic god-contract package, also the declared home of "Feature flag evaluation authority" (AGENTS.md:361), mixing flags into the type root.

**AV-M5 — Declared-but-unused workspace dependencies create a phantom dependency graph.**
`@letbuyy/utils`: declared by 7 apps, imported by 0 files (grep `from '@letbuyy/utils'` → no matches). `@letbuyy/api-types`: declared by `apps/marketing-site/package.json` and `services/api-gateway/package.json`, imported in source by only the gateway's schema-registry adapter — marketing-site's declaration is dead. The `dependency-manifest-validator`/`undeclared-import-validator` pair (AGENTS.md:221) checks that imports are declared, not that declarations are imported, so this drift is invisible to CI. Cost: misleading impact analysis and install weight.

**AV-M6 — Bidirectional worker coupling between the only two deployed services.**
`services/api-gateway/wrangler.toml:175-177, 277-279` binds `WEBHOOK_SERVICE` (service binding to `letbuyy-webhook[-staging]`), and the gateway's cron dispatch calls into it (`src/index.ts:484, 510-511`); webhook-service in turn depends on outcomes the gateway owns (writes `outbox_events`, `orders` — AV-H1). Two workers, mutual operational dependency, no governance doc records the cycle (`docs/governance/runtime-boundaries.md` describes them as independent boundaries at lines 20-21).

**AV-M7 — Production feature flags hard-off make three shipped subsystems unreachable in production while staging runs them on.**
`services/api-gateway/wrangler.toml:213-215`: `FEATURE_GRAPHQL/FEATURE_EXTENSIONS/FEATURE_LIQUID = "false"` under `[env.production.vars]` vs `"true"` in staging (lines 111-113). Feature-gated at `src/index.ts:353-362`. Architecture consequence: the production deployment ships a 1,835-line GraphQL schema (`src/graphql/schema.ts`), the app-extension runtime (`src/extensions/app-functions-runtime.ts`), and the Liquid theme pipeline as permanently dark code in the production bundle (cold-start weight + attack surface that auth/feature gates must keep closed). Detailed as incomplete features in the Phase 13 report; recorded here as a deliberate prod/staging architecture fork.

### LOW

**AV-L1 — `any` usage concentrated in 11 files** (grep, excluding tests): `apps/theme-marketplace` dashboard/api ×5, `services/api-gateway` `index.ts`, `routes/{inventory,admin,storefront,orders,onboarding}.ts` — e.g. `routes/storefront.ts:2270` `c.json(claim.responseBody as any, claim.statusCode as any)`. Down from the 51 files recorded at constitution generation (AGENTS.md:72). No `export …: any` found, so no any-typed public exports.

**AV-L2 — Reserved/placeholder runtime roots vs the "Placeholder app roots are forbidden" rule.** AGENTS.md:153 forbids placeholder roots, yet 6 service scaffolds + `apps/mobile/shopper-app` (2 files: AGENTS.md + manifest) exist as source roots, sanctioned by `runtime-boundaries.md:22-28` ("reserved"). The two authorities conflict; validators side with runtime-boundaries. Worse, `apps/mobile/operator-app` is a canonical (non-reserved) runtime in CLAUDE.md whose `lib/main.dart:1-36` is the unmodified Flutter counter demo ("Flutter Demo Home Page") — a placeholder wearing a canonical manifest.

**AV-L3 — Single sanitization gap:** `services/api-gateway/src/routes/employee.ts:60` (`AUTH_ERROR` + raw `error.message`, see AV-M3).

**AV-L4 — `:subdomain/customer/by-email` sessionless lookup** (`services/api-gateway/src/routes/storefront.ts:3866-3867`) — store-scoped customer lookup without a session; rate limiting exists on adjacent customer-auth routes (`enforceCustomerAuthRateLimit` at 3685, 3763, 3932, 4280) — enumeration-resistance depends on that coverage extending to this endpoint; flagged for verification, not asserted as exploitable.

**AV-L5 — Config sprawl:** `config/runtime/` holds 66 JSON/schema files, `docs/governance/` 117 docs, `scripts/validators/` 132 validators — a governance machine of ~315 artifacts whose validators assert document/config strings (e.g. `live-production-certification.json` "certificationMode": "credential-gated-plan-ready", lines 1-6) rather than runtime behavior; every refactor must co-update this plane (maintainability tax; see also prior Phase 10 V-C4).

---

## 4. Violation counts

| Severity | Count | IDs |
|---|---|---|
| Critical | 2 | AV-C1, AV-C2 |
| High | 5 | AV-H1…AV-H5 |
| Medium | 7 | AV-M1…AV-M7 |
| Low | 5 | AV-L1…AV-L5 |
| **Total** | **19** | |

Clean checks (Section 2): 13 declared rules verified compliant, including all hard import boundaries, secrets, env tracking, localStorage, price recalculation, and idempotency.

---

## Evidence Index

| # | Path | Lines / artifact |
|---|---|---|
| 1 | `/Users/saai_sidd/Git/Letbuyy_Store/AGENTS.md` | 61, 66-67, 71-72, 88-89, 95, 113, 119-124, 134-139, 153, 160, 177, 196, 214, 220-221, 247-256, 283, 301, 307, 311, 316-320, 361-362, 369, 381 |
| 2 | `/Users/saai_sidd/Git/Letbuyy_Store/CLAUDE.md` | Canonical Runtime Map; Deprecated Runtime Policy |
| 3 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/runtime-boundaries.md` | 9, 20-28, 32-41 |
| 4 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/import-governance.md` | 20-30, 53 |
| 5 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/governance/architecture-enforcement.md` | validator inventory table |
| 6 | `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml` | 9, 12-13 (payments/app-engine/extension-host) |
| 7 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/migrations/` | 10 files: 000_baseline.sql (pg_dump header 1-6), 073-078, 084, 088, 089 |
| 8 | `/Users/saai_sidd/Git/Letbuyy_Store/docs/archive/migrations-history/` | 72 archived migrations |
| 9 | `/Users/saai_sidd/Git/Letbuyy_Store/database/supabase/verification/065_enterprise_sdlc_lifecycle.sql` | location vs AGENTS.md:362 claim |
| 10 | `/Users/saai_sidd/Git/Letbuyy_Store/services/webhook-service/src/index.ts` | 11-17, 54-92, 232-244, 321, 360-503, 581-655, 702 |
| 11 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/storefront.ts` | 2245-2404 (order create), 3642, 3685, 3763, 3866-3867, 3924-3932, 4280; 4,826 total lines / 60 handlers |
| 12 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/auth.ts` | 34-44 (rate limits), 47-50, 89-121, 143-165 |
| 13 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/app/api/auth/login/route.ts` | 50-87, 113-132 |
| 14 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/lib/auth/device.ts` | 8-16, 22-42, 48-60 |
| 15 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/identity-platform/src/lib/auth/session.ts` | 7-32 (gateway-delegated persistence) |
| 16 | `/Users/saai_sidd/Git/Letbuyy_Store/packages/typescript/utils/src/supabase.ts` | 12-46 |
| 17 | `/Users/saai_sidd/Git/Letbuyy_Store/packages/typescript/utils/package.json` + 7 app package.json files | declared-unused dependency |
| 18 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/index.ts` | 285-327 (middleware+CORS), 344-362 (feature gates), 471-511, 609-612 (cron) |
| 19 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/middleware/security.ts` | 20-48, 98-128, 130-169 |
| 20 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/middleware/rateLimit.ts` | 6-11, 39-49 |
| 21 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/graphql/rest-shim.ts` | 15 |
| 22 | `/Users/saai_sidd/Git/Letbuyy_Store/services/queue-workers/src/platform-queue-consumer.ts` | 167 |
| 23 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/wrangler.toml` | 111-113, 175-177, 213-215, 277-279 |
| 24 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/employee.ts` | 60 |
| 25 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/middleware/store-context.ts` | 102-158 |
| 26 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/execution/product-execution.adapter.ts` | 334-352 |
| 27 | `/Users/saai_sidd/Git/Letbuyy_Store/services/api-gateway/src/routes/payments.ts` | 61, 215, 297, 320-323, 674-677 |
| 28 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/developer-portal/runtime.manifest.json` | 1-12 |
| 29 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/operator-app/lib/main.dart` | 1-36 (Flutter counter demo) |
| 30 | `/Users/saai_sidd/Git/Letbuyy_Store/apps/mobile/shopper-app/` | 2 files (AGENTS.md, runtime.manifest.json) |
| 31 | `/Users/saai_sidd/Git/Letbuyy_Store/services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/` | 2 files each |
| 32 | `/Users/saai_sidd/Git/Letbuyy_Store/config/env/templates/next-app.env.example` | 10-45 (placeholders only) |
| 33 | `/Users/saai_sidd/Git/Letbuyy_Store/tasks/todo.md` | 242-260 (validator failures on dev machines) |
| 34 | `/Users/saai_sidd/Git/Letbuyy_Store/config/runtime/live-production-certification.json` | 1-26 |
| 35 | Governance suite run | `node scripts/validate-governance.mjs` → "Governance validation passed (128 validators)" (2026-06-05, isolated workspace) |
| 36 | `wc -l` census | storefront.ts 4826; app-store.ts 2721; theme-bundle.ts 2100; shared-types index 2090; editor page.tsx 2067; graphql/schema.ts 1835; app-engine index 1778; api-client index 1698; create_store_wizard.dart 1635; webhook index 1511 |
| 37 | `apps/identity-platform/src/app/api/auth/logout/route.ts` | 5-21, 54-64 |
| 38 | `apps/storefront-runtime/src/lib/store-service.ts` / `product-service.ts` | API-client-only data access (1-12 imports) |
