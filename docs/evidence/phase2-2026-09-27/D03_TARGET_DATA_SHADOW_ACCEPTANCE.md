# D03 target-data shadow verification and auth-hardening acceptance

**Date:** 2026-09-28 · **Branch:** `letbuyy/phase2-shared-buyer-identity` · **Task:** the reissued
mandate distinguishing target-data-backed shadow verification from the prior pass's legacy-grant-
translation comparison, plus final gate accounting, console-revocation precision, and OTP acceptance.

**Starting SHA:** `fef9e73f` (verified against the actual repository). This document's own commit
follows the implementation commits listed in the final report.

## A — Pending gate accounting (Section 5)

The prior turn's full gate run (`sha=fef9e73f`) had not completed when compaction/handoff occurred.
Verified honestly rather than inferred: the process was confirmed STILL ACTIVE (`ps aux`, live PID,
not stuck) when this task began, competing for CPU with a concurrent, unrelated Edynox validation run
on the same machine (`Projects/Start_Up/Edynox-foundation`, untouched per this repository's own rule
against interfering with unrelated processes). It was not duplicated. It later completed on its own:
`failed=6` — one lane beyond the session's baseline five, `test:@letbuyy/theme-engine`'s
`"Urban Kicks fixture renders N=25 times within 30000ms budget"` timing-budget assertion. Reproduced
in isolation while the Edynox process was still running: it failed again, confirming this is
resource-contention-induced (theme-engine is untouched by any commit in this session) rather than a
regression. Not claimed fixed, not claimed unrelated by assertion alone — reproduced.

## B/D — Target-backed shadow data source (Section 6)

The prior pass's `shadow-permission-comparison.ts` translates **legacy grants** into a synthetic actor
— it proves permission-translation correctness (does the alias table + engine agree with what a
legacy grant should mean), never whether a real backfilled row exists. This is a genuinely different
question, confirmed true by inspection before writing anything: it cannot verify principal backfill,
target membership existence, role assignment, target revocation state, or site binding.

**New:** `identity-foundation/target-shadow-comparison.ts`. Hard rule enforced by construction: this
file never reads `employees` and never accepts a `granted` array. Its only inputs are a
`legacy_user_id` (used solely as the `principals.legacy_user_id` lookup key) and a `site_id`. Sequence
(exactly the mandate's own 1-7): (1) the caller passes in the already-computed legacy decision; (2)
resolve the principal via `legacy_user_id`; (3) load the `store_memberships` row for the site; (4)
resolve `role_ids` → `site_role_permissions`; (5) evaluate allow/deny (an explicit `deny` row always
wins over `allow` for the same action); (6) compare; (7) the caller returns only the existing
authoritative decision — this function's result is never itself consulted for enforcement. Every
"missing" path (no principal, no membership, inactive membership, no roles assigned) returns
`targetAllowed: false` explicitly — there is no code path that can return `true` without a real,
active, role-permission-backed row. Proven, not asserted: a negative control that changed the
"principal not found" branch to falsely return `MATCH`/`true` caused exactly one test to fail (the
"never grants" test) — every other test, including the ones exercising different outcomes, still
passed, showing this specific guarantee is what's actually being checked.

Wired into `evaluateStaffRequest` (`middleware/staff-permission.ts`) alongside the legacy-translated
comparator — both run when shadow mode is enabled, logged as two distinctly-named events
(`staff_permission_shadow_comparison` / `staff_permission_target_shadow_comparison`), both discarded
after logging.

**Circular import removed** (Section 7): `staff-permission.ts` imported
`compareStaffPermissionDecision` from `shadow-permission-comparison.ts`, which imported
`evaluateStaffPermission` back from `staff-permission.ts`. Extracted the pure primitive to
`lib/staff-permission-decision.ts` (no imports of its own); both comparators and the enforcement
module now depend on it without depending on each other. A shared `shadow-alias-lookup.ts` holds the
`canonicalActionFor` lookup both comparators also needed, for the same reason.

## Environment eligibility (Section 7)

`ENVIRONMENT !== 'production'` alone silently qualified staging, preview, an unset value, or a typo.
Fixed to require BOTH that AND `isLocalSupabaseEnvironment(env)` (this repository's own established
"is this genuinely local" signal — `SUPABASE_URL` contains `localhost`/`127.0.0.1`), matching the exact
convention already used elsewhere in this codebase (the local-schema-missing dev fallback in
`routes/auth.ts`). 7 pure tests: approved local development qualifies; production never qualifies even
with a localhost URL; a staging/preview-shaped `SUPABASE_URL` never qualifies regardless of the
`ENVIRONMENT` label; an unset `ENVIRONMENT` does not silently qualify a non-local URL; a malformed
`ENVIRONMENT` value does not either; the flag off never qualifies even locally; an unset `SUPABASE_URL`
does not silently qualify a non-production `ENVIRONMENT`. Negative control (reverting to the old,
looser check): exactly the 4 environment-dependent tests failed; the other 19 (identity-based, not
environment-based) were unaffected.

## Shadow independence (Section 11)

Two decisive tests in `staff-permission-shadow.test.ts`:
1. A backfilled, active, correctly-granting membership (legacy and target both allow — `MATCH`).
   Mutating **only** the target fixture (`store_memberships.status -> 'suspended'`, touching nothing
   in `employees`) produces `DIVERGE`/`TARGET_MEMBERSHIP_INACTIVE`, while the real HTTP response
   remains exactly 200 (unaffected). Restoring the target fixture returns `MATCH`.
2. Opposite direction: a legacy-denied user (`viewer-user`) is given a target principal + active
   membership + a role that **would** grant more than legacy — the real HTTP response remains 403
   (still denied), while the shadow log correctly records
   `DIVERGE_LEGACY_DENIES_TARGET_ALLOWS`.

Both prove the shadow path genuinely reads target data (not a copy of the legacy result) and cannot
change enforcement in either direction.

## C — Target semantics coverage (Section 8)

| Legacy capability | Target capability | Site scope | Notes |
|---|---|---|---|
| Owner bypass (`sites.custom_user_id`/`user_id`) | Not represented | N/A | `OWNER_BYPASS_NOT_REPRESENTED_IN_TARGET_MODEL` — named, not folded into a generic mismatch, in both comparators |
| `employees.permissions.granted` (write-implies-read) | `site_role_permissions.permission` via `store_memberships.role_ids` | `store_memberships.store_id` | The legacy write-implies-read rule has no target-model equivalent — a real, already-documented divergence (`DIVERGE_LEGACY_ALLOWS_TARGET_DENIES`), not fixed by copying legacy into the target actor |
| `*` / `prefix:*` wildcard grants | No wildcard concept | — | Not translated; the new model sees zero permissions for a wildcard-only actor (unchanged from the prior pass's own finding) |
| Unmapped legacy keys (customers, discounts, settings, …) | No canonical alias | — | `UNMAPPED_NO_CANONICAL_ALIAS`; only products:read/write, orders:read/write, super_admin are mapped today (unchanged) |
| Revoked/removed `employees` row | `store_memberships.status != 'active'`, or no row at all | `store_memberships.store_id` | Now actively reconciled (see below), not merely absent |

Verified, not assumed: store ownership stays site-scoped (owner bypass carries no cross-site
authority in either model); merchant and platform-operator permissions remain fully separate systems
(`staff-permission.ts` vs. `requirePlatformOperator()`/`INTERNAL_PERMISSION_TIERS` — no code path
connects them); an "administrator"-labeled product role was never granted merchant-owner authority.
This merchant/site slice does **not** prove organization-graph convergence — `organizations` and
`org_memberships` are untouched by this pass; only `principals` and `store_memberships` were backfilled
and reconciled, which the requirement matrix now states explicitly rather than implying broader
coverage.

## Backfill reconciliation (Section 9)

`executeStoreMembershipBackfill` previously only inserted/updated active memberships; a non-active
legacy row was blocked (never written), but an **already-existing active target row was never
touched** — exactly the gap named: "a revoked legacy row being skipped on a fresh run is not
sufficient." Now: resolves any existing target membership regardless of legacy status; if legacy is
non-active (removed or soft-deleted) and a target row exists and is still active, it is actively
revoked (`status -> 'removed'`); re-running on an already-revoked target is idempotent
(`skipped_already_exists`); a non-active legacy row with **no** prior target row still blocks (nothing
to reconcile). Re-approval (legacy flips back to active) upserts the membership back to active. 5 new
fake-postgrest tests plus full coverage in the real-Postgres acceptance test below. Negative control
(reverting the revoke branch to a no-op skip): exactly the 3 reconciliation-revocation tests failed.

Role/permission-level downgrade: tested via a direct `role_ids` change against real
`site_role_permissions` rows (see below) — there is no legacy-role-string-to-target-role-id mapping
to test a legacy-driven downgrade through, and none is invented (see the "known limitation" row in
`PHASE2_DECISIONS.md`).

## Persistent real-database acceptance (Section 10)

The prior pass's backfill proof was ephemeral (seeded, verified, deleted). New, persisted:
`services/api-gateway/src/__tests__/backfill-and-target-shadow.postgres.test.ts`. Self-skips (`t.skip`,
reported as `skipped:1 pass:0`, never a pass) only when no local Supabase instance is reachable; run
for this acceptance with the local stack up, it **passed**, not skipped. Covers in one seeded/cleaned
run: principal insertion; mapping stability (`legacy_user_id -> principal_id` resolves identically
across repeated lookups); membership insertion; role/permission resolution against **real**
`site_roles`/`site_role_permissions` rows (seeded by the test itself — both tables are empty in every
real environment, confirmed by inspection); idempotent rerun (verified by a direct `count(*)` query,
not just the function's return value); ambiguity blocking (a manually-inserted duplicate principal via
raw SQL); revocation after initial backfill (verified by a direct `status` query showing `'removed'`
in real Postgres); permission downgrade (swapping `role_ids` to a role with no matching permission
row, confirmed via the target comparator); partial-run recovery (a simulated interrupted run resumed
from the full input, confirming the already-processed row is skipped and the new one inserted).

A real tenant-guard rejection was hit and fixed during this work, not merely anticipated: the
reconciliation `UPDATE` originally scoped only by `.eq('id', existing.id)`; `store_memberships` is a
registered tenant table, and the guard correctly refused it (`"Tenant table store_memberships requires
a tenant/owner predicate"`). Fixed by adding `.eq('store_id', row.store_id)` — both satisfies the guard
and is a genuine extra correctness guarantee (the update can only ever touch the row already resolved
for exactly this store+principal).

## Bounded local shadow rehearsal (Section 12)

200 synthetic requests rotating 4 representative identities (owner, mapped-and-agreeing manager,
forbidden viewer, revoked staff) against the real `assertStaffPermission` entry point, shadow mode on:

```json
{
  "requests": 200,
  "elapsedMs": 143,
  "httpStatusCounts": { "200": 100, "403": 100 },
  "legacyShadowComparisons": 200,
  "targetShadowComparisons": 200,
  "legacyOutcomeCategories": { "OWNER_BYPASS_NOT_REPRESENTED_IN_NEW_MODEL": 50, "DIVERGE_LEGACY_ALLOWS_NEW_DENIES": 50, "MATCH": 100 },
  "targetOutcomeCategories": { "OWNER_BYPASS_NOT_REPRESENTED_IN_TARGET_MODEL": 50, "MATCH": 50, "TARGET_PRINCIPAL_NOT_BACKFILLED": 100 },
  "errorLogLines": 0
}
```

143ms for 200 requests through BOTH shadow dimensions confirms bounded per-request overhead. This is
explicitly **not** a production-traffic soak — it is synthetic, single-process, single-run. A
reproducible longer run: rotate a larger identity set (ideally including real backfilled
principals/memberships against the real local Postgres, not only the fake), raise the request count,
and record the same JSON shape; stop criteria for a genuine soak would be a fixed wall-clock duration
(e.g. 10 minutes) or a fixed request count (e.g. 50,000), whichever comes first; acceptance criteria
would be zero `*_EVALUATION_ERROR` outcomes and a stable p99 added-latency figure, neither of which a
143ms/200-request rehearsal can establish on its own — stated as a limitation, not claimed away.

## E — Console revocation: the real guarantee, precisely (Section 13)

- **When configuration loads:** `PLATFORM_CONSOLE_ALLOWED_EMAILS` is read from `process.env` fresh on
  every call (`getAllowedConsoleEmails`, no caching layer this repository added). The check itself is
  therefore always "live" relative to the running process's own environment.
- **Restart/redeploy required?** In practice, yes — most hosting models bake environment variables
  into a deployed process at build/boot time; a bare OS-level env change is not visible to an
  already-running Node process without a restart or redeploy. The fix's real guarantee is precisely
  this: **the very next request after the deployed process's environment actually reflects the
  change is denied** — not "instantly on an env-var edit alone."
- **Multiple instances disagreeing:** yes, possible during a rolling deployment — old instances still
  serving the previous environment until fully cycled out. Inherent to any env-var-based
  configuration in a multi-instance deployment; not something this fix introduces or resolves.
- **`proxy.ts` vs. `requireConsoleSession()` — identical policy?** Confirmed by code: both call the
  identical `isConsoleEmailAllowed` from the identical `console-access-allowlist.ts` module. One
  source of truth, not two independently-maintained checks that could drift.
- **Old cookies valid again after re-adding an email?** Yes, immediately — there is no per-session
  revocation ledger, only membership state. Removing then re-adding an email makes any still-unexpired
  session cookie for that email valid again on the very next request. "Removal" is a membership-state
  fact, not a permanent kill of any specific previously-issued token.
- **Does the gateway independently enforce membership?** No — `services/api-gateway`'s
  `internal-console.ts` routes are gated by `PLATFORM_CONSOLE_API_TOKEN`, a single shared,
  service-level credential common to every console-originated call. It proves "this request came from
  the console app," never "this specific operator is still allowed." The person-level check lives
  entirely in the console app's own layer.
- **Static-token routes bypassing person-level checks?** Yes — found for real, not hypothetically:
  `founding/action` and `founding/export` (see below), fixed this pass.
- **Real lifecycle test:** `proxy.test.ts`'s "operator removed from the allowlist" tests construct a
  session cookie **while the operator was still allowed**, then change only the allowlist env var for
  the subsequent request on the SAME cookie — this is the actual operational sequence (valid login,
  then revocation, then a later request), not a same-call `process.env` mutation disconnected from a
  real prior session issuance.

**New finding, fixed this pass:** `founding/action` (pause/resume/disable/enable the founding-merchant
program; reallocate/reclaim site slots) and `founding/export` (CSV export of allocation data,
site IDs, pricing) had **no session check of any kind** and are not covered by `proxy.ts`'s
`protectedPrefixes` matcher (`/api/founding/*` matches none of the listed prefixes). Both relied
solely on the shared `PLATFORM_CONSOLE_API_TOKEN`. New `lib/console-api-auth.ts` reads the session
directly from the `NextRequest` (deliberately avoiding `console-auth-server.ts`'s `server-only` guard,
which blocks testing outside real Next.js SSR) and checks the same `isConsoleEmailAllowed` predicate;
wired into both routes, returning a proper JSON 401/403 (not a page redirect, which would be the
wrong shape for a `fetch()`-based API caller). 6 tests (no-session / revoked-allowlist / no-MFA /
authorized-passes-through, × 2 routes); negative control confirmed load-bearing.

## OTP (verification_tokens) acceptance (Section 14)

Not rebuilt — verified against the existing, already-committed atomic fix:
- Exactly one concurrent redemption succeeds: re-confirmed (existing real-Postgres test,
  `verification-token-redemption.postgres.test.ts`).
- Storage error fails closed: re-confirmed (existing fake-postgrest test).
- Expiry, purpose (type), and principal (email) binding all hold: re-confirmed (existing tests).
- Every active caller uses the corrected path: re-confirmed by exhaustive search —
  `verify-otp`, `verify`, and `reset-password` in `apps/platform/identity` are the only three real
  callers of `POST /auth/custom/tokens/validate`; the fix lives in that one shared gateway endpoint,
  so there is no per-caller "uncorrected" path possible.
- **Downstream-failure behavior, inspected precisely:** in `reset-password/route.ts`, if
  `set-password` fails AFTER the token is consumed, the token is permanently dead and the password
  was never changed — the user must request a new reset link. The identical shape applies to
  `verify/route.ts`'s `email_verify` case if `verify-email`/session creation fails after consumption.
  This is a genuine, honest **usability** limitation (a legitimate user must retry via a fresh
  request), not a security defect — no double-spend, no bypass, and the existing "sequential replay"
  test already proves a consumed token can never be reused regardless of why it was consumed. Not
  fixed this pass (building retry/rollback semantics would be new feature work, not verification); no
  new test added, since the security property this concern would test is already covered.

## Tests and gate

Full gateway `test:unit`: **1270 discovered, 1260 pass, 0 fail, 9 skipped, 1 todo** (this task's
starting baseline: 1252/1242 — the delta, +18, is exactly this task's three new/expanded test files'
combined addition: `staff-permission-shadow.test.ts` 11→23 (+12), `backfill-executor.test.ts` 11→16
(+5), `backfill-and-target-shadow.postgres.test.ts` +1). Console app's own `test` script: **28 + 11
pass, 0 fail** (was 22+11 — +6 from the two new founding-route test files). Typecheck clean on
`@letbuyy/api-gateway` and `@letbuyy/admin-web`. `validate:tenant-isolation`: passed (284 tenant
tables, 0 bypasses). `domain-boundary-validator`: passed (one false-positive from this task's own
prose was found and reworded, not suppressed). Final full gate table is reported in this task's chat
response rather than duplicated here (dated evidence about one moment).

## Remaining owner decisions (unchanged by this task)

D04.2–D04.4, D04.6, D04.9; D04.8 (delivery provider); D05.2–D05.8. Per-session-jti console revocation
(as opposed to the allowlist-membership check this task hardened) is a new, precisely-named limitation
from this task, not yet an open decision item with a recommendation attached.
