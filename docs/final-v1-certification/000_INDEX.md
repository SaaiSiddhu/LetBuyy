# LetBuyy V1 — Final Red-Team Certification

**HEAD `ae383bb8` (`stepup/main`, 217 ahead of `origin/main`). Read-only audit; no code changed. All findings carry file:line and were verified against the live working tree, not docs or memory.**

## Verdict (one line)

**NOT READY** for 100 beta merchants + real money today. Gated by deploy/provisioning + 3 verified code defects + the alerting gap — **not** by architecture. Path to **READY FOR PILOT** is ~3–4 weeks (see `PRODUCTION_PLAN.md`).

## Two false positives this program caught (why "no assumptions" matters)

1. **Prior internal docs claimed "LB-1..7,13 done, 2 code blockers."** Stale-but-mostly-true; corrected per-blocker below.
2. **An earlier pass (incl. this auditor) flagged an S0 "LB-1 routing regression — storefronts unreachable."** **RETRACTED.** The repo is on **Next.js 16.1.6**, which renamed the middleware entry point from `middleware.ts` to **`proxy.ts`** (official: nextjs.org/docs/messages/middleware-to-proxy; having both files is a hard build error). `apps/storefront-runtime/src/proxy.ts` exports `async function proxy()` + `config.matcher` — the correct Next 16 middleware. Commit `9c3f2157` deleting `middleware.ts` was the **correct migration**, not a regression. **LB-1 is SATISFIED; storefront host-routing works.** All four host-routing apps use `proxy.ts`.

## Scores (0–100)

| Domain | Score | One-line basis |
|---|---|---|
| Architecture | 88 | clean modular monolith; money/identity/tenancy sound; single-region write ceiling by design |
| Security | 82 | no live hole, fail-closed; −shared INTERNAL_API_SECRET, rate-limit coverage, no alerting |
| Money & Ledger | 90 | invariants preserved, gift-card split-brain fixed; −shipping-drop, GST-on-mutable-column |
| Tenant Isolation | 92 | 0 ownership gaps across 87 routes; RLS forced + app_tenant red-team test |
| Customer Journey | 65 | front door works; −LB-8 broken bar, shipping-drop, gift-card UX, COD email |
| Merchant Journey | 70 | full loop wired; −teams owner-only, KYC no review surface + payouts not KYC-gated |
| Deployment | 40 | excellent gated pipeline **never run**; never pushed/provisioned |
| Infrastructure | 55 | design 90, provisioning 0, **no external alerting** |
| Scale (V1 10–1k merch) | 85 | edge-cached reads + Hyperdrive; single-region writes fine at V1 |
| **Overall (codebase)** | **~74** | strong, money-sound, ~85% V1 code-complete |
| **Production readiness** | **~15** | unshipped + unprovisioned + 3 code defects + no paging |

## Documents

Phase A `ARCHITECTURE_AUDIT.md` · Phase B `CROSS_APP_INTEGRATION.md` + `INTEGRATION_MATRIX.md` · Phase C `TENANT_ISOLATION_AUDIT.md` · Phase D `AUTH_AUDIT.md` · Phase E `RATE_LIMIT_AUDIT.md` + `RATE_LIMIT_MATRIX.md` · Phase F `MONEY_SYSTEM_AUDIT.md` · Phase G `CUSTOMER_JOURNEY_AUDIT.md` · Phase H `MERCHANT_JOURNEY_AUDIT.md` · Phase I `DEPLOYMENT_AUDIT.md` + `DEPLOYMENT_MATRIX.md` · Phase J `SCALE_AUDIT.md` · Phase K `RED_TEAM_REPORT.md` · Phase L `FINAL_V1_CERTIFICATION.md`. Plus `TOP_50_BLOCKERS.md`, `TOP_50_RISKS.md`, `TOP_50_RECOMMENDATIONS.md`, `TOP_50_FAST_FIXES.md`, `LAUNCH_PLAN.md`, `BETA_PLAN.md`, `PRODUCTION_PLAN.md`.

## Method

Consolidates code-verified investigation passes executed this session at HEAD `ae383bb8`: 8 parallel deep-dive agents (architecture, storefront, merchant, identity, console, marketing, gateway, queues, webhooks, DB, money, payments, shipping/GST, gift-card, email, security, tenant-isolation, rate-limit, deployment, infra/scale) + targeted ground-truth verification of every load-bearing claim + direct re-checks that overturned two earlier conclusions. Where an agent and the code disagreed, the code won.

## The 3 verified code defects (not LB-1)

- **LB-8** `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:56–203` — no `announcementBar` renderer; `theme-registry.ts:627–628` injects one into the default theme → broken "Renderer not available" box atop every default-theme store.
- **LB-11** `apps/merchant-control-plane/src/components/merchantNavigation.ts:93` — gift-card nav present; storefront has no redemption input → merchants issue codes shoppers can't apply (backend redemption itself is fixed).
- **Shipping-drop** `apps/storefront-runtime/src/app/api/orders/route.ts:48–57` — drops `shippingRateId` (sent by `checkout-client.tsx:363`); gateway falls back to deliveryOption legacy (migration 170: standard=0/express=99), so merchant rate cards are bypassed and standard orders ship free.
