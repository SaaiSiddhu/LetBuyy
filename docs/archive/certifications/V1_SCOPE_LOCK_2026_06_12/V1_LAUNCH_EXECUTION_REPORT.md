# LETBUYY V1.0.0 — LAUNCH EXECUTION REPORT

**Program:** V1_SCOPE_LOCK_2026_06_12 (launch execution, Batches 1–7 = LB-1…LB-13)
**Authority:** `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md` · `EXECUTION_LEDGER.md` (rows `V1-LAUNCH-CP0` → `V1-LAUNCH-B5`)
**Report date:** 2026-06-13 · **Repo HEAD:** `140a73db` (v1-launch-b4) · working tree carries uncommitted Batch 5
**Rule applied:** Repository evidence wins. Wishlist loses. No overclaim.

---

## 0. READ THIS FIRST — SESSION CONSTRAINT & VERDICT

This session **had a working shell and ran the mandated validation**, but **could not commit**: the repo's `.git/index.lock` is present and un-removable in this sandbox (`EPERM`), so `git add` / `git commit` fail. Consequence:

> Everything below is **validated by actually running** the gate, typecheck, and tests — **except** that nothing could be committed, and the one governance check that depends on files being tracked (the untracked-migration guard) therefore still reports red for migration 170. That single red is a **commit artifact, not a defect**; it clears the moment a human runs one `git add`.

**Honest verdict against the program's stop condition** (`LB-1…LB-13 complete AND all tests pass AND gate passes AND report generated`):

> **NOT MET. The `[V1 LAUNCH CODE COMPLETE]` token is deliberately NOT returned.**
> 7 of 13 code blockers are complete and committed. **LB-7 (Batch 5) is now reconciled and validated** (tests + typecheck + full gate minus the untracked-migration commit artifact) but **uncommitted**. 5 blockers (LB-8…LB-12, Batches 6–7) are not started.

---

## 1. EXECUTIVE STATUS

| Bucket | Count | Blockers |
|---|---|---|
| ✅ **Complete & committed** (gate-green at commit) | **7** | LB-1, LB-2, LB-3, LB-4, LB-5, LB-6, LB-13 |
| 🟩 **Validated this session, PENDING COMMIT** | **1** | LB-7 (+ GST) |
| ❌ **Not started** | **5** | LB-8, LB-9, LB-10, LB-11, LB-12 |
| **Total V1 code blockers** | **13** | LB-1…LB-13 |

Plus **9 human/provisioning tracks (H-1…H-9)** that no code can close (push-to-origin, 32 prod secrets, DNS, prod Supabase, secret rotation, Resend live, Turnstile live, Razorpay Route onboarding, legal/pricing). These gate actual go-live independent of code.

---

## 2. BLOCKER-BY-BLOCKER STATUS

| # | Blocker | Batch | Status | Evidence |
|---|---|---|---|---|
| LB-1 | Storefront `middleware.ts` re-export of `proxy` | 1 | ✅ committed | `90368dc6`; `apps/storefront-runtime/src/middleware.ts` |
| LB-2 | Cut Stripe/PayPal/Cashfree from checkout UI | 1 | ✅ committed | `90368dc6` |
| LB-13 | Security trio (PII leak · replay guard · rate limits) | 1 | ✅ committed | `90368dc6` |
| LB-3 | Refund chain (Razorpay refund + UI + step-up TOTP) | 2 | ✅ committed | `f53d6e2f` |
| LB-4 | Payout release UI (shared step-up + Route flow) | 2 | ✅ committed | `f53d6e2f` |
| LB-5 | Variants E2E | 3 | ✅ committed | `db986077` |
| LB-6 | Collections E2E | 4 | ✅ committed | `140a73db` |
| LB-7 | Merchant shipping rates honored + GST invocation | 5 | 🟩 **validated, UNCOMMITTED** | `V1-LAUNCH-B5` ledger row; see §4 |
| LB-8 | AnnouncementBar renderer (theme T1) | 6 | ❌ not started | — |
| LB-9 | Appearance bridge (theme T2) | 6 | ❌ not started | — |
| LB-10 | Buyer lifecycle emails (shipped/cancelled/refunded) | 7 | ❌ not started | — |
| LB-11 | Hide gift cards + dead marketplace links | 7 | ❌ not started | — |
| LB-12 | Explicit shopper registration step | 7 | ❌ not started | — |

---

## 3. BATCH MAP

| Batch | Scope | Commit / row | Tests | Status |
|---|---|---|---|---|
| **Batch 1** — Foundation | LB-1, LB-2, LB-13 | `90368dc6` | lb1×4, lb2×6, lb13×4 | ✅ committed |
| **Batch 2** — Money flows | LB-3, LB-4 | `f53d6e2f` | lb3×4, lb34×7 | ✅ committed |
| **Batch 3** — Catalog core | LB-5 | `db986077` | lb5×12 | ✅ committed |
| **Batch 4** — Discovery | LB-6 | `140a73db` | lb6×10 + fed×3 | ✅ committed |
| **Batch 5** — Commerce completion | LB-7 + GST | `V1-LAUNCH-B5` (uncommitted) | **lb7×28 + reconciled lb6 count** | 🟩 **validated, pending commit** |
| **Batch 6** — Theme completion | LB-8, LB-9, T1–T4 | — | — | ❌ not started |
| **Batch 7** — Buyer trust | LB-10, LB-11, LB-12 | — | — | ❌ not started |

---

## 4. BATCH 5 (LB-7 + GST) — WHAT WAS DONE & VALIDATED THIS SESSION

LB-7's implementation was already on disk from an interrupted prior run. This session **reconciled two test/ratchet conflicts** (the reason the prior run never committed) and **ran full validation**.

**Reconciliation 1 — lb7 test #5 (the blocker).** The test asserted `doesNotMatch(/DROP FUNCTION/)`, but migration 170 **must** drop the prior 14-arg `create_checkout_order` overload: adding two trailing params changes the signature, and without the drop PostgREST resolves `rpc()` calls ambiguously (`PGRST203`), breaking **all** order creation. The migration is correct; the assertion was wrong. It was rewritten to a **stronger** invariant — require `CREATE OR REPLACE`, **require** the guarded `DROP FUNCTION IF EXISTS public.create_checkout_order`, and **forbid** a bare `CREATE FUNCTION` (with comments stripped so the rollback note doesn't taint it). Confirmed there is **no grant regression**: no per-function `GRANT` exists, and the `SECURITY DEFINER` + default execute privileges survive drop+replace.

**Reconciliation 2 — lb6 test #9 (ratchet coupling).** LB-7 added the shipping proxy routes, so the prior run had already bumped `domain-boundary-validator.mjs` to **127** routes — but left the lb6 collections test asserting the old **124**. Updated the lb6 assertion 124→127 in lockstep, the same ratchet-maintenance pattern earlier batches used (115→123→124→127).

**Validation actually executed this session:**

| Check | Command | Result |
|---|---|---|
| LB-7 launch tests | `node --test tests/launch/lb7-shipping-gst.test.mjs` | **28 / 28 pass** |
| Full launch suite | `node --test tests/launch/*.test.mjs` | **75 / 75 pass** |
| Route-ownership | `node --test tests/federation/app-api-route-ownership.test.mjs` | **3 / 3 pass** |
| Money-path typecheck | `tsc --noEmit -p services/api-gateway` | **0 errors** |
| Governance gate | `node scripts/validate-governance.mjs --lane=gate` | **green on all validators EXCEPT** the untracked-migration guard for migration 170 (commit artifact) |
| Behavioral (checkout/money/coupons/payments) | `tsx --test …` | 24 / 26 — the **2 failures proven pre-existing baseline** (see below) |

**The 2 behavioral failures are NOT Batch 5 regressions** (proven, not assumed):
- `checkout-d6.test.ts` → `Cannot find module 'zod'` — a test-harness module-resolution issue, unrelated to LB-7.
- `payments.test.ts #8` → expects `checkout-client.tsx` to call `/payments/stripe/checkout`, which **committed LB-2 already removed**. `git show HEAD:…checkout-client.tsx` has **0** occurrences — this test was already failing at the committed HEAD, independent of B5. (It is a stale-test loose end from Batch 1, out of LB-7 scope.)

**Net:** LB-7 is functionally complete and validated to the limit of a no-commit sandbox. The only thing between it and a fully-green gate is the commit in §10.

---

## 5. FILES (Batch 5, on disk / uncommitted)

`database/supabase/migrations/170_v1_shipping_rates_gst.sql` · `services/api-gateway/src/lib/shipping-rate-resolver.ts` · `…/execution/order-execution.adapter.ts` · `…/routes/storefront/checkout-payment-routes.ts` · `…/routes/checkout.ts` · `…/routes/coupons.ts` · `apps/storefront-runtime/src/app/api/shipping/rates/route.ts` · `…/checkout/checkout-client.tsx` · `apps/merchant-control-plane/…/shipping/rates/route.ts` + `…/[rateId]/route.ts` · `…/settings/shipping/page.tsx` · `scripts/validators/domain-boundary-validator.mjs` (→127) · `docs/governance/app-api-route-ownership.md` · `tests/federation/app-api-route-ownership.test.mjs` · `tests/launch/lb7-shipping-gst.test.mjs` (#5 reconciled) · `tests/launch/lb6-collections.test.mjs` (#9 reconciled).

**Tests added across the launch program:** B1 14, B2 11, B3 12, B4 10 (+3 federation), B5 28 (lb7) = **~75 launch-path assertions, all green.**

---

## 6. LAUNCH READINESS %

Reasoned estimate, weighted by the scope-lock's §11 weights; human tracks excluded (they gate go-live separately).

| Domain (weight) | At audit | Est. now | Driver |
|---|---|---|---|
| Identity merchant core (10) | 85 | 85 | — |
| Merchant admin (15) | 72 | ~90 | LB-3/4/5 committed |
| Storefront (15) | 60 | ~72 | LB-1 + LB-6 committed; LB-8/9 open |
| Checkout & payments (15) | 70 | ~90 | LB-2 + LB-3 committed; **LB-7 validated** |
| Catalog (10) | 60 | ~95 | LB-5 + LB-6 committed |
| Orders & customers (10) | 70 | ~74 | LB-10 + LB-12 open |
| Money spine (10) | 78 | ~85 | refund/payout wired |
| Shipping/tax (5) | 55 | ~85 | **LB-7 + GST validated** (pending commit) |
| Internal ops + team (5) | 75 | 75 | — |
| Notifications (5) | 55 | 55 | LB-10 open |
| **Weighted estimate** | **≈ 68%** | **≈ 84–86% of V1 code scope** | |

**Plain-language:** **8 of 13 code blockers functionally done** (7 committed + LB-7 validated-pending-commit). Remaining code ≈ **12–15 dev-days** (LB-8 1 · LB-9 3 · LB-10 2 · LB-11 0.5 · LB-12 1 · theme T3/T4 4 · misc). Actual launch additionally needs all **9 human tracks** — none are code, none are done.

---

## 7. MERCHANT JOURNEY VERIFICATION

✅ closed & committed · 🟩 validated, pending commit · ❌ blocker remaining · 🔌 human/env-gated.

| Step | State | Basis |
|---|---|---|
| Sign up · create store · add products | ✅ / 🔌 | real; needs Resend + Turnstile live (H-6/7) |
| Multi-variant products | ✅ | LB-5 committed |
| Manage inventory · receive orders · fulfill | ✅ | real |
| Issue refunds | ✅ / 🔌 | LB-3 committed; live needs PSP secrets (H-2) |
| Manage payouts | ✅ / 🔌 | LB-4 committed; live needs Razorpay Route (H-8) |
| **Shipping rates honored at checkout** | 🟩 | **LB-7 validated, pending commit** |
| Customize store — variants/collections | ✅ | LB-5 + LB-6 |
| Customize store — appearance / announcement bar | ❌ | **LB-9 (T2) + LB-8 (T1) not started** |

---

## 8. CUSTOMER JOURNEY VERIFICATION

| Step | State | Basis |
|---|---|---|
| Reach `{store}.letbuyy.com` | ✅ / 🔌 | LB-1 committed; needs wildcard DNS (H-3) |
| Browse store / collections / variants | ✅ | LB-6 + LB-5 committed |
| Add to cart · checkout · Razorpay · COD · track | ✅ / 🔌 | real; live needs Razorpay secrets (H-2) |
| **Accurate shipping at checkout** | 🟩 | **LB-7 validated, pending commit** |
| Register (email-not-found path) | ❌ | **LB-12 not started** |
| Shipped / cancelled / refunded emails | ❌ | **LB-10 not started** |
| Gift cards hidden (unredeemable) | ❌ | **LB-11 not started** |

---

## 9. PLATFORM (STAFF) JOURNEY VERIFICATION

No LB blocker targets the console; status carried from scope-lock §7 (not re-verified this session). Manage merchants (Merchant 360, suspend/restore, SoD, audit) ✅; review activity (risk/T&S, audit logs) ✅ read-only; support 🔧 ops-manual; **KYC review queue is the one notable gap** and is explicitly outside the LB set.

---

## 10. COMMIT HANDOFF (required — the sandbox cannot do this)

This session could not commit (`.git/index.lock` un-removable). To finish Batch 5, a human runs:

```
git add database/supabase/migrations/170_v1_shipping_rates_gst.sql \
        services/api-gateway/src/lib/shipping-rate-resolver.ts \
        services/api-gateway/src/execution/order-execution.adapter.ts \
        services/api-gateway/src/routes/storefront/checkout-payment-routes.ts \
        services/api-gateway/src/routes/checkout.ts \
        services/api-gateway/src/routes/coupons.ts \
        apps/storefront-runtime/src/app/api/shipping \
        apps/storefront-runtime/src/app/store/\[subdomain\]/checkout/checkout-client.tsx \
        apps/merchant-control-plane/src/app/api/stores/\[store\]/shipping/rates \
        apps/merchant-control-plane/src/app/\[store\]/settings/shipping/page.tsx \
        scripts/validators/domain-boundary-validator.mjs \
        docs/governance/app-api-route-ownership.md \
        tests/federation/app-api-route-ownership.test.mjs \
        tests/launch/lb7-shipping-gst.test.mjs \
        tests/launch/lb6-collections.test.mjs \
        EXECUTION_LEDGER.md
node scripts/validate-governance.mjs --lane=gate   # now fully green (untracked-170 cleared)
git commit -m "v1-launch-b5: LB-7 shipping rates honored + GST invocation; reconcile lb7/lb6 ratchet tests"
```

(First clear the stale lock if no git process is live: `rm -f .git/index.lock`.)

---

## 11. WHAT REMAINS TO GA

**Code (≈12–15 dev-days):** commit Batch 5 (§10); **Batch 6** — LB-8 AnnouncementBar (S), LB-9 Appearance bridge (M), theme templates T3/T4 (~4d); **Batch 7** — LB-10 lifecycle emails (S–M), LB-11 hide gift cards + dead links (S), LB-12 registration step (S). Validate gate + typecheck + launch tests after each.

**Human / provisioning (parallel, ≈2–3 weeks, no code):** H-1 push-to-origin · H-2 32 secrets · H-3 DNS + wildcard · H-4 prod Supabase · H-5 secret rotation · H-6 Resend live · H-7 Turnstile live · H-8 Razorpay Route · H-9 legal/pricing.

---

## 12. THIS SESSION — WHAT WAS ACTUALLY DONE

1. Reconstructed true program state from `EXECUTION_LEDGER.md` + git (Batches 1–4 committed; Batch 5 interrupted mid-flight, uncommitted).
2. **Reconciled the two conflicts blocking Batch 5** — lb7 test #5 (overload-safe DROP) and lb6 test #9 (P4-4 count 124→127) — encoding stronger, correct invariants (no weakening).
3. **Ran the mandated validation:** lb7 28/28 · full launch suite 75/75 · federation 3/3 · api-gateway tsc 0 · governance gate green on every validator except the untracked-migration commit artifact · behavioral baseline failures proven pre-existing.
4. Updated the `V1-LAUNCH-B5` ledger row and this report to the validated state.

**Could not:** commit (sandbox `.git/index.lock`), so the untracked-migration guard stays red and Batches 6–7 were not force-built unvalidated. **No money-path or theme code was modified** beyond the two test reconciliations described above.

---

*Provenance: live `node`/`git`/`tsc` runs at working-tree state on 2026-06-13 (HEAD `140a73db`); `EXECUTION_LEDGER.md` rows `V1-LAUNCH-CP0`…`V1-LAUNCH-B5`; `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md`. Batches 1–4 "committed/green" are from their commit-time ledger rows; Batch 5 figures are from this session's runs.*
