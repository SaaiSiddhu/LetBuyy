# 15 — FINAL GO / NO-GO CERTIFICATION

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`), working tree dirty and user-owned
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

---

# VERDICT: NO-GO

For the frozen V1 scope in [`05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md`](05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md),
at commit `bf35062e`, on the evidence in this package.

**This is not a close call**, and it is not a verdict about missing features.

---

## 1. Gate matrix

| # | Gate | Required | Actual | Pass |
|---|---|---|---|---|
| G-01 | Governance gate green | `pnpm validate:governance` exit 0, all 108 validators executed | **exit 1**; aborts at validator 5 of 108; **102 never run**; `prompt-perimeter` independently fails | **✖** |
| G-02 | Branch lag zero (ART-03 / DEPLOY-R1) | 0 | **106** vs `main`, **291** vs `origin/main` | **✖** |
| G-03 | CI protects the working branch | CI runs on the integration branch | `ci.yml` triggers only on `develop`/`main`; `stepup/main` has **no CI at all** | **✖** |
| G-04 | No un-waived S0 (R-18) | 0 open | **5 verified S0** | **✖** |
| G-05 | Money posts exactly once (ART-10 / PAY-R2) | one writer | **four uncoordinated writers to `merchant_payable`** | **✖** |
| G-06 | No `USING(true)` to PUBLIC/anon (ART-09 / R-3) | 0 | **22** survive in final migration state without `TO service_role` | **✖** |
| G-07 | Single token issuer (ART-05 / R-14) | `identity-platform` only | gateway `/v1/auth/signup` + `/v1/auth/signin` also mint sessions | **✖** |
| G-08 | Gateway off blanket `service_role` (ART-08 / R-2) | tenant queries via `withTenantTx` | `withTenantTx`/`withResolvedTenantTx`: **4–5 references repo-wide**, all definition/import/re-export; `getSupabaseAdmin` ~998× in the gateway | **✖** |
| G-09 | No third-party code in a live path (ART-16 / R-12) | none | App Bridge reachable in production despite `FEATURE_EXTENSIONS="false"`; **mobile half closed by this program**, gateway half open | **✖** |
| G-10 | Storefront reachable at `{store}.letbuyy.com` | routing executes | `middleware.ts` absent; nothing invokes `proxy()` | **✖** |
| G-11 | End-to-end merchant→buyer journey proven | ≥ 1 execution | **never executed anywhere** | **✖** |
| G-12 | Store-submission gates (doc 13) | 14/14 | **2/14** | **✖** |
| G-13 | Account deletion (both stores) | present | **absent everywhere in the codebase** | **✖** |
| G-14 | Crash reporting / monitoring connected | connected | all live adapters **NOT CONNECTED** | **✖** |
| G-15 | Tenant isolation fail-closed (ART-08 / R-1) | red team green | **RT-1…RT-9 PASS on real Postgres** under `app_tenant` + raw-REST | **✔** |
| G-16 | Ledger append-only (ART-10 / R-6) | enforced at DB layer | **PASS** — rejects UPDATE *and* DELETE on real Postgres | **✔** |
| G-17 | Session rotation / reuse rejection | enforced | **PASS** on real Postgres | **✔** |
| G-18 | `commission_bps = 0` (ART-12 / R-9) | 0 + ratchet | **PASS** — `DEFAULT 0` (migration 162) + ratchet validator | **✔** |
| G-19 | Reserved services empty (ART-19 / R-16) | manifest-only | **PASS** — all six are `AGENTS.md` + `runtime.manifest.json` | **✔** |
| G-20 | No committed secrets (SEC-R2 / R-21) | none | **PASS** — `.dev.vars` correctly gitignored | **✔** |
| G-21 | Mobile static quality | analyze clean, tests green | **PASS** — clean, **172/172** | **✔** |
| G-22 | Mobile token storage (SEC-R4) | Keychain/Keystore | **PASS** — `FlutterSecureStorage`; prefs hold only an email | **✔** |
| G-23 | Provider-mode honesty (PAY-R10 / R-22) | no stub reads as success | **PASS** — `SKIP_NEEDS_HUMAN_*` sentinels, fail-closed | **✔** |
| G-24 | V1 exclusions actually unreachable | deep links gated | **PASS (mobile)** — enforced at route resolution, 8 tests | **✔** |

**10 of 24 gates pass.** Every failing gate is either an S0, a deployability blocker, or an evidence
gap. **No failing gate is waivable** — R-18 forbids a green build coexisting with a known un-waived
S0, and ART-03 forbids treating undeployed work as live.

## 2. Per-capability final position

| Band | Count | Meaning for launch |
|---|---|---|
| LAUNCH_PROVEN (100) | **0** | — |
| RELEASE_CANDIDATE_WITH_GAPS (85–99) | 1 | — |
| V1_CANDIDATE (70–84) | 18 | Mostly infrastructure and invariants, not merchant features |
| INTEGRATED_BUT_NOT_V1_CANDIDATE (50–69) | 78 | **The real story** — built, wired, unprovable |
| PARTIAL (30–49) | 46 | |
| SCAFFOLD_ONLY (10–29) | 39 | |
| NOT_STARTED (0–9) | 6 | Includes mandatory items: account deletion, iOS privacy manifest, iOS pipeline, host routing, refund UI |

Mean **45.5**. Exactly **one merchant-facing feature** clears 70 (inventory reservations). Products,
orders, fulfilment, customers and discounts all sit at 50–69, capped by the same missing integration
evidence.

## 3. Scenario coverage — the decisive table

| Result | Count |
|---|---|
| Proven by an executing automated test | **3** — money-posts-once, cross-tenant-denied, session-fails-closed |
| Partial | 5 |
| Absent | 12 |

All three proven scenarios are **database-layer** proofs on the ephemeral Postgres fixture.
**Not one scenario crossing an HTTP boundary has been executed**, because no application runtime was
booted (the local stack requires a Supabase instance that is not running) and no CI runs on the
active branch.

**This single fact is the certification.** A commerce platform that has never once demonstrated
merchant-creates-product → buyer-buys-it → merchant-fulfils-it cannot be certified, however much
correct code it contains.

## 4. Environment truth

| Environment | Status |
|---|---|
| **Local** | Partially proven — DB layer green (4 suites), Flutter green (172/172, release APK built), HTTP layer never exercised |
| **Staging** | **NO EVIDENCE.** Not probed, not deployed |
| **Production** | **DOES NOT EXIST as a verified estate.** No deploy has ever run; 291 commits of lag; every live adapter NOT CONNECTED |

No claim of "live", "deployed", or "in production" appears anywhere in this package.

## 5. Unresolved risks carried forward

| # | Risk |
|---|---|
| R-1 | **Money correctness.** Four writers to `merchant_payable`. Until reduced to one and proven by a reconciliation harness, merchant balances cannot be trusted. |
| R-2 | **Tenancy in practice vs on paper.** The red team passes for the tables it covers, but `withTenantTx` is essentially unused. Coverage beyond the tested surface is **unmeasured**, and the "326 tables without FORCE" claim came from a grep method a verifier proved unreliable — it must be re-measured against a live database. |
| R-3 | **The gate hides 102 validators.** Fixing the design-system drift may reveal further failures — and will un-gate a destructive artifact cleanup (`HAZ-01`). |
| R-4 | **Storefront fix ordering.** Shipping `middleware.ts` without the now-fixed `published` writer *and* a back-fill would 401 every storefront. |
| R-5 | **A deploy without `--env production`** ships `FEATURE_EXTENSIONS="true"` and `FEATURE_LIQUID="true"` — flipping the Liquid default cohort-wide without the ART-17 gate. |
| R-6 | **Unpinned CI Flutter.** A Flutter release already turned this suite red once. |
| R-7 | **Governance drift outside the perimeter.** An unregistered 31-phase program shipped Never-Build-List code while its own state file recorded `EXIT=1` at every phase. |

## 6. What would change the verdict

**CONDITIONAL-GO becomes reachable when:**

1. Branch lag = 0 and CI runs on the working branch (G-02, G-03);
2. the five S0s are closed or ARB-waived with a remediation deadline (G-04…G-07);
3. `middleware.ts` + `published` back-fill ship together and a real store serves (G-10);
4. the merchant→buyer journey executes once, anywhere (G-11);
5. the mobile integration test executes, lifting the 69 cap (for V1.1).

**GO additionally requires** the doc 13 store gates for V1.1, monitoring connected, and the
provisioning in doc 14.

Item 4 is the pivotal one. Everything else is tractable engineering; without it there is no evidence
at all.

## 7. Certification statement

This package certifies **NO-GO** for a V1 launch of LetBuyy at commit `bf35062e`.

It further certifies, positively and on executed evidence, that:

- the **canonical money ledger kernel is behaviourally correct** — append-only enforced at the
  database layer, rejecting both UPDATE and DELETE, with derived-balance and double-release guards
  firing;
- **cross-tenant isolation holds** for the tested surface under a non-`BYPASSRLS` role (RT-1…RT-9);
- **session rotation rejects reuse**;
- **`commission_bps = 0`** is structurally enforced with a ratchet;
- **all six reserved services remain empty**;
- **no secret is committed**;
- **provider-mode honesty holds** — no stub reads as success;
- the **merchant mobile app is statically clean** (`flutter analyze` clean, 172/172 tests) and its
  **V1 exclusions are now enforced at route resolution**, deep links included.

Those are real achievements and they are not diminished by the verdict. The gap is between *built*
and *proven*, and this package's central recommendation is to close that gap before building
anything further.

**No signature block is provided.** Constitutional sign-off is an ARB act (§12) and cannot be
generated by automation. The decisions awaiting a human are listed in
[`14_HUMAN_REQUIRED_ACTIONS.md`](14_HUMAN_REQUIRED_ACTIONS.md) §5–6.
