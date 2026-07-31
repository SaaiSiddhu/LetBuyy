# LetBuyy Repository Archaeology

> Discovery-only. No code was modified to produce this document.
> All claims are cited to a file path (and line where relevant).
> Stale or aspirational CLAUDE.md claims are flagged explicitly.
> Date: 2026-06-20

---

## Section 1: Architecture Map

### Full Component Inventory

| Name | Type | Status | Deploy Target | Source Files (TS/Dart) | Notes |
|------|------|--------|---------------|------------------------|-------|
| `apps/storefront-runtime` | Next.js app | **REAL** | Vercel (bom1) | 148 TS/TSX | Multi-tenant storefront host; proxy.ts is live Next.js middleware |
| `apps/merchant-control-plane` | Next.js app | **REAL** | Vercel (bom1) | 424 TS/TSX | Largest app; merchant admin UI |
| `apps/identity-platform` | Next.js app | **REAL** | Vercel (bom1) | 82 TS/TSX | Auth, onboarding, store creation |
| `apps/marketing-site` | Next.js app | **REAL** | Vercel (bom1) | 94 TS/TSX | Public marketing pages |
| `apps/platform-console` | Next.js app | **REAL** | Vercel (bom1) | 78 TS/TSX | Operator/platform console |
| `apps/app-marketplace` | Next.js app | **FROZEN** | Excluded from turbo build | 96 TS/TSX | Frozen per CLAUDE.md; source exists but excluded from `pnpm build` |
| `apps/developer-portal` | Next.js app | **FROZEN** | Excluded from turbo build | 25 TS/TSX | Frozen per CLAUDE.md |
| `apps/theme-marketplace` | Next.js app | **FROZEN** | No vercel.json found | 71 TS/TSX | Frozen per CLAUDE.md |
| `apps/platform-operations-portal` | Next.js app | **FROZEN** | Excluded from turbo build | 37 TS/TSX | Frozen per CLAUDE.md |
| `apps/mobile/merchant-app` | Flutter app | **REAL** | Mobile release | 156 Dart files | Source in `lib/`; wrangler-independent; `flutter test` used in CI |
| `apps/mobile/shopper-app` | Placeholder | **RESERVED** | Not deployed | 0 | Only `AGENTS.md` + `runtime.manifest.json` present |
| `apps/mobile/operator-app` | Placeholder | **RESERVED** | Not deployed | 0 | Only `AGENTS.md` + `runtime.manifest.json` present |
| `services/api-gateway` | Cloudflare Worker | **REAL** | Cloudflare Workers | 291 TS | Hono-based; `wrangler.toml` present; `name = "letbuyy-api"` |
| `services/mobile-bff` | Cloudflare Worker | **REAL** | Cloudflare Workers | 5 TS | `wrangler.toml` present; `name = "letbuyy-mobile-bff"` |
| `services/webhook-service` | Cloudflare Worker | **REAL** | Cloudflare Workers | 7 TS | `wrangler.toml` present; `name = "letbuyy-webhook"` |
| `services/queue-workers` | Cloudflare Worker | **REAL** | Cloudflare Workers | 14 TS | `wrangler.toml` present; `name = "letbuyy-queue-workers"` |
| `services/analytics-pipeline` | Placeholder | **RESERVED** | Not deployed | 0 | No `src/`, no `package.json` |
| `services/checkout-runtime` | Placeholder | **RESERVED** | Not deployed | 0 | No `src/`, no `package.json` |
| `services/event-bus` | Placeholder | **RESERVED** | Not deployed | 0 | No `src/`, no `package.json` |
| `services/media-service` | Placeholder | **RESERVED** | Not deployed | 0 | No `src/`, no `package.json` |
| `services/notification-service` | Placeholder | **RESERVED** | Not deployed | 0 | No `src/`, no `package.json` |
| `services/search-service` | Placeholder | **RESERVED** | Not deployed | 0 | No `src/`, no `package.json` |
| `packages/shared-types` | Library | **REAL** | Published to workspace | 8 TS | `@letbuyy/shared-types`; highest blast radius |
| `packages/auth-core` | Library | **REAL** | Published to workspace | 9 TS | `@letbuyy/auth-core` |
| `packages/infrastructure` | Library | **REAL** | Published to workspace | 24 TS | `@letbuyy/infrastructure` |
| `packages/theme-engine` | Library | **REAL** | Published to workspace | 37 TS | `@letbuyy/theme-engine`; Liquid/JSON renderer |
| `packages/typescript/ui` | Library (Storybook) | **REAL** | Dev server only | 54 TS/TSX | `@letbuyy/ui`; design system; path `packages/typescript/ui`, NOT `packages/ui` |
| `packages/payments` | Library | **REAL** | Published to workspace | 2 TS | `@letbuyy/payments` |
| `packages/tenant-core` | Library | **REAL** | Published to workspace | 1 TS | `@letbuyy/tenant-core` |
| `packages/checkout-core` | Library | **REAL** | Published to workspace | 2 TS | `@letbuyy/checkout-core` |
| `packages/billing-core` | Library | **REAL** | Published to workspace | 4 TS | `@letbuyy/billing-core` |
| `packages/event-core` | Library | **REAL** | Published to workspace | 5 TS | `@letbuyy/event-core` |
| Other `packages/*-core` | Libraries | **REAL** (thin) | Published to workspace | 1 each | audit, cms, identity, notification, organization, permission, session, token |
| `packages/dart` | Flutter pkg | **REAL** | Flutter only | 0 TS | No package.json; Dart-only |
| `tools/graph-server` | LCIS V1 | **DEV TOOL** | NOT deployed | 80+ MJS | Local server; port 3333; no package.json! |
| `tools/central-intelligence` | LCIS V2 | **DEV TOOL** | NOT deployed | 30+ MJS | Local server; port 3334; `package.json` present |
| `database/supabase/migrations` | SQL | **REAL** | Supabase (data layer) | 116 SQL | Migrations 001–187 (last: `187_v1_sites_site_settings.sql`) |
| `infrastructure/` | Cloudflare config | **REAL** | Cloudflare + deploy scripts | – | `ci-cd/`, `cloudflare/`, `deployment/`, `dns/`, `monitoring/`, `observability/`, `security/`, `scripts/` |

### Deprecated Alias Check
All deprecated aliases from CLAUDE.md (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) are **absent from the repository**. The deprecated list is clean.

### Runtime Topology (ASCII)

```
 ┌───────────────────────────────────────────────────────────────────┐
 │                        VERCEL (region: bom1)                      │
 │                                                                    │
 │  marketing-site      identity-platform    platform-console         │
 │  (public pages)      (auth/onboarding)    (operator UI)            │
 │                                                                    │
 │  storefront-runtime                merchant-control-plane          │
 │  {store}.letbuyy.com / custom domain  admin.letbuyy.com            │
 │  proxy.ts = Next.js middleware        424 TS files                 │
 └───────────────────────────┬───────────────────────────────────────┘
                             │ HTTP /v1/* (gateway proxy)
                             ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                  CLOUDFLARE WORKERS                               │
 │                                                                    │
 │  api-gateway (letbuyy-api)          mobile-bff (letbuyy-mobile-bff)│
 │  Hono, 291 TS files                 5 TS files                     │
 │  wrangler.toml → src/index.ts       wrangler.toml                  │
 │                                                                    │
 │  queue-workers (letbuyy-queue-workers)   webhook-service (letbuyy-webhook)│
 │  crons: "17 */6 * * *"             HMAC-signed outbound            │
 │  14 TS files                        7 TS files                     │
 └───────────────────────────┬───────────────────────────────────────┘
                             │ Supabase JS client (SECURITY DEFINER RPCs)
                             ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                       SUPABASE (data layer)                       │
 │  116 migrations (001–187)                                         │
 │  Tables: sites, store_customers, products, orders, order_items,   │
 │  payment_transactions, refunds, payouts, gift_card_accounts, …    │
 │  RPCs: create_checkout_order, confirm_order_payment_with_ledger,  │
 │  complete_order_refund, issue_gift_card, …                        │
 │  651 RLS policies (per db-intel.json)                             │
 └───────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────┐
 │         FLUTTER MOBILE (merchant-app)           │
 │  apps/mobile/merchant-app, 156 Dart files       │
 │  CI: flutter test test/mobile_services_test.dart│
 │  → mobile-bff (Cloudflare Worker) for API calls │
 └─────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────┐
 │  LOCAL DEV ONLY — not in any deployment path    │
 │  tools/graph-server    (LCIS V1, port 3333)     │
 │  tools/central-intelligence (LCIS V2, port 3334)│
 └─────────────────────────────────────────────────┘
```

---

## Section 2: Dependency Map

### Key Cross-Package Dependencies

The pnpm workspace (`pnpm-workspace.yaml`) declares:
- All `apps/*` and `apps/mobile/*`
- All `services/*`
- Explicit package list: `shared-types`, `tenant-core`, `commerce-core`, `checkout-core`, `payments`, `auth-core`, `identity-core`, `token-core`, `session-core`, `permission-core`, `organization-core`, `audit-core`, `theme-engine`, `cms-core`, `event-core`, `notification-core`, `billing-core`, `infrastructure`
- `packages/typescript/*` (covers `@letbuyy/ui` and TypeScript config)
- **`tools/` is NOT declared in `pnpm-workspace.yaml`**

Evidence: `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml`

### Blast Radius — Verified Counts

| Hotspot | CLAUDE.md Claim | Verified Count | Search Command Used |
|---------|-----------------|----------------|---------------------|
| `getSupabaseAdmin` | 115 files | **110 files** | `grep -r "getSupabaseAdmin" --include="*.ts" --include="*.tsx" -l \| grep -v node_modules` |
| `@letbuyy/shared-types` | (high) | **151 files** | `grep -r "from '@letbuyy/shared-types'" --include="*.ts" --include="*.tsx" -l \| grep -v node_modules` |
| `@letbuyy/api-client` | (high) | **95 files** | `grep -r "from '@letbuyy/api-client'" --include="*.ts" --include="*.tsx" -l \| grep -v node_modules` |
| `create_checkout_order` | (canonical) | **35 files** | `grep -r "create_checkout_order" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.mjs" -l \| grep -v node_modules` |

**Note on `getSupabaseAdmin`:** CLAUDE.md claims 115 files; actual grep yields 110. Minor discrepancy — likely a stale count from an earlier graph scan. Still confirms it as the highest-blast symbol.

**Note on `@letbuyy/api-client`:** CLAUDE.md lists this as a package with high blast radius (95 files importing it), but `packages/api-client/` does **not exist** as a standalone package directory. The package is likely resolved through another mechanism or the import comes from an inner package path. Investigation: `grep` confirms 95 files do import it, so the package itself must be declared elsewhere (possibly inside `packages/typescript/` or an undiscovered alias).

### Package Dependency Graph (textual)

```
apps/storefront-runtime ──────┬──→ @letbuyy/auth-core
apps/merchant-control-plane ──┤──→ @letbuyy/shared-types  (151 importers)
apps/identity-platform ───────┤──→ @letbuyy/tenant-core
apps/marketing-site ──────────┤──→ @letbuyy/ui  (54 TS files; dev-time Storybook)
apps/platform-console ────────┘──→ @letbuyy/api-client  (95 importers)
                                ──→ @letbuyy/infrastructure
services/api-gateway ────────────→ @letbuyy/shared-types
                                ──→ @letbuyy/payments
                                ──→ @letbuyy/billing-core
                                ──→ @letbuyy/audit-core
                                ──→ [Supabase Admin via getSupabaseAdmin — 110 files]
packages/theme-engine ───────────→ @letbuyy/shared-types
```

### Turbo Pipeline
`turbo.json` defines: `build`, `dev`, `lint`, `test`, `typecheck`.
`build` task: `dependsOn ["^typecheck", "^build"]` — packages must typecheck before apps can build.
Evidence: `/Users/saai_sidd/Git/Letbuyy_Store/turbo.json`

The `pnpm build` script explicitly excludes frozen apps:
```
turbo build --filter=!@letbuyy/app-marketplace --filter=!@letbuyy/theme-marketplace
            --filter=!@letbuyy/developer-portal --filter=!@letbuyy/platform-operations-portal
```
Evidence: `/Users/saai_sidd/Git/Letbuyy_Store/package.json` (`build` script)

---

## Section 3: Domain Map

Based on the validator names, package names, and route structure in `services/api-gateway/src/routes/`:

| Business Domain | Primary Runtime | Supporting Packages | Key RPC |
|-----------------|----------------|---------------------|---------|
| **Auth / Identity** | `identity-platform`, `api-gateway` | `@letbuyy/auth-core`, `@letbuyy/identity-core`, `@letbuyy/token-core`, `@letbuyy/session-core` | `issueCustomerSession` (HS256), ES256 JWKS |
| **Tenancy / Stores** | `api-gateway`, `storefront-runtime` | `@letbuyy/tenant-core` | `verifySiteOwnership`, site_id RLS |
| **Products / Collections / Inventory** | `merchant-control-plane` (UI), `api-gateway` (data) | `@letbuyy/commerce-core` | inventory ledger RPCs |
| **Orders** | `api-gateway` (`routes/orders.ts`) | `@letbuyy/shared-types` | `create_checkout_order` |
| **Checkout** | `storefront-runtime` (embedded, not centralized) | `@letbuyy/checkout-core` | `create_checkout_order` |
| **Payments / Refunds / Payouts** | `api-gateway` (`routes/payments.ts`) | `@letbuyy/payments`, `@letbuyy/billing-core` | `confirm_order_payment_with_ledger`, `complete_order_refund` |
| **Gift Cards** | `api-gateway` | `@letbuyy/payments` | `issue_gift_card`, `restore_gift_card_on_refund` |
| **Webhooks** | `webhook-service` (Cloudflare Worker) | — | HMAC-signed outbound |
| **Queue / Async** | `queue-workers` (Cloudflare Worker) | `@letbuyy/event-core` | `signQueueTenantEnvelope` |
| **Themes** | `storefront-runtime` (render), `merchant-control-plane` (editor) | `@letbuyy/theme-engine` | Liquid/JSON renderer |
| **Marketing / SEO** | `marketing-site` | — | — |
| **Mobile / Merchant App** | `apps/mobile/merchant-app` | Flutter, `@letbuyy/auth-core` via BFF | `mobile-bff` |
| **Platform Ops** | `platform-console` | — | — |
| **GST / Invoices** | `api-gateway` | `@letbuyy/billing-core` | server-side GST compute, immutable invoices |
| **Shipping** | `api-gateway` (`routes/shipping.ts`, `routes/shipping-labels.ts`) | — | `shipping_rates` table |

---

## Section 4: Data-Flow Map

### Synchronous (User-Facing) Path

```
Browser / Mobile App
    │
    │  HTTPS request to {store}.letbuyy.com
    ▼
apps/storefront-runtime (Vercel, bom1)
    │  Next.js middleware: proxy.ts
    │  → resolves site_id from hostname via @letbuyy/tenant-core
    │  → enforces storefront access mode (public/password/preview_only/offline)
    │  → sets storefront gate cookie (HMAC-signed)
    │
    │  SSR/API routes proxy outward to api-gateway
    ▼
services/api-gateway (Cloudflare Worker, letbuyy-api)
    │  src/index.ts (Hono)
    │  Middleware stack: auth → rateLimit → apiVersioning → security headers
    │                    → idempotency → featureGate → observability
    │                    → internalPerimeter
    │  Merchant routes: auth = ES256 JWT (identity-platform JWKS)
    │  Customer routes: auth = HS256 JWT (CUSTOMER_SESSION_SECRET)
    │  verifySiteOwnership guard on every tenant route
    ▼
Supabase (PostgreSQL)
    │  Called via Supabase JS client (getSupabaseAdmin / service role)
    │  Money mutations: ONLY via SECURITY DEFINER RPCs
    │    create_checkout_order, confirm_order_payment_with_ledger,
    │    complete_order_refund, issue_gift_card, set_gift_card_status,
    │    restore_gift_card_on_refund
    │  RLS enforced on all tenant tables
    │  116 migrations in database/supabase/migrations/
    ▼
Response → api-gateway → storefront-runtime → Browser
```

### Async (Queue / Webhook) Path

```
api-gateway (Cloudflare Worker)
    │  Enqueues signed job envelope: signQueueTenantEnvelope
    ▼
services/queue-workers (Cloudflare Worker, letbuyy-queue-workers)
    │  cron: "17 */6 * * *"
    │  Processes async jobs (inventory sync, email triggers, etc.)
    ▼
services/webhook-service (Cloudflare Worker, letbuyy-webhook)
    │  HMAC-signed outbound webhook delivery to merchant endpoints
    ▼
External merchant webhook URLs
```

### Canonical Money Path

```
Client submits order
    ▼
api-gateway validates: amounts, GST, shipping from DB (NOT from client)
    ▼
Razorpay HMAC-SHA256 signature verification (server-side)
    ▼
db.rpc('create_checkout_order', { idempotency_key, ... })
    → SECURITY DEFINER; ON CONFLICT + FOR UPDATE; balances ≥ 0
    ▼
[Payment confirmed] → db.rpc('confirm_order_payment_with_ledger')
[Refund]           → db.rpc('complete_order_refund')
[Gift card]        → db.rpc('issue_gift_card') / 'restore_gift_card_on_refund'
    ▼
Canonical ledger in Supabase (immutable; no .from(money_table).insert/update in TS)
```

### Mobile Path

```
apps/mobile/merchant-app (Flutter, 156 Dart files)
    │  Same-auth: Turnstile + mobile BFF
    ▼
services/mobile-bff (Cloudflare Worker, letbuyy-mobile-bff)
    │  Verifies Turnstile before password login
    ▼
services/api-gateway
    ▼
Supabase
```

---

## Section 5: Runtime / Deployment Map

### Vercel Deployments

Five Next.js apps have `vercel.json`. All use `regions: ["bom1"]` (Mumbai) and share the same header security policy.

| App | vercel.json Location | Build Command |
|-----|---------------------|---------------|
| `storefront-runtime` | `apps/storefront-runtime/vercel.json` | `pnpm turbo build --filter=@letbuyy/storefront-runtime` |
| `merchant-control-plane` | `apps/merchant-control-plane/vercel.json` | `pnpm turbo build --filter=@letbuyy/merchant-control-plane` |
| `identity-platform` | `apps/identity-platform/vercel.json` | `pnpm turbo build --filter=@letbuyy/identity-platform` |
| `marketing-site` | `apps/marketing-site/vercel.json` | `pnpm turbo build --filter=@letbuyy/marketing-site` |
| `platform-console` | `apps/platform-console/vercel.json` | `pnpm turbo build --filter=@letbuyy/platform-console` |

Evidence: Individual `vercel.json` files in each app directory.

**FROZEN apps with NO `vercel.json` in root** (at repository root only; some may exist in worktrees — confirmed absent from main tree):
- `apps/theme-marketplace` — no `vercel.json`
- `apps/platform-operations-portal` — no `vercel.json`
- `apps/app-marketplace` — no root-level `vercel.json`
- `apps/developer-portal` — no root-level `vercel.json`

### Cloudflare Workers Deployments

All four real services are Cloudflare Workers (`wrangler.toml` present):

| Service | Worker Name | Entry | Crons |
|---------|-------------|-------|-------|
| `api-gateway` | `letbuyy-api` | `src/index.ts` | None (production triggers defined in env.production) |
| `mobile-bff` | `letbuyy-mobile-bff` | `src/index.ts` | None |
| `webhook-service` | `letbuyy-webhook` | `src/index.ts` | None |
| `queue-workers` | `letbuyy-queue-workers` | `src/index.ts` | `"17 */6 * * *"` |

All use `compatibility_date = "2026-05-25"` and `nodejs_compat` flag.
Evidence: `services/*/wrangler.toml`

### Supabase Data Layer

- **Location:** `database/supabase/migrations/` (177 total SQL files)
- **Migration count:** 116 numbered migration files (001–187; non-contiguous due to some being combined)
- **Latest migration:** `187_v1_sites_site_settings.sql`
- **DB Intel (from graphify-out/db-intel.json):** 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes
- Evidence: `database/supabase/migrations/` directory, `graphify-out/db-intel.json`

### Reserved / Not Deployed

Six placeholder service directories contain zero source files and no `package.json`:
`analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`.
Three mobile app placeholders contain only `AGENTS.md` + `runtime.manifest.json`:
`apps/mobile/shopper-app`, `apps/mobile/operator-app`.

These are **manifest-only reservations**, consistent with CLAUDE.md.

---

## Section 6: Ownership Map

### CODEOWNERS

Evidence: `/.github/CODEOWNERS`

| Path Pattern | Owner |
|--------------|-------|
| `*` (global fallback) | `@saai-sidd` |
| `/.github/workflows/` | `@saai-sidd` |
| `/database/supabase/migrations/` | `@saai-sidd` |
| `/config/env/` | `@saai-sidd` |
| `/services/api-gateway/src/routes/payments.ts` | `@saai-sidd` (critical path, named explicitly) |
| `/services/webhook-service/` | `@saai-sidd` |
| `/.gitattributes`, `/.gitignore` | `@saai-sidd` |
| `/apps/storefront-runtime/` | `@saai-sidd` |
| `/apps/merchant-control-plane/` | `@saai-sidd` |
| `/apps/identity-platform/` | `@saai-sidd` |
| `/apps/app-marketplace/` | `@saai-sidd` |
| `/apps/theme-marketplace/` | `@saai-sidd` |
| `/apps/marketing-site/` | `@saai-sidd` |
| `/apps/platform-console/` | `@saai-sidd` |
| `/apps/platform-operations-portal/` | `@saai-sidd` |
| `/apps/mobile/` | `@saai-sidd` |
| `/services/` | `@saai-sidd` |
| `/packages/` | `@saai-sidd` |
| `/database/` | `@saai-sidd` |
| `/infrastructure/` | `@saai-sidd` |
| `/docs/governance/` | `@saai-sidd` |
| `/scripts/validate-architecture.mjs` | `@saai-sidd` |
| `/scripts/validate-governance.mjs` | `@saai-sidd` |
| `/scripts/validators/` | `@saai-sidd` |

**Assessment:** Single-owner repository (solo founder). The CODEOWNERS comment says "intentionally uses broad platform ownership until dedicated GitHub teams exist." No team-based ownership yet; all paths converge to `@saai-sidd`.

### CI Workflows

Evidence: `/.github/workflows/`

| Workflow | File | Purpose |
|----------|------|---------|
| Main CI | `ci.yml` | Standard build/test gate |
| Security Review | `security-review.yml` | Per-PR security audit (Anthropic claude-code-security-review) |
| Full Security Audit | `full-security-audit.yml` | Weekly comprehensive audit |
| Architecture Governance | `architecture-governance.yml` | Governance validator |
| Staging Deploy | `staging-deploy.yml`, `staging-runtime-deployment.yml` | Staging environment |
| Production Deploy | `production-deploy.yml`, `production-rollout.yml` | Production releases |
| Mobile Release | `mobile-merchant-release.yml` | Flutter merchant-app |
| Graph Intelligence | `graph-intelligence.yml` | LCIS graph refresh |
| Misc | `deploy-staging.yml`, `environment-lifecycle.yml`, `hot-table-partition-maintenance.yml`, `branch-lag-monitor.yml`, `live-production-certification.yml` | Ops tasks |

---

## Section 7: Where LCIS Physically Lives & How It's Invoked

### Physical Location

**LCIS V1 (Graph Server):**
- Path: `tools/graph-server/`
- Entry: `tools/graph-server/server.mjs`
- Size: ~80 `.mjs` files (all intelligence, report generators, domain engines)
- No `package.json` — it is a plain directory of ESM scripts, not a workspace package
- Evidence: `tools/graph-server/` directory listing

**LCIS V2 (Central Intelligence):**
- Path: `tools/central-intelligence/`
- Entry: `tools/central-intelligence/intelligence-api/server.mjs`
- `package.json` present: `@letbuyy/central-intelligence` v2.0.0
- Dependencies: `@qdrant/js-client-rest`, `@opentelemetry/*`, `playwright`
- Subdirectories: `agents/`, `architecture-intelligence/`, `autonomous-operations/`, `browser-intelligence/`, `context-intelligence/`, `correlation/`, `daily-intelligence/`, `docker-compose.yml`, `execution-engine/`, `executive-intelligence/`, `goal-engine/`, `graph-engine/`, `intelligence-api/`, `investigation-engine/`, `knowledge-engine/`, `memory-engine/`, `observability/`, `operating-loop/`, `operator-platform/`, `orchestration-engine/`, `prediction-engine/`, `reasoning/`, `recommendation-engine/`, `self-model/`, `skills/`, `verification-engine/`
- Evidence: `tools/central-intelligence/package.json`

### Workspace Membership

**`tools/` is NOT declared in `pnpm-workspace.yaml`.**

The workspace file declares `packages/...`, `apps/*`, `apps/mobile/*`, `services/*` — but does not include `tools/`. This means:
- `tools/graph-server/` is not a workspace package (and has no `package.json` anyway)
- `tools/central-intelligence/` has a `package.json` but is NOT a workspace member
- Neither tool is built, linted, or typechecked as part of `pnpm build`, `pnpm lint`, or `turbo typecheck`

Evidence: `/Users/saai_sidd/Git/Letbuyy_Store/pnpm-workspace.yaml` (no `tools/` entry)

### Invocation — The `graph:*` Scripts

All `graph:*` scripts live in root `package.json` and invoke `node tools/graph-server/*.mjs` directly. There are **approximately 65 `graph:*` scripts** in root `package.json`. Examples:

```
"graph:ui"      → node tools/graph-server/server.mjs          (starts LCIS V1 on :3333)
"graph:update"  → node tools/graph-server/refresh-graph.mjs   (re-runs graphify scan)
"graph:db"      → node tools/graph-server/db-intel.mjs        (DB layer extraction)
"graph:v3"      → db-intel + infra-intel + domain-intel + gen-v3-reports
"graph:omega"   → chains ~25 scripts; full build of LCIS state
"graph:intel"   → node tools/graph-server/intelligence.mjs    (the CLI query tool)
```

LCIS V2 is started separately via its own `package.json` scripts (`npm start` in `tools/central-intelligence/`), not via root `package.json`.

Evidence: `/Users/saai_sidd/Git/Letbuyy_Store/package.json` (scripts section)

### Graphify: Installation Status

`graphify` (the code-graph indexer) **IS installed** via `uv tool install graphifyy`:
- Binary: `/Users/saai_sidd/.local/bin/graphify`
- Also installed: `graphify-mcp` (the MCP server binary)
- Version: `graphifyy v0.8.39`
- Evidence: `uv tool list` output confirming `graphify` and `graphify-mcp`

### Graphify Artifacts

`graphify-out/` **exists and is populated** (66 files confirmed present):
- `graphify-out/graph.json` — the main code graph (read by LCIS V1 server.mjs)
- `graphify-out/db-intel.json`, `graphify-out/domain-intel.json`, etc. — generated by the `graph:*` pipeline scripts
- `graphify-out/` and `.graphify/` are in `.gitignore` (evidence: `.gitignore` entries confirmed)

### MCP Registration Status

`graphify-mcp` is **installed as a binary** (`/Users/saai_sidd/.local/bin/graphify-mcp`) but is **NOT registered in the project's `.claude/settings.json`**.

- `/.claude/settings.json` has an empty `mcpServers: {}` object
- CLAUDE.md says "graphify-mcp is also installed (operator-registered; not auto-added to `.claude/`)" — this is **accurate**: it is registered at the user/operator level (outside the repo), not in the project settings file
- Evidence: `cat .claude/settings.json | mcpServers = {}`; `uv tool list` confirming binary presence

### CRITICAL VERDICT: Is LCIS Today a Build-Time CLI + Local Dev Server with ZERO Presence in the Deployed Product?

**YES. This is confirmed.**

Evidence chain:
1. `tools/` is absent from `pnpm-workspace.yaml` — the LCIS tools are not workspace members
2. No `vercel.json` exists in `tools/graph-server/` or `tools/central-intelligence/`
3. No `wrangler.toml` exists in either tools directory
4. The root `pnpm build` script explicitly references `turbo build` which only covers workspace packages — `tools/` is excluded by virtue of not being declared
5. `graph:ui` just runs `node tools/graph-server/server.mjs` — a plain local Node.js server
6. LCIS V1's `server.mjs` says in its header comment: "Zero dependencies (Node http only). Reads graphify-out/graph.json directly. Start: `pnpm graph:ui` → http://localhost:3333" — local dev only
7. LCIS V2 requires external services (Qdrant, OTel exporter, Playwright) and a `setup.sh` script — it is explicitly a local/dev-server tool
8. `graph:graph-intelligence.yml` CI workflow name suggests LCIS may run in CI to regenerate artifacts — but it does NOT serve the LCIS UI in production
9. LCIS data flows to developers and AIs only; it has no request path from any deployed Vercel app or Cloudflare Worker

**LCIS is a developer intelligence layer that runs on the developer's local machine (and possibly in CI for artifact generation). It is architecturally invisible to users, merchants, and the deployed production system.**

---

## Corrections to CLAUDE.md Claims

| CLAUDE.md Claim | Actual Finding |
|-----------------|----------------|
| "107-validator gate" | **108 gate validators** in `validate-governance.mjs` (confirmed by exact parse). Script also has 114 `.mjs` files in `scripts/validators/`. CLAUDE.md is 1 short. Evidence: `scripts/validate-governance.mjs` final `console.log`. |
| "`getSupabaseAdmin` (115 files)" | **110 files** by live grep. 5-file discrepancy; likely stale from a past graph scan. |
| "`@letbuyy/api-client` (high blast radius)" | 95 importing files confirmed. However, **`packages/api-client/` does not exist as a directory**. The package resolves via an unknown alias (possibly generated or re-exported). |
| "`@letbuyy/ui`" (implied in packages/) | Located at **`packages/typescript/ui/`**, not `packages/ui/`. CLAUDE.md omits this path detail. |
| "graphify-mcp is also installed (operator-registered; not auto-added to `.claude/`)" | **Accurate.** Binary confirmed at `/Users/saai_sidd/.local/bin/graphify-mcp`; absent from `.claude/settings.json`. |
| "414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes" | These numbers come from `graphify-out/db-intel.json` — a generated artifact. They are from a prior scan and may be stale; they are not independently verifiable without re-running `pnpm graph:db`. |
| LCIS as "the repository scan is the LAST resort" | Architecturally accurate — LCIS V1 reads `graphify-out/graph.json` which is generated from the repo. However LCIS V2's live values (telemetry, GMV, merchant counts) are **NOT CONNECTED** unless `OPENAI_API_KEY`, `QDRANT_URL`, and `OTEL_EXPORTER_OTLP_ENDPOINT` are set (confirmed by `tools/central-intelligence/package.json` optional deps). |
