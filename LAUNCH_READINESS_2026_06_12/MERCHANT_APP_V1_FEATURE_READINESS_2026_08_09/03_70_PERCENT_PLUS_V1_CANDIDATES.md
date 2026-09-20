# 03 — THE 70%+ V1 CANDIDATES

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.
Where this document and [`02_COMPLETE_MERCHANT_FEATURE_INVENTORY.md`](02_COMPLETE_MERCHANT_FEATURE_INVENTORY.md)
disagree on a score, **this document governs** — these scores have been through falsification.

---

## 1. The result that decides the V1 shape

Nineteen of 188 capabilities scored ≥ 70 on the auditors' first pass. Reviewing them is what turned
the mandate ("find what is >70% and finish it") into the scope in doc 05, because of a single
observation:

> **Group A is almost entirely infrastructure and invariants. Exactly one merchant-facing feature
> clears 70.**

| Category | Members (first-pass score) |
|---|---|
| Money kernel | canonical double-entry ledger (82) · fail-closed with no credentials (80) · `commission_bps = 0` (74) · canonical money RPCs (71) |
| Security / tenancy | ES256/HS256 realm separation (76) · secret handling (74) · Turnstile (72) |
| Theme | sanitizer + Liquid sandbox (82) · renderer selection (74) · React section registry (70) · web theme editor (72) |
| Governance | evidence-package placement law (78) · decision-class escalation (74) · freeze protocol (72) · frozen-app containment (74) |
| **Commerce** | **inventory reservations + oversell prevention (72)** ← the only one |
| Infra | Worker configuration (71) · local dev environment (70) · domains/custom-domain connect (70) |

Not products. Not orders. Not fulfilment. Not customers. Not discounts. Not checkout. Those all sit
at 50–69, and nearly always for the same reason: **no automated happy-path integration test**, which
caps a capability at 69.

**A V1 cannot be assembled from Group A alone** — it contains no coherent merchant journey. That is
why the frozen scope is the union of Group A and the mandatory foundations in doc 04, rather than
"ship the things that scored highest".

## 2. Falsification method

Every score in this list was challenged, not accepted. Three independent passes:

1. **Test-citation audit.** Every claimed test file was checked for existence. **All nine spot-checked
   citations resolved to real files** — the auditors did not invent evidence.
2. **Hard-cap re-application.** The caps were applied again, mechanically, against the cited
   evidence. This demoted three capabilities (§4).
3. **Execution.** Where a capability claimed an executable test, it was **run**, not read.

A parallel adversarial falsification agent was also dispatched; it had not returned at package time,
so **nothing in this document depends on it**. Every verdict below is the orchestrator's own,
traceable to an executed command or a cited file.

## 3. Confirmed ≥ 70 — with executed proof

These survived falsification because a command was run and passed.

| Capability | Score | Proof executed |
|---|---|---|
| **Canonical double-entry ledger kernel** | **82** | `node --test tests/executable/money-ledger-postgres.test.mjs` → pass. Append-only enforced on real Postgres: `ERROR: ledger is append-only; use reversing entries` on **UPDATE and DELETE**. |
| **Inventory reservations + oversell prevention** | **72** | `node --test tests/executable/inventory-postgres.test.mjs` → pass: *"reservations prevent oversell and support commit, release, and expiry on real Postgres"*, 27 relevant assertions. **The only merchant-facing capability with genuine behavioural proof.** |
| **Canonical money RPCs** (SECURITY DEFINER, idempotency, locking) | **71** | Same suite, plus `foundation-wave1-money-postgres` (repaired by this program) → double-release guard and derived-balance insufficiency both fire. |
| **ES256/HS256 realm separation** | **76** | `tests/auth/customer-session-gateway.test.mjs` exists; `foundation-wave4-session-postgres` passes — session rotates and **rejects reuse**. |
| **`commission_bps = 0`** | **74** | `DEFAULT 0` at `162_phase_a_commission_zero.sql:4,7` + `commission-bps-zero-validator.mjs` ratchet. *Residual:* `commission.ts:292` still computes a fee if a row were non-zero. |
| **Fail-closed with no provider credentials** | **80** | Verified statically and behaviourally — `SKIP_NEEDS_HUMAN_*` sentinels; the Android release build **refuses** rather than debug-signing; wave-3 asserts *"sandbox registrar stays gated and no longer emits success-shaped fake payloads"*. |
| **Secret handling** | **74** | No committed secret found; `.dev.vars` correctly ignored (`.gitignore:93`); `tests/security/environment-honesty.test.mjs` exists. |
| **Theme sanitizer + Liquid sandbox** | **82** | `packages/theme-engine/test/qi-security.test.ts` exists; `test:foundation:wave6` passes. |
| **Frozen-app / reserved-service containment** | **74** | Verified directly: all six reserved services are `AGENTS.md` + `runtime.manifest.json` only; frozen apps have no deploy config. |

## 4. Demoted by falsification — these are NOT V1 candidates

The hard cap *"no automated happy-path integration test ⇒ maximum 69"* is not advisory. Applying it
mechanically removes three capabilities from Group A.

| Capability | First pass | Corrected | Why |
|---|---|---|---|
| Constitutional decision-class escalation (Class A/B/C) | 74 | **≤ 69** | The auditor recorded `testEvidence: NONE`. A governance rule with no validator and no test is a *documented convention*, not an enforced capability — precisely the "a rule that is not testable is not yet governance" standard the Constitution sets (§5.2). |
| Foundation freeze instrument + ARB freeze-exception protocol | 72 | **≤ 69** | `testEvidence: NONE` — *"no validator or test asserts freeze-exception"*. Same reasoning. |
| Local development environment | 70 | **≤ 69** | `testEvidence: NONE directly`. And demonstrably so: the documented local stack could not be brought up in this program (it requires a Supabase instance that is not running), which is exactly the failure an integration test would have caught. |

**Corrected Group A: 16 capabilities, not 19.**

## 5. Contradictory evidence carried against the survivors

Recording what argues *against* each surviving score, because a score without its counter-evidence is
marketing.

| Capability | Contradictory evidence |
|---|---|
| Canonical ledger kernel (82) | The kernel is correct, but **`MNY-S0-001` confirms four uncoordinated writers to `merchant_payable`** — the same rupee credited multiple times. The *primitive* is sound; its *usage* is not. This is the sharpest example in the audit of why a high component score does not imply a working system. |
| Canonical money RPCs (71) | `CC-S1-REFUND-NO-STEPUP` and `MNY-S1-004`: **both refund legs in `orders.ts` are un-gated**, and a refund path carries a cross-tenant exposure "wider than claimed". |
| Realm separation (76) | `IDN-S0-1`: a **second issuer** exists — gateway `/v1/auth/signup` and `/v1/auth/signin` mint merchant sessions outside `identity-platform` (ART-05 / R-14). Separation is correct where it is implemented; sole-issuance is violated. |
| Turnstile (72) | Capped by "required provider mock-only". Production keys are unset, and because it **fails closed**, a store reviewer cannot log in — a submission blocker independent of code quality. |
| Theme renderer selection (74) | Correct in production (`FEATURE_LIQUID="false"`), but `[vars]` and `[env.staging.vars]` set it `"true"` — **a deploy without `--env production` flips the Liquid default cohort-wide**, which ART-17/THEME-R6 forbid without the parity/security/perf gate. |
| Web theme editor (72) | Already capped at 69-class by "no automated happy-path integration test" in the auditor's own note; retained at 72 only on the strength of `editor-bridge-contract` coverage. Treat as the weakest survivor. |
| Frozen-app containment (74) | True at the **deploy** layer. At the **source** layer, `apps/developer-portal` (frozen) has ~2,125 lines of uncommitted work that is the proximate cause of the red governance gate. |
| Domains / custom-domain connect (70) | The connect flow exists, but **host routing is dead code** — `middleware.ts` absent, `proxy()` never invoked. A domain you can connect but not serve is not a working capability. |
| Secret handling (74) | Clean today, but the gate that would catch a regression is red and **102 of 108 validators never execute**. |

## 6. What "finish the 70%+ features" would actually mean

The mandate assumed a set of nearly-done merchant features. The evidence does not support that
assumption, and following it literally would produce a V1 consisting of a ledger, a sanitizer, a
reservation system and some governance documents — with no way for a merchant to sell anything.

The honest restatement:

- **Group A is a strong foundation, not a product.** Its members are largely the *correctness
  primitives* (ledger, tenancy, sanitizer, reservations) — the hardest things to build and the ones
  most expensive to get wrong. That they score highest is genuinely good news.
- **The merchant journey sits at 50–69**, one integration test away from being demonstrable in most
  cases.
- Therefore V1 is **Group A + the mandatory foundations in doc 04**, and the work that changes the
  verdict is **verification** — turning 50–69 into 85+ — not construction.

This is the central finding of the program, and it is why doc 15 returns NO-GO while simultaneously
certifying that the money, tenancy and session kernels are behaviourally correct.
