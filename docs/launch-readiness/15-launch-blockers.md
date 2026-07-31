# Launch Blockers

**Date:** 2026-06-19  
**Source:** LCIS `/api/decision-v2`, `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md`, `CAPABILITY_BACKLOG.md`, `ACTUAL_STATE.md`  
**Verdict:** NO-GO — 5 code blockers + 9 human seams

---

## CRITICAL Code Blockers (must fix before launch)

### LB-8 — Announcement Bar
**Severity:** 🔴 Critical  
**Status:** Missing + governance-trapped  
**Effort:** ~1 day (after governance decision)

**Evidence:**
- `renderer-registry.tsx:56-203` — no `announcementBar` case in the renderer registry
- `renderer-registry.tsx:243-275` — unrecognized sections fall through to `UnknownSectionFallback`
- `no-new-react-sections-validator.mjs:9-40` — freezes React sections at 20, blocks adding `announcementBar` as a new React section
- Liquid is off in production (`wrangler.toml:245`: `FEATURE_LIQUID="false"`)

**Decision required BEFORE any code:**
- Option 1 (Recommended): Fold announcement bar into the existing `header.tsx` section — no new React section file, no freeze violation. ~1 day.
- Option 2: ARB approval to add new React section — governance change, needs founder sign-off
- Option 3: Liquid activation for this section — forbidden without ARB + production canary

**Impact if not fixed:** Common storefront element renders as broken fallback. Merchants cannot use the announcement bar.

---

### LB-9 — Appearance Bridge (Dead Island)
**Severity:** 🔴 Critical  
**Status:** Missing (writes without reads)  
**Effort:** ~2–3 days + 1 migration (mig 171)

**Evidence:**
- Appearance page WRITES to `sites.site_settings`: `stores.ts:701-711`
- Storefront SELECT omits `site_settings`: `storefront.ts:345`
- `mapSupabaseToStore` ignores `site_settings`: `store-service.ts:575-588`
- Storefront layout DOES apply theme-bundle `themeSettings` → `:root` CSS vars: `layout.tsx:106-160`

**Fix:** Add `site_settings` to `STOREFRONT_SITE_SELECT` + merge into `themeSettings` in `mapSupabaseToStore`. The CSS variable layer is already wired.

**Impact if not fixed:** All merchant appearance customizations (colors, fonts, brand settings) are stored but never applied. The storefront looks like the default theme regardless of what the merchant configured.

---

### LB-12 — Shopper Registration (Dead Button)
**Severity:** 🔴 Critical  
**Status:** Broken — button calls setPassword with no resetToken  
**Effort:** ~1–2 days

**Evidence:**
- `account-bottom-sheet.tsx:128` — "Create Account" button
- `account-bottom-sheet.tsx:372-413` — email-not-found dead-ends with no register path
- `customer-auth-context.tsx:145-147` — `setPassword()` called without resetToken
- `set-password/route.ts:35` — route rejects requests without valid resetToken
- `auto-create/route.ts:17` — `findOrCreateCustomer` backend function exists and is reusable

**Fix:** Add explicit register branch reusing `findOrCreateCustomer`; fix resetToken mismatch; preserve customer/merchant session separation (already intact).

**Impact if not fixed:** New customers cannot create accounts. They can only get an auto-created account by placing an order first. This is a poor UX for any commerce platform.

---

## HIGH Blockers

### LB-10 — Lifecycle Emails (Partial)
**Severity:** 🟠 High  
**Status:** Partially implemented  
**Effort:** ~2 days (+ H6 Resend for live delivery)

**Evidence:**
- `order_shipped` template EXISTS: `notification-core/src/index.ts:329`
- `order.fulfilled → order_shipped` mapping EXISTS: `notification-core/src/index.ts:392`
- `order_cancelled` event EXISTS: `orders.ts:52-55,436-437`
- `order_refunded` event EXISTS: `orders.ts:1317`
- NO `order_cancelled` email template — event dispatches but nothing sends
- NO `order_refunded` email template — same
- CAP-C18: Resend adapter wired, runs when `RESEND_API_KEY` configured

**Fix:** Add `order_cancelled` + `order_refunded` templates; verify `order_shipped` carries tracking number; ensure idempotent queue dispatch.

**Impact if not fixed:** Customers receive no notification when their order is cancelled or refunded. This creates support ticket volume and poor trust.

---

### LB-7 — Shipping Rates + GST (Validated, Uncommitted)
**Severity:** 🟡 Medium (code is done, just needs commit)  
**Status:** Validated 28/28, UNCOMMITTED due to `git index.lock` in sandbox  
**Effort:** 1 human commit in a real environment

**Evidence:**
- `LB7_CERTIFICATION.md` — "lb7 28/28; launch suite 75/75; federation 3/3; api-gateway tsc 0; gate green on all validators EXCEPT untracked-170"
- `170_v1_shipping_rates_gst.sql` — migration exists, untracked (not committed)
- `services/api-gateway/src/lib/shipping-rate-resolver.ts` — shipping rate resolution implemented
- Sequential migration validator fails on untracked migration 170 → gate shows 106/107 not 107/107

**Fix:** In a real git environment (not this sandbox): `git add database/supabase/migrations/170_v1_shipping_rates_gst.sql && git commit -m "v1-launch-b5: LB-7 shipping rates + GST"`

**Impact if not fixed:** No computed shipping cost at checkout. No GST calculation. Checkout totals are missing a component.

---

## MEDIUM Blockers

### LB-11 — Dead Surfaces (Low Risk, Quick Fix)
**Severity:** 🟠 Medium  
**Status:** Identified, not hidden  
**Effort:** ~0.5 days

**Evidence:**
- Gift cards nav + page active in merchant admin: `merchantNavigation.ts:93`
- Gift cards issue to wrong table: `products.ts:1062` writes `gift_cards`; checkout redeems `gift_card_accounts` — issued codes unredeemable
- Dead marketplace links: `apps/page.tsx:42,84,88` → frozen `apps.letbuyy.com`
- Dead theme links: `AppsSettingsClient.tsx:26,148,198`, `themes/page.tsx:458,498` → frozen `themes.letbuyy.com`

**Fix:** Hide gift-cards nav+page (keep the route for now); remove/guard the 5 dead marketplace/theme links.

**Impact if not fixed:** Merchants can navigate to broken/frozen surfaces and receive confusing 404s or broken functionality.

---

## Human Seams (no code can close these)

| # | Seam | Owner | Dependency | Risk | Timeline |
|---|---|---|---|---|---|
| **C0** | Clear `git index.lock` + commit LB-7 in real env | Engineer | Real git checkout | Low | Immediate |
| **H1** | Push to origin + set branch protection | Eng lead | C0 | Medium | Day 1 |
| **H2** | 32 production secrets (Razorpay live, STEP_UP_SIGNING_SECRET, CUSTOMER_SESSION_SECRET, identity JWK, CHECKOUT_SIGNING_SECRET, etc.) | Founder + Eng | Razorpay, Resend, Turnstile accounts | **High** | Weeks |
| **H3** | DNS + wildcard `*.letbuyy.com` configured | Founder | Domain registrar | **High** | Days |
| **H4** | Production Supabase provisioned + all 186 migrations applied | Engineer | H1 | **High** | Days |
| **H5** | Secret rotation → flip `INTERNAL_AUTH_LEGACY_ACCEPT=false` | Engineer | H2 | Medium | Week 2 |
| **H6** | Resend live email (SPF/DKIM/DMARC + `LETBUYY_EMAIL_MODE=live`) | Founder | H3 (DNS) | Medium | Weeks |
| **H7** | Turnstile live keys provisioned | Founder | — | Medium | Days |
| **H8** | Razorpay Route onboarding (PA split) | Founder | Razorpay business account | **High** | Weeks |
| **H9** | Legal ToS / Privacy / DPDP posture + pricing truth | Founder + Legal | — | Medium | Weeks |

---

## Capability Gaps (live certification required)

| ID | Gap | When Required |
|---|---|---|
| CAP-C01 | Live capture-ledger certification | Before 1st paid order |
| CAP-C02 | Live refund-ledger certification | Before 1st refund |
| CAP-C03 | Live payout provider certification | Before 1st payout |
| CAP-C04 | Live money reconciliation certification | Before 100 merchants |
| CAP-C06 | Live step-up certification | Before refunds/payouts go live |
| CAP-C09 | Mobile Turnstile live (merchant app) | Before mobile app launch |
| CAP-C10 | Live alert delivery drill | Before launch |
| CAP-C11 | Live tenant red-team probes (staging) | Before launch |
| CAP-C16 | Live carrier integration (Shiprocket) | V1.1 |
| CAP-C18 | Live email dispatch (Resend) | Tied to H6 |

---

## Path to GO

```
Week 1: 
  → Decide LB-8 approach (Option 1: header-fold)
  → Implement LB-11 (0.5d) + LB-8 (1d) + LB-10 (2d)

Week 2:
  → Implement LB-9 (2-3d) + LB-12 (1-2d)
  → Commit LB-7 in real env (C0)
  → Push to origin (H1)

Parallel (Weeks 1-6):
  → H2: Provision all secrets
  → H3: DNS wildcard
  → H4: Production Supabase + migrations
  → H7: Turnstile
  → H8: Razorpay Route onboarding
  → H9: Legal

Weeks 3-8:
  → Staging environment setup
  → Live certifications (CAP-C01..C11)
  → Pilot program (5 merchants)
  → Money certification (Phase D, 12 scenarios + 7-day clean soak)

September:
  → Launch readiness certification
  → October 1 launch
```

**Total code remaining: ~7–9 dev-days**  
**Total human seams: parallel 6–10 week work**  
**Critical path: staging environment (H4) → pilot → certifications → launch**
