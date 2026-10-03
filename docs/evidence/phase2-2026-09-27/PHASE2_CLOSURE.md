# Phase 2 closure — shared buyer identity, privacy and order visibility

2026-09-27. Branch `letbuyy/phase2-shared-buyer-identity`, worktree
`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`, branched from `develop` @ `130b669d`
(Phase 1R's own integration + evidence commit, verdict A). Not merged, not pushed, per the mandate's
own boundary — this document is the local closure record for the owner's review.

Execution mode: **SINGLE AGENT** · Subagents invoked: **NO** · Agent/Task delegation: **NO** ·
Background agents: **NO** · Parallel worktree agents: **NO** · Workflow orchestration: **NO**.

## Execution/status matrix

| Package | Current implementation | Proven gaps closed this phase | Status |
|---|---|---|---|
| F2.1 Identity authority and transition map | 9-realm issuer/consumer matrix built from current source (`F2.1_IDENTITY_ISSUER_MAP.md`) | Named a second symmetric-secret deviation (console session) precisely for the first time; traced merchant-session revocation (DB-backed, not a gap) | **VERIFIED** (mapping); two items named for handoff, not fixed (see below) |
| F2.2 Buyer sessions across origins | PKCE + exact-redirect-match + S256 + audience/realm separation, already built (APPID-P4a-P4d) | none needed — re-verified: 20+12 gateway tests, 10/10 fresh real-Postgres replay/expiry/concurrency/RLS proof, 3/3 CSRF, 1 live adversarial probe | **VERIFIED** |
| F2.3 Buyer profile and addresses | Atomic default-address switch, ownership enforcement, already built | none needed — re-verified: 8/8 fresh real-Postgres atomicity/ownership/cascade/role-containment proof | **VERIFIED** |
| F2.4 Historical and new order ownership | `buyer_order_links` as sole ownership source, operator conflict-resolution path, already built (APPID-P3) | none needed — re-verified: 17/17 gateway tests, 12/12 fresh real-Postgres unverified-stranger/conflict/operator-resolution/role-containment proof | **VERIFIED** |
| F2.5 Merchant and staff convergence | `employees` live and structurally revocation-safe; `identity-foundation` org model dormant (correctly) | Corrected `site_memberships`/`site_roles` framing (dead-in-effect, 3 real read call sites, zero writers); 4-scenario real-database staff journey (store-scoping, revocation) | **PARTIALLY COMPLETE** — D03 (staff-migration timeline) genuinely open, presented not resolved |
| F2.6 Operator identity and privileged actions | Console MFA hardened (SUSTAINED-E); gateway RBAC two-tier and tested | **Fixed**: operator moderation read-path break (F-ADM4-1 #5) — no operator could complete an approve/reject/take-down before this phase; 2 stale contract-test assertions retargeted; real browser journey (ordinary account denied) | **PARTIALLY COMPLETE** — D04 (bootstrap/MFA-factor/role-tier) genuinely open; console has no role concept to test "restricted reviewer" against |
| F2.7 Privacy and database isolation | RLS/GUC tenant fence, already built | none needed — re-verified: 2/2 + 1/1 fresh real-Postgres red-team proof (RT-1..9, security-rls-hardening); confirmed absence of buyer-facing export/deletion (named for handoff) | **PARTIALLY COMPLETE** — D05 (retention/deletion policy) genuinely open; export/deletion is net-new capability, not built |

> **Correction (2026-09-29) — the F2.5 row above and "Exact next task" below are superseded.** The row's "dead-in-effect,
> … zero writers" finding was true on 2026-09-27 and stopped being true the next day:
>
> - `PHASE2_CONTINUATION.md` §3 (the same day) had already concluded **do not delete**: these tables are the named target
>   schema of the identity-foundation scaffold, and dropping three of 22+ coherent tables piecemeal is not a safe cleanup.
> - The D03 work of 2026-09-28 made `site_roles` and `site_role_permissions` **load-bearing**: `owner-role-backfill.ts` and
>   `staff-role-backfill.ts` write them (library code run by persisted tests; no route or worker calls them yet),
>   `target-shadow-comparison.ts` reads `site_role_permissions` and is imported by the live `staff-permission.ts` gate, and
>   `resolveTenantAccessProfile` (called from `middleware/store-context.ts` on store-scoped requests) reads all three tables.
> - The accepted identity design reuses `site_roles`/`site_role_permissions` as the canonical role catalog and plans
>   `site_memberships` → `store_memberships` as a dual-run migration (`ORGANIZATION_ARCHITECTURE.md` M3–M5), not a drop.
>
> **No deletion of any of these tables is authorized, and none was performed.** `site_memberships` is assessed on its own —
> it is not interchangeable with `store_memberships`. The trace, the assessment and the replacement queue are in
> `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §3 and §10.

## What was actually implemented (not audited, not proposed — done, tested, negative-controlled)

1. **`services/api-gateway/src/lib/supabase.ts` + `routes/operations/marketplace-listings.ts`**: closed
   F-ADM4-1 break #5. Two narrow, allowlisted, contract-tested exceptions to the tenant query guard
   (`getSupabaseAdminUnguarded` extended by one caller; `getSupabaseAdminForOperatorRead`, new). A
   `todo`-marked test now passes for real. Commit `d951050b`.
2. **Two stale contract-test fixes** (console dev-MFA-bypass path; customer-web internal-only-path
   allowlist) — both were refactors-moved-the-code-not-a-regression, confirmed by reading the current
   source before retargeting either test. Commits `f1db4fd2`, `aa332c16`.
3. **`scripts/governance/run-executable-suites.mjs`**: fixed a silent 0/0/0 pass/fail-count bug (stale
   Node-test-runner output-format regex) that was defeating this tool's own stated purpose on every
   run, for every suite, regardless of outcome. Commit `27b1b320`.
4. **Three long-running dev servers found wedged and restarted** (identity-platform and api-gateway
   during the prior Phase 1R pass; `apps/internal/console` this phase) — all sharing the same symptom
   (`Internal Server Error`, ~1-day uptime) and the same fix (restart from the primary checkout,
   output captured). Root cause not established across three occurrences — named as a Phase 2 handoff
   item, not claimed diagnosed.

Every fix above has before/after evidence and, where the change touches security-relevant logic
(items 1, 2), a genuine negative control (stash-revert-restore, confirmed the test fails for the
original reason with the fix removed).

## Automated test counts (this session, fresh)

| Suite | Result |
|---|---|
| `test:contracts` | 320/320 |
| `tests/security/*.test.mjs tests/auth/*.test.mjs` (`tests:security+auth`) | 37/37 |
| Gateway `test:unit` (`services/api-gateway/src/__tests__/*.test.ts`) | 1111 tests, 1101 pass, 0 fail, 9 skip, 1 todo (unrelated, `LB-BIL-002`) |
| `tests:governance` | pass (full `gate.sh --full` lane) |
| `unguarded-admin-client-contract.test.ts` | 5/5 |
| `operator-scoped-admin-client-contract.test.ts` (new) | 5/5 |
| `operator-moderation-auth-chain.test.ts` | 7/7 (0 todo, was 1 todo) |
| `staff-permission.test.ts` | 9/9 |
| `staff-paths-fail-closed.test.ts` | 9/9 |
| `buyer-authorization-routes.test.ts` + `buyer-realm-session.test.ts` | 20/20 |
| `buyer-links-operations.test.ts` + `buyer-order-routes.test.ts` | 17/17 |
| `identity-redteam.test.ts` | 17/17 |
| `console-mfa.test.ts` | 8/8 |
| Real Postgres, fresh disposable containers, via the now-fixed runner or direct `tsx --test` | `buyer-authorization-codes-postgres` 10/10 · `buyer-profile-addresses-postgres` 8/8 · `buyer-verified-ownership-postgres` 12/12 · `tenant-redteam-postgres` (RT-1..9 + W1) 2/2 · `security-rls-hardening-postgres` 1/1 |
| Full `gate.sh --full` | 6 lanes red at baseline (before this phase's fixes); **4 confirmed pre-existing/ambient** (customer-web lint, stale-artifact method-artifact, `tests:all` GraphQL/REST parity — catalog domain, `@letbuyy/ui` foundation.test.tsx table interaction) by direct diff attribution (zero overlap between this phase's 13-file diff and any failing area) **+ merchant-web's 36 (theme-editor suite, also zero diff overlap)**; **2 fixed this phase** (`tests:security+auth`, `test:contracts`'s console-MFA item was already counted in the 320/320 above) |

## Negative authorization/isolation results (adversarial, not merely "it returned 200")

- Console's shared bearer token as an operator credential → **401**, before any data lookup.
- No credentials / a buyer-realm bearer on an operator route → **401**.
- A merchant identity with no operator permission → **403**, `PERMISSION_SCOPE_DENIED`, zero rows read.
- An operator holding only `review:view` → **403** on a decide action.
- A store admin (merchant realm) on an operator route → **refused**, through the real auth+permission
  chain (`staff-paths-fail-closed.test.ts`).
- A manager's `employees` row queried at a *different* site than their own → **zero rows**, against
  real data (live journey, not a mock).
- The same manager, revoked (`status` → `'removed'`) → **zero rows** on the next query, immediately.
- An unauthorized email at the console's real `/login` → **`access_denied`**, live browser journey.
- Two concurrent redemptions of one authorization code → **exactly one wins** (real Postgres, `FOR
  UPDATE`).
- A wrong PKCE verifier → **refused, and burns the code** (real Postgres).
- Cross-tenant reads under `app_tenant` and the raw-REST role, GUC unset → **zero rows, no mutation**
  (real Postgres, RT-1..9).

## Database/migration actions actually performed

**No new migration was authored or applied.** Every real-Postgres verification ran EXISTING, already-
committed migrations (up to and including 260) against fresh, disposable, uniquely-named `postgres:16-
alpine` containers created and destroyed for the purpose (`letbuyy-phase2-exec-pg{2,3,4}`, each
confirmed removed after use; `docker ps` shows none remaining). One direct data-only journey (F2.5)
inserted and then deleted two synthetic `employees`/`users_custom` rows in the actual owned local
Supabase Postgres (`supabase_db_letbuyy-newmac-20260926`) — no schema change, confirmed 0 rows
remaining after. No migration was applied to that shared local database.

## Browser/Android/API journeys actually verified

- **Buyer** (A): not re-run this phase — the Phase 1R integration pass's own device evidence
  (`docs/evidence/phase1r-integration-2026-09-27/`) remains current, verified by direct diff: this
  phase's changes touch zero files in the buyer-facing mobile app or its identity/session code paths.
  Cited, not reproduced, per the "prior evidence, valid" evidence category.
- **Merchant/staff** (B): real-database journey (F2.5, above) proving store-scoping and revocation
  against live data; a full browser walkthrough of a real merchant sign-in was **not** run this phase
  (named explicitly in `F2.5_MERCHANT_STAFF_CONVERGENCE.md`).
- **Operator** (C): real browser journey against `apps/internal/console` (F2.6) proving an ordinary
  account is denied; the "limited reviewer vs. privileged operator" half is **N/A** against the current
  console (no role tier exists to exercise — a structural finding, not a skipped test).
- **Database/privacy** (D): real, fresh Postgres red-team suites (F2.7); no export/deletion workflow
  exists to journey through (confirmed absence, named for handoff).

## Remaining owner decisions (genuinely open, none resolved or silently assumed)

- **D03** — employee/staff migration timeline to the `identity-foundation` org-model target.
  Recommendation on record (SUSTAINED-I, carried forward): migrate the merchant realm onto
  identity-platform OIDC first, with staff-membership unification in the same bounded phase.
- **D04** — operator bootstrap, recovery, MFA-factor mandate, and the static
  `platform-console@letbuyy.local` principal's disposition. Recommendation on record: follow the
  existing wave order (merchant realm validates the pattern before an operator realm with
  `super_admin`-equivalent reach); TOTP-minimum/aal3-for-break-glass as the MFA-factor starting
  proposal.
- **D05** — data purpose, retention, deletion exceptions, incident responsibilities. No recommendation
  invented; affected record categories named (`buyer_accounts`, `buyer_addresses`,
  `buyer_order_links`) for whoever answers it next.

> **Status reconciliation (2026-09-29).** The F2.5–F2.7 rows and the three decisions above describe 2026-09-27. Since then
> (`PHASE2_DECISIONS.md`, "Recovered owner decisions"): **D03** was answered "Local merchant-staff transition" and its local
> slices — backfill, target-backed shadow comparison, a real HTTP-to-database rehearsal, roles for arbitrary staff, a real
> independently authenticated staff product journey, a bounded and cancellable shadow lookup — are implemented and locally
> verified; the authoritative cutover and a sustained observation window are not done and not authorized. **D04**'s
> Reviewer/Moderator/Administrator tiers were approved and implemented (`requirePlatformOperator`), and console session
> revocation and magic-link single use were hardened; bootstrap, recovery, the MFA enrollment model, high-risk dual control,
> delivery and the moderation/impersonation callers remain open. **D05**'s initial restricted export scope was approved and the
> generator is implemented, tested and inactive; requester verification, release protection, retention and deletion remain
> open. "Genuinely open, none resolved" is therefore true only of the sub-decisions listed in
> `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §10. The current matrix is §8 there.
>
> **Later note (2026-10-01, P2-PRIVACY-CONCURRENCY-DB).** "Approved and implemented (`requirePlatformOperator`)" is accurate for the
> support router mounted alone; through the production worker an earlier `/operations/*` gate admits only allowlisted super
> admins, so the Reviewer/Moderator/Administrator tiers are implemented and not reachable (`P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md`
> §9.3). Buyer privacy-request intake also now has a persistent real-database proof of concurrency and ownership (same document).

## External/infrastructure blockers

- The three-times-observed long-running-dev-server wedge (identity-platform, api-gateway,
  `apps/internal/console`) — fixed each time by restart, never root-caused. A concrete next step is
  named (capture stdout/stderr to a file at process start for the next occurrence, per this session's
  own restart practice) rather than left vague.
- No Android/browser credential or device blocker was hit this phase — the Phase 1R integration
  pass's own device work remains the current, valid buyer-side evidence.

## Evidence paths

- `docs/evidence/phase2-2026-09-27/F2.1_IDENTITY_ISSUER_MAP.md`
- `docs/evidence/phase2-2026-09-27/F2.5_MERCHANT_STAFF_CONVERGENCE.md`
- `docs/evidence/phase2-2026-09-27/F2.6_OPERATOR_IDENTITY.md`
- `docs/evidence/phase2-2026-09-27/F2.7_PRIVACY_TENANT_ISOLATION.md`
- This document.
- Commit range: `130b669d..HEAD` on `letbuyy/phase2-shared-buyer-identity` (11 commits, listed by
  `git log --oneline` in the completion report).

## Exact next task

> **SUPERSEDED 2026-09-29.** Do **not** execute item 1: `site_roles` and `site_role_permissions` are used by the current D03
> implementation and the accepted design keeps them as the role catalog; `site_memberships` is a live read path with a
> planned migration, not a dead table (see the correction after the status matrix). Item 2 is removed from the immediate
> queue: the evidence it asked for already exists in four categories that must not be conflated — **database proof**
> (F2.5's four-scenario journey and the persisted real-Postgres D03 suites), **internal signed-header API verification**
> (the real staff product journey drives real HMAC-signed requests through the real `authMiddleware`; that is not a browser
> login or MFA proof), **browser login verification** (the merchant sign-in redirect to identity-platform and the console's
> ordinary-account-denied journey) and the **owner-confirmed local runtime and S26 verification**. It returns to the queue
> only if a specific change invalidates one of them. The current queue is `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §10.
> The original text is kept below for the record.

Two independent, immediately-executable next steps, neither blocked on an owner decision:

1. **`site_memberships`/`site_roles` `SAFE_DELETE`** (F2.5): drop both tables (new migration + paired
   rollback), simplify `lib/tenant-context.ts`'s `resolveTenantAccessProfile` to use its fallback
   parameters unconditionally, update the one read in `routes/app-store/developer-routes.ts`. Zero
   writers confirmed anywhere; confirmed non-interacting with the live `employees`-based enforcement
   path. Independent of D03.
2. **A real merchant-realm browser journey** (F2.5's named gap): sign in a real merchant owner and a
   real restricted staff account through `apps/merchant/web`'s actual login, exercise an allowed and a
   forbidden action, revoke mid-session, confirm the next request is denied — completing Section 17.B's
   closure coverage the real-database journey in this phase did not reach.

Beyond these two, F2.5/F2.6/F2.7's remaining work is genuinely gated on D03/D04/D05.

## Confirmations

No push. No merge to `develop`. No deployment. No `staging`/`main` promotion. No external
email/SMS/notification sent. No payment execution, no order placed, Pay/Place-Order never tapped
(nothing in this phase reached a payment surface at all — F8/F9 are out of scope). Old Mac and T7
backups, `~/.letbuyy/preservation/primary-pre-integration-20260927-181701/`, and all signing assets
untouched.

## Current follow-on position — 3 October 2026

The historical queue above predates later accepted Phase 2 work; do not execute it as the current
next task. Operator mutation integrity, verified storefront order list/detail reads, and their React
and Liquid buyer-order surfaces are recorded in the later dated acceptance files. See
`P2_OPERATOR_MUTATION_INTEGRITY_ACCEPTANCE.md`, `P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md`, and
`P2_BUYER_ADDRESS_ATOMIC_ACCEPTANCE.md` for current evidence.

The next dependency-ready slice is to connect the canonical buyer session to normal account
profile/address surfaces and the account hub while keeping verified store-customer-only features
separate. Then continue the remaining Phase 2 issuer, staff/operator, privacy fulfillment, and
cutover decisions in `PHASE2_DECISIONS.md`. Phase 2 remains open; this does not accept the full
identity programme, browser/hosted cutover, or any later parent phase.

## Current follow-on position — 4 October 2026

The React and Liquid buyer-session gates, shared buyer profile, buyer address CRUD, and account-hub
entry are now connected to their normal account surfaces. The signed storefront buyer session is
kept distinct from the store-customer session, including wishlist visibility and store-only
preferences. See the dated follow-ons in `P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md` for checks and
limits. Continue through the remaining Phase 2 issuer, staff/operator and privacy fulfillment work,
then the locked parent phases. This does not close Phase 2 or verify any hosted/browser sign-in path.
