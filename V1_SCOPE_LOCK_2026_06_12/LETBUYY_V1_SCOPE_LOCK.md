# LETBUYY V1.0.0 — SCOPE LOCK

**Program:** V1_SCOPE_LOCK_2026_06_12 · **Mode:** Adversarial repository audit (22 parallel auditors + orchestrator + 2 verifiers)
**Audited HEAD:** `1a14a802` (launch-readiness-arm; main == stepup/main; **origin/main 180 commits behind, never pushed**)
**Rule applied:** Repository evidence wins. Product opinions lose. Existing implementation wins. Wishlist loses.
**Governance note:** Tracked by the V1 launch execution program (v1-launch-cp0). Basename does not match the prompt-perimeter prompt-class regex (MISSION|PROMPT|BLUEPRINT|MASTERPLAN|DELETION), so no PROMPTS.md registry row is required; this is a report-class evidence artifact. Ledger row: V1-LAUNCH-CP0.

---

## 1. EXECUTIVE SUMMARY

LetBuyy is **already a Shopify-class codebase with one product inside it that is ~62% finished and seven products inside it that are 0–30% finished**. The V1 decision is not "what to build" — it is "which 38% to finish and which seven products to refuse to ship."

What the repository proves LetBuyy already is:

- A **multi-tenant India-first commerce platform**: 5 Vercel apps (storefront-runtime, merchant-control-plane, identity-platform, platform-console, marketing-site) + 4 Cloudflare Workers (api-gateway, webhook-service, queue-workers, mobile-bff) + 98 Supabase migrations + a certified double-entry money ledger.
- The merchant admin has **45 UI pages, 47 API routes**, and a real product→order→fulfill loop. The api-gateway has 50+ route domains with real checkout, payments, orders, payouts.
- The buyer can already (in code): browse a store, add to cart, check out via **Razorpay or COD**, get a confirmation email, and see order status — *provided 1 missing 3-line file is created and ~8 secrets are provisioned*.
- Foundation blockers B2–B7 are **closed at HEAD** (gate green, 107 validators). Only **B1 — the human push to origin — remains**, and origin still ships the account-takeover and the 3% rake.

What V1.0.0 is, in one sentence:

> **One web platform, one theme (LetBuyy Default / urban-kicks React), one country (India), one currency (INR), two payment methods (Razorpay + COD), manual fulfillment with tracking numbers, email-only buyer notifications, 0% commission, owner-only merchants, and a staffed internal console — nothing else.**

Headline numbers:

| Metric | Value |
|---|---|
| V1-scoped completion today | **~62%** (weighted across the 9 V1 domains) |
| Launch blockers (code) | **13** (LB-1…LB-13, §9) — largest single item ≤ ~8 dev-days (verifier-sized) |
| Launch blockers (human/env) | **9 provisioning tracks** (§9.B) — none require code |
| Remaining code work | **~38–48 dev-days** (≈ 5–6 weeks for 2 engineers, verifier-adjusted) |
| 60-day launch verdict | **FEASIBLE** for a 10–50-merchant pilot, tight but real (§13) |

The three most dangerous facts found (all previously unreported):

1. **`apps/storefront-runtime/src/proxy.ts` is never wired as middleware.** There is no `middleware.ts`; a few files import its helper utilities, but the `proxy()` entry point is never invoked. Subdomain (`store.letbuyy.com`) and custom-domain routing **does not execute at all**. Every storefront is only reachable at the internal `/store/[subdomain]` path. Fix: one ~3-line file. (LB-1)
2. **Variant writes are a no-op.** The merchant product form hardcodes `variants: []`; option metadata saves but no `product_variants` rows are ever created; the storefront variant picker is cosmetic and `cart line variant_id` is always null. Every product on the platform is effectively single-variant. (LB-5)
3. **The live checkout ignores merchant shipping rates.** The storefront order path computes shipping inside the `create_checkout_order` RPC with hardcoded standard=free/express=₹99; the merchant's configured zones/rates are never read. The hosted-checkout path is worse: it trusts a client-supplied `shipping_quote` blob. (LB-7)

---

## 2. V1 PRODUCT DEFINITION

**LetBuyy V1.0.0 is a web-only storefront platform for Indian small merchants:**

| Dimension | V1.0.0 ships | Explicitly NOT in V1 |
|---|---|---|
| Merchant surface | Web admin (`admin.letbuyy.com`) | Mobile app (built ~68%, push dead, signing unprovisioned → V2) |
| Storefront | `{store}.letbuyy.com` subdomains + custom domains, React-rendered | Liquid engine (0% rollout, ARB-deferred), theme marketplace |
| Theme | **One theme: LetBuyy Default (urban-kicks)** with editor + nav menus | Multiple themes, Liquid themes, theme store |
| Catalog | Products (single + multi-variant after LB-5 fix), manual collections, inventory with reservations, R2 media | Smart collections, multi-location UX, purchase orders, transfers (already "not available yet" stubs) |
| Checkout | Razorpay (platform account) + COD; coupons (%, fixed, free-shipping); GST rate calc | Stripe, PayPal, Cashfree (UI removed), gift cards (split-table bug — hidden), BOGO, automatic discounts, multi-currency |
| Money | Canonical double-entry ledger, 0% commission, payout statements + Razorpay Route release, COD remittance recon | Merchant-own Razorpay keys, AI-credit purchase (501), subscription-revenue ledgering (gap accepted + tracked) |
| Fulfillment | Manual: merchant enters tracking number; buyer sees status + email | Carrier integrations (Shiprocket/Delhivery/Pickrr — hardcoded sandbox), label purchase, carrier webhooks, GST e-invoice IRP |
| Notifications | Email only (Resend): OTP, reset, order confirmation, **+ shipped/cancelled/refund (to build)** | WhatsApp (sandbox-locked, DLT non-compliant), SMS (doesn't exist), push (dry-run) |
| Identity | Email+OTP signup, password login, Turnstile, TOTP 2FA, step-up for money actions | OIDC provider (501), passkeys (absent), magic link (flag off), SSO |
| Team | **Owner-only merchants**; platform-side staff RBAC (real) | Merchant staff roles (DB exists, enforcement inert, invite acceptance page missing → V1.1) |
| Internal ops | Platform console: Merchant 360, suspend/restore, audit logs, money recon, risk/T&S dashboards, **+ KYC queue + refund tooling (to build or ops-manual)** | Marketplace governance actions (live only in frozen ops-portal), feature-flag admin |
| Ecosystem | None | App store, developer portal, extensions/Wasm (flag off), GraphQL (flag off), AI generation (sandbox) |

---

## 3. V1 APPS

| Runtime | V1 status | Completion | Verdict |
|---|---|---|---|
| `apps/storefront-runtime` | **SHIPS** | 52% → needs LB-1, 6, 8, 9 | The buyer product. Highest-leverage fixes live here. |
| `apps/merchant-control-plane` | **SHIPS** | 68% | 28 real pages; needs refund UI, step-up UI, variant builder fix |
| `apps/identity-platform` | **SHIPS** | 58% (merchant core ~90%) | Signup/login/OTP/reset/switch all real at HEAD; takeover fixed (HEAD only) |
| `apps/platform-console` | **SHIPS** | 65–70% | 17 real dashboard routes; needs KYC queue + refund tooling |
| `apps/marketing-site` | **SHIPS** | 80% | Must fix ₹20/month price contradiction + dead ToS/Privacy links |
| `services/api-gateway` | **SHIPS** | 70% | The monolith that owns checkout/payments/orders — canonical |
| `services/webhook-service` | **SHIPS** | 65% | Razorpay/Stripe sig-verified; PayPal verify absent (moot — PayPal cut) |
| `services/queue-workers` | **SHIPS** | 55% | Deployable; email dispatch real; push dry-run (accepted for V1) |
| `services/mobile-bff` | DEPLOYS, idle | 75% | Ships only to serve future mobile; no V1 dependency |
| `apps/mobile/merchant-app` | **V2** | 68% | Login unblocked in code, but push structurally absent + store signing unprovisioned. NOTE: ci.yml merge-safety-gate still runs `flutter analyze/test` on every PR — mobile gates CI merges even while deferred |
| 4 frozen apps + 6 reserved services | **NOT V1** | 0% | Confirmed manifest-pinned, no deploy config (§10) |

---

## 4. V1 THEME

**Decision (evidence-forced): the React path IS the theme. Name it "LetBuyy Default" (internal id `urban-kicks`).**

- React rendering is the only live path: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (packages/theme-engine/src/theme-governance.ts:14), `FEATURE_LIQUID="false"` in production wrangler.toml. Liquid bundle exists only as an unstyled fixture; flipping it would render bare HTML. **Liquid = V2.**
- 20 registered React section components; default template renders announcementBar → hero → categoryGrid → featuredProducts → productGrid → newsletter, bound to real product data.
- The theme **editor is genuinely wired**: publish → `theme_releases.template_snapshot` → `sites.template_config` → storefront `mapSupabaseToStore` → CSS vars + section render, with preview sessions and cache purge. Sections, settings, header, footer, nav menus, product/collection templates all reach the live store.
- `theme_id='modern'` (the DB default for new stores) is a **ghost label** that silently resolves to urban-kicks. Rename or alias it during V1 polish.

**Theme Completion Plan (ordered, sized):**

| # | Gap | Size | Why |
|---|---|---|---|
| T1 | `AnnouncementBar` React component (registry entry missing) | S | Every new store's FIRST visible element is currently an "unavailable section" placeholder |
| T2 | Appearance→themeSettings bridge: brand color/font/radius/custom-CSS/logo/favicon save to `site_settings` which the storefront **never reads** | M | The entire Appearance page is a dead island today |
| T3 | Collection page: `collectionFilter` component + `/collections/[slug]` route + product-assignment (with LB-6) | M | No collection browsing exists |
| T4 | Populate route-specific `templates.index/product/collection` (today every route renders the home section list) | M | Product/collection pages currently reuse home layout |
| T5 | Footer-menu edit UI (footer nav renders but is uneditable) | S | |
| T6 | Section image-upload widget (today merchants paste raw URLs) | M | |
| T7 | Cart page theme-rendering + product-page blocks | L | **V1.1** — static cart page is acceptable for launch |

---

## 5. V1 MERCHANT FEATURES

Status legend: ✅ ships as-is · 🔧 ships after listed fix · ⛔ cut from V1.

| Feature | Status | Evidence / fix |
|---|---|---|
| Signup → OTP → password → store creation | ✅ | identity-platform flows real; needs Resend+Turnstile secrets only |
| Dashboard + 5-step setup checklist | ✅ | DashboardClient.tsx:130, driven by real setupStatus |
| Products CRUD + media upload (R2) | ✅ | products routes + upload→R2 real |
| **Variants** | 🔧 LB-5 | UI sends `variants: []`; build matrix-expansion + per-variant price/SKU/stock UI; wire picker→cart `variant_id` |
| Collections (create + **assign products + render**) | 🔧 LB-6 | `collection_products` table has zero write paths; no storefront route |
| Inventory levels/adjustments/reservations | ✅ | RPCs with row locks; reservation inside `create_checkout_order` |
| Orders list/detail/status lifecycle | ✅ | VALID_TRANSITIONS state machine enforced |
| Fulfill with tracking number | ✅ | manual fulfillment works end-to-end |
| **Refunds** | 🔧 LB-3 | Today: no UI anywhere, no provider API call, no step-up challenge UI → refunds 100% blocked (secret IS injected by deploy workflows once the GitHub secret value exists) |
| Order editing | ✅ | VERIFIER-CORRECTED: line-item PATCH **does** recalculate parent totals (orders.ts:1071–1107); prior agent claim refuted — ships as-is |
| Coupons (%, fixed, free-shipping) | ✅ | server-authoritative enforcement in `evaluate_checkout_promotion` with row locks + atomic usage increment — strongest commerce subsystem found |
| Gift cards | ⛔ hide (LB-11) | Issuance writes `gift_cards`; checkout redeems `gift_card_accounts` — every issued code is unredeemable |
| Shipping zones + rates honored at checkout | 🔧 LB-7 | UI/API/DB exist; live checkout RPC hardcodes free/₹99 and ignores them; hosted path trusts client quote |
| Taxes: GST rates + CGST/SGST/IGST engine | 🔧 wire-up | Engine is a complete pure function (checkout-core:793–879) that **nothing calls at confirm** — invoke it in order creation |
| GST e-invoice (IRP) | ⛔ V2 | Hardcoded sandbox; live throws HumanRequiredError |
| Payments: Razorpay (platform keys) + COD | ✅ env | Razorpay session+verify+webhook+ledger real; COD confirmed path real |
| Merchant-entered Razorpay keys | ⛔ V2 | Checkout reads only `c.env.RAZORPAY_*`; merchant keys saved but never used — hide/label the settings pane |
| Payouts: statements + Route release | 🔧 LB-4 | Real Route client + double-release guard + kill-switch; blocked by step-up UI + HR-PA-SPLIT-LIVE |
| Domains: subdomain + custom domain connect | 🔧 LB-1 + env | Domain claim/verify/Vercel-attach code real; dead without middleware + wildcard DNS |
| Theme editor + nav menus | ✅ | wired E2E (§4) |
| Appearance (brand) page | 🔧 T2 | dead island today |
| Analytics (orders/revenue) | ✅ partial | summary real; `revenueByMonth: []` hardcoded — ship with banner or S-fix |
| Notifications settings | ✅ | preferences save; delivery = email only in V1 |
| Staff management | ⛔ V1.1 | invite API exists but acceptance page missing AND role enforcement inert (owner-only gates everywhere) — ship owner-only |
| Plan/billing | ✅ sandbox | free plan only at launch; pricing page already says "Pending"; **fix ₹20/month hardcoded claim at signup** (S) |
| Blog/pages/content | ✅ | real CRUD + storefront render |
| AI sidebar/AI generation | ✅ inert | sandbox templates; no live key; leave |
| Purchase orders / transfers | ⛔ already honest stubs | "not available yet" banners stay |

## 6. V1 CUSTOMER (BUYER) FEATURES

| Feature | Status | Note |
|---|---|---|
| Reach store at `{store}.letbuyy.com` | 🔧 LB-1 | the 3-line middleware file |
| Home / product pages (SSR, JSON-LD, sitemap, robots) | ✅ | quality SEO layer exists |
| Collection browsing | 🔧 LB-6/T3 | absent today |
| Search | 🔧 S | client-side filter only; `/shop?search=` param ignored — wire it (S) |
| Cart (localStorage + server sync) | ✅ | |
| Checkout: address → shipping → Razorpay/COD | ✅ env | inline success screens for Razorpay/COD work; **remove Stripe/PayPal buttons** (LB-2 cut) |
| Coupon entry | ✅ | validate endpoint wired |
| Order confirmation email | ✅ env | Resend + queue path real |
| Account: login, orders, addresses | ✅ | separate shopper session (storefront-issued JWT) |
| Customer password reset | ✅ | VERIFIER-CORRECTED: reset flow exists (`api/customer/set-password` handles `request_reset` + token confirm); prior agent claim refuted — verify email dispatch during pilot |
| Registration path | 🔧 LB-12 | email-not-found dead-ends; add explicit register step (S) |
| Order status + tracking number display | ✅ | account orders page shows 4-step timeline + tracking number |
| Shipped/cancelled/refund emails | 🔧 LB-10 | templates/triggers absent — highest-trust buyer events |
| Wishlist | ✅ partial | IDs only; acceptable V1 |
| Policy pages | ✅ | ContentService-backed; **must add real ToS/Privacy content + fix dead `href="#"` links at signup** (legal) |

## 7. V1 INTERNAL (PLATFORM STAFF) FEATURES

| Capability | Status | Note |
|---|---|---|
| Console auth: email allowlist + TOTP MFA | ✅ | custom but real; env-var allowlist acceptable at V1 scale |
| Merchant 360 (search/view/suspend/restore + SoD + audit) | ✅ | |
| Impersonation | 🔧 V1.1 | token minted+logged but storefront consumer absent — defer |
| **KYC review queue** | 🔧 build-or-ops-manual | merchant KYC submission API exists; staff review surface = zero. V1 options: (a) build console queue (M, 3d) or (b) documented ops-manual via Supabase + decision log. Pick (a) if payouts gate on KYC. Not an order-flow blocker, hence outside LB list. |
| **Staff refund/force-refund tooling** | 🔧 with LB-3 | console has zero refund path; merchant refund UI (LB-3) covers V1; console force-refund = V1.1 |
| Money reconciliation queue (wallet vs ledger, SoD dual-approve) | ✅ | auto-plug P0 confirmed CLOSED at HEAD — resolution is human-only |
| Risk / Trust&Safety dashboards | ✅ read-only | case actions V1.1 |
| Audit logs (paginated, searchable) | ✅ | no diffs/export — acceptable |
| Analytics/MRR/funnel dashboards | ✅ | depends on queue-worker rollups (deployable) |
| Compliance/DSR lifecycle | ✅ | dry-run export acceptable V1 |
| Support tickets | 🔧 ops-manual | `support_tickets` table + Merchant-360 visibility exist; no standalone queue — V1 = shared inbox + table, V1.1 = console page |
| Feature-flag admin | ⛔ V2 | env-var flags fine at V1 scale |
| Marketplace governance actions | ⛔ V2 | decisions live only in frozen ops-portal; moot since app/theme marketplace is closed in V1 |

## 8. V1 TEAM FEATURES

Evidence: platform-side RBAC is **production-quality** (25+ scopes, 4 tiers, break-glass grants, access reviews, SoD checks in `rbac.ts`); merchant-side staff is **inert** (invites enqueue email but no acceptance page exists; `site_memberships/site_roles/site_role_permissions` populated but **no route gates on them** — every sensitive route checks owner-only `verifySiteOwnership`).

**V1 team scope (locked):**
- Platform staff: allowlist + TOTP login, scope-based permissions, break-glass — **ships as-is**.
- Merchant side: **owner-only**. Hide the staff/users settings page or mark "coming soon" (S). Defer to V1.1: invite acceptance page, role enforcement wiring (`resolveTenantAccessProfile` → route gates), dual-control invocation (today `checkSegregationOfDuty` is defined but not called in the refund path — wire when staff exist).

---

## 9. LAUNCH BLOCKERS

### 9.A Code blockers (all must close before GA; sizes: S<1d, M=1–5d)

| # | Blocker | Size | Evidence |
|---|---|---|---|
| LB-1 | **Create `apps/storefront-runtime/src/middleware.ts`** re-exporting `proxy` — subdomain + custom-domain routing is dead code today | **S** | no middleware.ts; nothing imports proxy.ts; vercel.json/next.config don't substitute |
| LB-2 | **Cut Stripe/PayPal/Cashfree from checkout UI** (Stripe success page is hardcoded always-error; PayPal webhook has no signature verification; Cashfree never exposed) | **S** | checkout/success/page.tsx never reaches success; payments.test.ts:113 asserts PayPal verify absent |
| LB-3 | **Refund chain**: Razorpay refund API call + merchant refund UI + step-up (TOTP) challenge UI. Backend step-up crypto + `step_up_challenges` table + challenge endpoint already exist; the entire frontend layer is missing. Secret is injected by deploy workflows (prod line 318) once the GitHub secret value is provisioned (H-2) | **M, 5–8d (verifier-sized)** | refund route 428s without step-up token; zero `step_up` references in MCP; API only records pre-existing `provider_refund_id` |
| LB-4 | **Payout release UI**: same step-up UI (shared with LB-3) + `RAZORPAY_ROUTE_PROVIDER_ENABLED` flow | **shared w/ LB-3** | payouts.ts:576 step-up gate |
| LB-5 | **Variant write path (verifier-confirmed worst code gap)**: cartesian matrix builder UI + a `POST /products/:id/variants` API (doesn't exist) + storefront picker→cart `variant_id` resolution. Multi-option products are currently non-purchasable as variants | **M, 6–9d (verifier-sized)** | new/page.tsx:528 `variants: []`; cart-context.tsx:93 `variant_id: null`; no variant-write endpoint in products.ts |
| LB-6 | **Collections E2E**: product-assignment API+UI; public collection-by-slug endpoint; `/collections/[slug]` storefront route + section | **M, 4–5d** | `collection_products` has zero write paths; no collection route exists |
| LB-7 | **Honor merchant shipping rates at checkout** (replace hardcoded free/₹99 in `create_checkout_order`; kill client-trusted `shipping_quote` on hosted path) | **M** | RPC hardcodes; checkout.ts:513 stores client blob verbatim |
| LB-8 | **AnnouncementBar renderer** (every new store's first element is a broken placeholder) | **S** | schema + default template exist; no component/registry entry |
| LB-9 | **Appearance bridge** (colors/font/radius/CSS/logo/favicon → actually applied on storefront) | **M** | storefront never reads `site_settings` blob |
| LB-10 | **Buyer lifecycle emails**: shipped (with tracking), cancelled, refunded | **S–M** | only order-confirmation email exists; templates absent |
| LB-11 | **Hide gift cards page + dead marketplace links** (apps.letbuyy.com / themes.letbuyy.com buttons) | **S** | split-table bug makes issued codes unredeemable |
| LB-12 | **Explicit shopper registration step** (email-not-found currently dead-ends; reset flow already exists — verifier-corrected) | **S** | account sheet `not_found` state has no register action |
| LB-13 | **Security trio**: `/storefront/directory` merchant-email leak; `assertProviderPaymentNotReplayed` on storefront verify; checkout/customer-login per-IP rate limits | **S** | public-routes.ts:267 service-role join exposes emails; replay guard only on merchant route |

*Removed after verification: "freeze order editing" — the PATCH handler already recalculates parent totals (orders.ts:1071–1107); prior agent claim refuted.*

Also in the V1 code track (not E2E-blocking, but pre-GA): fix ₹20/month signup copy + dead ToS/Privacy anchors (S, legal); patch `production-deploy.yml` to inject Razorpay secrets into Workers (S — staging does, production doesn't); `compare_at_price` column mismatch (select silently nulls — S); `bogo` coupon type 500s (block type at API — S); GST engine invocation at order creation (M, with LB-7).

### 9.B Human/env blockers (no code; the repo cannot close these)

| # | Track | Detail |
|---|---|---|
| H-1 | **B1: push to origin** + branch protection — origin still ships the takeover & 3% rake; zero CI deploy has ever fired | the single highest-leverage action; arms FC-02 freeze cert |
| H-2 | **32 production GitHub secrets** (release-preflight enumerates them) incl. Razorpay live keys+webhook secret, `STEP_UP_SIGNING_SECRET`, `CUSTOMER_SESSION_SECRET`, `PAYMENT_CONFIG_ENCRYPTION_KEY`, identity JWK | `scripts/github/set-secrets.mjs` |
| H-3 | **DNS**: `letbuyy.com` zone, wildcard `*.letbuyy.com` → storefront, api/webhooks/bff worker domains, `connect.letbuyy.com` CNAME target | `infrastructure/dns/letbuyy_com.tf` does not exist yet |
| H-4 | **Production Supabase** project + `supabase db push` (98 migrations) via the gated workflow | encrypted backup step already built |
| H-5 | **HR-SECRET-ROTATION**: 9 per-caller secrets + keyring blobs, then flip `INTERNAL_AUTH_LEGACY_ACCEPT=false` | keyring code + validator landed (B7a–c); rotation unexecuted |
| H-6 | **Resend live**: domain SPF/DKIM/DMARC + `LETBUYY_EMAIL_MODE=live` | emails silently no-op until set |
| H-7 | **Turnstile live keys** (identity + mobile proxy path) | fails closed without |
| H-8 | **HR-PA-SPLIT-LIVE**: Razorpay Route onboarding for payout split | blocks real merchant payouts, not orders |
| H-9 | **Legal**: real ToS/Privacy/DPDP posture + pricing truth | GO/NO-GO row 8, founder sign-off |

Deliberately NOT blockers (deferred with evidence): carrier live creds (V1 = manual fulfillment), WhatsApp WABA/DLT (V1 = email), KYC live provider (V1 = manual review), GST IRP, FCM/APNs, KMS, OIDC/Hydra, warehouse/AI-model rows.

---

## 10. V2 DEFERRED FEATURES

**Zero-work deferrals (already gated/inert at HEAD):** Liquid rendering (flag false), GraphQL (flag false), extensions/Wasm runtime (flag false), AI credit purchase (hard 501 — B6), OIDC provider (501 skeleton), magic link & passkeys (flags off), app-marketplace / developer-portal / theme-marketplace / platform-operations-portal (frozen manifests, no deploy config), 6 reserved services (manifest-only), smart collections (no engine), automation/workflows, B2B, POS, subscriptions/recurring (don't exist), multi-currency (INR hardcoded), abandoned-cart (queue job has no consumer — dead-letters silently), marketing campaigns (backend exists, no UI surface).

**Small-work deferrals (hide a surface):** gift cards (LB-11), merchant staff settings page, merchant-own Razorpay keys pane, Stripe/PayPal buttons (LB-2), dead marketplace links, purchase-orders/transfers (already honest stubs), Business-details/Localization/Security-2FA/Custom-data settings (already `BackendNeededPane`).

**Genuine V2 roadmap (in priority order, from evidence of demand inside the code):** 1) Shiprocket live + carrier webhooks + label purchase; 2) WhatsApp (DLT-registered templates) + COD confirmation loop; 3) merchant staff roles + invite acceptance + dual-control wiring; 4) merchant mobile app (push via FCM/APNs + store signing); 5) merchant-own payment accounts; 6) Liquid theme engine + second theme; 7) KYC live provider; 8) GST e-invoice IRP; 9) app store + extensions + ops-portal unfreeze; 10) GraphQL/OIDC for integrations; 11) subscription-revenue ledgering + Razorpay settlement-file ingestion; 12) analytics pipeline.

---

## 11. LAUNCH COMPLETION %

Per-domain, V1-scope-adjusted (post-cuts), weighted by launch criticality:

| Domain | Raw audit % | V1-scoped % | Weight | Notes |
|---|---|---|---|---|
| Identity (merchant core) | 58 | 85 | 10 | cuts: OIDC/passkeys/magic-link out |
| Merchant admin | 68 | 72 | 15 | refund UI + variant builder are the gap |
| Storefront | 52 | 60 | 15 | middleware + collections + appearance |
| Checkout & payments | 45 | 70 | 15 | Razorpay+COD only; refund chain pending |
| Catalog | 52 | 60 | 10 | variants + collections |
| Orders & customers | 62 | 70 | 10 | emails + reset + edit-freeze |
| Money spine | 72 | 78 | 10 | strongest domain; recon human-loop ready |
| Shipping/tax (manual fulfillment scope) | 32 | 55 | 5 | rates-honored fix + GST invocation |
| Internal ops + team (V1 scope) | 67 | 75 | 5 | KYC queue is the gap |
| Notifications (email-only scope) | 30 | 55 | 5 | 3 missing templates |
| **WEIGHTED TOTAL** | | **≈ 68%** | 100 | **~62% if env/DNS/secrets provisioning is included as scope** |

## 12. ESTIMATED REMAINING WORK

**Code track (~38–48 dev-days, verifier-adjusted):** LB-1 0.5 · LB-2 1 · LB-3+4 5–8 · LB-5 6–9 · LB-6 4–5 · LB-7+GST 4 · LB-8 1 · LB-9 3 · LB-10 2 · LB-11 0.5 · LB-12 1 · LB-13 1 · T3/T4 theme templates 4 · search wire-up 1 · marketing copy/legal pages 1 · prod-deploy Razorpay patch + misc S-bugs 2 · integration/E2E hardening buffer 5.
→ **2 engineers ≈ 5–6 calendar weeks.** (Fallback if the schedule slips: ship V1.0.0 single-variant-only and move LB-5 to v1.0.1 — the only ≥6-day item.)

**Human/provisioning track (parallel, ~2–3 calendar weeks):** H-1…H-9 (§9.B). Longest lead items: Razorpay Route onboarding (H-8) and Resend domain auth (H-6).

**Pilot track (after deploy): 2–3 weeks** — 5–10 real merchants, GO/NO-GO rows 1–16 from LAUNCH_READINESS (already written), invariants I1–I8 run against prod DB (runner fixed by B5 but **still not wired into CI — wire it during pilot**).

**Total: ~8–9 weeks from today with 2 engineers + 1 founder-operator. A 60-day (8.5-week) V1.0.0 is feasible with zero scope additions.**

---

## 13. THE 60-DAY ANSWER

**What EXACTLY ships in LetBuyy v1.0.0:** the §2 table. One theme, one country, one currency, Razorpay+COD, manual fulfillment, email notifications, 0% commission, owner-only merchants, staffed console. 9 runtimes deployed behind the already-built gated production pipeline.

**What EXACTLY does not ship:** everything in §10 — most of it is *already* off at HEAD; V1 discipline is mostly refusing to turn things on, plus ~6 small hide-this-surface commits.

**Shortest path from current repository state to first real merchants and first real orders:**

1. **Week 0 (days 1–3):** LB-1 middleware file + LB-2 provider cut + LB-13 security trio + prod-deploy Razorpay patch. Human: B1 push + branch protection; start DNS, Supabase prod, Razorpay live, Resend, Turnstile.
2. **Weeks 1–2:** LB-3/4 refund+payout step-up chain; LB-10 emails; LB-12 registration step; LB-11 hides. Human: 32 secrets; HR-SECRET-ROTATION; legal pages.
3. **Weeks 3–4:** LB-5 variants; LB-6 collections; LB-7 shipping/GST; LB-8/9 theme fixes; T3/T4 templates. Deploy to staging continuously through the gated workflow.
4. **Weeks 5–6:** first production deploy (the workflow already enforces governance-gate → preflight → migration → staging-E2E → backup → deploy → smoke). G4 go-live probes (takeover denial, anon-order denial, `commission_bps=0`). Onboard 5 pilot merchants with COD + Razorpay test-to-live.
5. **Weeks 7–8:** pilot hardening, invariants-in-CI, KYC queue or ops-manual decision, GO/NO-GO sign-offs → **v1.0.0 tag**.

First real COD order is achievable in **week 1 on staging** (LB-1 + secrets is sufficient); first real production order in **week 5–6**; v1.0.0 GA at **day ~60**.

---

*Verification: every load-bearing claim was re-tested by 2 independent verifier agents — 9 confirmed, 3 nuanced, 2 refuted-and-corrected in this document (shopper password reset exists; order-edit totals are recalculated). Verifiers also re-sized the 3 largest blockers (refund 5–8d, variants 6–9d, collections 4–5d) and found the Flutter CI merge-gate coupling.*

*Sources: 22 agent reports against HEAD `1a14a802`; prior-program reconciliation (FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12, FOUNDATION_CLOSURE_2026_06_12, LAUNCH_READINESS_2026_06_12) with all load-bearing claims re-verified in code. Conflicts resolved in favor of direct code reads at HEAD. Key conflict resolutions: (1) two checkout paths exist — the live storefront path is `POST /storefront/:subdomain/orders` → `create_checkout_order` RPC (reserves inventory atomically, hardcodes shipping); the hosted `/v1/checkout/*` path validates pre-existing reservations and trusts client shipping quotes; (2) COD remittance DOES post the canonical ledger via migration-165 RPC (collection phase intentionally pre-ledger); (3) step-up auth is REAL (HMAC implementation), contradicting older "placeholder" audits — the gap is the unprovisioned secret and missing challenge UI; (4) reconciliation auto-plug P0 is CLOSED at HEAD (human-only resolution with SoD).*
