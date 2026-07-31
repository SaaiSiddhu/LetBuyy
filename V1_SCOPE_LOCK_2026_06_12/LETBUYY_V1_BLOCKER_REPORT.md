# LETBUYY V1 — BLOCKER REPORT

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · **Recommendation: 🔴 NO-GO**

This is the Phase 9 *"otherwise"* output: not all of LB-7…LB-12 are complete, so per the program's own stop condition a blocker report — not a certification — is generated. Every blocker cites code. Foundation winners (money, identity, tenancy, the 123-validator gate) are **intact and verified** (see `ACTUAL_STATE.md`); the blockers below are launch-scope completion + two structural seams.

## Why NO-GO (one line)

LB-8, LB-9, LB-12 are missing and LB-10 is partial; LB-7 and all future work **cannot be committed in this environment** (`.git/index.lock` un-removable); and **LB-8 as scoped conflicts with the React-section freeze**, requiring a human governance decision before any code is written.

---

## A. CODE BLOCKERS

| # | Blocker | Severity | Status | Evidence | What's required |
|---|---|---|---|---|---|
| **LB-7** | Shipping rates + GST | 🟡 | **Validated, UNCOMMITTED** | `LB7_CERTIFICATION.md`; lb7 28/28; gate green except untracked-170 | One human commit (C0). No code left. |
| **LB-8** | Announcement bar | 🔴 | **Missing + governance-trapped** | `renderer-registry.tsx:56-203` (no `announcementBar` → `UnknownSectionFallback` 243-275); `no-new-react-sections-validator.mjs:9-40` freezes 20 React sections; Liquid off in prod (`wrangler.toml:245`) | **DECISION REQUIRED — see §B.** Then ~1 day. |
| **LB-9** | Appearance bridge | 🔴 | **Missing (dead island)** | writes `sites.site_settings` (`stores.ts:701-711`); storefront never reads it (`storefront.ts:345` select omits it; `mapSupabaseToStore` ignores it) | Bridge: add `site_settings` to `STOREFRONT_SITE_SELECT` + merge into `themeSettings` in `mapSupabaseToStore` → `:root` vars already consume it (`layout.tsx:106-160`). ~2–3 days incl. tests. |
| **LB-10** | Lifecycle emails | 🟠 | **Partial** | `order_shipped` template + `order.fulfilled→order_shipped` map exist (`notification-core/src/index.ts:329,392`); **no** `order_cancelled`/`order_refunded` email type (events exist `orders.ts:52-55,1317`) | Add cancelled + refunded templates + queue dispatch; verify shipped email carries tracking; idempotent. ~2 days. **Live delivery gated by H6 (Resend).** |
| **LB-11** | Hide dead surfaces | 🟠 | **Identified, not hidden** | gift-cards nav+page (`merchantNavigation.ts:93`; issues unredeemable codes — `products.ts:1062` vs `gift_card_accounts`); dead marketplace/theme links (`apps/page.tsx:42,84,88`; `AppsSettingsClient.tsx:26,148,198`; `themes/page.tsx:458,498`) | Hide gift-cards nav+page; remove/guard the 5 dead marketplace/theme links (keep live `accounts.letbuyy.com`). ~0.5 day. Low risk. |
| **LB-12** | Shopper registration | 🔴 | **Missing + a broken button** | email-not-found dead-ends (`account-bottom-sheet.tsx:372-413`); `set_password` "Create Account" sends no resetToken → rejected (`customer-auth-context.tsx:145-147`, `set-password/route.ts:35`) | Add explicit register branch reusing `findOrCreateCustomer` (`auto-create/route.ts:17`); fix resetToken mismatch; preserve customer/merchant session separation (intact). ~1–2 days. |

**Remaining code ≈ 7–9 dev-days** (LB-8 contingent on the §B decision), plus the LB-7 commit.

---

## B. STRUCTURAL DECISION REQUIRED — LB-8 vs the freeze

The prompt says "build LB-8 Liquid-rendered / Liquid remains winner" **and** "do not introduce Liquid rollout / treat foundation frozen / preserve governance guarantees." In the live repo these conflict: production renders **React**, the announcement bar has **no React component**, and `no-new-react-sections-validator` **forbids adding one**. Three honest options — pick one before any LB-8 code:

1. **Fold the announcement bar into the existing (frozen-allowed) `header` section** — render the strip inside `header.tsx` driven by the `announcementBar` schema/settings. Avoids a *new* React section file, so the freeze validator is not tripped and no governance change is made. **Recommended** — smallest blast radius, no new architecture, no Liquid rollout.
2. **Turn Liquid on for this section** — requires flipping `FEATURE_LIQUID`/`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`, which is an **ARB-gated V2 action** and explicitly forbidden by the prompt. Rejected unless ARB approves.
3. **Amend `no-new-react-sections-validator` to admit a 21st section** — a *governance change* (the prompt says "do not create new governance systems / preserve guarantees"). Allowed only with explicit owner sign-off recorded.

This is a launch-director decision, not an implementation detail. It is logged here rather than resolved unilaterally.

---

## C. HUMAN SEAMS (Phase 8) — none are code; do not mark complete

| # | Seam | Required action | Owner | Dependency | Risk | Launch impact |
|---|---|---|---|---|---|---|
| **C0** | **Commit seam (sandbox)** | clear `.git/index.lock`; `git add` + commit LB-7 (and any LB-8…12) | engineer at a real checkout | none | low | **Blocks every per-block commit** the program mandates; blocks LB-7 finalization |
| H1 | Push to origin + branch protection | push, protect `main` | eng lead | C0 | med | origin stays behind until done |
| H2 | 32 production secrets | set Razorpay live, STEP_UP_SIGNING_SECRET, CUSTOMER_SESSION_SECRET, identity JWK, etc. | founder/eng | Razorpay, Resend, Turnstile accounts | **high** | money + auth fail closed without |
| H3 | DNS + wildcard `*.letbuyy.com` | create zone + records | founder | domain | high | **storefront unreachable** without |
| H4 | Production Supabase + migrations 000→170 | provision + `db push` | eng | C0/H1 | high | no prod DB = no launch |
| H5 | Secret rotation → `INTERNAL_AUTH_LEGACY_ACCEPT=false` | rotate per-caller secrets | eng | H2 | med | internal-auth hardening |
| H6 | Resend live (SPF/DKIM/DMARC, `LETBUYY_EMAIL_MODE=live`) | domain auth | founder | DNS | med | **all email no-ops** (gates LB-10) |
| H7 | Turnstile live keys | provision | founder | none | med | login/signup fail closed |
| H8 | Razorpay Route onboarding | PA split onboarding | founder | Razorpay | high | **real payouts blocked** (LB-4 live) |
| H9 | Legal ToS/Privacy/DPDP + pricing truth | author + sign | founder/legal | none | med | compliance / GO-NO-GO row |

---

## D. PATH TO GO

1. **Decide LB-8 approach** (§B — recommend option 1, header-fold).
2. **Clear the commit seam (C0)** in a real environment; commit LB-7 → gate 123/123 green.
3. Implement, validate (gate+tsc+tests), and **commit separately**: LB-11 (½d) → LB-9 (2–3d) → LB-12 (1–2d) → LB-10 (2d) → LB-8 (1d, per §B).
4. Re-run the Phase 7 journey audits; only then is a `LETBUYY_V1_CERTIFICATION.md` honestly possible.
5. Work H1–H9 in parallel (founder/eng).

**No launch-readiness claim is made.** Foundation is sound; launch scope is ~7–9 dev-days + the commit seam + the LB-8 decision away, and go-live remains gated on the 9 human seams.
