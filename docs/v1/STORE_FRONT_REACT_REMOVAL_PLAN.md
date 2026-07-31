# Storefront React Removal Plan (Post-Slice-7)

**Type:** Research / certification — no implementation. **Date:** 2026-06-16.

---

## PHASE 8 — Checkout Architecture Audit

**Question: can checkout become Liquid, or must it stay island-driven?**

| | LetBuyy current | Shopify |
|---|---|---|
| Cart → checkout | signed `cart.checkout_url` handoff (`liquid-l8-cart.test.ts`) | signed checkout handoff |
| Checkout render | React `checkout-client.tsx` (Razorpay SDK + COD) | **hosted, non-Liquid** (Checkout Extensibility / web components) |
| Amounts | server-authoritative (`create_checkout_order` RPC) | server-authoritative |
| Signature/idempotency | server-side HMAC + idempotency keys | server-side |

**Recommendation: checkout should remain a controlled ISLAND/hosted surface — NOT raw Liquid.** Even Shopify does not render checkout in Liquid (it moved to hosted Checkout Extensibility). The correct target is a Liquid **checkout shell** (contact/address/summary) that mounts an `lb-checkout-payment` island wrapping the **existing** Razorpay/COD flow verbatim (no payment/ledger/idempotency change). This keeps PCI-sensitive logic in controlled JS while making the surrounding presentation Liquid. **Checkout is therefore NOT a blocker to "Liquid storefront"** in the Shopify sense — it is a presentation-shell + island task.

---

## PHASE 10 — React Removal Certification

### Can React be deleted today? **NO.**

React is the **default production renderer** (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) and the **sole renderer** for 13 routes. Deleting it today breaks checkout, account settings/wishlist/addresses, guest orders, CMS, blog, policies, and every Liquid-branched route's fallback.

### Blockers ranked by effort

| Rank | Blocker | Effort | What it needs |
|---|---|:--:|---|
| 1 | **Search backend + UI** | **LARGE** | new gateway FTS endpoint (pg_trgm) + drops + `search` template + `lb-search-results` island. Net-new backend. |
| 2 | **Checkout Liquid shell** | **LARGE** | `checkout` template + `lb-checkout-payment` island wrapping existing Razorpay/COD (no payment change) |
| 3 | **Recommendations** | **LARGE** | net-new engine + drop + section |
| 4 | **Account trio (settings/wishlist/addresses)** | **MEDIUM** | 3 templates + 3 sections + `customer.addresses` drop + wishlist product fetch + page branches (slice-7 pattern) |
| 5 | **CMS + blog + policies** | **MEDIUM** | `page`/`blog`/`article`/`policy` templates + content drops + route branches |
| 6 | **Order detail + guest orders** | **MEDIUM** | `/account/orders/[id]` route + guest `/orders` Liquid + `order` detail drop (template exists, dormant) |
| 7 | **Collection filter/sort/pagination** | **MEDIUM** | filter data + drops + section |
| 8 | **Registration/login/forgot routes** | **MEDIUM** | route-wire the dormant `customers/login`+`register` templates + `lb-customer-auth` island + forgot template |
| 9 | **Client analytics** | **MEDIUM** | `lb-analytics` beacon + events endpoint → rollups |
| 10 | **Per-theme Liquid bundles** | **MEDIUM** | author bundles for all themes (only Urban Kicks today); remove demo-fixture fallback |
| 11 | **Flip Liquid default** | **SMALL** | `theme-governance.ts:14` → true (staged, AFTER 1–10) |
| 12 | **Runtime parity proof** | **MEDIUM** | needs Razorpay/Supabase connected (the 0/13 gate) + shadow tests |

### Effort tally
- **LARGE (3):** search, checkout shell, recommendations.
- **MEDIUM (8):** account trio, CMS/blog/policies, order detail, filters, auth routes, analytics, per-theme bundles, runtime proof.
- **SMALL (1):** flip the default flag.

---

## React removal path (staged — never a direct delete)

| Stage | Goal | Exit |
|---|---|---|
| **R1 — Parity build** | Close all 10 blocker areas (templates + drops + islands + search/recs backend) | every route has a Liquid path; 0 dormant templates |
| **R2 — Per-theme bundles** | Every theme ships a Liquid bundle; remove demo-fixture fallback (`store-service.ts:670-673`) | theme-contract validator green |
| **R3 — Shadow + prove** | Shadow Liquid vs React on real traffic; live checkout/order smoke test | parity diff < threshold (needs live env) |
| **R4 — Liquid default** | Flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=true` (staged per theme) | sustained no-regression |
| **R5 — Fallback off** | `renderLiquidPlan` null → holding page, not React (`composition-engine.tsx`) | zero React renders in telemetry |
| **R6 — Delete React** | Remove registry/components/chrome/contexts/React pages; **keep** islands + editor | Liquid-only build green |

---

## Exact React removal status

- **Liquid completion ≈ 52%**, **React dependency ≈ 48%**.
- **React removal: NO** — blocked at R1 (parity not built) and R3 (no connected runtime to prove). 
- **Critical path to removability:** R1 (build the 3 LARGE + 8 MEDIUM items) → R2 (per-theme bundles) → R3 (live proof) → R4–R6.
- **Lowest-effort, highest-leverage next steps:** (a) the account trio (MEDIUM, slice-7 pattern ready), (b) order detail (template exists, just needs a route), (c) policies (LOW). These convert ~5 React-only routes to Liquid with no new backend.

**Nothing here is implemented — research only.** The build sequencing is owned by [LIQUID_100_PERCENT_PARITY_PLAN.md](LIQUID_100_PERCENT_PARITY_PLAN.md) (updated targets) + this plan.
