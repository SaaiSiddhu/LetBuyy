# LCIS Domain Intelligence — Phase 5

**Mission:** Define what intelligence each LetBuyy business and platform domain actually *needs*, then map current LCIS coverage and gaps. This is a demand-side analysis — independent of what LCIS currently supplies.

**Evidence sources (cited throughout):**
- `CLAUDE.md` — domain model, runtime map, money/auth/RLS hard rules, LCIS query tables
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` — supreme law
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` — master canonical registry
- `docs/central-intelligence/DOMAIN_EXPLAIN.md` — per-domain criticality + failure blast
- `docs/central-intelligence/DOMAIN_INTELLIGENCE.md` — graph node counts + DB surface
- `docs/central-intelligence/customer-journey-intelligence.md` — customer journey stage map
- `docs/central-intelligence/merchant-intelligence.md` — merchant lifecycle stage map
- `docs/graph/payment-intelligence.md`, `identity-intelligence.md`, `tenant-intelligence.md`, `security-intelligence.md`
- `docs/central-intelligence/OMEGA_GAP_REPORT.md` — LCIS self-reported coverage levels
- `docs/central-intelligence/LCIS_V2_GAP_ANALYSIS.md` — v1→v2 gap narrative
- `services/api-gateway/src/index.ts` — actual route registration (ground truth of what's real)

**Methodology note:** Where LCIS claims a metric or score, it is accepted at face value for *structural* coverage; live/runtime values are always NOT CONNECTED in the current system (0 of 7 providers wired, per `OMEGA_GAP_REPORT.md`). This gap is noted per-domain.

---

## Part 1 — Per-Domain Intelligence Maps

---

### 1. Storefront Runtime

**Purpose:** The customer-facing store rendered per tenant. Handles host-based routing, access control (public / password / preview_only / offline), theme rendering (React default; Liquid canary OFF), cart, and public product/collection pages.

**Runtime + data footprint:**
- Primary app: `apps/storefront-runtime` (`src/proxy.ts`, `src/app/`, `src/lib/`)
- Middleware: `proxy.ts` resolves host → `site_id`, access mode, redirect role (multi-domain migration 185)
- Key tables: storefront access context (`published`, `access_mode`, `custom_domain_status`), cart/orders (10 tables), products/collections (14 tables), themes (32 tables)
- Routes (customer journey): 14 landing/storefront routes, 3 product, 3 cart, 9 checkout (source: `customer-journey-intelligence.md`)
- Packages: `@letbuyy/auth-core` (gate tokens), `@letbuyy/tenant-core` (host resolution)

**Criticality:** Tier 2 (`DOMAIN_EXPLAIN.md`). Revenue-adjacent — if down, no traffic converts. Not a money RPC host itself (checkout/payment cross into `storefront-runtime` but the money RPCs live at the gateway). Single security invariant: the storefront gate token (`LETBUYY_STOREFRONT_GATE_COOKIE`) must be issued and verified server-side; client must not bypass access_mode.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Which stores are currently in `offline` or `password` mode and why? | Ops / Founder | Revenue impact: offline stores earn nothing |
| How many tenants have a connected custom domain vs. subdomain only? | Ops | Domain Center feature adoption; DNS misconfiguration risk |
| What is the Liquid canary flag status per store? Is any store running Liquid rendering? | Eng | ART-17 freeze risk; sanitizer audit trigger |
| Where does `proxy.ts` host resolution fail (unknown host → 404 vs. gateway down)? | Eng / On-call | Storefront outage root-cause |
| Which stores have `redirect` domains that may be misconfigured (wrong CNAME target)? | Merchant / Ops | SEO and traffic loss |
| What is the request fanout from proxy to gateway per store? (latency distribution) | Eng / Perf | SLA; gateway dependency |
| Are theme previews active for stores in production (preview cookie exposure)? | Security | Preview bypass of access control |

**Current LCIS coverage:**
- Structural: `docs/central-intelligence/DOMAIN_EXPLAIN.md` lists Storefront as Tier 2 with failure impact "Store down; no traffic converts" and consumer list `[operations, themes]`.
- `customer-journey-intelligence.md` maps 14 routes + 21 tables to Landing/Storefront stages.
- `/api/domain?key=storefront` serves domain metadata.
- Graph: `proxy.ts` is known to be live middleware (`MEMORY.md`: "proxy.ts is live middleware").

**Gap:**
- No per-store access-mode health view (online/offline/password counts). NOT CONNECTED — requires live DB query.
- No Liquid canary flag inventory per store (query-bound; no LCIS surface).
- Custom domain DNS health is modeled in `Domain Center dev config` (`MEMORY.md`) but NOT CONNECTED to a live DNS probe.
- No latency/fanout data from storefront-proxy to gateway. NOT CONNECTED (Analytics Engine unwired).
- Preview cookie exposure risk is not in the security audit surface.

---

### 2. Merchant Control Plane

**Purpose:** The merchant-facing dashboard. Everything a store owner does after onboarding — products, orders, inventory, customers, analytics, themes, payouts, settings, and more.

**Runtime + data footprint:**
- Primary app: `apps/merchant-control-plane/src/app/[store]/` with sub-routes: `dashboard`, `products`, `orders`, `customers`, `analytics`, `payouts`, `coupons`, `marketing`, `online-store`, `settings`, `apps`, `inventory`, `categories`, `ai`, `appearance`, `export`, and more.
- Backend: all routes proxy to `services/api-gateway` (merchant app calls gateway via proxy — `MEMORY.md`).
- Lifecycle tables: 33 routes, 92 RPCs, 181 tables across merchant lifecycle (`merchant-intelligence.md`).
- Key areas: `[store]/products`, `[store]/orders`, `[store]/dashboard`, `[store]/payouts`.

**Criticality:** Merchant domain is Tier 1 (`DOMAIN_EXPLAIN.md`). Failure blast: `[inventory, analytics, marketplace, themes, authorization, operations]`. Merchant management down = onboarding blocked, no store setup.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Which merchants are active vs. inactive (last login, last order, last product update)? | Founder / Growth | Churn detection |
| What percentage of merchants have completed onboarding (store → first product → first order)? | Founder / Product | Funnel health |
| Which merchant control plane routes are broken / returning errors in production? | Ops / Eng | Merchant experience SLA |
| What is the distribution of merchant plan tiers (billing)? Which are on trial vs. paid? | Founder / Finance | Revenue concentration risk |
| Which merchants have staff accounts and are they using RBAC correctly (staff permission enforcement)? | Security | Privilege audit |
| What does the dashboard show for stores with zero orders vs. stores with 100+ orders? (data shape differences that may surface UI bugs) | QA / Product | Edge case exposure |
| Which merchants have published themes vs. draft-only themes? | Ops | Storefront availability |
| Phase 4 audit finding (`MEMORY.md`): customer detail page missing, staff RBAC enforcement stubbed. Are these still open? | Eng | Launch blockers |

**Current LCIS coverage:**
- `docs/central-intelligence/merchant-intelligence.md` gives a full lifecycle stage map (Merchant → Products → Collections → Inventory → Orders → Payments → Refunds → Payouts → Shipping → GST → Discounts → Gift Cards → Themes → Analytics).
- `/api/merchant-health`, `/api/merchant-risk`, `/api/merchant-growth`, `/api/merchant-adoption`, `/api/merchant-churn` are modeled (OMEGA layer, `CLAUDE.md`).
- Phase 4 findings documented in `MEMORY.md` (`project_v1_phase4_merchant_audit.md`).

**Gap:**
- All merchant health/risk/growth/adoption/churn scores are **query-bound** (per `OMEGA_GAP_REPORT.md`: "per-merchant scores query-bound"). NOT CONNECTED.
- Staff RBAC enforcement status (stubbed vs. real): no LCIS surface. Requires code + runtime verification.
- No merchant route error-rate surface. NOT CONNECTED (Analytics Engine unwired).
- Customer detail page gap: flagged in memory, not in an LCIS audit endpoint.

---

### 3. Identity / Authentication

**Purpose:** Issues and verifies all platform sessions. Two issuers: customer HS256 (`CUSTOMER_SESSION_SECRET`, `issueCustomerSession`) and merchant ES256 (`identity-platform`, `LETBUYY_IDENTITY_PUBLIC_JWKS`). Guards onboarding with Turnstile + rate-limit. Step-up HMAC gates refunds/payouts.

**Runtime + data footprint:**
- Primary app: `apps/identity-platform/src/app/` — routes: `login`, `signup`, `onboarding`, `select`, `oauth2`, `jwks`, `forgot-password`, `reset-password`, `set-password`, `check-email`, `auth/`, `lookup`.
- Gateway middleware: `src/middleware/auth.ts`, `customer-session.ts`, `store-context.ts`.
- Packages: `packages/auth-core`, `packages/session-core`, `packages/token-core`, `packages/permission-core`.
- Graph: 5,586 nodes, attention score 74 (`docs/graph/identity-intelligence.md`).

**Criticality:** Tier 2 (Authentication/Authorization domains in `DOMAIN_EXPLAIN.md`). Hard security invariant: **two issuers, never crossed** (`identity-sole-issuer-validator`). Failure: logins fail or sessions forgeable → account takeover risk.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is the `identity-sole-issuer-validator` currently passing? (the single most critical security invariant) | Security / Eng | Cross-issuer token forgery risk |
| What is the current step-up HMAC gate coverage — which routes require step-up and are any gaps present? | Security | Refund/payout abuse surface |
| Are any merchant ES256 tokens being accepted for customer routes or vice-versa (runtime evidence)? | Security | Issuer crossover attack |
| What is the Turnstile gate hit rate / bypass rate on registration and login? | Security / Ops | Bot detection efficacy |
| How many merchant accounts are in `onboarding` vs. `select` vs. fully active state? | Ops / Founder | Onboarding funnel visibility |
| Is the JWKS endpoint (`/jwks`) returning valid public keys? Is the key rotation schedule defined? | Security / Eng | Token verification breakage if JWKS stale |
| What is the OAuth2 PKCE surface (developer-portal, frozen)? What happens when a developer tries to use it? | Developer / Security | Frozen feature exposure |
| Are forgot-password / reset-password flows rate-limited against enumeration? | Security | Account takeover vector |

**Current LCIS coverage:**
- `docs/graph/identity-intelligence.md` provides full surface map (HS256 / ES256 / step-up / OAuth PKCE / sessions / RBAC / Turnstile).
- Validator `identity-sole-issuer-validator.mjs` is part of the 107-validator gate (documented as PASS).
- `/api/domain?key=identity` serves domain metadata.
- `/api/security-intelligence` covers the identity surface in the 11-control model (`CLAUDE.md`).

**Gap:**
- No live session volume / error rate. NOT CONNECTED.
- No Turnstile bypass-rate signal. NOT CONNECTED.
- JWKS freshness / key rotation: not modeled as an LCIS health check.
- OAuth2 PKCE surface (frozen): documented as frozen but no alert if code changes re-activate it without ARB.
- Step-up gate coverage is modeled in the graph but not surfaced as a completeness percentage in a queryable endpoint.

---

### 4. Payments

**Purpose:** Authorizes and captures money (Razorpay + COD) and posts all transactions to the canonical double-entry ledger via `SECURITY DEFINER` RPCs. The highest-blast Tier 1 domain.

**Runtime + data footprint:**
- Gateway routes: `routes/payments`, `routes/checkout` (Razorpay verify HMAC lives at `checkout-payment-routes.ts:464–646`), `routes/cod-reconciliation`.
- Key RPCs: `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`, `post_settlement_ledger_transaction`.
- Packages: `packages/payments/src/index.ts`, `packages/checkout-core/src/index.ts`.
- Graph: 6,393 nodes, attention score 82 (`docs/central-intelligence/DOMAIN_INTELLIGENCE.md` — "the densest money surface").
- Validator: `canonical-ledger-only-validator.mjs` (PASS).

**Criticality:** Tier 1, money-primary. Failure blast: `[refunds, operations, orders]`. Every rupee of revenue flows through this domain. Hard rules: canonical ledger only; server-authoritative amounts; Razorpay HMAC verified server-side; idempotency + `FOR UPDATE`; balances ≥ 0.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is `canonical-ledger-only-validator` passing (no direct `.insert/update` on money tables)? | Security / Eng | Ledger integrity invariant |
| What is the current Razorpay payment success rate vs. failure rate? | Ops / Founder | Revenue loss signal |
| Are any `create_checkout_order` calls failing idempotency (duplicate key conflicts)? | Eng | Double-charge risk |
| What is the COD-to-prepaid ratio across stores? | Founder / Finance | COD reconciliation workload |
| Are there any orders stuck in `payment_pending` state beyond a threshold? | Ops | Revenue leakage / customer trust |
| What is the ledger reconciliation status — do `payment_transactions` + `refunds` + `payouts` balance? | Finance / Founder | Financial audit readiness |
| Is H8 (Razorpay Route / split payments) still a launch blocker? | Founder / Eng | `MEMORY.md` flags this as the critical path for Oct 1 |
| What is the blast radius if `confirm_order_payment_with_ledger` is modified? | Eng / ARB | Change-control gate |
| Are gift-card ledger projections (no mutable decrement) consistent with redemption counts? | Finance / Security | Gift-card liability accuracy |

**Current LCIS coverage:**
- `docs/graph/payment-intelligence.md` — comprehensive flow map (checkout→create_checkout_order→confirm→refund→post_settlement) with Mermaid diagram.
- `/api/payment`, `pnpm graph:intel payment` — payment blast/flow queries.
- `/api/revenue-intelligence`, `/api/revenue-v2` — ledger model (amounts query-bound).
- Validator: `canonical-ledger-only-validator.mjs` in 107-validator gate.
- OMEGA: `/api/fix-engine` includes payment-related ranked fixes.

**Gap:**
- Payment success/failure rates: **NOT CONNECTED** (Razorpay webhook data requires live adapter).
- Idempotency conflict rate: **NOT CONNECTED**.
- COD reconciliation status: route exists (`cod-reconciliation` router in `index.ts`) but no LCIS health surface.
- Ledger reconciliation balance check: modeled in `revenue-v2` but amounts **query-bound** (NOT CONNECTED).
- H8 Razorpay Route status: tracked in `MEMORY.md` but no LCIS endpoint surfaces it as a launch blocker with current state.
- LCIS over-serves this domain on structural intelligence (graph is richest here at 6,393 nodes) but is almost entirely dark on live operational state.

---

### 5. Orders / Checkout

**Purpose:** Captures the order lifecycle (cart → checkout → order → fulfillment) and orchestrates the multi-step checkout flow (discount resolution, GST, shipping rate selection, payment initiation).

**Runtime + data footprint:**
- Gateway routes: `routes/orders`, `routes/checkout`, `routes/returns`.
- Storefront-runtime: checkout pages (9 routes, 37 tables — `customer-journey-intelligence.md`).
- Merchant-control-plane: `[store]/orders` (3 routes, 12 RPCs, 10 tables — `merchant-intelligence.md`).
- Key tables: `orders`, `order_items` (`*_minor bigint` money), status state machine in `orders.ts PATCH`.
- Packages: `packages/checkout-core/src/index.ts`, `packages/commerce-core`.

**Criticality:** Tier 1. Failure blast: `[inventory, payments, refunds, operations, shipping]`. Orders failing = revenue stops.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| What is the checkout funnel drop-off at each stage (cart → checkout → payment initiation → payment confirm)? | Product / Founder | Conversion optimization |
| How many orders are in each status state (pending, confirmed, fulfilled, cancelled, refunded)? | Ops | Operations health |
| Are any orders stuck in intermediate states (e.g. payment initiated but not confirmed for >N minutes)? | Ops | Revenue leakage |
| What is the average order value per store? Outliers? | Founder / Analytics | Business intelligence |
| What is the COD order rate vs. prepaid? (distinct from payments — needed at checkout decision time) | Ops / Merchant | Fulfilment planning |
- Checkout research finding (`MEMORY.md`): checkout is embedded in `storefront-runtime`, not yet centralized. Is this still true? | Eng / Arch | Future checkout-runtime planning |
| Are branding tokens reaching the checkout UI (known gap from checkout research)? | Product | Brand consistency |
| Is cart abandonment being tracked anywhere? (known NOT IMPLEMENTED — no cart abandonment system) | Product | Conversion loss visibility |

**Current LCIS coverage:**
- `customer-journey-intelligence.md`: Cart (3 routes, 10 tables), Checkout (9 routes, 37 tables), Order (4 routes, 19 tables) stages mapped.
- `DOMAIN_EXPLAIN.md`: Orders domain listed with failure blast.
- `/api/customer-journey` covers the checkout-to-order arc.
- Checkout research findings documented in `MEMORY.md` (`project_checkout_research.md`).

**Gap:**
- Checkout funnel conversion rates: **NOT CONNECTED** (analytics_event_stream unwired).
- Order-state distribution: **NOT CONNECTED** (query-bound).
- Cart abandonment: explicitly **NOT IMPLEMENTED** (no system exists — `MEMORY.md`).
- Branding token gap in checkout: known finding, no LCIS endpoint or validator tracks it.
- The "checkout embedded in storefront-runtime" architectural debt has no LCIS surface that tracks whether the planned `services/checkout-runtime` placeholder has been activated.

---

### 6. Inventory / Catalog (Products, Collections, Inventory)

**Purpose:** Products domain owns the catalog (products, options, variants, metafields). Collections groups them for merchandising. Inventory tracks stock levels, reservations, transfers, adjustments per location.

**Runtime + data footprint:**
- Gateway routes: `routes/products`, `routes/inventory`, `routes/categories`, `routes/smart-collections`.
- Merchant-control-plane: `[store]/products` (2 routes, 5 RPCs, 10 tables), `[store]/products/inventory` (1 route, 18 RPCs, 9 tables), `[store]/products/collections` (1 route, 0 RPCs, 4 tables) — `merchant-intelligence.md`.
- Inventory RPCs: 18 (highest RPC count in the merchant lifecycle — `merchant-intelligence.md`).
- Commerce research finding (`MEMORY.md`): inventory ledger/locations/suppliers/POs/transfers + RPCs + routes are all real backend (not stubs).

**Criticality:** Products Tier 1 (storefront empty without catalog). Inventory Tier 1 (overselling / false out-of-stock = checkout failures). Collections Tier 2 (broken navigation).

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Which products have inventory tracked vs. not tracked? What is the out-of-stock rate by store? | Merchant / Ops | Overselling risk |
| Are any inventory reservations (from pending orders) not being released on order cancellation? | Eng / Ops | Inventory leak (pre-launch audit found COD inventory leak — fixed, `MEMORY.md`) |
| What is the distribution of product variant complexity (single SKU vs. multi-variant)? | Product | Theme/storefront rendering edge cases |
| Are smart collections computing correctly (dynamic membership rules)? | Merchant / QA | Navigation accuracy |
| Which stores have products with missing images, prices, or descriptions? | Merchant / Ops | Storefront quality |
| What is the transfer/PO pipeline status (items in transit vs. received)? | Merchant / Ops | Supply chain visibility |
| Are inventory adjustments from refunds being applied correctly? (`restore_gift_card_on_refund` fixed — is analogous inventory restore working?) | Eng / Finance | Refund correctness |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: Products (Tier 1, failure blast: `[inventory, operations, orders]`), Inventory (Tier 1, blast: `[orders, refunds, operations, shipping]`), Collections (Tier 2).
- `merchant-intelligence.md`: inventory has 18 RPCs and 9 tables mapped.
- Phase 5 commerce finding (`MEMORY.md`): "commerce BACKEND already REAL."
- `/api/domain?key=products`, `?key=inventory`, `?key=collections` serve domain metadata.

**Gap:**
- Out-of-stock rates, reservation leak detection, product quality metrics: all **NOT CONNECTED** (query-bound).
- Smart collection dynamic rule correctness: no LCIS validator or test surface.
- Inventory restore on refund is noted as fixed in the pre-launch audit but no ongoing LCIS check confirms it stays correct.
- Transfer/PO pipeline status: 18 inventory RPCs are modeled in the graph but no LCIS surface for the operational state of in-flight POs.

---

### 7. Shipping / Fulfillment

**Purpose:** Manages shipping zones, rates, fulfillment orders, shipments, and labels. Pincode serviceability is server-resolved. Rate pinning (LB-7) was a launch blocker resolved in Phase 1.

**Runtime + data footprint:**
- Gateway routes: `routes/shipping`, `routes/shipping-labels`, `routes/shipping-tax`.
- Merchant-control-plane: `[store]/orders` (fulfillment sub-routes), 3 routes, 1 RPC, 10 tables (`merchant-intelligence.md`).
- Audit command: `.claude/commands/shipping-audit.md`.
- Key: `shipping_rates` table (LB-7 fix), server-resolved rate selection.

**Criticality:** Tier 1 (`DOMAIN_EXPLAIN.md`). Failure blast: `[orders, inventory, analytics]`. Orders cannot ship; tracking breaks.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Are shipping rates correctly computed server-side (never client-trusted)? Any routes bypassing server resolution? | Security / Eng | Rate manipulation risk |
| What is the pincode serviceability coverage per store? | Merchant / Ops | Order acceptance rate |
| Which fulfillment orders are overdue (created but not shipped beyond SLA)? | Ops / Merchant | Customer experience |
| What is the label generation failure rate? | Ops | Fulfillment bottleneck |
| Are shipping taxes being calculated correctly for inter-state vs. intra-state shipments? | Finance / GST | Tax compliance |
| What is the ratio of fulfilled vs. unfulfilled orders per store? | Ops | Store operational health |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: Shipping listed as Tier 1 with blast.
- `DOMAIN_INTELLIGENCE.md`: shipping_rates table noted with LB-7 reference.
- Audit command: `.claude/commands/shipping-audit.md` (structural).
- `customer-journey-intelligence.md`: Tracking stage maps 6 routes, 25 tables.

**Gap:**
- No live fulfillment SLA tracking. NOT CONNECTED.
- Label generation failure rate: NOT CONNECTED.
- Pincode coverage: no queryable LCIS surface.
- `shipping-tax` route (`routes/shipping-tax` in `index.ts`) is registered but not surfaced in any LCIS domain map — gap in structural coverage.

---

### 8. GST / Tax / Invoicing

**Purpose:** Computes India GST server-side for all transactions and issues immutable GST invoices. GSTIN capture at merchant onboarding. Zero tolerance for client-trusted tax amounts.

**Runtime + data footprint:**
- Gateway routes: `routes/tax`, `routes/shipping-tax`.
- Merchant-control-plane: `[store]/certifications` (GST GSTIN), 1 route, 1 RPC, 6 tables (`merchant-intelligence.md`).
- Audit command: `.claude/commands/gst-audit.md`.
- Hard rule (CLAUDE.md): "GST computed server-side; invoices immutable."

**Criticality:** Tier 2 (`DOMAIN_EXPLAIN.md`). Failure: "Wrong tax; non-compliant invoices; legal exposure."

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is GST ever computed client-side (any route returning tax derived from client input)? | Compliance / Security | Legal + financial risk |
| Are all issued GST invoices immutable (no update path to an issued invoice)? | Compliance | Audit integrity |
| What is the GSTIN capture rate at merchant onboarding? | Ops / Finance | B2B invoice compliance |
| Are HSN/SAC codes being applied correctly per product category? | Finance / Compliance | GST return accuracy |
| Is the tax rate correct for the goods category (5%/12%/18%/28% slabs)? | Finance | Revenue and compliance risk |
| Are inter-state (IGST) vs. intra-state (CGST + SGST) calculations correctly split by shipment destination? | Finance / Compliance | GST return correctness |
| What percentage of orders have a B2B (GSTIN) invoice vs. B2C? | Finance | Invoice management workload |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: GST & Tax listed as Tier 2 with failure impact.
- `DOMAIN_INTELLIGENCE.md`: table noted (GST entry points).
- Audit command: `.claude/commands/gst-audit.md` (structural).
- `merchant-intelligence.md`: 1 RPC, 6 tables for GST.

**Gap:**
- No validator enforces "invoices immutable" at the code level (LCIS structural model notes it; no deterministic gate).
- `routes/shipping-tax` route (registered in `index.ts`) is absent from `DOMAIN_INTELLIGENCE.md` table — structural blind spot.
- HSN/SAC code coverage: not modeled anywhere in LCIS.
- IGST vs. CGST/SGST split logic: not auditable from LCIS endpoints.
- GSTIN capture rate: query-bound, NOT CONNECTED.

---

### 9. Gift Cards / Ledger

**Purpose:** Issues, redeems, and restores gift cards as a ledger projection. Gift-card balance is a derived view over `gift_card_ledger_entries` — there is no mutable decrement column. Balance leaks are a financial liability.

**Runtime + data footprint:**
- Gateway routes: `routes/gift-cards` (implied; not explicitly visible in `index.ts` head — present via the gift-card RPCs).
- Merchant-control-plane: 2 routes, 7 RPCs, 5 tables (`merchant-intelligence.md`).
- Key RPCs: `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund` (in `CLAUDE.md`).
- Tables: `gift_card_accounts`, `gift_card_ledger_entries`, `gift_card_redemptions`.
- Pre-launch audit (`MEMORY.md`): gift-card restore bug was found and fixed (`restore_gift_card_on_refund` invocation gap).

**Criticality:** Tier 1 (`DOMAIN_EXPLAIN.md`). Failure blast: `[orders, payments, operations]`. "Unredeemable codes or balance leaks; liability mismatch."

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is the gift-card balance always computed as a ledger projection (no mutable decrement column exists)? | Security / Finance | Invariant verification |
| Are `restore_gift_card_on_refund` calls being made on every eligible refund? (previously a gap) | Eng / Finance | Liability accuracy |
| What is the total outstanding gift-card liability (sum of unredeemed balances across all stores)? | Finance / Founder | Balance sheet liability |
| Are any gift-card codes exposed to enumeration attacks (sequential codes, short codes)? | Security | Gift-card fraud |
| What is the redemption rate by cohort (issued month vs. redeemed month)? | Finance | Liability expiry modeling |
| Are gift cards correctly scoped by `site_id` (a code from store A cannot redeem at store B)? | Security / Tenancy | Cross-tenant redemption attack |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: Gift Cards listed as Tier 1 with blast.
- `merchant-intelligence.md`: 7 RPCs, 5 tables mapped.
- `docs/graph/payment-intelligence.md`: gift card RPCs appear in the payment flow graph.
- `/api/revenue-v2` models gift-card liability (amounts query-bound).
- Pre-launch fix documented in `MEMORY.md`.

**Gap:**
- No validator confirms "ledger projection only" at the schema level (no LCIS check for absence of a balance column).
- Cross-tenant redemption scope (`site_id` on `gift_card_accounts`): modeled in tenant graph but no audit command specifically targeting gift-card cross-tenant isolation.
- Outstanding liability total: **query-bound, NOT CONNECTED**.
- Redemption rate cohort: **NOT CONNECTED**.
- Code enumeration risk: not in the security attack graph surface for gift cards specifically.

---

### 10. Themes / Theme Platform

**Purpose:** Liquid + JSON renderer with a locked sanitizer. React is the default rendering path; Liquid canary is OFF (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`). ART-17 freezes new React-per-section after the freeze date. Sanitizer is locked (`FORBID` lists, `outputEscape:'escape'`).

**Runtime + data footprint:**
- Package: `packages/theme-engine`.
- Merchant-control-plane: `[store]/online-store/themes` (1 route, 4 RPCs, 32 tables — `merchant-intelligence.md`).
- Storefront-runtime: theme rendering path (Liquid or React).
- Graph: 5,163 nodes (`DOMAIN_INTELLIGENCE.md`). Table: `themes.default_template`.
- Phase 2 themes (`MEMORY.md`): preset engine + 10 experiences + industry map + `letbuyy-core` alias. `theme-registry.ts` FROZEN.

**Criticality:** Tier 2 (`DOMAIN_EXPLAIN.md`). Failure: "Store renders broken or unsafe HTML." Security sub-invariant: sanitizer bypass = XSS across all stores.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is the Liquid sanitizer still locked (no changes to `FORBID` lists or `outputEscape`)? | Security / Arch | XSS invariant |
| Which stores have Liquid canary enabled? (should be zero in production unless canary was deliberately activated) | Security / Eng | ART-17 compliance |
| Is `theme-registry.ts` still frozen (no new entries added without ARB approval)? | Arch / ARB | Governance compliance |
| Are theme presets applying correctly (the `apply_preset` API gap found in Phase A research)? | Product / Eng | Onboarding UX |
| Which stores have a published theme vs. draft only? Which stores have never assigned a theme? | Ops | Storefront availability |
| What is the Urban Kicks theme reuse status (found 85% reusable as Core — `MEMORY.md`)? | Product / Eng | Theme library completion |
| Are any theme RPC calls bypassing the sanitizer (calling the renderer without the escape pipeline)? | Security | XSS bypass risk |
| What is the `--lb-*` design token compliance rate (design-system ratchet)? | Design / QA | UI consistency |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: Themes listed as Tier 2 with failure impact.
- `DOMAIN_INTELLIGENCE.md`: 5,163 nodes, themes.default_template anchored.
- Theme research complete (`MEMORY.md`): Phase A + B findings.
- `/api/theme-intelligence` is listed in LCIS v6 (`CLAUDE.md`).
- `theme-audit.md` audit command in `.claude/commands/`.

**Gap:**
- Sanitizer lock status: no LCIS validator or gate confirms the sanitizer config has not drifted. High-value gap.
- Liquid canary per-store inventory: **NOT CONNECTED** (feature flag query-bound).
- `theme-registry.ts` freeze enforcement: documented in memory but no automated gate.
- `apply_preset` API gap: identified in research, no LCIS endpoint tracks resolution status.
- Theme assignment rate (stores with vs. without published themes): **query-bound, NOT CONNECTED**.

---

### 11. App Marketplace

**Purpose:** App store — app installs, extensions, billing, and webhooks. Status: **FROZEN** (not a production deploy target per `CLAUDE.md`). `app-marketplace` is in the frozen/pending-consolidation list.

**Runtime + data footprint:**
- App: `apps/app-marketplace` (frozen; listed in `DOMAIN_INTELLIGENCE.md` with 1,349 graph nodes).
- Gateway routes: `routes/app-store`, `routes/app-api` (registered in `index.ts` — still live in gateway even though the app is frozen).
- `partner_payout` ring-fenced for marketplace billing.

**Criticality:** Tier 2 (`DOMAIN_EXPLAIN.md`). Currently frozen: "App ecosystem unavailable (currently frozen)."

**Honest note:** The app marketplace is NOT IMPLEMENTED as a production target. `app-marketplace` is explicitly in the frozen list (`CLAUDE.md`). However, `routes/app-store` and `routes/app-api` are registered in the gateway — a live gateway exposure for a frozen product.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Are `routes/app-store` and `routes/app-api` accessible without authentication in production? | Security | Frozen product attack surface |
| What is the ARB decision state for unfreezing the marketplace? | Arch / Founder | Roadmap clarity |
| If any merchant has installed apps (legacy data), what is their state? | Ops | Data hygiene |
| Is `partner_payout` table accumulating rows for a frozen product? | Finance | Liability |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md` and `DOMAIN_INTELLIGENCE.md` both note frozen status.
- `/api/apps-intelligence` listed in LCIS v6 (`CLAUDE.md`).
- `marketplace-audit.md` audit command exists.

**Gap:**
- The gateway still registers `app-store` and `app-api` routes. LCIS has no alert that a frozen product has live gateway endpoints — this is an unmodeled attack surface.
- ARB decision tracking for unfreeze: not in any LCIS endpoint.

---

### 12. Developer Platform

**Purpose:** OAuth/PKCE, API clients, and tooling for third-party developers. Status: **FROZEN** (not a production deploy target). `developer-portal` is in the frozen list (`CLAUDE.md`).

**Runtime + data footprint:**
- App: `apps/developer-portal` (frozen; 755 graph nodes per `DOMAIN_INTELLIGENCE.md`).
- Gateway routes: `routes/operations/developers` (registered in `index.ts`).
- OAuth2/PKCE: referenced in `identity-intelligence.md` as "(developer-portal, frozen)".

**Criticality:** Tier 2, frozen. "Developer access unavailable (currently frozen)."

**Honest note:** NOT IMPLEMENTED as a production target. Similar to the marketplace, the developer route `routes/operations/developers` is live in the gateway for a frozen product.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is OAuth2/PKCE endpoint accessible in production (frozen feature exposure)? | Security | Unauthenticated OAuth surface |
| What is the ARB unfreeze criteria and timeline? | Arch / Founder | Roadmap |
| Are any existing OAuth tokens or API keys in the database for a system that's "frozen"? | Security / Ops | Credential hygiene |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md` and `DOMAIN_INTELLIGENCE.md` note frozen status.
- `/api/developer-intelligence` listed in LCIS v6.
- `developer-portal-audit.md` audit command exists.

**Gap:**
- Same structural blind spot as marketplace: live gateway route for a frozen app. No LCIS alert.
- OAuth token/credential inventory for frozen product: not queryable.

---

### 13. Platform / Internal Operations

**Purpose:** Internal ops plane — incidents, RBAC, risk, trust & safety, reconciliation. The operator console (`apps/platform-console`) and the gateway's internal perimeter (`middleware/internal-perimeter.ts`).

**Runtime + data footprint:**
- App: `apps/platform-console/src/app/` — routes: `(auth)`, `(dashboard)`, `api`.
- Gateway: `routes/operations`, `routes/operations/rbac`, `routes/operations/incident-command`, `routes/operations/risk`, `routes/operations/support`, `routes/operations/trust-safety`, `routes/internal-console`, `routes/internal-billing`, `routes/internal-events`.
- Middleware: `internal-perimeter.ts` (restricts internal routes).
- Merchant-control-plane: `[store]/access_account` (billing/plan selection).

**Criticality:** Tier 1 (`DOMAIN_EXPLAIN.md`). Failure blast: `[authentication, notifications, analytics, payouts]`. "Ops blind; incident response degraded."

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is the internal perimeter (`internal-perimeter.ts`) correctly blocking all `internal-*` routes from public access? | Security | Internal API exposure |
| Are incident command routes accessible only to internal operator role (not merchant role)? | Security | Privilege escalation |
| What is the current platform RBAC coverage (which internal operations require which role)? | Security / Ops | Audit completeness |
| Is there an active incident right now? What is its blast radius? | Ops / On-call | Incident response |
| What is the COD reconciliation backlog? | Finance / Ops | Revenue recovery |
| Are trust-and-safety flags being actioned (how many stores are flagged, pending review)? | Ops | Platform health |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: Internal Operations as Tier 1.
- `OMEGA_GAP_REPORT.md`: Runtime Intelligence 100% implementable; Security Intelligence 100%.
- `/api/incident-control`, `/api/operations`, `/api/observability` in LCIS v6.
- LCIS OMEGA/Genesis: incident and runbook coverage modeled.

**Gap:**
- Internal perimeter boundary enforcement: `internal-perimeter.ts` is a key security control not included in the 107-validator gate (no validator confirms it is applied to all internal routes).
- Real incident state: **NOT CONNECTED** (no live incident feed in-repo, per `LCIS_V2_GAP_ANALYSIS.md`).
- COD reconciliation backlog: **NOT CONNECTED**.
- Trust-and-safety flag queue: **NOT CONNECTED**.

---

### 14. Infrastructure

**Purpose:** The deployment, compute, and runtime substrate: Cloudflare Workers (queue-workers, webhook-service), Vercel (Next.js apps), Supabase (Postgres + RLS + migrations), GitHub Actions (CI/CD, security scans).

**Runtime + data footprint:**
- Services: `services/queue-workers`, `services/webhook-service`.
- Migrations: `database/supabase/migrations/` (the authoritative schema source).
- Secrets: env bindings (never in-repo); `packages/infrastructure`.
- Validators: 107-gate (`node scripts/validate-governance.mjs`).
- OMEGA gap: `INFRASTRUCTURE_INTELLIGENCE.md` modeled; cost-usage query-bound.

**Criticality:** Tier 1 (cross-cutting). All runtimes depend on it. Failure = everything fails.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| What is the current migration state (latest applied migration number vs. HEAD)? | Eng / Ops | Schema drift detection |
| Are all required secrets present in each deployment environment (local / staging / production)? | Ops / Security | Runtime failure prevention |
| Is `getSupabaseAdmin` called only behind `verifySiteOwnership` (no blanket service-role)? | Security | The single highest blast-radius symbol (115 files) |
| What is the Cloudflare Worker queue depth and error rate? | Ops | Async job health |
| What is the webhook delivery success rate? | Ops / Merchant | Webhook reliability |
| Are GitHub Actions security scans passing? | Security | Ongoing vulnerability detection |
| What is the estimated infra cost at current load? At 100 merchants? At 10k users? | Founder / Finance | Burn rate |

**Current LCIS coverage:**
- `INFRASTRUCTURE_INTELLIGENCE.md` in `docs/central-intelligence/`.
- `OMEGA_GAP_REPORT.md`: Deployment Intelligence 100% implementable.
- `/api/infra`, `pnpm graph:infra`, `pnpm graph:depstate` cover declared state.
- `getSupabaseAdmin` blast radius documented (115 files) in `CLAUDE.md`.
- Cost intelligence: modeled to 100% (pricing model + dependency graph + hotspots) — usage query-bound.

**Gap:**
- Migration state vs. DB actual: **NOT CONNECTED** (no live Supabase introspection).
- Worker queue depth, error rate: **NOT CONNECTED** (Analytics Engine unwired).
- Webhook delivery rate: **NOT CONNECTED**.
- Secret presence per environment: modeled (`/api/environment-registry`) but live probe **NOT CONNECTED** (no credentials at build time).
- Infra cost at scale: framework present, actual usage **query-bound, NOT CONNECTED**.
- `getSupabaseAdmin` blast radius (115 files) is LCIS's single most important structural alert — but there is no automated gate that blocks a new call from being added without review.

---

### 15. Analytics

**Purpose:** Event stream, rollups, projections, and exports. Powers the merchant analytics dashboard and feeds internal operations metrics.

**Runtime + data footprint:**
- Gateway routes: `routes/analytics`, `routes/commerce-analytics`.
- Merchant-control-plane: `[store]/analytics` (4 routes, 13 RPCs, 36 tables — highest table count in the merchant lifecycle — `merchant-intelligence.md`).
- Event source: `analytics_event_stream` (referenced in `customer-journey-intelligence.md`).

**Criticality:** Tier 1 (`DOMAIN_EXPLAIN.md`). Failure blast covers nearly every domain: `[inventory, payments, refunds, operations, orders, themes, shipping, storefront]`. Analytics stale = all downstream projections lag.

**Intelligence the domain NEEDS:**

| Question | Persona | Why critical |
|----------|---------|-------------|
| Is the event stream receiving events in real time? What is the ingestion lag? | Eng / Ops | Data freshness |
| What is the rollup freshness — how stale are the materialized aggregates? | Merchant / Ops | Reporting accuracy |
| Which stores have analytics enabled vs. disabled? | Ops | Feature adoption |
| Are revenue projections consistent with ledger amounts? | Finance / Founder | Data integrity |
| Is the export pipeline working? (last successful export per store) | Merchant / Ops | Data portability |

**Current LCIS coverage:**
- `DOMAIN_EXPLAIN.md`: Analytics Tier 1 with blast.
- `merchant-intelligence.md`: 13 RPCs, 36 tables mapped.
- LCIS telemetry layer: `/api/telemetry` models 12 adapters with ingestion contract.
- Customer Intelligence: 8 graphs model conversion/retention/loyalty (rates query-bound).

**Gap:**
- Event stream ingestion lag: **NOT CONNECTED** (Analytics Engine = the live data source, unwired).
- Rollup freshness / staleness: **NOT CONNECTED**.
- Every derived metric (conversion rates, revenue projections, cohort analysis) is **query-bound, NOT CONNECTED**.
- LCIS analytics coverage is architecturally complete but operationally dark — the gap between structural model and live signal is greatest here because analytics is itself the live-data layer.

---

## Part 2 — Explicitly NOT IMPLEMENTED Domains

The following are **manifest-only placeholders** as of the repository state on `stepup/main`. LCIS should not model these as active domains with operational intelligence needs, and should not paper over their absence.

| Domain | Status | Evidence | Current LCIS risk |
|--------|--------|----------|-------------------|
| `services/checkout-runtime` | Reserved, not implemented | `CLAUDE.md` canonical runtime map | Checkout intelligence (Part 1 §5) currently routed to `storefront-runtime` — the LCIS claim that checkout is its own service is incorrect |
| `services/search-service` | Reserved, not implemented | `CLAUDE.md` | No search intelligence domain needed until activated |
| `services/media-service` | Reserved, not implemented | `CLAUDE.md` | Media routes go through `routes/upload` / `routes/media` in gateway |
| `services/notification-service` | Reserved, not implemented | `CLAUDE.md` | Notifications are via Resend (email) + WhatsApp gateway routes |
| `services/event-bus` | Reserved, not implemented | `CLAUDE.md` | No event-bus intelligence applicable |
| `services/analytics-pipeline` | Reserved, not implemented | `CLAUDE.md` | Analytics runs through gateway routes + Cloudflare Analytics Engine directly |
| Subscriptions journey | NOT IMPLEMENTED | `CLAUDE.md`: "Subscription journey is NOT IMPLEMENTED (no subscriptions domain)" | LCIS v11 lists this as a journey — must be marked NOT IMPLEMENTED in the journey graph |
| `apps/mobile/shopper-app` | Reserved | `CLAUDE.md` | No mobile intelligence domain |
| `apps/mobile/operator-app` | Reserved | `CLAUDE.md` | No mobile intelligence domain |

---

## Part 3 — Cross-Domain Intelligence (Highest-Stakes Flows)

### Flow 1: Checkout → Payment → Ledger → Refund

This is the highest-blast cross-domain flow. It spans: Orders (checkout) → Payments (Razorpay / COD) → Ledger (canonical RPCs) → Refunds (step-up gated) → Gift Cards (restore) → Inventory (reserve/restore) → Shipping (fulfill/cancel) → Notifications (receipt/refund email) → Analytics (event emission).

**Cross-domain intelligence demanded:**

1. **End-to-end idempotency tracing.** Can an operator answer: "for order X, were all ledger entries created with their idempotency keys, and were any duplicate attempts detected?" No single LCIS endpoint today answers this across the full chain.

2. **Money invariant completeness.** For a given order: `payment_amount == order_total + tax + shipping` AND `refund_amount ≤ captured_amount` AND `gift_card_ledger balance == sum(issue) - sum(redemption) + sum(restore)`. LCIS models each piece but no endpoint computes the three-way reconciliation for a single order.

3. **Step-up gate coverage across the refund path.** Which routes call refund RPCs? Do all of them pass through the step-up HMAC gate? The security graph models this but does not expose a yes/no answer.

4. **Blast radius of changing `create_checkout_order`.** LCIS identifies this RPC as a hotspot (`CLAUDE.md`). The graph blast radius query (`/api/blast?q=create_checkout_order`) covers code nodes; it does not cover which merchants would be affected if the RPC fails.

5. **COD reconciliation chain.** COD orders flow: order confirmed (COD) → fulfillment → `cod_reconciliation_entries` → settlement. This chain has no end-to-end health view in LCIS.

---

### Flow 2: Store Creation → Onboarding → Theme Assignment

Spans: Identity (merchant account creation) → Merchant (store provisioning, `site_id` generation) → Tenancy (RLS tables created) → Themes (theme assigned) → Storefront (access_mode set to published).

**Cross-domain intelligence demanded:**

1. **Onboarding funnel with per-step drop-off.** How many merchants make it from signup → store creation → first product → theme published → first order? No LCIS endpoint answers the complete funnel with counts. (Rates are query-bound but the funnel *topology* should be modeled structurally.)

2. **Theme auto-assignment on onboarding.** Research finding (`MEMORY.md`): "onboarding doesn't auto-assign themes." This means new stores may go live without a theme. LCIS has no structural check that the onboarding flow includes a theme assignment step.

3. **Tenant isolation verification at store creation.** When a new `site_id` is created, are all tenant RLS policies automatically covering it? Is the `tenant-tables.registry` updated? No LCIS health check confirms "store X is correctly isolated."

---

### Flow 3: Tenant Isolation (Security Cross-Domain)

Spans: Tenancy (RLS + `site_id`) → Security (validators) → Payments (service-role boundary) → Identity (issuer separation) → Every data-mutating route.

**Cross-domain intelligence demanded:**

1. **Live RLS coverage delta.** The 107-validator gate confirms RLS is forced on currently-known tenant tables. But new tables added between runs are undetected until the next gate run. LCIS has no "new tables since last validation" alarm.

2. **`getSupabaseAdmin` call-site growth tracking.** This symbol has 115 file consumers — the highest blast radius in the codebase (`CLAUDE.md`). LCIS documents it but has no alarm if the consumer count grows between commits.

3. **Cross-tenant data probe.** No LCIS endpoint can answer: "Is there any live query path from tenant A's context that could return tenant B's data?" This requires a runtime probe that is NOT CONNECTED.

4. **Webhook HMAC coverage.** `signQueueTenantEnvelope` gates queue jobs; webhook service uses HMAC. Are all webhook dispatch paths going through the signing layer? The security graph models anchor points but does not enumerate uncovered dispatch paths.

---

## Part 4 — LCIS Coverage Assessment

### Where LCIS Over-Serves Demand

| Area | Over-service | Evidence |
|------|-------------|----------|
| Payments structural model | 6,393 graph nodes, 34 money RPCs, 7 named flow endpoints — richest domain by far | `DOMAIN_INTELLIGENCE.md`; `payment-intelligence.md` |
| Version naming / layer proliferation | 12 named generations (V1–V11, X, OMEGA, INFINITY, Genesis) — navigating LCIS itself is a discovery problem; the intelligence-about-intelligence surface exceeds the intelligence-about-platform surface in many domains | `000_INDEX.md` tension #2 |
| "100% implementable" claims | `OMEGA_GAP_REPORT.md` claims 100% on Code/DB/Domain/Runtime/Security — but "implementable" ≠ "connected to live data"; the framing obscures that the operational value is near-zero until providers are wired | `OMEGA_GAP_REPORT.md` |
| Naming of frozen domains | `/api/apps-intelligence`, `/api/developer-intelligence`, `/api/theme-intelligence` as peer endpoints suggest these are co-equal live domains — masking that two of three are frozen | `CLAUDE.md`; `DOMAIN_EXPLAIN.md` |

### Where LCIS Under-Serves Demand

| Area | Under-service | Gap severity |
|------|--------------|-------------|
| Live provider connectivity | 0 of 7 providers wired; every operational metric is NOT CONNECTED | **Critical** — renders all runtime/merchant/revenue intelligence non-operational |
| Internal-perimeter enforcement | `internal-perimeter.ts` is not validated by any of the 107 gates | **High** — internal routes accessible beyond the intended boundary without detection |
| Frozen-product live gateway exposure | `routes/app-store`, `routes/app-api`, `routes/operations/developers` are live in the gateway for frozen products; no LCIS alert | **High** — attack surface for frozen features |
| GST/Tax structural gaps | `routes/shipping-tax` unrepresented in domain map; no "invoices immutable" validator; HSN/SAC not modeled | **Medium** — compliance risk invisible to LCIS |
| Liquid sanitizer drift detection | No validator or gate confirms sanitizer config has not changed since lock | **High** — XSS invariant is unmonitored |
| `getSupabaseAdmin` growth alarm | 115-file blast radius documented but no gate blocks new consumers from being added | **Medium** — highest-blast symbol growing silently |
| Subscriptions journey honesty | LCIS v11 lists Subscriptions as a journey without marking it NOT IMPLEMENTED | **Low** — misleading for new engineers/agents |
| Cart abandonment | Acknowledged NOT IMPLEMENTED in memory, absent from LCIS journey maps | **Low** — product intelligence blind spot |
| Checkout embedded vs. centralized | `storefront-runtime` still owns checkout; `services/checkout-runtime` is a placeholder; LCIS does not surface this architectural debt | **Medium** — planning confusion |

---

## Part 5 — Summary Table: Intelligence Needs vs. Coverage

| Domain | Tier | Highest-value intelligence need | LCIS structural | LCIS operational | Key gap |
|--------|------|--------------------------------|----------------|-----------------|---------|
| Storefront Runtime | 2 | Access-mode health per store | Connected | NOT CONNECTED | Live store status |
| Merchant Control Plane | 1 | Onboarding funnel + active merchant count | Modeled | NOT CONNECTED | Live merchant scores |
| Identity / Auth | 2 | Issuer-crossover alarm; step-up coverage % | Connected (validators) | NOT CONNECTED | Live session rates |
| Payments | 1 | Razorpay success rate; ledger reconciliation | Connected (richest) | NOT CONNECTED | All live metrics |
| Orders / Checkout | 1 | Checkout funnel conversion; stuck-order count | Partial (topology) | NOT CONNECTED | Cart abandonment absent |
| Inventory / Catalog | 1 | Out-of-stock rates; inventory reserve leaks | Connected | NOT CONNECTED | Ongoing reserve validation |
| Shipping / Fulfillment | 1 | Fulfillment SLA; label gen failures | Partial | NOT CONNECTED | `shipping-tax` route missing |
| GST / Tax | 2 | Immutable invoice enforcement; IGST split | Partial | NOT CONNECTED | No invoice-immutability validator |
| Gift Cards | 1 | Ledger projection integrity; liability total | Connected (payment graph) | NOT CONNECTED | Cross-tenant scope check |
| Themes | 2 | Sanitizer lock status; Liquid canary inventory | Partial | NOT CONNECTED | No sanitizer-drift gate |
| App Marketplace | 2 | Live gateway exposure for frozen product | Frozen documented | N/A | Gateway route alert |
| Developer Platform | 2 | OAuth surface for frozen product | Frozen documented | N/A | Gateway route alert |
| Platform / Internal Ops | 1 | Internal perimeter validation; incident state | Modeled | NOT CONNECTED | `internal-perimeter.ts` ungated |
| Infrastructure | 1 | Migration state; `getSupabaseAdmin` growth | Connected (declared) | NOT CONNECTED | Secret probe unwired |
| Analytics | 1 | Event stream ingestion lag; rollup freshness | Modeled (adapters) | NOT CONNECTED | Entire operational layer dark |

---

*Generated: 2026-06-20 · Phase 5 of LCIS Discovery Mission · Working branch: `stepup/main`*
*Evidence: cited inline to repository paths. Live data claims marked NOT CONNECTED per LCIS honesty contract.*
