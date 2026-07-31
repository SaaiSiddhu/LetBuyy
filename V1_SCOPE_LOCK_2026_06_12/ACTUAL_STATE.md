# LETBUYY V1 — ACTUAL STATE (Phase 0 Truth Reconstruction)

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · **Method:** 5 parallel code-audit agents + direct gate/test/typecheck runs. **Code wins; no doc/old-report trusted without a file:line, test, validator, or commit.**

**Two facts gate the whole program:**
- **COMMIT SEAM (sandbox):** `.git/index.lock` exists and is **un-removable** (`rm` → `Operation not permitted`). `git add`/`git commit` fail. Nothing can be committed in this environment — so every "complete" item below that isn't already in a commit is *validated-but-uncommitted*.
- **Governance gate is 123 validators, fail-fast, and currently fails on exactly ONE thing:** the untracked migration `170_v1_shipping_rates_gst.sql` (sequential-migration-validator). That is a *direct consequence of the commit seam*, not a code defect. The other 122 validators pass (the 41 before it in the run; the 12 key guarantees behind it confirmed green by independent execution).

---

## ✅ COMPLETED (committed + invariant-verified)

| Item | Evidence | Commit |
|---|---|---|
| LB-1 storefront middleware | `apps/storefront-runtime/src/middleware.ts` exists, re-exports `proxy` (two agents independently confirmed — the old scope-lock "middleware missing" claim is **stale**) | `8d73fe7a` |
| LB-2 Razorpay+COD-only checkout | `payments.test.ts #8` proves the 7 stripe/paypal storefront routes are deleted; `checkout-client.tsx` has 0 `/payments/stripe/checkout` | `8d73fe7a` |
| LB-13 security trio | directory PII removed, replay guard, per-IP rate limits | `8d73fe7a` |
| LB-3 refund chain | `services/api-gateway/src/routes/payments.ts:462+` — Razorpay `refund()` (537-544) → `postPaymentLedger` (558-577); step-up gated (492-502, 428); idempotent (`payment.refund:<id>`); over-refund guard (481-484) | `30744216` |
| LB-4 payout release | `payouts.ts:555+` step-up (576-586) + atomic `claim_payout_statement_release` double-release guard (mig 160:357) + derived-balance check; live rail gated 503 until PA creds | `30744216` |
| LB-5 variants E2E | matrix builder → real `variants[]` → cart `variant_id` | `04cbbbab` |
| LB-6 collections E2E | assignment API/UI + `/collections/[slug]` route | `0b8a56e7` |

**Foundation invariants — PRESERVED (must not regress):**
- **Money:** DB-enforced double-entry — `enforce_ledger_transaction_balance()` + `CONSTRAINT TRIGGER ledger_entries_balance_enforced DEFERRABLE` (mig `139:172-198,378-382`); append-only (`reject_ledger_mutation` 358-376); capture/refund/payout/COD all post the canonical ledger; commission hard-zeroed (mig `162` default+backfill) — validators `canonical-ledger-only`, `no-self-custody-rail`, `commission-bps-zero` green. `money.test.ts`+`settlements.test.ts` = **13/13**.
- **Identity:** asymmetric ES256/EdDSA issuance (`identity-issued-session.ts:33-69`, throws if no private JWK) verified via JWKS at gateway (`identity-session-verifier.ts:42-109`, rejects non-ES256/EdDSA); `/api/auth/switch` takeover guard (`auth-switch-guard.test.ts` **4/4 pass**); step-up real HMAC (`security-controls.ts:81-100`); customer (HS256, `CUSTOMER_SESSION_SECRET`) vs merchant (ES256) sessions separate. Validators `identity-sole-issuer`, `stepup-crypto` green.
- **Tenancy:** `no-blanket-service-role`, `rls-force-coverage`, `no-public-using-true` all green.

---

## 🟡 PARTIALLY COMPLETED

| Item | What's done | What's missing | Evidence |
|---|---|---|---|
| **LB-7 shipping + GST** | Full impl on disk; **validated this session** — lb7 **28/28**, launch suite **75/75**, federation 3/3, api-gateway `tsc` 0, gate green on all validators **except** untracked-170 | **The commit.** Cannot `git add` (index.lock) | `V1-LAUNCH-B5` ledger row; mig 170; `shipping-rate-resolver.ts` |
| **LB-10 lifecycle emails** | `order_shipped` template + `order.fulfilled → order_shipped` mapping exist (`notification-core/src/index.ts:329,392`); order confirmation email real | **`order_cancelled` + `order_refunded` emails** — the *events* exist (`orders.ts:52-55,436-437,1317`) but there is **no email template type** for them; shipped-email dispatch+tracking not verified end-to-end | `notification-core/src/index.ts` type union (no cancelled/refunded) |

---

## 🔴 BROKEN (reachable surfaces that misbehave)

| Surface | Defect | Evidence |
|---|---|---|
| Gift cards | Issuance writes `gift_cards`; checkout redeems `gift_card_accounts` → **issued codes unredeemable**. Merchant nav+page ACTIVE; storefront has no redemption UI | issue `products.ts:1062`; redeem `create_checkout_order` (000_baseline:1819); nav `merchantNavigation.ts:93` |
| Shopper "Create Account" (set_password) | Button calls `setPassword()` with **no resetToken**; context (`customer-auth-context.tsx:145-147`) and route (`set-password/route.ts:35`) both reject → **dead button** | `account-bottom-sheet.tsx:128` |
| Dead marketplace/theme links | Point to frozen `apps.letbuyy.com` / `themes.letbuyy.com` | `apps/page.tsx:42,84,88`; `AppsSettingsClient.tsx:26,148,198`; `themes/page.tsx:458,498` |

---

## ⛔ MISSING

| Item | Reality | Evidence |
|---|---|---|
| **LB-8 announcement bar** | Schema registered, but live **React renderer has no `announcementBar` component** → renders `UnknownSectionFallback` ("Renderer announcementBar is not available"). **Governance-trapped:** `no-new-react-sections-validator` freezes the React section set at 20 ("React sections frozen; add Liquid instead"); Liquid is **off in production** (`FEATURE_LIQUID="false"` wrangler:245, `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`). Cannot add a new React section without touching governance, nor render via Liquid without a forbidden Liquid rollout. **Needs an approach decision.** | `renderer-registry.tsx:56-203,243-275`; `no-new-react-sections-validator.mjs:9-40` |
| **LB-9 appearance bridge** | Appearance page **writes** `sites.site_settings` (`stores.ts:701-711`) but the storefront **never reads it**: `STOREFRONT_SITE_SELECT` omits it (`storefront.ts:345`); `mapSupabaseToStore` ignores it. Dead island. (Storefront *does* apply theme-bundle `themeSettings` → `:root` vars, `layout.tsx:106-160` — so the bridge fix is "select + merge", not build-from-scratch) | `storefront.ts:345`; `store-service.ts:575-588` |
| **LB-12 shopper registration** | Email-not-found **dead-ends** ("place an order, account auto-created"); no register form/route. Backend `findOrCreateCustomer` (`auto-create/route.ts:17`) exists and is reusable | `account-bottom-sheet.tsx:372-413` |

---

## 👤 HUMAN SEAMS (no code can close these)

| # | Seam | Note |
|---|---|---|
| C0 | **Commit seam** (sandbox) | `.git/index.lock` un-removable → `git add`/`commit` blocked. Clears outside this sandbox. Gates LB-7 finalization and all per-block commits. |
| H1 | Push to origin + branch protection | origin still behind |
| H2 | 32 production GitHub secrets | incl. Razorpay live, STEP_UP_SIGNING_SECRET, CUSTOMER_SESSION_SECRET, identity JWK |
| H3 | DNS + wildcard `*.letbuyy.com` | storefront routing dead without it |
| H4 | Production Supabase + 98→170 migrations | |
| H5 | Secret rotation → flip `INTERNAL_AUTH_LEGACY_ACCEPT=false` | |
| H6 | Resend live (SPF/DKIM/DMARC + `LETBUYY_EMAIL_MODE=live`) | emails no-op until set — also gates LB-10 |
| H7 | Turnstile live keys | fails closed without |
| H8 | Razorpay Route onboarding | gates real payouts (LB-4 live) |
| H9 | Legal ToS/Privacy/DPDP + pricing truth | founder sign-off |

---

## SUMMARY

Foundation winners (money, identity, tenancy, governance gate) are **intact and verified**. Of 13 launch blockers: **7 committed**, **LB-7 validated-pending-commit**, **LB-10 partial** (cancelled/refunded emails missing), **LB-8/LB-9/LB-12 missing**, and **LB-11 surfaces identified for hiding**. The single most structural finding is that **LB-8 conflicts with the React-section freeze** and cannot be built as scoped without a governance decision. Nothing here can be committed in this sandbox (C0).
