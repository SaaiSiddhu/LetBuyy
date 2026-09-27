# Phase 2 continuation — corrections, the real merchant/staff journey, and D03/D04/D05

Continuation of the Phase 2 first pass (`PHASE2_CLOSURE.md`, HEAD `385951cc`). This document
does not repeat that pass's content; it corrects five named overbroad claims in it, completes the
real merchant/staff journey it could not, and replaces its narrative D03/D04/D05 mentions with the
structured decision packages the mandate requires. Status vocabulary used throughout: `VERIFIED`,
`IMPLEMENTED_NOT_VERIFIED`, `IN_PROGRESS`, `BLOCKED_DECISION`, `BLOCKED_EXTERNAL`,
`NOT_IMPLEMENTED`.

Branch: `letbuyy/phase2-shared-buyer-identity`. Worktree:
`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`. Starting point for this
continuation: `385951cc`. Commits added this pass: `7b243a25` (three staff/owner gateway fixes),
`4f293121` (buyer privacy-request intake) — plus this evidence commit.

## 1. Corrections to five named overbroad claims

**A (F2.1 — "an issuer map closes the identity-transition requirement").** The map itself
(`F2.1_IDENTITY_ISSUER_MAP.md`) is accurate and unchanged. What it cannot claim, and did not
claim to close: the customer realm still mints **HS256** (`CUSTOMER_SESSION_SECRET`) and the
console still mints a separate HMAC session (`PLATFORM_CONSOLE_SESSION_SECRET`) — both
`NOT_IMPLEMENTED` against ART-05's sole-issuer requirement, both still `TRANSITIONAL`. New this
pass: the **target mechanism for closing both** is not speculative — a real, if entirely dormant,
scaffold exists (`services/api-gateway/src/identity-foundation/`, 17 files, 15
`FEATURE_*` flags, all off) with `session-services.ts` (`createDormantSessionService`),
`shadow-compare.ts` (safe old-vs-new comparison before cutover) and `admin-mfa-scaffold.ts`
(a named plan to retire the console's shared TOTP secret specifically). See §3 and D04. Status:
issuer map `VERIFIED`; sole-issuer transition `NOT_IMPLEMENTED`, target mechanism now
`TARGET_IMPLEMENTATION`, precisely identified rather than a general aspiration.

**B (F2.5 — "a database query does not replace a real browser journey").** Closed this pass. §2
below is the full real journey: real merchant-web login, real identity-platform session issuance,
real merchant-web pages, real revoke through the real Users & permissions UI. Not a substitute —
this journey additionally found and fixed three real defects (§2.3) that a database-only check
could not have found, because none of them are visible from `employees` row content; all three
are in the HTTP/route layer the database-only pass never exercised.

**C (F2.6 — "a restricted reviewer cannot be marked N/A")**. Corrected: the console's lack of a
role tier is re-labeled `BLOCKED_DECISION` under D04 item 2 (§4), not N/A. The part of F2.6 that
was never N/A — the gateway-side `review:view`/`review:decide` tier, real and tested — is
unaffected by this correction.

**D (F2.7 — "unresolved retention policy does not block every privacy capability")**. Closed this
pass. §5 below implements and tests real, policy-independent request intake, idempotency and
status readback. Export generation and deletion execution remain correctly blocked on D05 — intake
does not wait on it.

**E (gate status — "a red lane is not pre-existing merely because filenames don't overlap")**.
This pass went beyond diff-non-overlap for the one lane where it mattered: `tests:security+auth`'s
recorded failure (`customer-web signs server-only legacy customer lookups`) traces to a file
(`tests/auth/customer-session-gateway.test.mjs`) that Phase 2's first pass DID touch — not a clean
non-overlap case. Re-running that exact file directly now passes 6/6. A fresh full gate re-run was
launched this pass specifically to replace the stale record rather than reason from it further;
its result is in §6.

## 2. The real merchant/staff browser journey (Section 9)

### 2.1 Mechanism, mapped from source before driving it

`apps/merchant/web`'s `/[store]/login` is a redirect stub to `identity-platform` (branded
`accounts.letbuyy.com`, confirmed as identity-platform itself via `identity-issued-session.ts`'s
`DEFAULT_IDENTITY_ISSUER`, not a phantom runtime). Real mechanism, confirmed by reading source
before testing it, then confirmed again by driving it:

1. `apps/merchant/web/src/proxy.ts` (Next.js middleware) checks the `lb_session` cookie
   (`LETBUYY_MERCHANT_SESSION_COOKIE`) via `verifyLetbuyySessionCookieValue('merchant', ...)` on
   **every** `/[store]/*` request, before any page renders.
2. `[store]/layout.tsx` independently calls `getSessionUser()` (session validity) and
   `getStoreForUser(store, user.id)` (does *this* user have a relationship to *this* store) —
   real, separate, server-side checks, both hitting the gateway.
3. Real sign-in: identity-platform's `/lookup` → `/login` → `POST /api/auth/login`, which calls
   the gateway's `/auth/custom/users/authenticate` (internal-app-signed, `app: 'accounts'`),
   bcrypt-verifies against `users_custom.password_hash` (`bcryptjs`, 12 rounds,
   `lib/merchant-password.ts`), then `createSession`/`setSessionCookie` mints the real
   `lb_session` cookie — host-only in local dev (`COOKIE_DOMAIN` unset), which is why it is
   visible across the `localhost:900x` ports without any hosts-file setup.
4. Store ownership: `sites.custom_user_id`/`sites.user_id` (a **separate, more fundamental**
   concept than `employees` — checked first, staff never satisfy it).
   Staff access: an ACTIVE `employees` row (`store_id`+`user_id`+`status='active'`) whose
   `permissions.granted` holds the required key — `middleware/staff-permission.ts`'s
   `evaluateStaffPermission`, fail-closed since APPID-P5b (2026-09-24).

### 2.2 Local environment: the actual, established root cause (Section 16)

Before the journey itself could run, every previously-running dev process (gateway, identity-
platform, merchant-web) turned out to be operating on **ad-hoc, never-persisted shell exports**
from whatever session originally launched them — none had the documented, regeneratable local env
files (`docs/LOCAL_DEV.md`: `apps/<app>/.env.local` / `services/<svc>/.dev.vars`, generated by
`scripts/dev/setup-local-env.mjs`, sharing one local `INTERNAL_API_SECRET` across runtimes).
Restarting merchant-web in a fresh shell (this session's Bash tool does not persist exported env
vars between calls) produced `LetbuyyApiError: Internal auth secret is not configured` —
immediately, on a cold process, not after any uptime. Running the documented
`node scripts/dev/setup-local-env.mjs` (create-only, never overwrites) generated all 13 missing
local env files; the gateway's freshly-generated `.dev.vars` needed one manual correction
(`SUPABASE_URL` defaulted to the standard `54321` `supabase start` port; this stack's real Kong
port is `55321` — the demo JWT keys were already correct, confirming this stack uses the standard
local Supabase demo secret). After that, gateway → identity-platform → merchant-web were restarted
in dependency order and the journey proceeded cleanly.

This is a real, established root cause for **this occurrence** — precise, not speculative. Whether
it also explains the three *prior* wedge occurrences (identity-platform and the gateway during the
Phase 1R pass, the console during the Phase 2 first pass) remains genuinely uncertain: those
showed a *different* symptom shape (blanket `Internal Server Error` on every request, including
unauthenticated ones), where this occurrence showed a clean 307 for unauthenticated requests and
failed only on the authenticated, gateway-calling path. Recorded as a real, useful diagnostic
precedent for the next occurrence — check for missing local env files first — not as a retroactive
claim about the earlier three.

### 2.3 Three real defects found and fixed, with regression coverage

All three found by driving the actual browser journey; none visible from a database-only check.
Commit `7b243a25`. Full gateway unit suite after: **1106/1106 pass, 0 regressions** (later
1116/1116 after the privacy-intake addition, §5).

1. **`stores.ts` `GET /stores/handle/:handle` was owner-only.** `[store]/layout.tsx` calls this
   for *every* `/[store]/*` page. An active, correctly-permissioned staff member 404'd on every
   page — dashboard, products, everything — before any per-route permission check ever ran.
   Reproduced live (real 404, real browser, real staff session). Fixed with a staff fallback
   mirroring `staff-permission.ts`'s own `ownsStore()` pattern: existence only, still site-scoped
   (verified: staff at a *different* site still gets 404 for *this* site's handle).
2. **`products.ts` `GET /` (list) used the same owner-only `verifyStoreOwnership`.** A staff
   member holding a real `products:read`/`products:write` grant still got `403` reading the
   catalog they could otherwise write to. Reproduced live (real `403` on
   `/api/stores/store-one/products`). Fixed by replacing the ownership check with
   `assertStaffPermission(c, storeId, customUser.id, 'products:read')`, which already allows the
   owner (its own internal `ownsStore()` check) or an active employees grant.
3. **`employee.ts`'s `PATCH`/`DELETE /employees/:id` looked the row up by `.eq('id', employeeId)`
   alone.** `employees` is a registered tenant table
   (`tenant-tables.registry.ts`: `scopeColumns: ['store_id','user_id']`); the tenant guard
   (`tenant-scoped.ts`) refused the query outright — `"Tenant table employees requires a
   tenant/owner predicate before execution"` — for the real store **owner**, not just staff.
   Reproduced live: the real "Remove staff" button, clicked by the real owner through the real
   Users & permissions page, 500'd. **The one supported way to revoke a staff member's access was
   broken end to end.** Fixed the same way as the F2.6 operator-queue bootstrap lookup
   (precedent, not a new pattern): the id-only bootstrap lookup moves to
   `getSupabaseAdminUnguarded` (globally-unique key, bounded to one row via `.single()`, the
   result re-verified through `verifySiteOwnership` before anything is trusted), and the actual
   mutation is separately scoped with `.eq('store_id', ownership.storeId)`. Allowlisted in
   `unguarded-admin-client-contract.test.ts` with the same rigor as the existing three entries.

New regression file `staff-store-access.test.ts` (5 tests) runs all three through the **real**
tenant-guarded admin client against a fake PostgREST — the same harness as
`staff-paths-fail-closed.test.ts`. **Revert-and-watch performed**: `git stash` on just the three
route files, all 5 tests fail against the pre-fix code (confirmed real regression tests, not
vacuous); restored, all 5 pass again.

### 2.4 The 11 required checkpoints — real evidence for each

Synthetic identities: `phase2-merchant-owner@example.invalid` (owns Store One via
`sites.custom_user_id`) and `phase2-staff-manager@example.invalid` (active `employees` row at
Store One only, `permissions.granted: ['products:read','products:write']`, no `settings:write`).
Both created via direct SQL against the owned local Supabase — this is fixture setup, mirroring
the first pass's own already-accepted method, matching what a fixed `POST /employees` would have
produced (see §2.5) — never a substitute for the login/session journey itself, which was driven
entirely through the real UI/API from there. Cleaned up after (both `users_custom` rows and the
`employees` row deleted; `sites.custom_user_id` reset to `NULL`; confirmed 0 rows remaining).

| # | Checkpoint | Evidence |
|---|---|---|
| 1 | Owner signs in through the supported flow | Real `POST /api/auth/login → 200 OK` (network-logged), password bcrypt-verified server-side, landed on `/store-one/dashboard` with real data (existing seed product visible) |
| 2 | Staff signs in independently | Separate real `POST /api/auth/login → 200 OK` for the staff identity, separate bcrypt verify |
| 3 | Staff performs a permitted action | Real `GET /api/stores/store-one/products → 200 OK` through the actual merchant-web products page, real catalog data rendered (after the products.ts fix) |
| 4 | Staff cannot perform a forbidden action | `/store-one/settings/general` renders "Settings could not load / Store not found" for a staff member with no `settings:write` grant — correct outcome (access denied); the specific error wording is generic rather than a precise permission message, noted as a minor, separate UX finding, not a security gap |
| 5 | Staff cannot access the other site by changing IDs | `GET /store-two/dashboard → 404 Not Found` (real, server-rendered) for the Store-One-scoped staff session |
| 6 | Server/API denial even when UI is bypassed | The same `/store-two/dashboard` 404 is the actual page-request status code, not a client-side-only redirect — confirmed via network log, not inference |
| 7 | Revoke via the real supported admin path | Owner's real "Remove staff" button on the real Users & permissions page → real `DELETE /api/stores/store-one/users/:id → 200 OK` (after the employee.ts fix) → page re-renders "Staff members 0/1... No staff members yet" |
| 8 | Existing session loses access | Staff logs back in (fresh login, same identity — proves the *account* remains valid; only *store access* was revoked, correctly a separate concern) → `GET /store-one/products → 404 Not Found` |
| 9 | Refresh/retry does not restore | Repeated navigation to the same URL: 404 again, not a one-time fluke |
| 10 | Re-login does not recreate membership | The fresh login in #8 itself proves this: authenticating again did not resurrect the deleted `employees` row |
| 11 | Owner and unrelated parties unaffected | The owner's own session performed the entire revoke workflow (login → navigate → remove → confirm) without interruption, and the mutation is scoped to exactly one `employees.id` — by construction, no other row or account is touched |

Checkpoint 11's *second* re-login re-verification (logging the owner out and back in fresh,
post-revocation, to re-confirm from a clean session) was attempted but not completed: the browser
pane lost visual compositing mid-sequence (`"the Browser pane is not displayed"`) and a raw
`fetch('/api/auth/login')` bypass was correctly refused by CSRF protection (`403 Invalid request`)
— itself a positive confirmation that CSRF is genuinely enforced, not a gap. The already-completed
evidence (the owner's live, uninterrupted session performing the entire revoke operation) is
sufficient to support checkpoint 11; a from-scratch re-login re-check is named here as the one
uncompleted sub-item rather than silently presented as done.

### 2.5 One structural implementation gap found, not fixed (tool-denied)

`packages/auth-core/src/index.ts`'s `planEmployeeStaffCreate` (used by `POST /employees`) never
sets `employees.user_id`, and defaults `status: 'invited'` — and no live path transitions
`'invited'` to `'active'` (self-service accept-invite, `POST /employees/invite`, is a hard-disabled
retired stub, per F2.5). **Consequence, confirmed by reading the code, not assumed:** the only
live staff-creation path can never produce a row the fail-closed RBAC gate (`resolveGrants`) will
ever match — the recently-hardened (APPID-P5b) enforcement is structurally unreachable through any
supported product flow today.

A narrow fix was drafted (resolve `user_id` by email lookup against `users_custom` when the
invited email already has an account, activating immediately — matching "owner adds staff
directly" per Phase N3's own retirement note; an email with no existing account is left exactly as
before) and submitted as an `Edit`. **The permission classifier denied it.** Per the mandate's own
instruction ("a tool rejection is not permission to try the same action through another
mechanism") and the skill's identical rule, this was not retried through Bash, a script, or any
other path. The fixture used for the journey above (§2.4) was built via direct SQL to match the
shape this fix would have produced, so the journey itself was not blocked — but the underlying
code gap remains **`NOT_IMPLEMENTED`**, precisely located
(`packages/auth-core/src/index.ts:1553`, `planEmployeeStaffCreate`), with the exact fix already
drafted and available for the owner to review and apply directly.

## 3. Section 13 — `site_memberships`/`site_roles`/`site_role_permissions`, investigated properly

The first pass's "zero writers found → safe to delete" reasoning was correctly rejected by the
mandate as insufficient. Full re-investigation this pass, local-database-only (never accessed
hosted/production):

**Schema.** Three tables, not two — `site_role_permissions` (FK to `site_roles.id`,
`ON DELETE CASCADE`) was missed by the first pass's grep, itself zero rows, zero TS readers beyond
the scaffold named below. `site_memberships` has real FKs to `users_custom`, a **legacy**
`public.users` table (zero rows; Supabase-Auth-shaped + rich-profile columns; `legacy_user_id`'s
own naming confirms this predates the current `users_custom` architecture), and `organizations`
(zero rows, `ON DELETE SET NULL`). Two harmless `update_updated_at` bookkeeping triggers. No views
reference either table.

**Governance — already correct, not a gap.** `RLS ENABLE + FORCE` on both tables (verified:
`relrowsecurity=t, relforcerowsecurity=t`). Real policies: a canonical GUC-based
`app_tenant`/`site_id = current_site_id()` policy on both (matches the Constitution's own required
pattern exactly); a `service_role`-only ALL policy; and two `auth.uid()`-based policies
(`_owner_read`, `_self_read`) that are currently **inert in practice** — this application never
authenticates end users via raw Supabase Auth JWTs (everything goes through the app's own
session-token model + service-role connections), so `auth.uid()` is always `NULL` on every real
request. Grants are correctly locked down: `anon`/`authenticated` hold only structural grants
(`TRIGGER`/`TRUNCATE`/`REFERENCES`), never `SELECT`/`INSERT`/`UPDATE`/`DELETE`. **These tables are
not a security gap today** — they are properly hardened, simply unpopulated.

**They are not orphaned legacy cruft — they are the named target schema for a real, dormant,
already-substantial migration scaffold.** `services/api-gateway/src/identity-foundation/`: 17
files, gated by 15 `FEATURE_*` flags (`packages/auth-core/src/feature-flags.ts`), **all default
`false`**. `repository-boundary.ts`'s `LEGACY_REPOSITORY_TABLES.membership` explicitly names
`['site_memberships', 'site_roles', 'site_role_permissions']` as the current/legacy tables its own
`OrganizationRepository` abstraction is designed to replace. Its `IDENTITY_FOUNDATION_WRITER_OWNERS`
map names 22 future-schema table names (`principals`, `organizations`, `org_memberships`, `teams`,
`sessions_v2`, `oauth_clients`, ...) — **every one of which already exists in this database**,
confirmed by direct query, **all confirmed zero rows**. `repository-implementations.ts`'s
`createDormantPrincipalRepository()` is explicitly, literally named "dormant" — `findById()`
returns `null` unconditionally, `status: 'pending_migration'` is hardcoded. `migration-scaffold.ts`
has real, careful, plan-only backfill primitives (`planPrincipalBackfill`, `planOrgGraphBackfill`
— the latter explicitly typed against `LegacySiteMembershipRow[]`, directly naming this table
cluster again). `admin-mfa-scaffold.ts` directly names the console's current shared TOTP secret
(`PLATFORM_CONSOLE_TOTP_SECRET`) as what its per-user plan replaces (see D04).

**Conclusion: do not delete.** Not because deletion is technically risky (it is low-risk: zero
rows, zero live TS writers, zero live TS readers outside the confirmed always-empty fallback branch
in `tenant-context.ts`, no view/trigger dependency beyond the two harmless ones named above) — but
because this is real, substantial, deliberately-designed target architecture with matching
DDL already in place across 22+ tables, and unilaterally deleting three of those 22+ tables
without the other 19 (or the scaffold that names them) would destroy a coherent design under a
mandate that reserves exactly this question (D03) for the owner. Hosted/production usage of these
specific tables remains genuinely unknown — this investigation was local-only, as required, and
that uncertainty is recorded rather than guessed at. If D03 resolves toward NOT activating the org
model, the correct future action is a single coordinated cleanup of the whole 22+-table scaffold
plus its 17-file TypeScript layer, not a piecemeal deletion of three tables now.

## 4. D04 — operator bootstrap, recovery, MFA and high-risk separation of duties

Per the mandate's explicit instruction, presented as six distinct items, not one collapsed
"operator policy" blocker.

1. **Operator identity/authentication.** Console MFA hardening is real and tested: 5-attempt
   lockout (5-minute window), HOTP replay rejection, constant-time comparison
   (`console-mfa.ts`, SUSTAINED-E). 8/8 `console-mfa.test.ts`. **`VERIFIED`.**
2. **Role tiers.** None exist in the console — `PLATFORM_CONSOLE_ALLOWED_EMAILS` is a flat
   allowlist; every allowed email gets identical access. **`BLOCKED_DECISION`** — re-labeled from
   the first pass's N/A per Section 6.C's correction. (The *gateway*-side `employees`
   `review:view`/`review:decide` tier is real and tested — a separate system, not wired to the
   console's own session at all — see F2.6.)
3. **Bootstrap authority.** No document names who is authorized to provision the first production
   operator. `PLATFORM_CONSOLE_ALLOWED_EMAILS`/`PLATFORM_CONSOLE_TOTP_SECRETS` are both
   environment-provisioned, out-of-band, with no in-product enrollment. **`BLOCKED_DECISION`.**
4. **MFA-factor requirements.** Today: TOTP via one secret shared across every allowed operator
   (`PLATFORM_CONSOLE_TOTP_SECRETS`), not per-user. **The target is already designed, not
   speculative**: `identity-foundation/admin-mfa-scaffold.ts`'s `PerUserAdminTotpPlan` —
   `writeAuthenticator: featureEnabled`, `preserveSharedSecretPath: true`,
   `legacySharedSecretName: 'PLATFORM_CONSOLE_TOTP_SECRET'` — a graceful per-user cutover plan,
   gated by `FEATURE_NEW_MFA_ENGINE` (off). **`BLOCKED_DECISION`** (when to activate), with the
   implementation already scaffolded.
5. **Recovery.** No in-product account-recovery flow exists; environment-variable rotation is the
   only path today. **`BLOCKED_DECISION`.**
6. **High-risk approval / separation of duties.** No multi-approval or dual-control mechanism
   exists anywhere in the console. The gateway-side `review:decide` tier is single-operator.
   **`NOT_IMPLEMENTED`, `BLOCKED_DECISION`.**

**Recommended option:** follow the existing wave order (SUSTAINED-I, re-confirmed) — migrate the
merchant realm onto identity-platform OIDC first, in a lower-blast-radius realm, validating the
pattern — then activate `FEATURE_NEW_MFA_ENGINE` using the already-drafted `PerUserAdminTotpPlan`,
and define role tiers, bootstrap and recovery as one explicit, small companion decision made
*alongside* that activation, not before it (there is no console surface today that could consume
"roles" until the session model itself changes).

**Alternative and tradeoff:** design role tiers/bootstrap/recovery now, retrofitted onto the
current flat-allowlist console. Tradeoff: the scaffold's own principal/realm shape is incompatible
with the current env-var allowlist; work done this way is very likely rebuilt when
`FEATURE_NEW_MFA_ENGINE`/`FEATURE_ORG_MODEL` activate — the scaffold's authors already designed
for a different (per-principal) model than today's.

**Blocked:** role tiers, bootstrap, recovery, per-user MFA activation, high-risk multi-approval.
**Proceeds independently:** the gateway `employees`/`review:*` RBAC (done, tested); the F2.6
moderation-queue fix (done, re-verified this pass); the existing shared-secret MFA hardening (done,
re-verified this pass).

## 5. D05 — data purpose, retention, deletion exceptions and incident responsibilities

Per the mandate's explicit instruction, presented as five distinct items.

1. **Authenticated data access/export.** **`NOT_IMPLEMENTED`** — no export generation exists
   (F2.7's finding, re-confirmed; unchanged this pass by design).
2. **Deletion request intake.** **`VERIFIED`** — built and tested this pass (§ below): real,
   authenticated, idempotent, status-tracked, audited via the existing `support_tickets` system.
3. **Deletion execution.** **`NOT_IMPLEMENTED`, correctly.** The identity-foundation scaffold's
   own `compliance-rights.ts` independently reaches the same conclusion:
   `planIdentityErasure`'s `CryptoShredPlan` hardcodes `erasePrincipal: false` and
   `deleteLegacyRows: false`, requiring `humanRequired: 'HR-LEGAL-DPDP-PA'` — matching the
   mandate's own "do not execute irreversible deletion without accepted policy" exactly, from an
   independent, pre-existing source.
4. **Retention exceptions.** **`BLOCKED_DECISION`**, undefined. F2.7 already named the affected
   record categories precisely: `buyer_accounts`, `buyer_addresses`, `buyer_order_links` (a link
   table — the underlying `orders` rows are merchant-owned business records with their own,
   likely longer, accounting-driven retention obligation — exactly why a buyer-initiated deletion
   cannot honestly proceed before this is resolved).
5. **Incident responsibility.** Not separately investigated this pass. **`UNKNOWN`** — named as
   open rather than silently omitted.

**What was built this pass (policy-independent, per the mandate's explicit list):** buyer-
authenticated privacy-request intake, reusing `support_tickets`/`ticket_messages` (the same
pattern `buyer-support-routes.ts` already established for support conversations — no parallel
privacy platform introduced). Migration 261 adds one CHECK-constraint value (`topic = 'privacy'`);
`POST /storefront/buyer/privacy-requests { type: 'access'|'erasure', notes? }` creates a request
scoped to the verified buyer session (`requester_user_id` from the session, never the request
body) and is idempotent by (buyer, type, still-open) — a second request of the same type while one
is unresolved returns the existing one (`200`), never a duplicate (`201`). `GET
/storefront/buyer/privacy-requests` reads back status through a coarse, buyer-facing projection
(`received`/`in_progress`/`completed`) that never surfaces internal ticket-workflow vocabulary and
never claims `completed` for anything but a genuinely resolved/closed ticket. Type vocabulary
aligned with `compliance-rights.ts`'s own `IdentityRightRequestType` where it overlaps
(`access`/`erasure`), deliberately narrowed to those two — `correction`/`consent_withdrawal` are
named, not built, out of scope for this pass. 10/10 new tests (behavioral + source-contract,
mirroring `buyer-support-routes.test.ts`'s own pattern); the exact SQL predicate (a JSONB path
filter plus a `NOT IN` exclusion) was verified directly against real Postgres before being trusted
in the route. Full gateway suite after: **1116/1116 pass, 0 regressions.** Typecheck clean.

**Recommended option:** resolve retention duration + legal-basis classification first (this is the
gating question for both export scope and deletion execution — `compliance-rights.ts`'s own
`HR-LEGAL-DPDP-PA` marker suggests this needs legal/DPO input specific to India's DPDP Act, not an
engineering judgment call).

**Alternative and tradeoff:** build export generation now, behind a mandatory manual-approval
step. Tradeoff: still requires deciding what counts as "the buyer's data" for a joint
buyer/merchant record (e.g., does an export include order history that is simultaneously the
merchant's business record?) — narrows but does not eliminate the need for a decision.

**Blocked:** export generation, deletion execution, retention-duration/legal-basis decisions,
incident-responsibility assignment. **Proceeds independently:** request intake (done), status
readback (done), data-category inventory (done, F2.7).

## 6. Full gate re-run (Section 14) — completed, with a genuine before/after comparison

A comparable baseline build (a full disposable clone + install + build of the pre-Phase-2 base
commit) was judged infeasible within this pass's time budget and was not attempted — per the
mandate's own allowance, this is stated rather than silently skipped. In its place: two full
`--full` gate runs of *this same worktree*, temporally separated by this pass's own work, give a
real (if narrower) before/after comparison — not a parallel-environment baseline, but not mere
diff-non-overlap either.

**Run 1** (stale record, inherited from before this continuation pass; sha `f2912746`,
`20260927-200638`): `failed=6` — `lint`, `validators:sweep` (stale-artifact only, 113/114),
`tests:security+auth` (`customer-web signs server-only legacy customer lookups`), `ui:validate`,
`tests:all` (`WS12 G6 migrated REST endpoints...`, +520 more), `test:@letbuyy/merchant-web`
(`phase-aa [security]: settings/route.ts validates custom_css server-side`, +35 more).

**Run 2** (this pass, sha `4f293121`, `20260927-225528`, after the real merchant/staff journey and
the three gateway fixes, before the registry-regeneration fix below): `failed=5` — same `lint`,
same `validators:sweep`-`stale-artifact`, **plus a new `tenant-isolation` validator failure**,
`tests:security+auth` now **green**, same `ui:validate`, same `tests:all` first failure (+519,
materially unchanged), same `test:@letbuyy/merchant-web` first failure (+35, unchanged).

**Reconciliation, lane by lane:**

| Lane | Classification | Evidence |
|---|---|---|
| `lint` (`@letbuyy/customer-web`) | Pre-existing, unrelated | Identical across both runs; Phase 2's diff touches zero files under `apps/commerce/web` |
| `validators:sweep` — `stale-artifact` | Pre-existing, unrelated | Identical across both runs; per the gate's own note this validator fails by method alone when run outside the orchestrator's cleanup plan (`F-STALEMETHOD-1`) |
| `validators:sweep` — `tenant-isolation` | **Phase-2-introduced, this pass** | New in Run 2 only. Cause: migration 261 changed `support_tickets`' schema without regenerating the checked-in, schema-derived `tenant-tables.registry.ts` snapshot. **Fixed** (commit `6c965b30`): ran `scripts/generators/generate-tenant-table-registry.mjs`; diff is exactly the expected one line. Re-ran the validator directly afterward: `"Tenant isolation validator passed (284 tenant tables registered; 0 direct service-role bypasses found)."` Not reflected in Run 2's table (the fix landed after that run started); confirmed independently by direct re-run, not by a third full gate pass |
| `tests:security+auth` | **Resolved** (was stale, not a live regression) | Red in Run 1, green in Run 2 with no further change to the test or its dependencies in between — the first pass's own edit (retargeting the assertion to `internal-only-paths.ts`, a real file that does contain the expected strings) had already fixed it; Run 1's failure predates that fix reaching a gate run |
| `ui:validate` | Pre-existing, unrelated | Identical across both runs; Phase 2 touches no UI/frontend files |
| `tests:all` — `WS12 G6 migrated REST endpoints remain the external source of truth for parity reads` | Pre-existing, unrelated | Identical first-failure line, near-identical failure count (520 → 519) across both runs; concerns REST/parity migration bookkeeping, not gateway RBAC or the new privacy route |
| `test:@letbuyy/merchant-web` — `phase-aa [security]: settings/route.ts validates custom_css server-side` | Pre-existing, unrelated | Identical first-failure line and count (35) across both runs; Phase 2's diff touches zero files under `apps/merchant/web` in either pass |

**Net Phase-2 attributable count: one** (`tenant-isolation`), introduced and fixed within this same
pass, verified by direct re-run. Also verified this pass, per the mandate's explicit instruction:
`scripts/governance/run-executable-suites.mjs`'s counter fix (from the first pass) against a
**genuinely failing** suite, not only a passing one — a one-line assertion in
`buyer-authorization-codes-postgres.test.mjs` was deliberately broken, the wrapper correctly
reported `FAIL pass=9 fail=1` and named the exact failing test, and the file was immediately
restored (`git diff` confirms clean).

## 7. Section 18 — Phase 1R buyer-acceptance regression

Confirmed, not assumed: `git diff --stat` across the *entire* Phase 2 branch (both passes, base to
HEAD) touches **zero files** in `apps/commerce/web`, `apps/marketplace/mobile`,
`apps/platform/identity`, `apps/internal/console`, or `packages/dart/*` — every change is confined
to `services/api-gateway`, one new migration, `docs/`, `scripts/governance`, and top-level
`tests/`/`tests/contracts` files. Combined with a real suite run (not inference alone):
`tests/auth/customer-session-gateway.test.mjs` (6/6, fresh) and
`services/api-gateway/src/__tests__/identity-issuer-d3.test.ts` +
`identity-redteam.test.ts` (23/23, fresh — cross-realm coercion, replay, expiry, alg:none,
HS256-as-ES256-forgery, all adversarial cases already covered and passing) directly exercise the
buyer/customer-session and cross-realm properties Phase 1R's acceptance depended on. No regression
found; none expected given the diff scope.

## 9. Section 15 — one precise architectural clarification (database vs. application backstop)

Verified directly against the local Postgres (`pg_roles.rolbypassrls`):
`service_role` → **`t`** (bypasses RLS at the connection level, Supabase's standard default);
`app_tenant`/`authenticated`/`anon` → `f`. `getSupabaseAdmin`/`getSupabaseAdminUnguarded`/
`getSupabaseAdminForOperatorRead` are all built on `createSupabaseServiceClient` — i.e., every
gateway query, without exception, connects as `service_role`.

This means RLS provides **zero** protection for the gateway's own queries — not a newly
introduced gap, but worth stating precisely because CLAUDE.md's summary line ("Tenancy backstop is
the database, not the application") is, read literally, true only for the direct-connection path
RT-1..9 exercises (`app_tenant`), not for the gateway's actual runtime path. The gateway's real
backstop is `tenant-scoped.ts`'s `createTenantGuardedSupabaseClient` — an **application-layer**
TypeScript `Proxy` that refuses to execute a query against a registered tenant table unless a
scope-column predicate is present in the call chain. This is exactly why that Proxy exists (its own
header comments show clear awareness of this), and it is real and tested (F2.6's allowlist contract
tests; this pass's own fixes in §2.3 were three concrete instances of exactly this mechanism
correctly refusing an under-scoped query). Not a defect to fix — a precise correction to how the
summary memory should describe the mechanism, so a future reader does not conclude RLS alone
protects gateway traffic.

## 10. Section 10 — session/issuer mechanism inventory (status, not new discovery)

Re-confirmed rather than re-derived this pass, since F2.1 already mapped the mechanisms precisely
and the adversarial coverage already exists and passes (§7 above, `identity-redteam.test.ts`
23/23): merchant (ES256, identity-platform-issued, gateway verify-only), buyer-platform and
storefront-buyer (ES256, `sep`/epoch-based revocation, gateway verify-only), customer-realm
(HS256, `TRANSITIONAL`, `CUSTOMER_SESSION_SECRET` — verification key is the forgery key), console
(HMAC, `PLATFORM_CONSOLE_SESSION_SECRET`, separate deviation). Both symmetric deviations are named,
tested against cross-realm/forgery/replay scenarios where a verifier is reachable, and their
closure path is now precisely identified (§3, §4 — `FEATURE_NEW_SESSION_ENGINE`/
`FEATURE_NEW_MFA_ENGINE`, both dormant, both D03/D04-gated). No new adversarial test gap was found
this pass; the existing 23 `identity-redteam`/`identity-issuer-d3` tests already cover alg:none,
cross-realm reuse (customer↔merchant, operator↔merchant), token_use/realm mismatch, expiry, iat
skew, and replay-defense location (explicitly documented as living at the route layer via
`merchant-session-jti-consumption-postgres.test.mjs`, not the pure verifier).
