# LetBuyy Unified Commerce — Current State and Gap Report

- **Date:** 2026-09-19
- **Prepared by:** the `/letbuyy` operating-skill session (Claude Fable 5.1). Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO · Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO.
- **Companion brief:** [`LETBUYY_UNIFIED_COMMERCE_GUIDANCE_HANDOFF.md`](./LETBUYY_UNIFIED_COMMERCE_GUIDANCE_HANDOFF.md)
- **Placement note:** the brief asked for the repository root. The repository's own gate forbids new root Markdown (`scripts/validators/whole-repo-end-state-validator.mjs:28-37` asserts a root-Markdown allowlist), so both documents sit in this dated evidence directory instead. Neither file was committed.
- **Nothing was implemented, deployed, committed, pushed, stashed or reset.** The only writes made by this audit are the two documents in this directory plus throwaway logs under the session scratchpad.

---

## 1. Executive verdict

**The founder's hypothesis is half right.** LetBuyy holds a real, tested commerce core — tenant-isolated Postgres with row-level security, a balanced double-entry ledger, idempotent checkout and inventory RPCs proven under genuine concurrency, a working Razorpay verification chain, a storefront runtime with custom domains and theme publishing, a marketplace listing model with moderation, and a platform buyer realm issued by an asymmetric identity service. Those parts are the infrastructure the proposed platform needs, and they were re-verified in this audit at the database and unit level (§18).

**What it does not hold** is any of the physical-commerce layer the merger requires: there is **no geography at all** in the schema (no coordinates, no PostGIS, no polygons), no fulfilment-location custody model beyond "a location belongs to one store", no dispatch, rider, proof-of-delivery or store-operations backend, **no POS of any kind**, no operator login that works in production, and no per-location or per-channel pricing. The quick-commerce donor code (`apps/phase_2/*`, `packages/dart/quickcommerce_*`) is UI and domain scaffolding wired to no backend. Agrimore's repository contains the geographic and dispatch primitives LetBuyy lacks, but in a partially rebuilt state with an unfixed auth-parsing defect and an untrusted internal hop.

**Nothing is deployed and nothing has been exercised end to end.** The integration branch `develop` (611 commits ahead of the workspace checkout) has never been booted as a running stack; no Supabase project exists by owner decision (D-11); the deploy workflows are dispatch-only; the GitHub remote is unreadable from this machine. Every HTTP-level and product-level claim in this report is therefore `inspected source` or `reproduced locally at the SQL/unit layer`, never `verified in staging`.

**Direction this audit recommends (a recommendation, not a decision):** keep LetBuyy as the base (consistent with the owner's recorded D-0), add the physical-commerce domain as new bounded capability inside the existing gateway and database rather than by importing Agrimore's backend, and reuse Agrimore's *designs* (zones, dispatch state machine, store-ops and rider flows, per-app design systems) after they are re-expressed against LetBuyy's tenancy and ledger invariants. Two constitutional conflicts must be settled by the founder before any of that starts: LetBuyy's permanent 0% transaction fee versus Agrimore's 3–4% commission model, and LetBuyy's "never a money custodian" rule versus a platform that collects payment and pays partners and riders (§23).

---

## 2. Founder vision — confirmed versus proposed decisions

Classification tags follow the repository's own scheme: `OWNER_DECISION`, `OPEN_FOUNDER_DECISION`, `CONSTITUTIONAL_DECISION`, `TARGET_IMPLEMENTATION`, `PROVISIONAL_DIRECTION`.

| Topic | Status today | Source |
|---|---|---|
| Canonical backend is LetBuyy's commerce OS; Agrimore's schema and Firebase are closed as backends | `OWNER_DECISION` D-0 (2026-09-04) | `.claude/skills/letbuyy/references/decisions.md` §2 |
| 0% transaction fee, permanent, both channels | `OWNER_DECISION` D-1 and `CONSTITUTIONAL_DECISION` (Constitution §6) | same; `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:125` |
| Merchant-of-record / who invoices the buyer | `OPEN_FOUNDER_DECISION` D-2 ("needs counsel") | decisions.md §2 |
| Multi-merchant cart: parent purchase + child orders, launched single-child behind a flag | `OWNER_DECISION` D-3; purchase tenancy platform-level | decisions.md §2, §2b |
| One admin = `admin_web` | `OWNER_DECISION` D-4 | decisions.md §2 |
| Marketplace buyer identity = platform buyer realm (third realm, asymmetric) | `OWNER_DECISION` D-8 | decisions.md §2b |
| All eleven Firebase capability areas rebuilt canonically; Firebase deleted in one cutover at the end | `OWNER_DECISION` D-9, D-10 | decisions.md §2b |
| No dev/staging Supabase; local throwaway containers only | `OWNER_DECISION` D-11 | decisions.md §2b |
| Phase 2 = quick commerce (Instant, Store Ops, Rider) on the same backend with Agrimore as UX/schema donor | `TARGET_IMPLEMENTATION` only — "nothing in this section is evidence that code exists" | decisions.md §4 |
| Unified platform: store builder + marketplace + quick commerce + one merchant app + Store Ops + Rider + adaptive POS + Central Admin + Sales Associate; "Letbuyy Store" naming | **Founder proposal under evaluation** — not yet in any decision record | this brief |
| Native Windows/macOS for Admin and POS; Flutter mobile | Agrimore `OWNER_DECISION` (ADR-0003, PDR-0001) in the Agrimore repository; **not** a LetBuyy decision | `Agrimore_Supabase/docs/decisions/ADR-0003-…md` |
| Merchant may place goods in a partner/dark store; custody arrangements explicit | Founder proposal; no model exists in either repository | this brief |
| Circle/polygon zones, overlapping stores, customer choice | Agrimore PDR-0002 §3 (decided there); absent in LetBuyy | `Agrimore_Supabase/docs/product/PDR-0002-…md` |

**Decision-record changes the proposal would require (identified, not made):** a Constitution amendment for new app roots (native POS and Admin shells are not among the eight runtimes or the six-app model), a decision on the fee model (D-1 vs Agrimore's commission), a resolution of D-2, a new tenancy decision for fulfilment locations owned by a different legal party than the stock owner, an amendment to the `channel` vocabulary (`channel_listings` allows `storefront | marketplace | instant`; the Constitution names `pos` as a channel value but nothing implements it), and an ARB decision before any reserved service root is filled.

---

## 3. Audited snapshot, scope, methods and limitations

### 3.1 Snapshot

| Item | Value |
|---|---|
| Workspace checkout | `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`, HEAD `a751a2ff` (2026-09-04). Working tree: 38 modified, 1 deleted, 15 untracked files owned by other sessions. **0 ahead / 611 behind `develop`.** Read-only for this audit (skill rule). |
| Audited code snapshot | `LetBuyy-develop` worktree, branch `develop`, HEAD `88a9bf6f` (2026-09-12 11:04 +0530), **clean tree before and after every test run** (`git status --porcelain` = 0). 111 phase merges since `a751a2ff`. |
| Other branches | `staging` = `main` = `a751a2ff`; `stepup/main` = `e72aef17` (preserved alias). `develop` is not pushed anywhere (D-12); the remote `SaaiSiddhu/Letbuyy_Store` is unreadable from this machine. |
| Agrimore comparison snapshot | `/Users/saai_siddharth/Projects/Start_Up/Agrimore_Supabase`, branch `foundation-rebuild`, HEAD `6a33bf8` (2026-09-19). The index holds an uncommitted cleanup in flight: 1,225 staged deletions (mostly `legacy_archive_v2/`), 104 adds, 45 renames, 12 modifications. The audit read the index/working-tree state, not HEAD. |
| LCIS intelligence layer | Both servers (`:3333`, `:3334`) were down and were not started; the repository was scanned directly. |

**All file:line references below resolve against `develop` = `88a9bf6f`**, not against the workspace checkout, unless a path is prefixed `Agrimore_Supabase:`.

### 3.2 Method

1. Read the governing documents (`CLAUDE.md`, the skill's `decisions.md`, `hazards.md`), the ledgers (`EXECUTION_LEDGER.md`, `CAPABILITY_BACKLOG.md`, `docs/active/BRANCH_DISPOSITIONS.md`), and the 2026-09-12 integration evidence.
2. Inventoried apps, services, packages, migrations, workflows and infrastructure descriptors from manifests.
3. Traced each domain from route → execution adapter → RPC → table, reading the *latest* redefinition of every RPC (`grep -l 'FUNCTION public.<name>' … | tail -1`), never the baseline copy.
4. Ran the safe test lanes and eight executable Postgres suites inside throwaway containers (§18).
5. Read Agrimore's product records, decision records, launch plan, SQL migrations, gateway route table, Edge Functions and app skeletons.

### 3.3 Limitations (named, not hidden)

- **No running stack.** The programme has never reached `E2E_DEVELOP`; the last diagnosis (ledger row `PHASE-F-E2E-0c`) blamed the Docker daemon's pull path. Postgres images are present locally today and container runs succeeded, so that blocker may have moved, but booting Supabase + four Workers + five Next apps was outside this audit's bounded scope. **Route-level behaviour, browser flows and provider callbacks are therefore not reproduced.**
- **No cloud visibility.** Deployed state is `UNKNOWN_LIVE_STATE` throughout.
- **No live provider credentials** were used or needed; no payments, SMS, or payouts were attempted.
- **Flutter apps were not built.** Prior evidence (memory: Phase Q) shows `merchant_app` and `customer_app` compiled once; not re-verified here.
- **Next builds were not re-run.** The 2026-09-12 evidence records all five `next build`s green at `9532074b` (`docs/evidence/integration/2026-09-12-develop-integration.md` §Measurement 3). Historical, not fresh.
- **Agrimore Flutter/Next apps were not built or run.**

---

## 4. Repository and application inventory

### 4.1 Toolchain and versions (from manifests)

| Layer | Version / fact | Evidence |
|---|---|---|
| Package manager / runtime | pnpm 10.6.2; Node 20 in CI (`.nvmrc`/`.node-version` = 20), Node 26.5.1 on this machine | `package.json`, `.github/workflows/ci.yml` |
| Web apps | Next 16.1.6, React 19.2.3 on all five (`customer_web` :9000, `merchant_web` :9001, `identity-platform` :9002, `marketing-site` :9006, `admin_web` :9007; `next dev --webpack`) | each `apps/*/package.json` |
| Workers | Hono ^4.7 (gateway) / ^4.0, wrangler ^4.100; `api-gateway` :9010, `mobile-bff` :9011, `webhook-service` :9012, `queue-workers` :9013 | `services/*/package.json` |
| Flutter | SDK constraint `^3.10.0`; `customer_app` 1.0.10+4013 (`letbuyy_marketplace`, android/ios/web), `merchant_app` 1.0.0+1 (`letbuyy_store`, android/ios), `phase_2/rider_app` and `store_ops_app` 0.1.0+1 (android/ios) | `pubspec.yaml` files |
| Native desktop | **No** `.csproj`, `.sln`, `.xcodeproj` or `Package.swift` in either repository | `find` over both trees |
| Tests | `node --test` / `tsx --test`; vitest only in `@letbuyy/ui`; Playwright 1.60.0 declared (`tests/e2e/*`) | `package.json` |
| Database | 175 tracked migrations (`000_baseline.sql` … `246_release_decrements_committed_quantity.sql`), 97 paired rollbacks; 449 distinct `CREATE TABLE` symbols across history; 73 `FORCE ROW LEVEL SECURITY` statements; 279 tenant tables registered by the tenant validator | `database/supabase/migrations`, validator output |

### 4.2 Directory guide (what each root is, and whether it runs)

| Root | Role | Class |
|---|---|---|
| `services/api-gateway` | Hono/Cloudflare Worker modular monolith; ~70 route modules mounted under `/v1` (`src/index.ts:722-857`); execution adapters in `src/execution/*` are the only callers of the money RPCs | ACTIVE |
| `services/queue-workers` | 14 modules: reservation expiry, loyalty earn, money-ledger reconciliation, push dispatch, risk scoring, SLO telemetry, incident command, JTI sweeper…; 7 queue consumers with dead-letter queues; cron `17 */6 * * *` | ACTIVE |
| `services/webhook-service` | Razorpay ingress (raw-body HMAC), `payment_webhook_events` dedupe, forwards to gateway internal payment routes; outbound app-lifecycle HMAC | ACTIVE |
| `services/mobile-bff` | Composite `/v1/mobile/dashboard` for `merchant_app` | ACTIVE |
| `apps/identity-platform` | Sole asymmetric issuer (ES256/EdDSA) for **merchant** and **buyer** realms; email OTP signup, Turnstile, rate limits, JWKS endpoint | ACTIVE |
| `apps/customer_web` | Storefront runtime: host routing (`src/proxy.ts`), `/store/[subdomain]/…` tree, account pages, hosted `checkout-origin`, `robots.ts`, `sitemap.ts` | ACTIVE |
| `apps/merchant_web` | Merchant OS: 80+ pages under `/[store]/…` (products, inventory, transfers, purchase orders, locations, orders, payouts, themes editor, domains, shipping, taxes, staff, billing); 130 API routes that proxy to the gateway | ACTIVE |
| `apps/admin_web` | Operator console: 22 pages incl. `marketplace-listings`, `marketplace-governance`, `money-reconciliation`, `merchants`, `risk` | SUPPORTING |
| `apps/marketing-site` | Public marketing | ACTIVE |
| `apps/merchant_app` | Flutter merchant app, 153 Dart files, gateway-only, screens for inventory/transfers/PO/locations, KYC, staff, shipping, taxes, domains | SUPPORTING |
| `apps/customer_app` | The **shipped Play Store app** (`com.letbuyy.letbuyy`, Firebase project `letbuy-y`), 183 Dart files; 29 files still Firestore/Firebase-Auth bound, 5 touch the canonical marketplace API (FB-2) | Lineage A, being retired (D-10) |
| `apps/phase_2/{rider_app,store_ops_app}` | Agrimore donor UIs (20 and 18 Dart files; riverpod + go_router; features: assignment/delivery/earnings/shift; queue/pick_pack/handoff/inventory) wired to no LetBuyy backend | Phase 2 tier (real source, no backend authority) |
| `packages/dart/quickcommerce_*` | Donor domain/API/design/offline/realtime packages (≈85 Dart files) | donor |
| `packages/typescript/{ui,api-client,api-types}` | `@letbuyy/ui` design system (`--lb-*` tokens, 284 variables), typed client | shared |
| `packages/{tenant-core,session-core,identity-core,auth-core,payments,billing-core,checkout-core,theme-engine,infrastructure,…}` | shared domain packages; `infrastructure/razorpay-adapter` holds order/fetch/refund calls | shared |
| `services/{checkout-runtime,event-bus,notification-service,analytics-pipeline,media-service,search-service}`, `apps/mobile/*`, `apps/admin_app` | RESERVED, manifest-only, must stay empty | RESERVED |
| `services/compatibility/{agrimore_bridge,cloudflare_bridge}` | Manifests and READMEs only; inert | compatibility |
| `apps/{app-marketplace,developer-portal,theme-marketplace,platform-operations-portal}` | FROZEN, not deploy targets | FROZEN |
| `services/lcis-api`, `tools/*`, `packages/lcis-*` | Central Intelligence tooling, non-deployed | TOOLING |

### 4.3 Integrations declared in code (none observed live)

Razorpay (orders, verify, webhooks, refunds, subscriptions), Resend (email), Twilio (WhatsApp), FCM/APNs (push dispatcher env), Cloudflare Turnstile, Cloudflare R2 (`letbuyy-media-staging`), Queues, KV, Hyperdrive, D1 (staging bindings in `services/api-gateway/wrangler.toml`), Vercel domains API (custom domains), DNS-over-HTTPS TXT verification, courier adapters Shiprocket/Delhivery/Pickrr (sandbox unless `LOGISTICS_MODE=live`), Postgres full-text search (`to_tsvector`/`search_vector`, no external search provider), GraphQL storefront behind `FEATURE_GRAPHQL`. **No maps, geocoding or routing provider anywhere in LetBuyy.**

### 4.4 Duplicates and which one runs

- Three customer identities coexist (per-store `store_customers` with HS256 sessions, platform `buyer_accounts` with asymmetric sessions, Firebase Auth in the shipped app). §7.
- Two order-entry paths: storefront `POST /storefront/:subdomain/orders` (live path) and the hosted checkout state machine `routes/checkout.ts` (`checkout_sessions`, `verify-handoff`), now referenced by `customer_web` (`checkout-url`, `verify-handoff`); runtime use unverified.
- `products.stock` / `product_variants.inventory_qty` are denormalised caches of `inventory_levels.available` since migration 216; the authority is `inventory_levels`.
- Organisation model (`organizations`, `org_memberships`, `org_store_links`, migration 159) exists as DDL behind `FEATURE_ORG_MODEL` and is referenced only by identity-foundation scaffolding — **DDL-real, wiring-dead**.

---

## 5. Current runtime architecture

```
                 ┌──────────────────────────── browsers / apps ────────────────────────────┐
                 │  {store}.letbuyy.com / custom domain        merchant_web   admin_web     │
                 │  customer_web (Next 16)                     (Next 16)      (Next 16)     │
                 │  merchant_app (Flutter)  customer_app (Flutter, Firebase — retiring)     │
                 └───────┬───────────────────────────┬──────────────┬──────────────────────┘
                         │ /api/storefront/* rewrite  │ 130 proxy    │ console-auth (dev-only
                         │ → gateway /v1/storefront   │ routes       │ magic link)
   identity-platform ────┼───────────────────────────┼──────────────┤
   (ES256/EdDSA issuer:  │                           │              │
    merchant + buyer     ▼                           ▼              ▼
    realms, JWKS)   ┌─────────────────────────────────────────────────────────┐
                    │ services/api-gateway  (Hono Worker, /v1, ~70 modules)   │
                    │  auth verifiers (JWKS, internal HMAC) · tenant GUC tx   │
                    │  execution adapters → db.rpc(...)  · idempotency claims │
                    └──────┬───────────────┬──────────────────┬───────────────┘
                           │ Supabase JS   │ Queues (5 prod.) │ R2 / KV / Hyperdrive / D1
                           ▼               ▼                  ▼
   ┌───────────────────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
   │ Postgres (Supabase shape)     │  │ queue-workers    │  │ webhook-service          │
   │ sites = tenant root (site_id) │  │ 7 consumers+DLQ  │  │ Razorpay raw-body HMAC   │
   │ RLS ENABLE+FORCE, app.site_id │  │ cron 6h: expiry, │  │ UNIQUE(provider,event_id)│
   │ money RPCs (SECURITY DEFINER) │  │ reconciliation,  │  │ → /storefront/internal/  │
   │ double-entry ledger, outbox   │  │ loyalty, push…   │  │   payments/{confirm,…}   │
   └───────────────────────────────┘  └──────────────────┘  └──────────────────────────┘
   mobile-bff (/v1/mobile/dashboard) fans in for merchant_app.
   NOT PRESENT: geography, dispatch, rider, store-ops, POS, partner custody, operator prod login.
   NOT DEPLOYED: any of the above (deploy lanes dispatch-only; Vercel IDs placeholders; no Supabase project).
```

---

## 6. Store builder — capability and workflow evidence

**Verdict: a functioning store builder exists in source; it is not a template gallery. Runtime unverified.**

| ID | Finding | Evidence | Type / state |
|---|---|---|---|
| LB-SB-001 | Merchant provisioning: identity signup → email OTP (`api/auth/verify-otp`, rate-limited, CSRF) → `create-store` → `sites` row with `subdomain`, `published`, `access_mode`, `theme_id`, `trial_*`, `custom_domain*` columns | `apps/identity-platform/src/app/api/auth/*`, `000_baseline.sql:11962-11993` | inspected source; Implemented but not exercised |
| LB-SB-002 | Tenant resolution: `customer_web/src/proxy.ts` resolves host via `/v1/internal/store-access/resolve` (`cache: 'no-store'`), rewrites to `/store/<subdomain>` with a boundary check against `/store/<subdomain>x` (ART-08), reserves `checkout.<root>` as a tenant-free origin, host-only preview cookie | `apps/customer_web/src/proxy.ts:112-270` | inspected source |
| LB-SB-003 | Custom domains: add → TXT challenge `_letbuyy-challenge.<domain>` verified over DoH → Vercel domain status/SSL → primary/redirect domains (migration 185), reviews, history | `services/api-gateway/src/routes/custom-domains.ts:139-591` | inspected source |
| LB-SB-004 | Themes: editor drafts, publish, preview sessions, releases and **rollback**, package upload; theme tables incl. `theme_releases`, `theme_editor_drafts`, `site_preview_links` (JTI-revocable) | `routes/themes.ts:567-702`, `custom-domains.ts:621-661` | inspected source |
| LB-SB-005 | Configuration is structured (JSON settings + Liquid/portable sections), not arbitrary code. Sanitizer: `FORBID_TAGS ['base','embed','object','script']`, `FORBID_ATTR ['style']`, `outputEscape:'escape'`; custom CSS passes `custom-css-sanitizer.ts` | `packages/theme-engine/src/theme-renderer.ts:300-301,1063` | inspected source |
| LB-SB-006 | Renderer split: Constitution names Liquid canonical; `FEATURE_LIQUID` default off; `rendererEngine` per theme. Prior memory records the shipped canonical theme still on frozen React and the Liquid theme "built and dark" — not re-measured here | `theme-execution.adapter.ts:675-698` | historical, unverified |
| LB-SB-007 | SEO: `robots.ts`, `sitemap.ts` present; policies, pages, blog, collections routes exist. Broken-link and accessibility checks **not run** (no running stack) | `apps/customer_web/src/app/{robots,sitemap}.ts` | inspected source |
| LB-SB-008 | Plan/subscription: billing routes and `plan_code` exist; **no store-count limit or plan gate on store creation was found** (`grep max_stores|store_limit` empty in `routes/stores.ts`, identity `create-store`) | `routes/stores.ts:647` | inspected source (absence by grep) |
| LB-SB-009 | Cross-tenant cache: storefront access resolution is `no-store`; `STOREFRONT_CACHE` flag exists; no cache-key-by-host test was found or run | `wrangler.toml` vars | unknown |

**Workflow evidence.** The 2026-09-12 integration document records all five Next apps building; the unit lane (§18) covers the storefront routers; the checkout RPC path is proven at SQL level. The **browser journey signup → publish → purchase has never been executed by the programme** (`E2E_DEVELOP` unreached).

---

## 7. Marketplace, customer identity and channel model

### 7.1 What exists

| ID | Finding | Evidence | State |
|---|---|---|---|
| LB-MKT-001 | Marketplace foundation: `marketplace_categories`, `channel_listings(site_id, product_id, channel ∈ {storefront, marketplace, instant}, status, visibility, marketplace_category_id, pricing_policy jsonb, compliance_flags, version)`, `channel_listing_moderation_events` with an advisory lock before the existence check, `transition_channel_listing` RPC, keyset `marketplace_feed` RPC, public routes `/storefront/marketplace/{feed,categories,listings/:id}`, merchant CRUD + transition under `/channel-listings`, admin screens `marketplace-listings` and `marketplace-governance` | `217_marketplace_channel_listings.sql:98-118,265-438`; `routes/storefront/public-routes.ts:295,325`; `routes/channel-listings.ts:106-207` | inspected source; RPC layer reproduced locally (`marketplace-channel-listings` suite exists; not run in this audit) |
| LB-MKT-002 | **No channel or location pricing.** `marketplace_feed` returns `products.price`; `pricing_policy` is stored and validated but never applied in feed or checkout (`grep pricing_policy` hits only the CRUD route, its schema and the registry) | `217_…sql:426-470`; grep | inspected source |
| LB-MKT-003 | Per D-11 the marketplace migrations have been applied to no database anywhere, so no feed row has ever been served to a client. The shipped `customer_app` reads the marketplace catalogue (FB-2) but keeps Firebase Auth, cart, orders, chat and reels (29 Firestore-bound files) | decisions.md §2b; `apps/customer_app/lib/**` | inspected source |
| LB-MKT-004 | Operator moderation cannot run in production today (§8, LB-ORG-004) → listings cannot reach `approved` → the feed stays empty in any real environment | `apps/admin_web/src/app/api/console-auth/login/route.ts:27-29` | inspected source |
| LB-MKT-005 | Sponsored feed ranking, banners, follower graph, wishlists, buyer notifications, returns, support tickets, loyalty (merchant-funded, ledger-backed) are built canonically (CAP-FB-* phases) | migrations 224-243; `routes/storefront/*` | inspected source; RPC suites exist |

### 7.2 Customer identity

| ID | Finding | Evidence |
|---|---|---|
| LB-CUST-001 | **Three identities.** (a) `store_customers(store_id, email, password_hash, addresses jsonb, …)` — tenant-scoped accounts used by `customer_web` `/customers/login`, session minted **HS256 from `CUSTOMER_SESSION_SECRET`** (the verification key is the forgery key; a recorded deviation, not a pattern). (b) `buyer_accounts(email, password_hash, email_verified, status)` — platform-level, minted ES256/EdDSA by identity-platform with `realm:'buyer'`, **no site claim by design**. (c) `buyer_store_customers(buyer_account_id, store_customer_id, site_id)` links (b) to (a) via `POST /buyer/link-store-customer`. (d) Firebase Auth in the shipped app. | `223_platform_buyer_identity.sql:58-79`; `identity-issued-session.ts:80-125`; `middleware/customer-session.ts:56-61`; `buyer-account-routes.ts:80-158` |
| LB-CUST-002 | Buyer accounts are **email + password**; the target shape names mobile number + OTP. No SMS provider is integrated for OTP (email OTP only). | `identity-platform/src/app/api/buyer/*`; env names show Twilio only for WhatsApp |
| LB-CUST-003 | Address book is tenant-scoped (`customer_addresses`, `store_customers.addresses`); there is **no platform-level address book** for a buyer, and no coordinates on any address. | `000_baseline.sql:8870-8901` |
| LB-CUST-004 | Merging accounts: the link table already models "one buyer ↔ many store customers". Merging would need an owner rule for email collisions, a consent step, and a policy that a merchant sees only its own `store_customers` row (which RLS already enforces: `buyer_accounts` carries no `site_id`, `purchases` is unreadable by merchants). **Shared identity does not grant any merchant access to another merchant's customer data**, and nothing in the schema would. | 219, 223 |

### 7.3 Unified experience across standard shipping and quick delivery — analysis

Today LetBuyy has exactly one delivery mode: carrier shipping computed from `shipping_zones` (countries/states/zip codes) and `shipping_rates`, plus pincode `shipping_serviceability_rules` (COD limits, weight bands, ETA days). There is no location context on the buyer, no store eligibility computation, no quick-delivery promise. Every item below is **new work**:

- **Channel selection and location context** — requires a buyer-level delivery address with coordinates, a serviceability service, and persisting the chosen fulfilment location with the basket (Agrimore PDR-0002 §3 describes this; LetBuyy has no field for it).
- **Same product from several merchants/locations** — needs a "location listing" (product × location × price × availability) layer between `channel_listings` and `inventory_levels`. Absent.
- **Eligibility and promises** — must be server-side at quote and at commit; `create_checkout_order` has no serviceability hook.
- **Tracking differences** — orders carry `tracking_number`, `carrier`, `shipments`, `shipment_events`; no rider position, ETA or proof types.
- **Fees, promotions, wallet, refunds by channel** — gift cards and loyalty are tender in the ledger; delivery fees are shipping rates; a rider fee/handling fee line type does not exist.

### 7.4 Recommended first-release cart model (recommendation, not approval)

**Recommendation: separate baskets per fulfilment mode, one fulfilment location per Instant basket, parent purchase + child orders retained for the standard-shipping marketplace.**

| Option | What it means | Pros | Cons |
|---|---|---|---|
| A. Separate baskets (recommended first release) | A storefront basket (one merchant), a marketplace basket (may span merchants → one `purchase`, N child `orders`, D-3 flag lifted later), and an Instant basket bound to one eligible location. Never merged silently; switching location requotes with explicit confirmation. | Matches what exists (D-3 model proven, `purchases` platform-level); Instant inherits Agrimore's proven single-location invariants; no split-shipment promises. | Buyers see up to two checkouts; needs clear UI copy; wallet/loyalty per merchant complicates "one basket". |
| B. Mixed cart with automatic split into child fulfilments | One basket; server splits by merchant and by mode. | One checkout. | Introduces split orders silently (the brief forbids that); refund, tracking and partial-failure semantics multiply; Instant capacity checks per line. |
| C. Single-location everywhere | Agrimore's rule applied to all channels. | Simplest invariants. | Breaks the marketplace (multi-merchant is the point) and the D-3 decision. |

Whichever is chosen, `purchases.channel` and `channel_listings.channel` vocabularies, and the D-3 flag, are the places the decision lands.

---

## 8. Unified merchant app, tenancy and membership model

| ID | Finding | Evidence | Consequence |
|---|---|---|---|
| LB-ORG-001 | Tenant root is `sites.id`; ownership is `sites.custom_user_id / user_id`; `listOwnedStoreIds` returns every site a user owns, so **one person can own many stores**, but each store is an independent tenant with its own products, customers, inventory locations and ledger accounts | `lib/order-ownership.ts:3-15`, `lib/auth-user.ts:58-83` | Multi-location = multi-site today; nothing shares catalogue across sites |
| LB-ORG-002 | Organisation layer (`organizations`, `org_memberships(principal_id, realm, role_ids)`, `org_store_links(relation)`, `delegations`) exists in migration 159 behind `FEATURE_ORG_MODEL`, referenced only by `identity-foundation/{migration-scaffold,repository-boundary}.ts` | grep | `merchant_principal → org → sites` is `TARGET`, not `CURRENT` |
| LB-ORG-003 | Staff: `employees(permissions.granted[])`, `employee_roles`, `employee_permissions`, `site_memberships(role_slugs)`, invites; `assertStaffPermission` evaluates `employees` — **default mode is `dryrun` (evaluate and log, never block)** unless `MERCHANT_STAFF_RBAC_MODE=enforce` | `middleware/staff-permission.ts:46-51,135-153` | Staff permission checks are advisory by default; owner-vs-staff separation is not enforced server-side until the flag is set and verified |
| LB-ORG-004 | **Operator realm has no production login.** `admin_web` console-auth is a dev magic link; in production the route returns `magic_link_delivery_not_configured`. identity-platform issues only `merchant` and `buyer` realms | `admin_web/src/app/api/console-auth/login/route.ts:27-29`; `identity-issued-session.ts:61,107` | Moderation, KYC review, reconciliation and suspension UIs are unreachable in any real environment |
| LB-ORG-005 | Roles absent from the schema: fulfilment-location operator/custodian, cashier, rider, Sales Associate. Locations (`inventory_locations.store_id`) always belong to the selling site; a partner-operated location cannot be expressed | `000_baseline.sql:9584-9618` | Custody model must be new |
| LB-ORG-006 | Onboarding/KYC: `onboarding` routes (start/status/steps/complete), `merchant_kyc_documents`, `/kyc/documents`; vendor adapter absent (D-KYC-VENDOR open); suspension surfaces exist only as `site.status` reads in the internal console | `routes/onboarding.ts`, `routes/kyc.ts:278-315`, `internal-console.ts:1164` | Verification, bank-change and offboarding controls are partial |
| LB-ORG-007 | Server authorisation on sensitive routes is `verifySiteOwnership` + tenant GUC transactions (`withResolvedTenantTx`, `SET LOCAL ROLE app_tenant`); RLS red-team RT-1…RT-9 passed in this audit | `lib/tenant-context.ts:67-314`; §18 | Database backstop is real; the application layer is defence in depth as the Constitution requires |

**Recommendation on app shape (not a decision).** Keep one merchant application (web + Flutter) whose modules are entitlement-driven; add **Store Ops as a role-specific mode of the merchant app for merchant-run locations**, and keep a **separate focused Store Ops app only for partner/dark-store staff who are not merchant members** (they must never receive merchant-wide permissions, and a picker's device needs a large-control, scan-first UI that the merchant dashboard does not). Rider and Sales Associate stay separate apps; their users belong to neither the merchant nor the operator realm. This requires a membership model with **scoped roles per location** (org → location → capability), which is the unbuilt organisation layer above.

---

## 9. Catalogue, channel offers and pricing

| ID | Finding | Evidence |
|---|---|---|
| LB-CAT-001 | Product identity: `products(store_id, name, price, compare_price, images, category, tags, variants jsonb, stock, track_inventory, allow_backorder, is_active, hsn_code…)`; `product_variants(product_id, title, price, sku, barcode, inventory_qty, weight)`; `collections`, `smart_collections`, `categories`, `metafields`, `product_snapshot` on `order_items` | `000_baseline.sql:10513-10603` |
| LB-CAT-002 | **No UNIQUE constraint on `sku` or `barcode`** was found in any migration (grep for `unique` near those columns is empty). Uniqueness scope for POS scanning is therefore undefined. | grep |
| LB-CAT-003 | One price per product/variant; **no per-location, per-channel or effective-dated price**; discounts via `coupons`, `discount_allocations`, `evaluate_checkout_promotion`; gift cards and loyalty are tender | migrations 234, 219 |
| LB-CAT-004 | Tax: `tax_rates` per HSN with store default, `tax_registrations`, `gst_invoices` (immutable via `reject_gst_invoice_mutation`), `issue_gst_invoice` RPC (214) called from the order adapter; GST computed in the gateway (`calculateGstLine`) and threaded into the RPC as `p_tax_amount`/`p_tax_lines` | `checkout-payment-routes.ts:187-333`; `order-execution.adapter.ts:146-151` |
| LB-CAT-005 | Batch/expiry metadata, bundles, units of measure, weighted goods: **absent** | schema |
| LB-CAT-006 | Channel publication: `channel_listings` per product per channel with moderation; storefront visibility is `products.is_active`; marketplace visibility is `status='approved'`; `instant` channel value reserved but nothing reads it | 217 |

**What one merchant needs to publish selected products to storefront, marketplace and quick commerce without duplicating truth:** keep `products` as the single identity; keep `channel_listings` as the per-channel offer; **add** a location-offer layer (`location_listings`: product/variant × `inventory_locations.id` × effective price × sold-here flag × external id) that Instant reads and that POS would read; make feed and checkout resolve price through the offer chain (channel → location → product) instead of `products.price`; snapshot the winning offer into `order_items`. Unpublished goods stay hidden because a missing `channel_listings` row already means "not on that channel"; the same rule must extend to location listings.

---

## 10. Inventory authority, ownership, custody and transfers

### 10.1 The model as built

`inventory_locations(store_id, name, is_default, status)` → `inventory_levels(store_id [141], product_id, variant_id, location_id, available, reserved, committed_quantity, unavailable_quantity, incoming, safety_stock_quantity, …)` → `inventory_reservations(store_id, product, variant, location, order_id, quantity, status, idempotency_key, expires_at, committed_at, released_at)` → `inventory_transfers(site_id, source_location_id, destination_location_id, status, shipped_at, received_at)` + `inventory_transfer_lines(quantity_requested/shipped/received, status)` + `inventory_transfer_receipts` → `purchase_orders` + receipts → `inventory_adjustments(site_id [245])` → `inventory_events` (append-only event log with quantity snapshots).

Every path that changes stock, and its guard:

| Path | Mechanism | Guard |
|---|---|---|
| Checkout (`create_checkout_order` → `create_order_with_inventory_reservations` (166)) | picks the level `ORDER BY loc.is_default DESC, il.updated_at ASC`, `reserve_inventory` then **immediately** `commit_inventory_reservation` (available −q, committed +q) | `pg_advisory_xact_lock(hash(site:idempotency_key))` before the existence check (218/CHK-0); `FOR UPDATE` on product and level; `require_inventory_site_guc` |
| Unpaid orders | `expire_unpaid_committed_reservations` (211) releases committed stock behind orders never paid (queue worker `inventory-reservations.ts:61`) | interval-based sweeper |
| Cancellation / refund / risk release | `release_order_inventory[_with_ledger]` (246) restores `available`, decrements `committed_quantity` only if a commit happened, floored at zero | `FOR UPDATE OF il` |
| Merchant edit "adjust stock" | `set_inventory_level_available[_batch]` from `product-execution.adapter.ts:633-651`; `adjust_inventory_level` from `/inventory/adjust` and `/bulk-adjust` | tenant GUC; idempotency claims on the route |
| Transfers | create: source `available −q, reserved +q` (status `reserved`); ship: line/status only; receive (per line, partial allowed): source `reserved −q`, destination `available +q`, `products.stock` cache resynced | idempotency adapter scope `inventory.transfers.*`; both locations must belong to the same `site_id` (`'transfer locations must belong to site'`) |
| Purchase orders | `create_purchase_order_with_lines`, `receive_purchase_order[_line]` | same |
| Returns | `create_order_return_and_refund` restores per line | same |
| Direct table writes from TypeScript | **none found** (`from('inventory_levels').update/insert` grep empty); `canonical-ledger-only-validator` passes | validator |

**Concurrency and idempotency were reproduced in this audit** (§18): two concurrent checkouts against `stock=1` produced one order and one typed failure; five concurrent replays of one idempotency key produced one order; removing the advisory lock from the live definition made the replay fail (control). Reservation TTL, commit, release and expiry passed (`inventory` suite); committed-quantity release passed 7/7.

### 10.2 The 20-shirts scenario against the current system

> A clothing merchant has 20 shirts. Five are transferred to a nearby participating supermarket for quick fulfilment. The merchant retains ownership. Storefront, marketplace, merchant POS and quick-commerce demand may arrive concurrently.

**What happens today.**
1. The supermarket cannot be a destination: `create_inventory_transfer_with_lines` raises `'transfer locations must belong to site'` unless the supermarket is modelled as a second `inventory_locations` row **of the same merchant site** — i.e., as if the merchant owned and operated it. There is no custodian, no acceptance step by the partner, no fee, no loss responsibility.
2. If it is modelled that way: create-transfer moves the source to `available 15, reserved 5`; the 5 are **not sellable anywhere** during transit (correct), but there is no `incoming` increment at the destination and no "in transit" state distinct from "reserved at source" — the dispatch and the receipt are the only two events. Receipt is explicit and may be partial (`quantity_received` < requested → `partially_received`), so a dispatch is *not* auto-confirmed as received — that part is right.
3. Concurrent demand: the storefront and marketplace both call the same checkout RPC, which picks **the default location first**, regardless of where the buyer is; there is no location-aware allocation, no per-location sellability, and no POS. A quick-commerce order at the supermarket would have to target the supermarket location explicitly — no route accepts a location today.
4. Ownership vs custody: `inventory_levels.store_id` conflates both; the ledger has no consignment account; a sale from the partner location posts to the merchant's ledger only because the location is the merchant's.

**What must change (new capability, not repair):**
- A `fulfilment_locations` / custody model: location operated by party X, stock owned by party Y, with `custody_agreements` (storage eligibility, fee terms, loss responsibility) and **partner acceptance** of a transfer (`received` recorded by the custodian's membership, not the merchant's).
- Explicit in-transit state: `inventory_transfers.status ∈ {draft, reserved, in_transit, partially_received, received, cancelled}` with destination `incoming` maintained, damage/short-receipt lines, and quarantine (`unavailable_quantity` exists as a number, not as a workflow).
- Location-aware allocation in checkout (`p_location_id` or an allocator that respects buyer location and channel) and available-to-promise per location = `available − active reservations − safety_stock`.
- Sale echo / external feed ingestion if the partner's own till sells the shirts: **absent entirely** (no source identity, observation time, dedupe or freshness bound). Until then, shared inventory with a partner who also sells offline cannot be promised.
- Business contracts to settle (not invented here): consignment vs sale-to-partner, storage/handling fee, loss and damage liability, returns handling at the partner, who invoices the buyer (D-2).

---

## 11. Quick commerce, zones, Store Ops and riders

### 11.1 LetBuyy today

| Capability | State | Evidence |
|---|---|---|
| Geocoding, coordinates on addresses, PostGIS | **Absent** — zero `geography|geometry|latitude|longitude` in 175 migrations; only `pincode`, `postal_code`, `radius text` | grep |
| Coverage (circle/polygon), overlap, store choice | Absent | — |
| Serviceability | Pincode rule table per site/provider (`shipping_serviceability_rules`: cod limits, weight band, ETA days) behind merchant auth (`assertStoreAccess`) | `145_executable_shipping_serviceability.sql:46-63`; `routes/shipping.ts:90-113` |
| Hours, accepting status, capacity, stock freshness | Absent (`inventory_locations.status` only) | — |
| Quote-time and commit-time revalidation | No quote object on the live path; hosted `checkout_sessions` exist; no serviceability hook in `create_checkout_order` | 234 |
| Preparation time / travel estimates | Absent | — |
| Partner acceptance, pick/pack, staging, handover | Absent in backend; `fulfillment_orders`/`fulfillment_order_lines`, `/orders/:id/fulfill`, packing slip exist for parcel fulfilment | `routes/orders.ts:742,1185` |
| Rider availability, offers, atomic acceptance, re-offer | Absent | — |
| Location updates, participant authorisation, stale tracking | Absent (no realtime layer in LetBuyy) | — |
| Proof of delivery, failure, return, support | `returns`, buyer support tickets exist; proof capture absent | `routes/returns.ts`; `buyer-support-routes.ts` |
| Carrier shipping | Shiprocket/Delhivery/Pickrr label adapters, **sandbox unless `LOGISTICS_MODE=live`**, and live provider "not enabled for this environment" | `routes/shipping-labels.ts:23-132` |
| Donor UIs | `phase_2/rider_app` (assignment, delivery, earnings, shift, auth), `phase_2/store_ops_app` (queue, pick_pack, handoff, inventory, onboarding); `quickcommerce_domain` entities for delivery/rider/store/zone; all wired to a non-existent Agrimore-shaped API | `apps/phase_2/*/lib/src/features` |

A generic `orders.status` (`pending|processing|shipped|delivered|…`) exists; **it is not a dispatch system**.

### 11.2 Agrimore primitives (the donor) — what is there and what blocks direct reuse

Audited at `Agrimore_Supabase` `foundation-rebuild` @ `6a33bf8`, index state.

| Primitive | Evidence | Reuse verdict |
|---|---|---|
| `ops.service_zones(polygon geography(polygon,4326))` with GiST index; `ops.dark_stores(location point, service_radius_m, accepts_orders, target_sla_seconds)`; `ops.store_service_zones`; `app.addresses.location geography` | `supabase/migrations/000003_geography_and_stores.sql:16-79` | **Adapt** — good schema shape; must be re-keyed to LetBuyy tenancy (`site_id`) and to a custody-aware location entity |
| `ops.find_serviceable_store(p_location, p_city_id)` | `000003:85-110` | **Replace logic** — returns the single nearest store within its *radius* (`LIMIT 1`), ignores polygons, returns no overlap list and no explanation; PDR-0002 §3 itself asks for more |
| `commerce.inventory_items(on_hand, reserved, safety_stock, CHECK reserved <= on_hand)`, `stock_movements` append-only trigger, `create_inventory_reservation`, `release_inventory_reservation`, `adjust_inventory` | `000005_inventory.sql:8-305` | **Design donor only** — LetBuyy's `inventory_levels` + reservations already cover this and are proven; adopt the `stock_movements` reason-code discipline and `safety_stock` semantics |
| `commerce.create_checkout_quote` (reserves at quote), `expire_checkout_quote`, `create_payment_intent`, `confirm_order_from_quote` (consumes `on_hand −q, reserved −q`, writes movement) | `000011_rpc_checkout.sql` | **Design donor** for a quote object; note **quote expiry is not scheduled anywhere** (`crons = ["*/1 * * * *"]` only runs `enqueuePendingOutbox`) — ADR-0006 admits this |
| `logistics.{rider_profiles, rider_shifts, deliveries(pickup/drop geography, version), rider_assignments(offer_id UNIQUE, status offered/accepted/rejected/expired/cancelled, score, expires_at), dispatch_attempts, delivery_status_events}`; `logistics.assign_rider(p_offer_id, p_expires_at, p_idempotency_key)`, `transition_delivery(p_expected_version)` | `000008_delivery_dispatch.sql`, `000012_rpc_delivery.sql` | **Adapt** — the best-shaped part of the donor: offer/expiry/versioned transitions map directly onto the founder's rider requirements |
| Edge Functions `assign-rider` (278 lines), `dispatch-order`, `checkout-quote`, `checkout-submit`, `confirm-payment`, `cancel-order`, `typesense-sync`, `send-notification`; Worker gateway route table (`workers/api-gateway/src/routes.ts`) with per-route auth/cache/rate-limit/idempotency policy | `supabase/functions/*`, `workers/api-gateway/src/routes.ts` | **Do not import** — LetBuyy already has a gateway; port the *behaviour* (dispatch scoring, offer lifecycle) as gateway modules + RPCs |
| Apps: `customer_app` (features: address, auth, cart, checkout, discovery, growth, home, notifications, orders, profile, tracking, wallet), `store_ops_app`, `rider_app`, `seller_app`, `admin_app`, `marketplace_web` (Next ^16.1.1, 8 shop pages) | 17–35 Dart files each; `agrimore_api` client with 30 `/v1/*` endpoints and `http://localhost:8787` default | **UX donor** — the current tree is a rebuilt skeleton, not a finished product; earlier audits describing a larger app no longer describe this tree |
| Product/decision records: PDR-0001/0002/0003, ADR-0001…0012, `PRODUCTION_LAUNCH_PLAN.md` (P0–P9), `SKIPPED_TASKS.md` | `docs/product`, `docs/decisions`, `docs/engineering` | **Reuse as requirements** — these are the clearest statements of the physical-commerce rules in either repository |

**Defects that block direct reuse of Agrimore code (inspected source, not reproduced):**

| ID | Defect | Evidence |
|---|---|---|
| AG-AUTH-001 | Auth response parsing still reads `payload.user.id` (GoTrue's `/user` returns the user object directly) in the gateway, the realtime gateway and the shared Edge helper — the defect ADR-0005 §4 says must be fixed before anything relies on it | `workers/api-gateway/src/middleware/auth.ts:44-54`; `workers/realtime-gateway/src/realtime/auth.ts:38-43`; `supabase/functions/_shared/auth.ts:55-62` |
| AG-SEC-001 | Edge Functions trust caller-supplied identity headers: `requireWorkerContext` reads `x-user-id` / `x-user-role` with no per-hop secret or signature; the gateway sets `x-user-id` itself. Whether the function URLs are reachable without the gateway depends on Supabase `verify_jwt` settings (only `auth-context` is explicitly `verify_jwt = false`); `UNKNOWN_LIVE_STATE` | `supabase/functions/_shared/worker_context.ts:9-20`; `workers/api-gateway/src/upstream/supabase.ts:97,165-169` |
| AG-PAY-001 | `confirm-payment` verifies the Razorpay signature **only if** all three fields are present, then confirms the order; reached today only from the webhook handler after raw-body HMAC (`handlers/api.ts:1050-1055`), so it is a weak internal contract rather than a public hole — combined with AG-SEC-001 it becomes one | `supabase/functions/confirm-payment/index.ts:36-70` |
| AG-SEC-002 | Live Razorpay credentials in git history; rotation `OPEN` with a `REPLACE_WITH_ROTATION_DATE` placeholder (values not reproduced here) | `SKIPPED_TASKS.md` §S-1 |
| AG-CON-001 | ADR-0009's "one OpenAPI authority with generated Dart/TS/C#/Swift clients" — only `tooling/contracts/enums.yaml` exists; no OpenAPI document, no native client, no native shell | `find` |
| AG-RLS-001 | `000010_rls_policies.sql`: 46 `ENABLE ROW LEVEL SECURITY`, 49 policies, **0 `FORCE`**, 1 `USING (true)`; tenancy is by `store_id`/membership functions, not a transaction-local GUC — incompatible with LetBuyy's isolation law as-is | grep |
| AG-TEST-001 | SQL tests are pgTAP files (`checkout_inventory_test.sql`, `delivery_state_test.sql`, `access_scope_test.sql`); the ADRs themselves record that they are sequential, not concurrent | `supabase/tests/rpc` |

**Bottom line for §11:** quick commerce in LetBuyy is greenfield backend work whose *requirements* are already written in Agrimore's PDR-0002/ADR-0004/0006/0007/0008 and whose *schema shapes* for zones and dispatch are worth transcribing. Nothing in it can be switched on by copying folders.

---

## 12. Adaptive POS — genuinely new work and reusable foundations

**POS has not started. This audit found no implementation evidence.** A repository-wide search for point-of-sale, cashier, terminal, cash drawer, shift, receipt-print and barcode-scan symbols returned only `merchant_app` purchase-order/transfer screens and two Storybook files — false positives. The Constitution lists `pos` as a value of the first-class `channel` dimension (`LETBUYY_CONSTITUTION.md:89`); no table, RPC or route implements it, and the live `channel` vocabularies (`channel_listings`, `purchases`) do not include it.

### 12.1 Shared POS capabilities — new vs reusable

| Capability | Reusable foundation in LetBuyy | New work |
|---|---|---|
| Branch-bound terminals, cashier identity, permissions | merchant realm (ES256/EdDSA), `employees` + permission keys, `inventory_locations` | terminal registration and binding, cashier sessions, location-scoped capability model (org layer, §8), `enforce` mode for staff RBAC, device attestation policy |
| Product search, scanning, price/tax, permitted discounts | `products`/`product_variants` (`sku`, `barcode`, `hsn_code`), `tax_rates` + `calculateGstLine`, coupons/promotions engine, `@letbuyy/api-client` | barcode uniqueness scope (LB-CAT-002), location price (§9), offline catalogue cache, cashier-discount authority rules |
| Cash and provider-confirmed digital tenders | Razorpay verification helper (shared verifier per D-PLATFORM-CHARGE), ledger `post_ledger_transaction`, `payment_transactions` | cash tender type and drawer accounting, terminal/UPI-QR provider flow (Razorpay POS or equivalent — **provider decision**), tender-split rules |
| Suspended unpaid baskets (not reservations) | `draft_orders` + `orders/drafts/:id/convert` | explicit "suspended basket" semantics with **no stock effect**, resume on any terminal at the branch |
| Transaction completion, receipts, safe reprint | `create_checkout_order` idempotency pattern, `generate_order_number`, GST invoice issuance | counter-sale RPC (consume at completion, one movement), receipt document model, reprint by stable reference |
| Shift open/close, cash reconciliation | ledger accounts (new account codes needed — `ledger_accounts.account_code` is a CHECK list) | shift entity, float/paid-in/paid-out, variance, manager sign-off |
| Voids, returns, exchanges, refunds, approvals | `create_order_return_and_refund`, `complete_order_refund`, restore paths | void-before-tender vs refund-after-tender, exchange as return + sale, manager approval and audit (`audit_logs` exists) |
| Receiving, counts, damage, adjustments | transfers, purchase-order receipts, `adjust_inventory_level` with reasons, `inventory_events` | cycle-count workflow, damage/quarantine states, count variance approval |
| Payment success then disconnect | idempotency claims + `payment_webhook_events` dedupe | client-side recovery by stable reference; reconciliation UI for "captured but unconfirmed" |
| Native Windows/macOS packaging, signing, updates, peripherals | nothing (no native code anywhere) | two native shells, generated clients (no OpenAPI authority exists in LetBuyy either — the gateway is hand-typed), MSIX/notarised pkg pipelines, peripheral abstraction, hardware compatibility list |

### 12.2 Industry modules — what is shared and what needs domain rules

| Domain | Shared | Domain rules (not theming) |
|---|---|---|
| Clothing | variants (`product_variants.title`/`sku`/`barcode`), returns, exchanges | barcode per variant (size/colour) not per product; exchange workflow with price-difference tender; seasonal price lists = effective-dated location prices |
| Supermarket | scanning, promotions, returns | batch/expiry metadata (absent), high-throughput scan path (keyboard-first UI, local catalogue), mix-and-match promotions; **weighted goods only with a complete design** (price-embedded barcodes, scale integration, refund of weighed lines) |
| Bakery | fixed-unit sales, promotions | production batches and freshness windows, wastage as a stock movement reason with cost attribution, preorders (a reservation with a pickup time — reservations exist, pickup does not), weighed sales as above |

**Smallest useful first domain (recommendation):** **clothing** — fixed units, variant barcodes, no batches or scales, exchange workflow reuses the existing return/refund RPCs, and it is the founder's own scenario (§10.2). Choosing it first does not drop the others; it sequences them.

**Offline.** Start with **online-only finalisation and offline drafts** (Agrimore ADR-0003 §5 and PDR-0002 §9 reach the same position). Offline *completed* sales against shared live stock would additionally require: per-terminal stock allocation pools, a local tender journal with signed sequence numbers, conflict resolution when the same unit sold online, delayed provider confirmation reconciliation, and a policy for negative stock — none of which can be promised as conflict-free. Do not promise it.

**Hardware.** Select one scanner, receipt printer, cash drawer and payment terminal model early in the POS work package and validate on both operating systems; no device is named or certified here.

---

## 13. Orders, payments, refunds and financial records

### 13.1 Trace (inspected source; SQL layer reproduced locally)

1. **Quote/pricing.** `POST /storefront/:subdomain/orders` (`checkout-payment-routes.ts:141`) loads the published store, computes GST per line from `tax_rates`/`hsn_code` and the store's GST state, then calls `OrderExecutionAdapter.createOrder` → `create_checkout_order` (234): the RPC recomputes subtotal from DB prices ("the client NEVER sends price/total"), resolves shipping from `shipping_rates` (fallback `express=99/standard=0` when a store has no rates), applies coupon, gift card (as tender, ledger-projected balance), loyalty (as tender), takes `p_tax_amount` from the gateway, inserts `purchases` + the child order + items atomically, reserves and commits inventory, and records `order_tax_lines`.
2. **Payment intent.** `POST /storefront/:subdomain/payments/razorpay/order` (`:440`) creates the Razorpay order **from `orders.total`**, rejects a client amount that differs, stores the provider order id on the order (`attach_order_payment_reference_with_ledger`).
3. **Provider confirmation.** Two independent paths: (a) client callback → `POST /storefront/:subdomain/payments/razorpay/verify` (`:560`): HMAC-SHA256 over `${order_id}|${payment_id}` with `timingSafeEqualHex`, bound to the **stored** provider order id, replay check on `razorpay_payment_id` already recorded for a different order, then `confirm_order_payment_with_ledger`; (b) webhook → `webhook-service` raw-body HMAC (`index.ts:246-255`), `payment_webhook_events UNIQUE(provider, provider_event_id)`, then internal HMAC-headed call to `/storefront/internal/payments/confirm` guarded by `isInternalRequest` (`INTERNAL_API_SECRET`).
4. **Ledger.** `confirm_order_payment_with_ledger` (168) posts a balanced transaction; `enforce_ledger_transaction_balance` is a **constraint trigger** that raises if a transaction's entries do not net to zero; `reject_ledger_mutation` triggers forbid UPDATE/DELETE on entries and transactions; `ledger_balance_breaks()` and the `money-ledger-reconciliation` worker exist. This **is** double-entry with an enforced balancing invariant, not a balance-history table (`139_executable_foundation_ledger_core.sql:125-193,359-382`).
5. **Fulfilment.** `/orders/:id/fulfill`, `fulfillment_orders`, shipping labels (sandbox), `shipments`/`shipment_events`, tracking route.
6. **Cancellation/refund.** `/orders/:id/refund` (initiate) and `/orders/:id/refund/complete` (complete) are separate; `complete_order_refund` posts the reversing ledger transaction and `release_order_inventory_with_ledger` restores stock once (proven 7/7). The provider call is `razorpay-adapter.refund()` → `payments/{id}/refund`; **it treats status `created` as `refunded`** (`packages/infrastructure/razorpay-adapter/index.ts:413-417`) — `created` is initiation, not completion.
7. **COD.** `set_pending_cod_order_status`, COD reconciliation routes and `reconcile_cod_remittance_with_ledger`.
8. **Settlement / payouts.** `settlements/ingest` (provider settlement records), `payout_statements` + `claim_payout_statement_release` + `POST /payouts/:id/settle` (manual, recorded); **no payout rail executes money** (no RazorpayX/fund-account code in the canonical services) — consistent with "never a custodian". `commission_bps` is 0 by validator. Wallet, gift card, loyalty and ad credits are ledger projections (`stored-value-write-fence`, migration 236).

### 13.2 Findings

| ID | Finding | Evidence | Blocks |
|---|---|---|---|
| LB-PAY-001 | Server-authoritative amounts and provider binding are real at every step above; client totals are rejected | §13.1 | — |
| LB-PAY-002 | `p_tax_amount`/`p_tax_lines` are RPC parameters computed in the gateway; the only caller is the order adapter, but the RPC itself would accept any tax from any future caller (POS, Instant) | `234:161`, `order-execution.adapter.ts` | pilot hygiene: move GST computation into the RPC or guard the parameter |
| LB-PAY-003 | Refund completion treats Razorpay `created` as `refunded`; failure after initiation is not modelled as a distinct state on that path | adapter `:413-424` | real-money pilot |
| LB-PAY-004 | Late payment after unpaid-order stock release: `expire_unpaid_committed_reservations` releases stock; `confirm_order_payment_with_ledger` (168) contains **no guard on cancelled/released orders** in the lines read (only `'order not found'`). A late webhook could mark an order paid whose stock was already released. **Untested scenario, inspected source only** | `168:150-260`, `211` | pilot |
| LB-PAY-005 | Uncertain provider responses: `payment_attempts`, `record_order_payment_failure_with_ledger`, `compensation_actions(flow ∈ checkout_confirm|refund|settlement)` exist; reconciliation of "captured at provider but unconfirmed here" relies on the webhook path; no operator UI reachable in prod (LB-ORG-004) | 139, webhook-service | pilot |
| LB-PAY-006 | Money items the merger needs that do not exist: custody/fulfilment fees, delivery earnings, rider payouts, partner payable vs merchant payable split, per-order commission (forbidden by D-1). `ledger_accounts.account_code` is a CHECK-constrained list — adding account types is a migration, not configuration | 139:79 | expansion |
| LB-PAY-007 | Provider settlement ↔ payable accrual ↔ statement ↔ payout are distinct records already (`settlements`, `payout_statements`, `payout_items`, `payout_reconciliation_records`); nothing executes a payout | routes/payouts.ts | — |

**Requires founder + professional confirmation before real money:** D-2 (merchant of record / who invoices), GST treatment of platform fees vs merchant sales when a partner location fulfils, custody-fee invoicing, rider earnings (contractor vs payroll), and whether any Agrimore-style commission is compatible with D-1 (it is not, as written).

---

## 14. Security and privacy findings

| ID | Boundary | Finding | Evidence | Severity / scope |
|---|---|---|---|---|
| LB-SEC-001 | Sessions | Merchant and buyer realms are asymmetric (ES256/EdDSA, JWKS at identity-platform; gateway verifies with `createLocalJWKSet` from `LETBUYY_IDENTITY_PUBLIC_JWKS`). Store-customer realm is **HS256 with `CUSTOMER_SESSION_SECRET`** (verification key = forgery key). Known deviation to collapse (ART-05/SEC-R7), not new | `lib/identity-session-verifier.ts`; `middleware/customer-session.ts:56-61` | High if the secret leaks; design debt |
| LB-SEC-002 | Operator realm | No production operator login (dev magic link only); MFA route exists but is unreachable in prod | `admin_web/…/console-auth/login/route.ts:27-29` | Blocks operations; not an exposure |
| LB-SEC-003 | Tenancy | RLS ENABLE+FORCE with transaction-local GUC; unset GUC → zero rows (RT-1…RT-9 **reproduced locally**); `tenant-isolation-validator` 279 tables / 0 service-role bypasses; baseline still carries legacy `TO authenticated` owner policies alongside GUC policies (defence in depth, not a hole); `service_role USING (true)` policies exist for the service role only | §18; `000_baseline.sql:26554,27224` | Strong |
| LB-SEC-004 | Staff privilege | Staff RBAC default `dryrun` never blocks (LB-ORG-003) | `staff-permission.ts:51` | Medium — owner/staff separation advisory until `enforce` |
| LB-SEC-005 | Internal entry points | Internal routes require `INTERNAL_API_SECRET` (+ previous for rotation) and optional IP allowlist; webhook→gateway uses HMAC session headers; `/store/<subdomain>` and `/checkout-origin` paths are unreachable except via host routing | `middleware/internal-perimeter.ts`; `proxy.ts:186-215` | Good |
| LB-SEC-006 | Rate limiting / abuse | Gateway rate limiter fails **closed** when its store is unavailable (`allowed:false, unavailable:true`); Turnstile on identity signup/login (merchant and buyer) and in gateway security middleware | `middleware/rateLimit.ts:341`; identity buyer routes | Good |
| LB-SEC-007 | Media | Upload route enforces a MIME allowlist (`MIME_NOT_ALLOWED`), size checks, R2 keys under site; signed-upload intents; documents (KYC) in `merchant_kyc_documents` with refresh of signed reads | `routes/upload.ts:119-196`; `routes/kyc.ts` | Adequate; KYC vendor absent |
| LB-SEC-008 | Webhooks | Raw-body HMAC, constant-time compare, provider event id uniqueness, DLQ for consumers | webhook-service; wrangler | Good |
| LB-SEC-009 | Secrets | No live credential in the tree; `environment-validator` reds are public Firebase Web API keys in the retiring app and a Razorpay sample test key in a donor fixture (attributed F-SECSCAN-1); the 2026 live-key exposure was closed by owner rotation (historical) | hazards.md; memory | Watch: Firebase keys leave with D-10 |
| LB-SEC-010 | Storefront custom code | No script/embed/object; style attributes forbidden; CSS sanitised; Liquid output escaped | theme-renderer | Good |
| LB-SEC-011 | Payments controls | Refund initiation and completion split; payouts are recorded not executed; step-up: `two-factor` routes and `security` routes exist — real-cryptography step-up on refunds/payouts **not re-verified here** | routes | Verify before pilot |
| LB-SEC-012 | Data minimisation | `customer_dsr_exports` exists (subject access); **no retention policy document found** for customer, location or document data; no deletion workflow located | grep | Flag — durations not invented |
| LB-SEC-013 | Realtime | LetBuyy has no realtime channels; Agrimore's realtime gateway shares AG-AUTH-001 | — | n/a / donor defect |

No vulnerability is claimed reproduced; the RLS red-team suite is the only security behaviour executed in this audit.

---

## 15. Infrastructure, deployment and operational gaps

| Layer | Documented | Declared in code | Runnable locally | Observed deployed |
|---|---|---|---|---|
| Postgres schema + RPCs | yes | 175 migrations + rollbacks | **yes** (this audit, throwaway containers) | no project exists (D-11) |
| Gateway / workers | yes | wrangler.toml with staging queues/KV/R2/Hyperdrive/D1 | `wrangler dev` scripts exist; not booted here | unknown; deploy lanes `workflow_dispatch` only (D-DEPLOY) |
| Next apps | yes | Vercel config with **placeholder project ids** (`config/vercel/projects.json`: 0 real ids) | built 2026-09-12 (historical) | unknown |
| CI | `ci.yml` on push/PR to develop/staging/main/stepup-main: typecheck, secret-hygiene, lint, unit-tests, merge-safety-gate, governance, mobile-merchant (macOS), build | 17 workflows | — | **runs unreadable** (remote 404 from this account) |
| Queues / outbox | yes | `outbox_events`, `outbox_dead_letters`, `outbox_consumptions`, relay adapter, 7 consumers with `max_retries` and DLQs | not booted | unknown; **queue lag never measured** |
| Reservation expiry / reconciliation | yes | `queue-workers/src/inventory-reservations.ts`, `money-ledger-reconciliation.ts` on the 6-hourly cron | SQL proven | unknown |
| Observability | Grafana dashboards, OTel collector, Prometheus rules, `slo-catalog.yaml` (honestly annotated `NOT MEASURED`) | yes | — | no alert receiver (no PagerDuty/Slack/Alertmanager config found) → **alert delivery to a human: not established** |
| Backup / PITR / restore | 2026-08-24 evidence: "plan-mode only" | — | — | no restore drill has ever run |
| Secrets handling | env names only in wrangler `[vars]`; Cloudflare secrets at deploy time | — | — | — |
| Domains / certificates | custom-domain flow via Vercel API; `checkout.<root>` reserved | yes | — | unknown |

**Production-readiness law (Constitution) status**, per `docs/evidence/production-readiness/2026-08-24-readiness-evidence.md` and unchanged in kind by this audit: payment integrity and tenant isolation MEASURED at repository level; auth resistance, checkout correctness, queue retry, backup, rollback PARTIALLY MEASURED; **alert delivery, RTO/RPO, load/spike/soak, SLOs NOT MEASURED**.

**External setup the combined product will need (named, not costed):** Supabase project(s) or equivalent Postgres with PITR; Cloudflare account with Queues/KV/R2/Hyperdrive; Vercel projects; Razorpay live keys + webhook secret (+ POS/terminal product decision); Resend; SMS/OTP provider for phone login (none today); FCM/APNs; Turnstile; maps/geocoding/routing provider (none today; Agrimore chose Google Maps Platform behind an adapter); courier live accounts; KYC vendor (D-KYC-VENDOR); Play/App Store signing (memory: three keystores, one unbacked); Windows code-signing certificate and Apple Developer notarisation for native POS/Admin; POS hardware.

**Cost drivers (qualitative only):** edge requests on public storefront reads (cache at edge to protect origin), Postgres compute for checkout/inventory write paths, queue volume for notifications/analytics, R2 egress for media and reels, maps API calls per serviceability check (cache by geohash), SMS OTP volume, provider fees per transaction (out of LetBuyy's control), and native app signing subscriptions. No numeric estimate is made; no volume is assumed.

---

## 16. Per-app UX, platform and design-system assessment

| App | Wiring | States / quality signals | Notes |
|---|---|---|---|
| `merchant_web` | 130 gateway-proxy API routes; pages for the whole merchant OS incl. inventory transfers/PO/locations/reservations/receipts | design ratchet enforced by validator; lint warnings only (105) | reusable as the merchant OS; needs location-scoped roles and Instant modules |
| `admin_web` | console pages for moderation, reconciliation, risk, merchants | 114 lint warnings; **no prod login** | D-4 makes it the one admin; the founder's "native Admin" desire conflicts — see §23 |
| `customer_web` | storefront tree + account + hosted checkout; rewrites `/api/storefront/*` to the gateway | 38 lint errors (37 hard-coded hex CAP-C77, 1 route rule) as of 2026-09-12; `robots`/`sitemap`; nine-state rule applies | theme-driven; Razorpay checkout flow present in `checkout-client.tsx` |
| `identity-platform` | login/signup/lookup/select/reset; buyer register/login | 26 lint warnings | sole issuer; add phone OTP realm later |
| `merchant_app` (Flutter) | gateway-only, 153 Dart files, 172 tests (canary); screens map to the web OS | 80 pre-existing analyze infos (memory); built once (Phase Q) | reusable; Store Ops mode candidate |
| `customer_app` (Fluter, shipped) | Firebase-bound except catalogue reads; HOLD (D-UX-DONORS) | 13 tests | retires at the D-10 cutover; its UI is the donor for the canonical buyer app |
| `phase_2/rider_app`, `store_ops_app` | riverpod + go_router skeletons; one deliberate dead scaffold error each (memory) | — | UX donors only |
| Agrimore apps | 17–35 Dart files each; `agrimore_api` client; `marketplace_web` 8 pages | not built here | the donor's own launch plan calls them "in progress" |

**Design coherence without identical screens (recommendation):** keep `tokens.ts` as the single token *source*, but introduce **role-level themes** (palette, density, typography, navigation pattern) resolved from the same tokens — merchant/admin (data-dense, existing `--lb-*`), buyer (theme-driven per merchant plus a platform buyer shell), Store Ops (large controls, amber/high-contrast, scan-first), Rider (glanceable, one next action), POS (cobalt/slate, keyboard and scan first, native controls). Agrimore's ADR-0010 palette directions are usable inputs. The contracts to stabilise: the nine UI states, WCAG 2.1 AA, INR/en-IN formatting, the `ProviderModeBadge` on every money/fulfilment surface, and a shared iconography/typography scale. Nothing here justifies a wholesale visual rewrite of the existing web apps.

---

## 17. End-to-end workflow traces with exact breakpoints

| # | Workflow | Path (source) | Breakpoints |
|---|---|---|---|
| 1 | Merchant onboarding → published store → purchase | identity signup (OTP, Turnstile) → `create-store` → `sites` → `merchant_web/[store]/products` → theme publish → `customer_web` host route → cart routes → `POST /storefront/:subdomain/orders` → Razorpay order → verify/webhook → `confirm_order_payment_with_ledger` | **B1** no database anywhere (D-11) so no HTTP journey has ever run; **B2** `E2E_DEVELOP` never reached; **B3** live Razorpay needs keys + webhook URL; **B4** Vercel/Cloudflare targets are placeholders |
| 2 | Same customer across channels | `buyer_accounts` ↔ `buyer_store_customers` ↔ `store_customers`; buyer token has no site claim | **B5** shipped app still uses Firebase Auth; **B6** email-only buyer identity; **B7** no platform address book; **B8** no Instant channel to be "the same customer" in |
| 3 | Merchant/location isolation | tenant GUC tx + RLS FORCE; RT-1…9 pass; inventory RPCs require the site GUC | **B9** locations cannot be operated by a non-owner; **B10** staff RBAC `dryrun`; **B11** org model unwired |
| 4 | Product publication and channel/location pricing | `channel_listings` transition (merchant) → operator approval (`admin_web`) → `marketplace_feed` | **B12** operator login absent in prod → nothing reaches `approved`; **B13** `pricing_policy` unapplied; **B14** no location listing |
| 5 | Quote/reservation → verified payment → order | order-first: reserve+commit at order creation → pay → confirm; unpaid sweeper | **B15** no quote object with expiry on the live path; **B16** late payment after release unguarded (LB-PAY-004); **B17** no serviceability/eligibility hook |
| 6 | Cancellation/refund → stock and money | `release_order_inventory_with_ledger` (7/7 reproduced) + `complete_order_refund` + gift/loyalty restore | **B18** provider `created` = refunded (LB-PAY-003); **B19** operator reconciliation UI unreachable |
| 7 | Fulfilment / shipping loop | `fulfill` → labels (sandbox) → `shipments` → track | **B20** live carriers not enabled; **B21** no rider/dispatch mode |
| 8 | Concurrent stock / idempotency | W1a, W1b, advisory-lock control, committed-quantity release | none at SQL level; **B22** route-level concurrency never exercised |

---

## 18. Tests executed, results and unverified claims

All commands ran in `LetBuyy-develop` at `88a9bf6f`; the tree was clean before and after (`git status --porcelain` → 0). No test touched an existing database: every Postgres suite ran through `scripts/governance/run-executable-suites.mjs`, which starts a uniquely named `postgres:16-alpine` container (`letbuyy-exec-<pid>-<uptime>`), replays every migration into it and removes it. The pre-existing stopped container `letbuyy-executable-pg` (created 2026-08-05) was not touched.

| Check | Command | Result | Depth | Limitation |
|---|---|---|---|---|
| Contract tests | `pnpm test:contracts` | **277 / 277 pass**, 0 fail, exit 0 (4.0 s) | in-process, no I/O | contracts, not behaviour |
| Gateway unit tests | `pnpm test:unit:gateway` | **962 tests, 953 pass, 0 fail, 9 skipped**, exit 0 (7.1 s) | Hono handlers with mocked DB | mocks; 9 skipped are env-gated |
| Governance gate inventory | `node scripts/validate-governance.mjs --lane=gate --plan` | 114 executable validators, 113 selected; exit 0 | inventory only — **no validator executed** | the real lane deletes `node_modules` and was not run |
| Money / tenancy validators (individually) | `node scripts/validators/{canonical-ledger-only,commission-bps-zero,tenant-isolation,session-security}-validator.mjs` | all 4 pass; tenant validator: 279 tenant tables, 0 service-role bypasses; `payment-rail-validator` does not exist | static | structural lint, not behaviour |
| Gateway typecheck | `pnpm --filter @letbuyy/api-gateway typecheck` | exit 0 | — | one package only |
| Checkout concurrency | executable `checkout-order-concurrency` | **5/5**: W1a stock=1, two concurrent checkouts (separate `psql` processes) → one order; W1b same key ×5 concurrent → one order | real Postgres, real concurrency | RPC layer, not HTTP |
| Idempotency lock | `checkout-idempotency-advisory-lock` | **4/4** incl. control: with the lock removed from the live definition the replay fails | real Postgres | — |
| Parent purchase / child order | `purchase-parent-child` | **5/5** incl. "no merchant realm can read or write `purchases`" | real Postgres | — |
| Tenant red-team | `tenant-redteam` | **2/2** (RT-1…RT-9 under `app_tenant` and raw-REST roles; migration 198 GUC gap closed) | real Postgres | — |
| Committed-quantity release | `committed-quantity-release` | **7/7** incl. control with 246 rolled back | real Postgres | — |
| Inventory reservations | `inventory` | **1/1** (reserve prevents oversell; commit, release, expiry) | real Postgres | single composite assertion |
| Ledger kernel | `money-ledger` | **1/1** (F6 money kernel proofs) | real Postgres | single composite assertion |
| RLS hardening | `security-rls-hardening` | **1/1** (migration 107 closes anon-readable policies) | real Postgres | — |

Total this audit: 26 executable assertions, 0 failures; 1,239 in-process tests, 0 failures.

**Historical evidence cited but not re-run (labelled as such throughout):** full 46-suite battery (46/0, 182 assertions, 2026-09-12); five `next build`s green (2026-09-12); gate baseline `failed=2` (environment, stale-artifact — both attributed); lint red only in `customer_web`; Flutter builds (Phase Q).

**Not run, and why:** the full gate real lane (destructive to `node_modules`), Next builds (time; historical evidence is nine days old with zero code delta noted at the time), Flutter builds (write tracked Gradle files), local stack boot and Playwright e2e (never achieved by the programme; out of bounded scope), any provider call, any Agrimore build or test.

---

## 19. LetBuyy / Agrimore comparison and reuse matrix

Legend — **Reuse**: use as-is · **Repair**: fix in place · **Adapt**: re-express against LetBuyy invariants · **Replace** · **New**.

| Component | LetBuyy (evidence) | Agrimore (evidence) | Recommendation | Proposed owner | Migration / compatibility | Unknowns / tests before selecting |
|---|---|---|---|---|---|---|
| Identity | ES256/EdDSA issuer, merchant + buyer realms, JWKS; HS256 store-customer deviation | Supabase Auth OTP; `payload.user.id` bug (AG-AUTH-001) | **Reuse LetBuyy**; add phone-OTP buyer credential; collapse HS256 | `apps/identity-platform` | map Firebase and Agrimore users into `buyer_accounts` at cutover; no token compatibility needed | SMS provider choice; realm for rider/associate/custodian |
| Tenancy | `sites`/`site_id`, RLS FORCE + GUC (reproduced) | `store_id` membership functions, no FORCE (AG-RLS-001) | **Reuse LetBuyy**; **New** location-scoped membership | gateway + DB | Agrimore's org/location ADR-0004 as the requirement | design of org → location → capability; FORCE RLS on new tables |
| Merchant onboarding / KYC | onboarding + KYC docs; vendor absent | seller onboarding skeleton | **Reuse LetBuyy** + vendor adapter | gateway | — | D-KYC-VENDOR |
| Catalogue | products/variants/HSN/collections; no SKU uniqueness | canonical catalog + `catalog.product_search_documents` (Typesense sync) | **Reuse LetBuyy**; **Repair** barcode uniqueness | gateway | — | search provider decision |
| Storefront builder | full (themes, domains, publish, rollback) | none | **Reuse LetBuyy** | `customer_web` + theme-engine | — | Liquid activation status |
| Channel offers | `channel_listings` with moderation; pricing unapplied | per-location listing concept (PDR-0002 §4), not built | **Adapt**: add location listings; apply pricing chain | gateway + DB | migrate `products.price` into default offers | cart-model decision (§7.4) |
| Stock | levels/reservations/transfers/PO/adjustments; proven concurrency | reserve-at-quote/consume-at-confirm; append-only movements; no schedule | **Reuse LetBuyy**; adopt movement reason codes; **New** custody/in-transit | DB RPCs | none (LetBuyy is authority) | custody contract terms; sale-echo policy |
| Pricing | one price; coupons; tender instruments | effective-dated rate engine (designed, not built) | **New** location/channel/effective-dated prices | gateway + DB | snapshot into `order_items` | — |
| Orders | order-first checkout, parent purchase, GST, returns | quote → intent → confirm | **Reuse LetBuyy**; **Adapt** a quote object for Instant (expiry, revalidation) | gateway + DB | one `create_checkout_order` lineage (guarded) | LB-PAY-004 test |
| Payments | Razorpay bound + webhook + ledger (reproduced at SQL) | Razorpay in Edge Functions; conditional signature (AG-PAY-001) | **Reuse LetBuyy** | gateway + webhook-service | — | refund `created` handling; step-up verification |
| Finances | double-entry ledger with balance trigger; payouts recorded not executed; 0% fee | journal designed (ADR-0008); `balance_after` column in current SQL; 3–4% commission model | **Reuse LetBuyy ledger**; **New** account types for custody fees / rider earnings **after** founder decides fee & custody | DB | none | **D-1 vs commission; custody vs "never a custodian"** |
| Search | Postgres FTS; SEARCH_QUEUE projection | Typesense sync function | **Reuse LetBuyy** now; provider decision later | gateway | — | scale trigger |
| Media | R2 + MIME allowlist + signed intents | media-gateway (proof upload) | **Reuse LetBuyy**; port proof-upload semantics | gateway | — | reels pipeline is ARB-gated |
| Notifications | Resend, Twilio WhatsApp, FCM dispatcher, buyer inbox | send-notification, FCM tokens | **Reuse LetBuyy** | queue-workers | — | SMS OTP provider |
| Serviceability / zones | **absent** | PostGIS zones + radius; nearest-store only | **Adapt Agrimore schema**, **Replace** the resolver (overlap list + choice + explanation) | gateway + DB (new module) | new tables under `site_id`/location | maps provider; polygon validation rules |
| Fulfilment (Store Ops) | parcel fulfilment only | queue/pick/pack/ready flows in Edge Functions + app skeleton | **New** in LetBuyy, using Agrimore flows as spec | gateway + DB | — | Store Ops mode vs app (§8) |
| Riders / dispatch | **absent** | offers with expiry, versioned transitions, shifts, proof (schema + RPC) | **Adapt** schema and RPC semantics into LetBuyy | gateway + DB + queue-workers | — | rider realm; earnings account; realtime channel design |
| Operations / admin | `admin_web` screens; no prod login | admin skeleton; native Admin planned | **Repair** operator login first; then decide native vs web (§23) | `admin_web` | — | founder decision on native Admin |
| POS | **absent** | **absent** (P6 planned) | **New** | new native roots (ARB) | — | everything in §12 |
| Sales Associate | absent | PDR-0003 (spec only) | **New**, spec reusable | new app | — | naming and incentives model |

**Live data:** LetBuyy canonical — no database exists, so **no live merchant or customer data** (D-11). Lineage A — the shipped Firebase app has real users; volume `UNKNOWN_LIVE_STATE` from this repository. Agrimore — unknown. Migration risk therefore concentrates on the Firebase cutover (D-10), not on the canonical schema.

---

## 20. Architecture options, recommended direction and trade-offs

| Option | Description | Strengths | Weaknesses | Verdict |
|---|---|---|---|---|
| 1. LetBuyy as the base, integrating selected Agrimore capabilities | Extend the gateway/DB with new bounded modules (serviceability, fulfilment locations & custody, dispatch, POS sale) that follow existing invariants; transcribe Agrimore schemas/RPC semantics; reuse Agrimore's PDRs as requirements and its Flutter flows as UX donors | Consistent with D-0; preserves the proven ledger, RLS, idempotency and identity; one repository, one gate, one runtime topology; nothing to copy wholesale | Physical-commerce domain is a large greenfield inside a large codebase; Constitution amendments needed for native app roots and channel vocabulary; the fee/custody conflict must be settled first | **Recommended** |
| 2. Shared commerce services behind existing frontends, staged convergence | Stand up "commerce services" (inventory, orders, payments) as APIs both LetBuyy and Agrimore frontends call, converging over time | Lets Agrimore's apps keep moving; incremental | Creates a second authority for orders/money/inventory during convergence — exactly what the Constitution forbids ("never a second canonical system"); double the identity mapping; Agrimore's gateway/Edge layer would need the AG-* defects fixed anyway | Not recommended |
| 3. Another architecture (e.g., adopt Agrimore's Supabase schema, or a fresh rewrite) | Replace LetBuyy's backend | none supported by evidence: Agrimore's backend is a skeleton with weaker isolation and open defects; a rewrite discards the only tested money and tenancy code in either repository | high | Rejected on evidence |

**Integration mechanics under Option 1 (what "integrate" means here):** identity mapping = Firebase/Agrimore users → `buyer_accounts` with consented linking to `store_customers`; data migration = only lineage A at the D-10 cutover (catalogue already canonical; orders/history policy is a founder call); API contracts = new gateway modules under `/v1` with typed schemas in `services/api-gateway/src/schemas`, mirrored into `@letbuyy/api-client` (and, when native POS starts, a **generated** client — a contract authority LetBuyy does not have today); event compatibility = new domain events through the existing outbox; rollback = feature flags per channel (`FEATURE_INSTANT`, the D-3 multi-child flag) and paired migration rollbacks; coexistence = Instant baskets separate from storefront baskets (§7.4), so failure of the new mode never breaks the existing one.

---

## 21. Dependency-ordered implementation backlog

Priority: P0 = before any pilot of the existing product; P1 = combined pilot; P2 = expansion. Type: R = repair, I = integration, N = new. Acceptance is what must be *measured*, per the repository's evidence rule.

| # | Outcome | Components | Depends on | Type | Pri | Acceptance evidence |
|---|---|---|---|---|---|---|
| 1 | Founder settles fee model, custody stance, D-2, native-Admin question, cart model | decision records | — | — | P0 | decisions recorded in `references/decisions.md` + Constitution amendment drafts |
| 2 | Local end-to-end stack boots from `develop`; one browser journey (signup → publish → pay in sandbox) recorded | supabase local, 4 workers, 3 apps, Playwright | Docker pull path | R | P0 | `E2E_DEVELOP` ledger row with video/log; journey re-runnable |
| 3 | Operator login works outside dev (magic link delivery or identity-platform operator realm) | `admin_web`, identity-platform | 2 | R | P0 | prod-mode login reproduced locally; MFA path exercised |
| 4 | Staff RBAC `enforce` verified; owner/staff separation tests | gateway | 2 | R | P0 | route probes: staff without key → 403 |
| 5 | Late-payment-after-release guard + refund-state fidelity (`created` ≠ `refunded`) | RPC 168, adapter | — | R | P0 | new executable suite: webhook after sweeper → order not paid / re-reserve policy applied; refund `created` → pending |
| 6 | GST computation inside the RPC or parameter guard | RPC 234 | — | R | P0 | executable suite: caller-supplied tax rejected |
| 7 | Cloud targets exist: Supabase project with PITR, Cloudflare, Vercel; deploy lanes retargeted (D-DEPLOY-1); restore drill executed; alert route to a human | infra | 1 | I | P0 | restore drill log; alert received by a person; SLO catalogue emitting |
| 8 | Buyer phone-OTP credential; platform address book with coordinates (no geo logic yet) | identity-platform, DB | SMS provider | N | P1 | register/login by phone reproduced; addresses carry lat/lng |
| 9 | Organisation → location → capability membership model (custodian, cashier, picker roles) with FORCE RLS | DB, gateway | 1 | N | P1 | tenant red-team extended to location scope; unset GUC → zero rows |
| 10 | Fulfilment locations + custody agreements + transfer states (in-transit, partner acceptance, short/damage receipt, quarantine) | DB, gateway, `merchant_web`/`merchant_app` | 9 | N | P1 | 20-shirts scenario as an executable suite: 15/5 with in-transit interval, partner acceptance by custodian membership only |
| 11 | Location listings + pricing chain (channel → location → product), effective dates, snapshot into `order_items` | DB, gateway | 10 | N | P1 | feed/checkout return location price; snapshot immutable |
| 12 | Serviceability module: zones (circle/polygon, PostGIS), overlap list with deterministic ranking + explanation, buyer choice persisted on the basket, revalidation at quote and commit | DB, gateway, `customer_web`/buyer app | 8, 10 | N (Agrimore schema adapted) | P1 | property tests on boundaries; ineligible location cannot be ordered from |
| 13 | Instant quote object with expiry and location-aware reservation/allocation; separate Instant basket (§7.4) | RPC lineage (guarded), gateway | 11, 12 | N | P1 | concurrency suite: last unit across storefront/Instant; quote expiry sweeper proven |
| 14 | Store Ops flows (accept, pick/scan, pack, stage, handover) as gateway modules + Store Ops mode/app | gateway, Flutter | 9, 13 | N (Agrimore flows as spec) | P1 | transactional transitions; empty update never "success" |
| 15 | Dispatch: rider profiles/shifts, offers with expiry and atomic acceptance, versioned delivery transitions, proof capture, participant-only tracking, earnings records in the ledger | DB, gateway, queue-workers, rider app | 9, 13, fee/custody decision | N (Agrimore schema adapted) | P1 | offer race: one acceptance; expiry re-offer; earnings balance |
| 16 | Money model extensions per decisions: custody fees, rider earnings, statements per party; reconciliation to zero | ledger | 1 | N | P1 | balanced postings; reconciliation report; no custody unless decided |
| 17 | Firebase cutover (D-10): buyer accounts, orders policy, app release | `customer_app`, identity | 8, marketplace feed live | I | P1 | cutover rehearsal on a copy; rollback plan |
| 18 | POS foundation: terminal registration, cashier sessions, counter-sale RPC (consume at completion), suspended baskets, receipts, shift/cash reconciliation | DB, gateway | 9, 11 | N | P2 | executable suites for counter sale + online last-unit race; shift variance report |
| 19 | Generated API contract (OpenAPI or equivalent) for native clients | gateway | 18 | N | P2 | client drift test in CI |
| 20 | Native POS shells (WinUI 3, SwiftUI), signing/update pipelines, peripheral abstraction, hardware list | new roots (ARB) | 18, 19 | N | P2 | both runners build; one device set validated per OS |
| 21 | Clothing module (variant barcodes, exchange), then supermarket/bakery rule sets | POS | 20 | N | P2 | domain rule tests |
| 22 | Central Admin decision executed (native vs `admin_web` per D-4); Sales Associate app per PDR-0003 | apps | 1, 3 | N | P2 | — |
| 23 | Load, spike, soak on checkout/inventory/dispatch; queue lag measured; SLOs with budgets | infra | 7, 13 | I | P2 | load report with numbers |

No calendar forecast is given: there is no measured team capacity and no first integration slice has been timed. Any estimate would be invented.

---

## 22. Internal engineering slice, controlled pilot and full product scope

**Internal engineering slice (proves the physical-commerce spine without money):** one test merchant with two locations (own shop + one "partner" location under the new custody model), a five-SKU fixed-unit assortment, the 20-shirts transfer with partner acceptance, one Instant basket with serviceability against a circle zone, one picker flow, one rider offer/acceptance/proof, sandbox Razorpay, reconciliation report to zero. **Acceptance:** every step is an executable suite or a recorded local e2e run; the storefront path is unaffected (existing suites still green); the concurrency suites cover the new mode.

**Controlled money-bearing pilot prerequisites (all must be measured, not asserted):** operator login in production; refunds end to end including provider failure states; reconciliation to zero across ledger, provider settlement and statements; tenant and location isolation red-team extended to custodians and riders; backup + restore drill; alert delivery to a named human; rollback rehearsed; live Razorpay with webhook; a single named partner location whose tills are captured (or an explicit "no shared inventory promise" for that partner).

**Full product scope** (the founder's eight surfaces, both native desktop OSs, multi-location, overlapping zones, role-specific design systems, Sales Associate) comes after the pilot reconciles repeatedly. It is not a date.

---

## 23. Founder decisions and external setup requirements

Decisions only the founder (and, where marked, counsel/accountant) can make — listed with the safe default while open:

| ID | Decision | Why it blocks | Safe default while open |
|---|---|---|---|
| FD-1 | **Fee model for the unified product.** D-1 says 0% forever on both channels; Agrimore's PDR-0001/0002 assume 3–4% blended commission on partner sales. One product cannot carry both. | Money model (#16), partner economics, statements | D-1 stands; no commission code |
| FD-2 | **Custody stance.** "Never a money custodian" vs a platform that collects buyer payment and settles partners and riders; plus physical custody fees | Ledger accounts, payout design, D-2 | no custody; record-only payouts |
| FD-3 | **D-2 merchant of record / invoicing party** (counsel) | GST invoices when a partner fulfils; refund liability | no assumption in code |
| FD-4 | **Cart model** (§7.4 options A/B/C) | #13, buyer UX | A (separate baskets) |
| FD-5 | **Native Central Admin vs `admin_web` (D-4)** | #22; two admins would violate "one admin" | `admin_web`; fix its login first |
| FD-6 | **Constitution amendments**: native POS/Admin app roots, `pos`/`instant` channel vocabulary, any reserved service activation (media for reels, search) | topology gate | nothing added until amended |
| FD-7 | **Store Ops delivery form**: mode of merchant app vs separate app for partner staff (§8) | #14 | mode for merchant-run, app for partner-run |
| FD-8 | **First POS domain** (recommendation: clothing) and pilot hardware purchase | #18–21 | clothing; no hardware named |
| FD-9 | **Maps/geocoding provider and SMS/OTP provider** | #8, #12 | adapters only |
| FD-10 | **Partner custody contract terms** (consignment vs sale, fees, loss, returns) — business, not engineering | #10 | consignment with merchant ownership, no fee, until written |
| FD-11 | **Naming** ("Letbuyy Store") and legal entity | branding only | no code impact |
| Open already | D-2, D-ID, D-KYC-VENDOR, D-FEAT-EXTRA, D-LOY-REVALUE, D-CI-ACCOUNT, D-DEPLOY-1 | as recorded | as recorded |

External setup: see §15 list (Supabase/Cloudflare/Vercel, Razorpay live + POS product, SMS, maps, FCM/APNs, Turnstile, courier live, KYC vendor, app signing incl. Windows/Apple, hardware).

---

## 24. Risks, unknowns and next concrete steps

**Risks**
- **Single-disk risk:** 611 commits of `develop` exist only on this machine (D-12). A disk loss erases the integration branch.
- **Empty-feed trap:** without operator login in production the marketplace can never show a listing; the Firebase cutover would then ship an empty marketplace.
- **Decision debt:** starting quick commerce before FD-1/FD-2 are settled will encode a fee or custody assumption that the Constitution forbids or the founder rejects.
- **Custody without capture:** promising shared inventory at a partner whose own tills are not captured produces oversells that no code can prevent.
- **Late-payment race** (LB-PAY-004) is a real-money defect candidate; it is inspected, not reproduced.
- **Donor drift:** Agrimore's tree changed today (1,388 index entries in flight); any reuse must re-read it at a committed SHA.

**Unknowns**
- Deployed state of anything; CI history; Play Store user volume; whether the Docker pull blocker still exists; Liquid activation status; Flutter build status today; step-up cryptography on refunds/payouts; whether Agrimore Edge Function URLs are reachable without the gateway.

**Next concrete steps (in order)**
1. Founder answers FD-1, FD-2, FD-4, FD-5 (one session, recorded).
2. Push or otherwise back up `develop` (owner act).
3. Repair items #2–#6 of the backlog on the existing product; re-run the full executable battery and record `E2E_DEVELOP`.
4. Write the Constitution amendment drafts for FD-6 and the location/custody tenancy decision; ARB review.
5. Start backlog #8–#10 as the first physical-commerce phases, each with an executable suite as acceptance.

---

## 25. Evidence index and audit-created artifacts

**Governing and ledger documents read:** `CLAUDE.md`; `.claude/skills/letbuyy/SKILL.md` and `references/{decisions,hazards}.md`; `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (grep); `EXECUTION_LEDGER.md` rows `PHASE-F-INTEG-1`, `PHASE-F-E2E-0/0b/0c`; `docs/evidence/integration/2026-09-12-develop-integration.md`; `docs/evidence/production-readiness/2026-08-24-readiness-evidence.md`; `docs/migration/repository_consolidation/17_remaining_migration_backlog.md`; `docs/active/BRANCH_DISPOSITIONS.md` (0 ACTIVE rows at audit time).

**Key LetBuyy source consulted (develop @ `88a9bf6f`):** `services/api-gateway/src/index.ts:722-857`; `routes/{inventory,checkout,payments,orders,returns,payouts,settlements,shipping,shipping-labels,custom-domains,themes,channel-listings,kyc,onboarding,employee,stores}.ts`; `routes/storefront/{public-routes,cart-routes,checkout-payment-routes,internal-payment-routes,buyer-account-routes,buyer-realm-wiring,marketplace-detail-routes}.ts`; `execution/{order,payment,product}-execution.adapter.ts`; `lib/{tenant-context,auth-user,order-ownership,provider-payment-verification,identity-session-verifier}.ts`; `middleware/{staff-permission,rateLimit,internal-perimeter,customer-session,buyer-session,auth}.ts`; `services/webhook-service/src/index.ts`; `services/queue-workers/src/*`, `wrangler.toml`; `apps/identity-platform/src/lib/auth/identity-issued-session.ts`, `src/app/api/{auth,buyer}/*`; `apps/customer_web/src/proxy.ts`, `next.config.ts:139-143`, `src/lib/api/browser-client.ts`, `src/app/store/[subdomain]/checkout/checkout-client.tsx`; `apps/admin_web/src/app/api/console-auth/login/route.ts`; `packages/theme-engine/src/theme-renderer.ts`; `packages/infrastructure/razorpay-adapter/index.ts`; migrations `000_baseline.sql`, `139`, `141`, `145`, `159`, `166`, `168`, `211`, `216`, `217`, `219`, `223`, `234`, `246`; `scripts/governance/run-executable-suites.mjs`; `tests/executable/*`.

**Agrimore source consulted (`foundation-rebuild` @ `6a33bf8`, index state):** `AGENTS.md`; `docs/product/PDR-0001…0003`; `docs/decisions/ADR-0001…0012` (0002–0008 read in part); `docs/engineering/PRODUCTION_LAUNCH_PLAN.md`; `docs/cleanup/REPOSITORY_CLEANUP_PLAN.md`; `SKIPPED_TASKS.md`; `supabase/migrations/000001…000024` (0003, 0005, 0007, 0008, 0010, 0011, 0012 in detail); `supabase/functions/*` (confirm-payment, _shared/worker_context.ts, _shared/auth.ts); `workers/api-gateway/src/{index,routes}.ts`, `handlers/api.ts`, `middleware/auth.ts`, `upstream/supabase.ts`; `workers/realtime-gateway/src/realtime/auth.ts`; `packages/agrimore_api`; `apps/*` directory shapes; `supabase/tests/*`.

**Artifacts created by this audit:**
- `docs/evidence/audits/2026-09-19-unified-commerce/LETBUYY_UNIFIED_COMMERCE_CURRENT_STATE_AND_GAP_REPORT.md` (this file, untracked)
- `docs/evidence/audits/2026-09-19-unified-commerce/LETBUYY_UNIFIED_COMMERCE_GUIDANCE_HANDOFF.md` (untracked)
- Session scratchpad logs (outside the repository): `test-contracts.log`, `test-unit-gateway.log`, `gate-plan.log`, `executable-suites.log`, `typecheck-gateway.log`, `val-*.log`

**Not created or changed:** no application code, migration, lockfile, workflow, configuration, credential, ledger row or decision record; no commit; no container or worktree left behind by this audit (eight throwaway containers were created and removed by the runner).

---

## 26. Status update — 2026-09-23

Added by phase F-UNI-1; §1–§25 above are left exactly as written on 2026-09-19. Measured against `develop` = `1e6cc4c3`. Fixes live on phase branches that are **committed but not merged or pushed**: `letbuyy/pay4-late-capture-after-release` and `letbuyy/adm4-operator-moderation-chain`. Execution mode: SINGLE AGENT · Subagents invoked: NO.

**Snapshot corrections (§3.1).** `develop`, `staging` and `main` all sit at `1e6cc4c3`, and `git ls-remote origin` (`SaaiSiddhu/letbuyy`) returned the same SHA for all three: `develop` **is** on an off-machine remote, so the D-12 statement that `develop` exists only on this disk no longer describes the repository. The primary checkout is the only worktree and is clean on `develop`. History was rewritten to a single author on 2026-09-20 (`cb7ad27c`), and all 833 `Co-Authored-By` trailers were removed.

| Finding | 2026-09-19 | 2026-09-23 | Evidence |
|---|---|---|---|
| LB-PAY-004 late payment after stock release | inspected source only | **reproduced, fixed on branch** — migration 252 locks the order and classifies each capture; a capture on a released or cancelled order is recorded once, the order cancelled, a refund queued, `order.cancelled` emitted; the gateway never announces it as paid | `tests/executable/late-capture-after-release-postgres.test.mjs` (9 fail on 000..251; 12/12 on 000..252, incl. a CONTROL that rolls 252 back); `late-capture-route-outcomes.test.ts` 9/9; 47-suite battery 47/0 |
| LB-PAY-009 (new) one payment posted to the ledger twice | — | **reproduced, fixed on branch** — the verify callback and the webhook confirmed one payment under two idempotency keys; `ledger_transactions` dedupes on `(site_id, source_type, source_id, idempotency_key)` only | same suite, sequential and concurrent |
| LB-PAY-008 (new) a webhook whose first processing failed is swallowed on retry | — | **open**, code reading | `webhook-service/src/index.ts` `writeWebhookEvent` (ignore-duplicates upsert) |
| LB-PAY-010 (new) storefront capture account | — | **open, decision input** — the storefront path reads platform `RAZORPAY_KEY_*`; the merchant path requires merchant-owned credentials; which account captures buyer money in live mode is FD-2 | `routes/storefront/checkout-payment-routes.ts:455-628`; `EXECUTABLE_HUMAN_REQUIRED.md` `HR-MERCHANT-PSP-LIVE` |
| LB-SEC-002 operator login | no production login | **one of five breaks**: (1) production login refused; (2) the console session carries `userId: null`; (3) `admin_web` authenticates with one shared bearer that only `/internal/console/*` accepts — the operator routes sit behind `authMiddleware`, which has no bearer verifier; (4) the decision body lacked the required `idempotency_key` — **fixed on branch**; (5) the tenant guard refuses the operator's cross-site `channel_listings` reads — even a correctly identified moderator gets a 500 | `operator-moderation-auth-chain.test.ts` (real `authMiddleware` + `requirePermission`); `admin-listing-decision-body.test.ts` |
| LB-FUL-001 (new) fulfilment RPC | — | **open, reproduced** — `create_order_fulfillment` (000_baseline, never redefined) raises `column "variant_id" is of type uuid but expression is of type text` on an ordinary COD order | direct SQL call against 000..252 |
| GST invoices (§13) | — | **correction**: invoices are issued at order creation (`issue_gst_invoice`, 214, from `OrderExecutionAdapter.createOrder`) — before payment on the razorpay rail, with no credit-note path for orders later cancelled | `execution/order-execution.adapter.ts:136-175` |
| Gate baseline | `failed=2` (2026-09-12, historical) | `failed=3` on every branch here: `customer_web` lint, `environment` + `stale-artifact` validators, and `tests/governance/ambient-red-attribution` "stale-artifact-validator is retired and stays green" — that test fails in any installed worktree because `1e6cc4c3` retired the red on a premise that only held in the uninstalled primary checkout | `gate.sh` runs at `c0d12b37`, `7ad896bf`, `1c0bdc65`, `85aa10c7`, `9a3cd846` |

**Smaller observations, not fixed:** `admin_web` offers "Take down" on `pending_review` listings, a transition the RPC only allows from `approved`; `/marketplace-listings` was missing from the `admin_web` proxy's protected list (restored on the ADM4 branch; the page guarded itself); the internal-identity JTI replay guard is per-isolate memory, which the stateless-runtime rule does not allow as an authority; the in-repo quick-commerce donor entities are 2–8-line stubs.
