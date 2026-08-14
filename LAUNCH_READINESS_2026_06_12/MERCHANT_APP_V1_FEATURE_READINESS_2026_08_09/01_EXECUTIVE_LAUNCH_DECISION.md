# 01 — EXECUTIVE LAUNCH DECISION

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `ee371182` (`stepup/main`), working tree dirty and user-owned
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

---

## 1. The verdict

# NO-GO

Not close, and not for the reason the repository's own documents suggest.

## 2. The one sentence that explains everything

> **LetBuyy's problem is not that too little was built. It is that almost nothing has been proven to
> work.**

188 merchant-facing capabilities were inventoried against `ee371182`. Mean score **45.5**. Nineteen
score ≥ 70. **None scores above 89. None is launch-proven.** But the shape matters more than the
average: the single largest cluster — **78 capabilities in the 50–69 band** — is real, wired,
tenant-aware code that cannot be certified, and in nearly every case it is capped by the *same*
missing thing: an automated happy-path integration test.

Of the 20 end-to-end scenarios a commerce platform must demonstrate, **3 pass, 5 are partial, 12 are
absent** — and all three that pass are database-layer proofs. **Not one scenario that crosses an
HTTP boundary has ever been executed.**

## 3. What V1 is

**LetBuyy V1 is the web merchant platform plus the buyer storefront. The Flutter merchant app is a
V1.1 companion release gated on four specific items.**

This upholds the prior scope lock's mobile-as-post-V1 classification — but for materially different,
better-evidenced reasons, and with a far shorter path than "68% complete" implied. The mobile app is
not unfinished. It has 151 Dart files, 91 routes, a clean `flutter analyze`, and **172/172 passing
tests**. What it lacks is *proof* and *store compliance*:

| Gate | State |
|---|---|
| An integration test that actually executes | Its only one is `skip:`-ed in every checked-in configuration |
| iOS privacy manifest + iOS release pipeline | Both absent — the release workflow is Android-only |
| Account deletion (in-app + web) | Absent everywhere in the codebase; both stores reject without it |
| The App Bridge decision | A forbidden surface is live (§5) |

Everything the prior lock cited — push and store signing — is either out of V1 scope (push, which
must simply not be claimed) or pure provisioning (signing, where the pipeline exists and correctly
fails closed).

## 4. The five S0 blockers

Each was independently re-verified by an adversarial verifier instructed to refute it. Three turned
out **worse** than first reported.

| # | Blocker | Why it stops launch |
|---|---|---|
| 1 | **Money is credited multiple times for the same rupee.** Four uncoordinated writers to `merchant_payable`. | A correctness failure in the canonical ledger's most important account. Merchants would be paid wrongly. |
| 2 | **22 permissive `USING(true)` policies** survive in final migration state without `TO service_role`. | Direct ART-09 / SEC-R6 violation — a database-layer tenant and PII exposure beneath the application. |
| 3 | **A second identity issuer exists.** Gateway `/v1/auth/signup` and `/v1/auth/signin` mint merchant sessions outside `identity-platform`. | ART-05 / R-14. Two issuers means the verification surface is also a forgery surface. |
| 4 | **The deploy pipeline cannot run.** Branch lag 106 vs `main`, **291 vs `origin/main`**; `production-deploy.yml`'s first job is the branch-lag guard. | ART-03. Nothing in this repository has ever been deployable. |
| 5 | **The active branch has no CI.** `ci.yml` triggers only on `develop`/`main`; all work happens on `stepup/main`. | No typecheck, lint, unit, governance or Flutter gate protects the branch anyone actually commits to. |

## 5. The constitutional finding

**A third-party app marketplace and an embedded App Bridge are live**, and they are forbidden by
ART-22, ART-16, NEVER-R3 and R-12.

- `/app-store` is mounted **inside the canonical monolith** (`api-gateway/src/index.ts:727`),
  including extension and developer-platform routes.
- Production sets `FEATURE_EXTENSIONS="false"` — **but the flag does not cover the App Bridge.**
  `extensionsFeatureGate` guards only the `/extensions` paths; `POST /app-store/.../embed-session`
  and `POST /app-store/bridge/fetch` remain reachable in production.
- The Flutter app ran a WebView that injected a native bridge, executed **remote third-party
  JavaScript**, and passed an attacker-controllable `path` into a merchant-session-scoped data proxy.

This is simultaneously a constitutional violation and an S1 security exposure. **This program closed
the mobile half** (§7); the gateway half is an ARB decision.

## 6. What was actually wrong with the existing evidence

The repository's own reporting said the gate was green and readiness was 98%. Both are false.

- `pnpm validate:governance` **exits 1**, and because the runner is fail-fast it aborts at validator
  **5 of 108** — so **102 validators never execute**. The true gate state is unknown, not green.
- LCIS reports `verdict: "NO-GO"` and `overallReadiness: 98` *in the same response*, derived from
  **generated certification markdown** — including LCIS's own certification of itself. Its code graph
  is **77 commits stale** and it has no staleness detection.
- A Wave-3 governance test named *"domain defaults stay on letbuyy.com"* was asserting the
  constitutionally **forbidden** `letbuyy.store` literal — failing the build for *complying* with
  the Constitution.
- The Wave-1 money gate could **never** pass: its fixture omitted a table a replayed migration
  foreign-keys to.

**Three of the auditors' own S0 claims were refuted on adversarial re-verification** — including one
this orchestrator initially confirmed by reading and then disproved by executing a release
manifest-merge diff. That correction is documented in full in doc 13 §2.2, because the lesson
generalises: **in this repository, reading is not verification.**

## 7. What this program changed

Eight changes, all uncommitted, each verified before and after. Highlights:

| Change | Effect |
|---|---|
| `sites.published` now written on publish | Closed a latent S0: the storefront resolver gates on `published`, which had **readers but no writer**. Fixing host routing without this would have 401'd every storefront while the admin still showed "published". |
| **V1 capability policy + route-level gating** (new) | The forbidden app marketplace and App Bridge are now closed on **all three** of their routes, plus gift cards, merchant-Razorpay and staff. Enforced at `AppRoutes.generateRoute`, so deep links cannot bypass it. **8 new tests; 172/172 green.** |
| Wave-1 money gate repaired | A money foundation gate that could never pass now passes, with real double-release and derived-balance assertions firing. |
| Wave-3 governance theater removed | Gate now asserts the Constitution instead of contradicting it. |
| 5 live `letbuyy.store` literals removed | Every new merchant was being told their store lived on a dead domain. |
| Tenant registry regenerated | 4 tenant tables from already-merged migrations were unregistered — the isolation validator wasn't checking them. |
| 5 failing Flutter tests fixed | A real tap-affordance defect (invisible ink splashes). |

## 8. The largest blockers, ranked by what they cost

1. **Verification, not construction.** One skipped integration test caps the entire mobile surface at
   69. Making it execute is the single highest-leverage change available.
2. **Deployability.** 291 commits of lag and no CI on the working branch mean nothing can be proven
   beyond a laptop.
3. **Money correctness.** Multi-writer `merchant_payable` must be reduced to one writer and proven by
   a reconciliation harness.
4. **Tenancy at the database layer.** 22 permissive policies, plus a `withTenantTx` boundary with
   **4–5 references repo-wide** while `getSupabaseAdmin` appears ~998 times in the gateway — the
   "gateway is off blanket `service_role`" claim does not hold in practice.
5. **Store compliance.** Account deletion, iOS privacy manifest and an iOS pipeline are three genuine
   builds, not toggles.

## 9. Explicitly excluded from V1

Multi-variant products · collections browsing · gift cards (split-table defect) · merchant-entered
Razorpay keys · purchase orders / transfers / multi-location · merchant staff roles · WhatsApp / SMS
/ push · AI screens · Stripe / PayPal / Cashfree · Liquid default · GraphQL · subscriptions ·
multi-currency · headless · reseller.

Permanently forbidden: the app marketplace, checkout extensions and App Bridge · CQRS / event
sourcing / saga · multi-region · sharding · service mesh · self-custody payouts · cross-merchant
wallet · any GMV or transaction fee · full in-WhatsApp commerce · filling the six reserved services
(verified compliant — all six are manifest-only).

## 10. What the founder should take from this

The instinct behind this program — *stop building, pick what is nearly done, finish it, launch
small* — is right. But the evidence says the binding constraint is not a shortage of features.

**LetBuyy has roughly a platform's worth of half-proven code and almost no proof.** The fastest path
to a defensible launch is not to finish 78 half-capabilities; it is to **freeze a small scope, make
the pipeline able to deploy it, and build the integration tests that turn 50–69 into 85+.** Three of
the five S0s (deployability, CI, and the evidence cap) are about being able to *demonstrate*
correctness rather than achieve it.

Two decisions are genuinely yours and were deliberately left open: **accept the web-first V1 with
mobile at V1.1**, and **decide what happens to the App Bridge**. Everything else proceeded without
waiting.
