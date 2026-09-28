# Phase 2 — Auth hardening and D03 runtime/backfill completion

**Date:** 2026-09-28 · **Branch:** `letbuyy/phase2-shared-buyer-identity` · **Task:** the reissued
mandate explicitly distinguishing this work from the prior two passes ("reverify four approved
slices" and its own two-test follow-up), covering four deliverables: A) buyer/merchant
`verification_tokens` redemption race, B) console session revocation, C) D03 backfill execution +
runtime shadow wiring, D) this record.

**Starting SHA:** `27a39c95` (verified against the actual repository, not assumed from the reissued
prompt's own stale claim). **Ending SHA (this record's own commit will follow):** see the branch log;
this pass's implementation commits are `90040449`, `7ae0959f`, `8a36e4aa`.

This document does not repeat what `PHASE2_DECISIONS.md`'s requirement matrix (updated alongside this
record) already states per-row; it records the reasoning, evidence, and limitations behind those rows.

## A — Buyer/merchant `verification_tokens` redemption race

**Reported as:** a read/delete TOCTOU, separate from the console's own (already-fixed) magic-link
consumption. **Verified, not assumed:** traced `POST /auth/custom/tokens/validate`
([auth.ts](../../../services/api-gateway/src/routes/auth.ts):1327) — a SELECT read `used`/`expires_at`,
checked them in application code, then ran an unconditional `UPDATE ... SET used=true WHERE id=X`
whose result was never even inspected. Reproduced against real local Postgres before writing any fix:
6 concurrent requests against one token, 6/6 returned 200 with identical redemption data.

**Severity, established by tracing real callers** (`apps/platform/identity`'s `verify-otp`, `verify`,
`reset-password` routes): the `magic_link` case in `verify/route.ts` mints a real login session
directly from this one validation call — worse than the console's equivalent, which only ever produces
a password-set intent.

**Fix:** a conditional UPDATE (`.eq('id', data.id).eq('used', false).gt('expires_at', now)`) makes the
consume step itself the single-use guarantee, via Postgres's own row-lock serialization. Re-proved
against the same real instance: 1/6. The negative control (reverting to the old code) surfaced a
second, worse defect: the old code discarded the UPDATE's error entirely, so a genuine storage failure
was reported as a false success, not merely a race.

**Evidence:** `verification-token-redemption.test.ts` (9 tests, fake PostgREST, persisted) +
`verification-token-redemption.postgres.test.ts` (2 tests, real Postgres, self-skipping, persisted).
Commit `90040449`.

## B — Console session revocation

**Reported as:** sessions may remain usable for up to 8 hours after access changes. **Verified, not
repeated as a claim:** the console's session cookie is a self-contained JWT (signature + `exp` only).
`isConsoleEmailAllowed` (the console's own canonical membership predicate, backed by
`PLATFORM_CONSOLE_ALLOWED_EMAILS`) was checked only at login. Both real gating layers —
`proxy.ts` (Next.js's actual middleware entry point in this Next.js 16 app; the framework renamed
`middleware.ts` to `proxy.ts`) and `requireConsoleSession()` (the server-component second layer) —
had the identical gap.

**Fix:** re-check `isConsoleEmailAllowed(session.email)` on every request in both layers. No new
authority or mechanism invented — this is the existing canonical check, called more often. Extracted
the allowlist predicate into a new, zero-import `console-access-allowlist.ts` so `proxy.ts` (which may
run in a runtime that cannot load `console-mfa.ts`'s `node:crypto` TOTP code) can depend on it safely.

**Scope, precisely stated, not padded:** "role downgrade" and "per-session revocation" do not apply
to this console's actual data model — its session carries no role/tier field at all (a single-tier,
allowlist-gated surface), and there is no per-session-jti revocation ledger. These are named
limitations, not claimed as tested.

**Evidence:** `proxy.test.ts` (6 tests against the real `proxy()` function with a constructed
`NextRequest` and a genuinely signed session token, not a mock). Wired into the app's own `test`
script. Negative control confirmed load-bearing. Commit `7ae0959f`.

## C — D03 backfill execution + runtime shadow evaluation

**Explicitly in scope per this mandate**, correcting the prior pass's boundary (repository + comparison
function only).

**Runtime shadow wiring:** added to `evaluateStaffRequest` in `staff-permission.ts` — the one
choke-point every merchant route already calls through (`products.ts`, `orders.ts`, `customers.ts`,
`inventory.ts`, `coupons.ts`, `stores.ts`, `smart-collections.ts`, `shipping-tax.ts`). Disabled by
default; opt-in only outside production (mirrors the existing `staffRbacMode` dry-run gate exactly).
Computes the real decision, computes the shadow decision, logs a bounded/redacted comparison, returns
only the real decision. 11 tests prove the real HTTP response is byte-identical on/off across every
representative case; a negative control (disabling the wiring, not an assertion) confirmed it
load-bearing.

**Backfill execution:** new `backfill-executor.ts`. Verified the real target schema before writing
anything (not assumed from `migration-scaffold.ts`'s own types) — `principals.id` is a DB-generated
uuid; the scaffold's `"legacy-merchant-<id>"` string is a plan-internal correlation key, never a
literal insert value. `store_memberships` has a real `UNIQUE(store_id, principal_id)`; `role_ids` is a
real `uuid[]`, not the scaffold's singular `role_id`. Implements: deterministic mapping by
`legacy_user_id` (never unverified email); idempotent reruns; interrupted-run recovery; ambiguous
identities block; non-active legacy memberships block rather than backfill as active (revocation
preserved); a missing prerequisite principal blocks its membership. 11 fake-postgrest tests + one real
local-Postgres run (3 principals inserted, idempotent rerun correctly skipped, a revoked membership
correctly blocked — verified by direct SQL count against the real tables, not just the function's
return value; synthetic data fully cleaned up after). Negative control confirmed the ambiguity guard
load-bearing.

**What this is not:** not a sustained, production-shaped shadow-observation period (a single
synthetic run proves the wiring and the decision logic, not real-traffic divergence rates over time);
not a cutover (current `staff-permission.ts` enforcement is untouched and remains the sole
authority); not a backfill of `credentials`, `authenticators`, `organizations`, `org_memberships`, or
`org_store_links` (out of the D03-approved merchant-staff-realm scope; only `principals` and
`store_memberships` were built).

Commit `8a36e4aa`.

## Tests and gate

Full gateway `test:unit`: 1252 discovered, 1242 pass, 0 fail, 9 skipped, 1 todo (baseline before this
mandate's three deliverables: 1219/1209 — the delta is exactly +33, the four new test files' combined
count). Console app's own `test` script: 22 + 11 pass, 0 fail (was 16 + 11; +6 from `proxy.test.ts`).
Typecheck clean on `@letbuyy/api-gateway` and `@letbuyy/admin-web`. `validate:tenant-isolation`:
passed (284 tenant tables registered, 0 direct service-role bypasses). Every previously-existing test
file touching this session's earlier work (`identity-reconciliation-report`, `principal-repository`,
`shadow-permission-comparison`, `buyer-export-contract`, `console-magic-link-consume`,
`require-platform-operator`, `operations-support-tier-wiring`,
`operator-scoped-admin-client-contract`) re-run and confirmed at 70/70, unaffected by this pass.

Full `gate.sh --full` re-run after all three commits: see this task's final chat response for the
exact table — reported there rather than duplicated here, since it is dated evidence about one moment,
not a durable fact for this file to restate.

## Explicit corrections to prior evidence (Section 15's own requirement)

- `GET /overview`'s tenant-guard 500 is **fixed** (commit `2e0c3204`, same day, a separate pass) — the
  requirement matrix's prior "flagged as a separate follow-up task, not fixed" line was already stale
  by the time this mandate started and is corrected in this update.
- D03's repository + shadow-comparison functions being real and tested was never itself a claim of
  full migration; this pass's backfill execution is still bounded to the merchant-staff realm's
  `principals` and `store_memberships` only, not the whole identity-foundation schema.
- The standalone shadow comparison function existing was correctly never described as "runtime
  integration" in prior evidence; this pass is what makes that description accurate.
- Nothing in this document treats "not yet attempted" work from a prior pass as policy-blocked where
  it was, in fact, simply not yet reached — this pass reached and completed the backfill-execution and
  shadow-wiring items the prior pass had explicitly left for a later, authorized continuation.

## Remaining owner decisions (unchanged by this pass)

D04.2–D04.4, D04.6, D04.9 (who assigns operator roles; bootstrap authority; recovery approver;
high-risk dual approval; moderation/impersonation route callers); D04.8 (delivery provider); D05.2–D05.8
(requester verification through incident ownership). None of this pass's work required or answered any
of these. Per-session console revocation (killing one issued token before its natural expiry, as
opposed to the allowlist-membership check this pass fixed) is a new, narrower, named limitation, not
yet an open decision item with a recommendation attached — it would need one before being built.
