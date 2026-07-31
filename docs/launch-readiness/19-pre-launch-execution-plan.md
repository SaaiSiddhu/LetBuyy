# Pre-Launch Execution Plan

**Date:** 2026-06-19  
**Target:** October 1, 2026 launch  
**Basis:** `V1_LAUNCH_EXECUTION_MASTER_PLAN.md`, blocker report, this audit  
**Approach:** Two parallel tracks — **Code Track** (engineer) + **Infrastructure Track** (founder/engineer)

---

## Overview

```
TODAY (Jun 19) ─────────────────────────────────────── OCT 1

Week 1-2    Week 3-4    Week 5-8    Week 9-12   Week 13-15  Week 16
CODE        STAGING     PILOT       CERTIFY     HARDEN      LAUNCH
BLOCKERS    SETUP       BEGINS      MONEY       & FREEZE
```

---

## 30 Day Plan (June 19 – July 19)

### Priority: Code Blockers + Infrastructure Foundation

#### Code Track (Engineer)

**Week 1 (Jun 19–26):**

| Day | Task | Effort | Gate |
|---|---|---|---|
| 1 | LB-8 governance decision: choose Option 1 (header-fold for announcement bar) | 0.5d decision | Founder approves |
| 1-2 | LB-11: Hide dead surfaces (gift cards nav + 5 dead marketplace/theme links) | 0.5d | Gate green post-commit |
| 2-4 | LB-8: Implement announcement bar as header section sub-component | 1d | `theme-section-registry.test.ts` green; validator clean |
| 4-7 | LB-10: Add `order_cancelled` + `order_refunded` email templates; verify shipped-email tracking | 2d | Mirror existing order-confirmation-email tests × 3 stages |

**Week 2 (Jun 26–Jul 3):**

| Day | Task | Effort | Gate |
|---|---|---|---|
| 1-3 | LB-9: Add `site_settings` to `STOREFRONT_SITE_SELECT` + `mapSupabaseToStore` merge; migration 171 | 2-3d | `appearance-bridge.test.ts`; `localization.test.mjs` |
| 3-5 | LB-12: Fix shopper registration — add register branch + fix resetToken; bump domain-boundary ratchet 127→128 | 1-2d | `customer-engagement.security.test.ts`; `storefront-customer-engagement-routes.test.ts` |
| 5 | LB-7: Commit in real git environment (clear index.lock → git add mig 170 → commit) | 0.5d | Gate 107/107 green post-commit |

**End of Week 2 target:** All 5 code blockers resolved and committed. Gate 107/107.

#### Infrastructure Track (Founder + Engineer, parallel)

**Week 1:**
- [ ] Register `letbuyy.com` domain (if not done) → set DNS A/CNAME records → wildcard `*.letbuyy.com` (H3)
- [ ] Begin Razorpay Route onboarding — submit business documents (H8) ← **start immediately; longest timeline**
- [ ] Provision Turnstile keys (H7) — takes minutes
- [ ] Begin Resend domain authentication (SPF/DKIM/DMARC) (H6) — takes days for DNS propagation

**Week 2:**
- [ ] Push `stepup/main` to origin + branch protection (H1)
- [ ] Provision production Supabase project (H4) — apply migrations 000 → 186
- [ ] Begin collecting all 32 production secrets (H2) — make list, identify which are ready

---

#### 30 Day Milestones

| Milestone | Date | Owner |
|---|---|---|
| LB-8 decision made | Jun 20 | Founder |
| All 6 code blockers committed + gate 107/107 | Jul 3 | Engineer |
| DNS wildcard live (*.letbuyy.com → Vercel) | Jul 7 | Founder |
| Production Supabase live + migrations applied | Jul 10 | Engineer |
| Push to origin + Vercel deploys triggered | Jul 5 | Engineer |
| Turnstile keys provisioned | Jun 22 | Founder |
| Resend DNS authentication started | Jun 22 | Founder |
| Razorpay Route application submitted | Jun 21 | Founder |

---

## 60 Day Plan (July 19 – August 19)

### Priority: Staging Environment + Live Certifications + Pilot Start

**Week 5–6 (Jul 19–Aug 2):**

| Task | Owner | Depends On |
|---|---|---|
| Production environment fully configured (all secrets in Wrangler) | Engineer | H2 |
| First production deploy (all 5 Vercel apps + 4 Workers) | Engineer | H1, H4 |
| Smoke test: merchant signup → product → checkout | Founder | Deploy |
| CAP-C11: Run tenant red-team tests against staging roles | Engineer | H4 |
| CAP-C09: Mobile Turnstile live test on merchant app | Engineer | H7 |
| CAP-C10: Alert delivery drill — trigger an incident, verify page | Ops | Deploy |
| CAP-C18: Resend email live test — send order confirmation | Engineer | H6 |
| Cold-user onboarding test (non-team member, timed ≤ 1 day) | Ops | Deploy |

**Week 7–8 (Aug 2–19):**

| Task | Owner | Depends On |
|---|---|---|
| Pilot Merchant 1 onboarded | Ops | Deploy, smoke |
| Pilot Merchant 2 onboarded | Ops | Deploy |
| Pilot Merchant 3 onboarded | Ops | Deploy |
| Money certification begins: Scenarios D1–D5 | Engineer | H2, H4, H8 |
| CAP-C01: First live Razorpay capture → ledger verification | Engineer | H2 |
| CAP-C02: First live refund → ledger reverse verification | Engineer | H2 |
| CAP-C03: First live payout attempt → provider proof | Founder | H8 |
| DR drill: backup restore test | Engineer | H4 |

#### 60 Day Milestones

| Milestone | Date | Owner |
|---|---|---|
| All 5 apps deployed to production | Aug 3 | Engineer |
| First real Razorpay payment captured in production | Aug 7 | Engineer |
| CAP-C11 tenant red-team green in staging | Aug 5 | Engineer |
| Money certification Phase D started | Aug 10 | Engineer |
| Pilot: 3 merchants onboarded | Aug 15 | Ops |
| 7-day money soak started | Aug 12 | Engineer |

---

## 90 Day Plan (August 19 – September 19)

### Priority: Money Certification + Pilot Completion + Launch Hardening

**Week 9–10 (Aug 19 – Sep 2):**

| Task | Owner |
|---|---|
| 7-day money soak completes (zero breaks = pass) | Engineer/Finance |
| Money certification G-D1..D5 green | Finance + Engineer |
| Pilot Merchants 4–5 onboarded | Ops |
| Pilot exit criteria F1–F5 being tracked | Ops |
| Review pilot support tickets → fix top 3 issues | Engineer |
| Razorpay Route live (H8 complete) | Founder |
| CAP-C03 + CAP-C05 payout certification | Engineer |
| Legal: ToS / Privacy / DPDP reviewed and signed | Founder + Legal |

**Week 11–12 (Sep 2–16):**

| Task | Owner |
|---|---|
| Pilot exit criteria F1–F10 all green | Ops |
| Pilot money record: F2/F3/F4 ledger-complete + payouts clean | Finance |
| CAP-C04: Money reconciliation certification (zero breaks) | Engineer |
| CAP-C06: Step-up live certification (TOTP live proof) | Engineer |
| Secret rotation drill (SKIP-W4) | Engineer |
| On-call rota defined for launch week | Ops |
| Error budget defined (availability ≥ 99.5%, checkout ≥ 99%) | Engineering |
| Launch freeze: no non-essential deploys after Sep 20 | Engineering |

**Week 13–14 (Sep 16–30):**

| Task | Owner |
|---|---|
| Launch certification meeting (16-gate GO/NO-GO) | Founder (chair) |
| All 16 launch gates evaluated (Doc 8 checklist) | All |
| Any non-⛔ rows waived with named acceptor + expiry | Founder |
| Launch certificate recorded in EXECUTION_LEDGER.md | Engineering |
| Launch-week rollback plan confirmed (redeploy + payout kill-switch + signup pause) | Engineering |
| Public announcement prepared | Founder |
| **September 30: Launch deploy** | Engineering |
| **October 1: Public launch** | All |

---

## Critical Path (must not slip)

```
Jun 21: Start H8 (Razorpay Route) — 6-week clock starts
Jul 3:  All code blockers done
Jul 10: Production Supabase live
Aug 3:  Full deploy live
Aug 10: Money certification starts
Aug 19: Razorpay Route live (end of 8-week window)
Sep 1:  7-day money soak done
Sep 16: Launch certification meeting
Sep 30: Deploy
Oct 1:  LAUNCH
```

**If any critical path item slips 2+ weeks → October 1 moves to October 15–22.**

---

## Highest ROI Work (by launch probability impact)

| Rank | Work Item | Why High ROI |
|---|---|---|
| 1 | **Start H8 Razorpay Route immediately** | Longest timeline; blocks payouts; non-code |
| 2 | **Fix LB-12 (registration)** | Customer cannot sign up → zero revenue |
| 3 | **Provision H4 (production Supabase)** | Zero certifications possible without live DB |
| 4 | **Fix LB-9 (appearance bridge)** | Merchant UX confidence |
| 5 | **Fix LB-8 (announcement bar)** | Visible broken element |
| 6 | **Configure H3 (DNS)** | Storefront unreachable without it |
| 7 | **H6 Resend email setup** | All transactional emails no-op without it |
| 8 | **Fix LB-10 (lifecycle emails)** | Reduces support tickets from day 1 |

---

## Must-Finish Before Launch (non-negotiable)

These must be completed and verified before October 1:

**Code:**
1. LB-7 committed
2. LB-8 fixed (announcement bar)
3. LB-9 fixed (appearance bridge)
4. LB-10 fixed (cancelled + refunded emails)
5. LB-11 fixed (hide dead surfaces)
6. LB-12 fixed (registration)

**Infrastructure:**
7. H1: Push to origin + branch protection
8. H2: All 32 production secrets provisioned
9. H3: DNS wildcard *.letbuyy.com
10. H4: Production Supabase + all 186 migrations
11. H6: Resend live (SPF/DKIM/DMARC)
12. H7: Turnstile live keys
13. H8: Razorpay Route onboarding

**Certifications:**
14. CAP-C01/C02: Money capture + refund certified in production
15. CAP-C11: Tenant red-team green in staging
16. CAP-C10: Alert delivery certified
17. Pilot: F1–F10 green (5 pilot merchants)
18. Cold-user onboarding test passes (≤1 day, no human help)
19. Legal: ToS/Privacy/DPDP signed (H9)
