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

The explicit verified buyer/store-customer relationship and separate historical-order claim are now
connected to same-origin actions in the React and Liquid account surfaces. The gateway enforces the
storefront token's signed site for both operations; PKCE linking rechecks callback host/site before
calling the relationship transaction. Local regression results and missing live and typecheck
evidence are recorded in `P2_CUSTOMER_SESSION_RETIREMENT.md`. Continue the broader caller/issuer
transition and remaining Phase 2 staff/operator/privacy work. Phase 2 and the parent goal remain open.

## Current follow-on position — 4 October 2026, hosted checkout

The checkout-origin COD screen now calls the signed-cart checkout state machine through a same-origin
validated BFF. Legacy hosted order creation also verifies the signed cart and exact item/coupon binding
before order creation. Local BFF and gateway tests plus customer-web typecheck passed. This does not
close online payment integration, buyer-session continuity/order ownership across the hosted origin,
hosted coupon quote parity, browser/device acceptance, or the human-required DNS/signing/provider setup.
The concrete next task and exact evidence are in `P2_HOSTED_CHECKOUT_ACCEPTANCE.md`. Phase 2 and the
eleven-phase goal remain open.

## Current follow-on position — 4 October 2026, buyer wishlist

The wishlist is now integrated for the canonical storefront buyer after an explicit verified
buyer/store-customer link. Gateway ownership is resolved from the signed buyer, signed site, and
relationship row; inactive store accounts fail closed. The account surface guides unlinked buyers
to the existing connect action. Liquid SSR now loads the same relationship-scoped products and
the browser island writes through the buyer wishlist proxy; guest and legacy customer behavior stays
on its established path. See `P2_BUYER_STORE_WISHLIST_ACCEPTANCE.md` for exact API and storefront
integration evidence.

Next active Phase 2 work: refresh the full F2.1 legacy issuer/consumer inventory and define local
dual-verifier, telemetry and rollback gates before changing any signer or verifier. Then continue
the missing loyalty/reviews/checkout buyer journeys and D04/D05 dependencies. No hosted cutover,
live browser sign-in, or complete Phase 2 acceptance is established. The eleven-phase goal remains
active; its later phases are still to be implemented and separately verified.

## 4 October correction — canonical rewards connected

The canonical buyer account now reads the merchant-funded rewards balance and recent ledger history through the signed site-bound buyer session. It distinguishes no programme from an enrolled zero balance, preserves exact database integer values, and keeps the loyalty UI read-only. [Buyer rewards acceptance](P2_BUYER_LOYALTY_ACCEPTANCE.md) records the route, proxy, theme, typecheck and owned-Postgres results. Rewards may be removed from the current account-consumer gap list; checkout association, live browser identity flow, legacy issuer retirement, and the remaining Phase 2 decisions/evidence stay open.

## 4 October checkout source correction

The checkout-origin page verifies a cart-bound signed handoff before rendering, but the reused `CheckoutClient` still posts order creation to `/api/orders`. That route does not carry or revalidate the handoff and does not use the gateway's signed checkout-session state machine. The active finalization path therefore remains incomplete despite the verified initial page render. The next implementation must connect the UI to canonical handoff/state-machine finalization, safely preserve optional buyer authority across the hosted checkout origin, and atomically/idempotently record `authenticated_checkout` ownership while retaining guest checkout and provider-failure recovery. No buyer credentials belong in handoff URLs. See the corrected next task and acceptance requirements in [buyer rewards acceptance](P2_BUYER_LOYALTY_ACCEPTANCE.md); this is a critical local source finding, not a claim that a hosted exploit or payment loss was reproduced.

## Current follow-on position — 4 October 2026, canonical registration

The default Liquid login and registration pages now both lead into the existing canonical buyer
PKCE flow; the transitional per-store registration form remains available. Theme fixtures and
rendered output are locally verified in `P2_CANONICAL_BUYER_REGISTRATION_ENTRY_ACCEPTANCE.md`.
The refreshed census confirms six HS256 issuance callsites across gateway and commerce, and
route-by-route legacy consumer migration is still required. Continue from the current working
tree; do not infer a legacy-session retirement, user migration, or hosted activation from this
entrypoint improvement. Next: finish the consumer matrix and migrate the remaining linked-store
journeys before implementing observable local verifier-transition and rollback controls.

## Current follow-on position — 4 October 2026, canonical reviews

The existing product review form now submits through the site-bound canonical buyer session when
one is present. The gateway derives `is_verified` and customer identity only from the buyer's
verified store-customer link, while the legacy customer-session route also ignores a body-supplied
verified flag and returns no reviewer PII. Unit, BFF, real-worker owned-database and TypeScript
evidence is in `P2_BUYER_REVIEWS_ACCEPTANCE.md`. The review item has moved out of the local canonical
buyer journey backlog. Loyalty, checkout association, browser sign-in, legacy issuer retirement and
the unresolved staff/operator/privacy requirements remain. Phase 2 and all later locked phases stay
open.

## Current follow-on position — 4 October 2026, legacy-session telemetry

The gateway now emits aggregate-only usage points for both accepted HS256 customer-session formats,
classified by token format and bounded route class. Local tests confirm that no token, user, tenant or
raw path identifiers enter the point and that telemetry failure cannot deny a valid session. See
`P2_CUSTOMER_SESSION_RETIREMENT.md`. This is source instrumentation only; no deployed telemetry was
queried, and no signer/verifier is retired. Continue the route-by-route legacy consumer matrix and
adapt remaining store-scoped flows through the existing explicit buyer/store-customer relationship.
Phase 2 and the eleven-phase goal remain open.

## Current follow-on position — 4 October 2026, authenticated checkout ownership

The local order BFF now carries the canonical site-bound buyer session to the gateway, and
authenticated checkout calls migration 267's atomic ownership wrapper. The wrapper revalidates the
live account epoch and prevents claiming a prior guest/other-buyer order; the existing guest order
RPC stays intact. See [authenticated checkout ownership acceptance](P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md).
Commerce/gateway typechecks, 1343 gateway unit tests and 4 BFF tests pass. The authored real-worker
Postgres acceptance did not run because there is no responding Docker daemon, and the migration was
not applied. Record this as local implementation only. Phase 2 remains open pending owned-database
proof, consumer integration, and its other identity/privacy/operator requirements; the eleven-phase
goal remains active.

## 4 October update — authenticated checkout ownership accepted locally

The preceding follow-on is superseded by the current evidence: the real-worker checkout ownership
suite passes 5/5, including session revocation racing the order transaction and rollback/reapply, and
the complete gateway database lane passes 119/119 across 19 suites. See
[authenticated checkout ownership acceptance](P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md)
and [its sanitized isolated-run record](P2_AUTHENTICATED_CHECKOUT_DATABASE_RUN.json). The buyer order
list/detail React and Liquid consumers already use explicit signed-site ownership links. Migration
267 remains unapplied outside disposable test databases. This closes this local Phase 2 checkout
writer slice, not Phase 2 as a whole. Next: finish the legacy issuer/consumer transition matrix and
continue the unresolved operator/privacy work; hosted observation, browser identity and release
remain distinct acceptance gates. The eleven-phase goal remains active.

## 4 October correction — hosted checkout buyer ownership

The Phase 2 COD buyer-binding slice is now locally verified through a same-origin HttpOnly-cookie
BFF, server-to-server gateway handoff, site/live-epoch validation, hosted session binding, and the
atomic buyer-owned order transaction. Migration 268 passed the focused real-worker owned-Postgres
suite 4/4, including active-session rollback refusal and terminal rollback/reapply; sanitized
evidence is in [hosted checkout acceptance](P2_HOSTED_CHECKOUT_ACCEPTANCE.md) and
[the database run summary](P2_HOSTED_CHECKOUT_BUYER_DATABASE_RUN.json). No production or restored
database was migrated. This supersedes checkout buyer ownership as a Phase 2 writer gap, while
leaving browser identity, provider/online-payment integration, telemetry observation, legacy
issuer transition, staff/operator and privacy requirements open. Phase 2 and the eleven-phase goal
remain active.

## 4 October correction — one buyer account for new storefront sign-ups

The prior registration CTA still allowed a second per-store password account, contrary to the
accepted one-buyer-account decision. New sign-ups now use the canonical identity-platform PKCE
flow from Liquid and React account entry points; the Commerce and gateway legacy registration APIs
fail closed, and the shared API client no longer exposes the retired operation. Existing store-only
login remains only so customers can access settings and link to a verified buyer identity. The
local integration checks and the remaining issuer/consumer retirement limitations are recorded in
[customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md). This is one Phase 2 transition
slice; legacy sign-in and password-reset issuance remain, and Phase 2/the eleven-phase goal remain
open.

## 4 October correction — canonical checkout address autofill

Normal storefront checkout now verifies which session realm is active and loads saved addresses
from the canonical buyer address book for a signed-in buyer. It uses the distinct store-customer
address book only after the buyer-session endpoint verifies signed-out state. Verification and
address-load failures remain visible and permit manual entry without cross-realm fallback. Hosted
checkout-origin pages continue to omit saved-address reads because their host-bound storefront
session is unavailable there and the cart handoff carries no address PII. See
[checkout buyer-address acceptance](P2_CHECKOUT_BUYER_ADDRESS_ACCEPTANCE.md). Four focused tests,
Commerce typecheck and `git diff --check` pass. This closes one local consumer-matrix gap only;
legacy login/reset issuance, browser identity, hosted observation and other Phase 2 requirements
remain open.

## 4 October correction — buyer logout exact-origin guard

The shared buyer mutation guard now compares `Origin` against the framework request's exact
scheme, host and port, in addition to rejecting Fetch Metadata marked cross-site or same-site.
This closes the same-host scheme-mismatch case for buyer linking, logout and mutating buyer BFFs.
All buyer logout responses are `no-store`, and rejected requests cannot clear the buyer cookie.
The focused flow/link/logout tests pass 7/7 and Commerce typecheck passes. See
[buyer logout CSRF acceptance](P2_BUYER_LOGOUT_CSRF_ACCEPTANCE.md). This local security correction
does not verify a browser or hosted deployment and does not close Phase 2.

## 4 October correction — legacy customer reset and host scope

Password-reset destination selection now verifies that a requested URL host resolves to the same
store whose reset token is being issued; otherwise the configured reset destination is used. Legacy
customer session issuance and reads now require the signed store ID to match the store resolved from
the current forwarded host. The Gateway reset-URL policy suite passes 4/4, Commerce session-scope
and adjacent focused tests pass 13/13, and both package typechecks pass. The broader Gateway security
test could not start because sandbox policy denied the TSX runner's Unix socket; this is not a
passing route-level or database result. See [legacy customer scope acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October correction — legacy login CSRF guard

The transitional customer-password login BFF accepts both Liquid form posts and JSON requests. It
now rejects cross-site, sibling-store same-site and scheme-mismatch origins before parsing input or
calling Gateway authentication. The focused login/flow tests pass 5/5, Commerce typecheck and
`git diff --check` pass. No browser test was performed; see the updated
[legacy customer scope acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October continuation — React customer login and account connection

The React storefront login route now has an explicit UI for store-password sign-in, reset-link
requests, canonical LetBuyy sign-in, and verified store-account connection. This fills the React
renderer gap while Liquid continues using its theme section. Commerce typecheck and focused lint
pass; login, buyer-auth start, and reset BFF coverage passes 7/7. Browser, provider, and email
acceptance are unverified. This does not retire the transitional issuer or close Phase 2; see
[legacy account link entry acceptance](P2_LEGACY_ACCOUNT_LINK_ENTRY_ACCEPTANCE.md).

## 4 October continuation — legacy account linking from storefront sign-in

Existing store-only customers can now start the verified LetBuyy/store relationship flow from the
Liquid sign-in page without first creating another legacy password session. The route accepts the
sanitizer-safe `intent` field while preserving existing `action` callers; linking still requires a
same-origin POST, PKCE, a verified buyer session for the signed storefront and the existing
same-email relationship check. Rendered-template/example tests pass 14/14, PKCE start/callback
tests 3/3, SSR contracts 14/14, and the full Theme Engine suite 1,874/1,874; both TypeScript checks,
focused lint and `git diff --check` pass. Browser/provider/database linking remains unverified. This
opens a local migration path without retiring the legacy password issuer. See
[legacy account link entry acceptance](P2_LEGACY_ACCOUNT_LINK_ENTRY_ACCEPTANCE.md).

The refreshed source census also corrects the older six-callsite count: four active Gateway/Commerce
HS256 customer-session signers remain (password login and reset completion in each runtime); both
registration routes are retired and one federation helper is dormant. No signer/verifier is disabled.
The deployed usage inventory remains unobserved; see the dated correction in
[customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md).

## 4 October correction — verify legacy login tenant before credential auth

The Commerce customer-login BFF now resolves the request's storefront host and checks the submitted
store ID before calling Gateway password verification. A cross-store mismatch is denied with a
generic no-store result, so it cannot trigger password authentication for a different tenant. The
focused login/session-scope tests pass 5/5, Commerce typecheck, targeted lint and `git diff --check`
pass. This is not live Gateway/browser evidence, and does not retire legacy customer sessions; see
[legacy customer scope acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October correction — transitional customer password reset is now connected

The store account settings password form previously called reset confirmation without the one-time
token or required tenant fields. It now requests a store-scoped reset link and the storefront has a
dedicated reset page that submits through a same-origin, host-to-store-bound BFF. Cross-origin and
wrong-tenant requests are denied, the email link's tenant marker is checked against the resolved
store, and the reset token is removed from browser history after capture. Focused BFF tests pass
2/2, Commerce TypeScript passes, and focused lint passes for the new route and page. No real email,
browser/provider redemption or hosted path was exercised. Reset completion retains the transitional
store-customer session issuer and does not finish identity convergence; Phase 2 stays open. See
[legacy customer scope acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md).

## 4 October continuation — retire the linked browser's legacy session

When the explicit verified-email link callback receives success from the Gateway relationship
operation, its redirect now expires the host-only legacy store-customer cookie in that browser.
Conflict/failure/unverified outcomes preserve that session, and ordinary LetBuyy sign-in is
unchanged. The callback/start/logout regressions pass 7/7, Commerce typecheck and focused lint pass,
and the diff check passes. Other devices' stateless legacy cookies remain valid until expiry; no
global revocation or hosted telemetry is established. Browser/provider/database acceptance is
unverified. This is a reversible local transition step, not Phase 2 closure; see
[legacy account link entry acceptance](P2_LEGACY_ACCOUNT_LINK_ENTRY_ACCEPTANCE.md).

## 4 October continuation — make legacy reset redemption single-use under concurrency

The public reset-confirmation worker now uses migration 269's service-role-only
transaction to lock and consume a one-time credential together with its active
store-customer password update. The previous split writes allowed simultaneous
requests to both succeed; the real-worker owned-Postgres regression reproduced
that behavior before the fix (`0ac0c98ebf7e`). Current focused tests prove one
winner under concurrency, rollback and same-token retry after an injected
credential-write failure, and execute privileges limited to `service_role`
(3/3, `e37d0b917b46`). The broader disposable owned-database lane passed 132/132
across 22 suites (`117976696129`), Gateway units passed 1,357 with one existing
TODO, typecheck and migration validation passed, and root shared contracts
passed 322/322. No migration was applied outside disposable test databases.
See [legacy customer scope acceptance](P2_LEGACY_CUSTOMER_STORE_SCOPE_ACCEPTANCE.md)
and [customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md).

This completes a local password-reset safety slice, not Phase 2. Legacy account
reads now check active/non-deleted status across profile, wishlist, addresses,
orders and the GraphQL customer field, with optional review identity checked at
its route. The next Phase 2 work is to finish the compatibility-only
issuer/verifier caller inventory and distinguish removable local call sites
from legitimate transitional clients; retain all deployed verifiers until
hosted usage telemetry, an authorized rollout and rollback evidence exist.
Browser and real-email/provider behavior remain unverified. The eleven-phase
programme remains active.

## 4 October continuation — harden session-cookie parsing and census local consumers

Gateway cookie parsing now treats invalid percent-encoding as an absent credential
instead of throwing. The focused middleware test reproduced the old 500, then passed
5/5 after the fix; API Gateway typecheck and diff check pass. An owned-worker
regression was added, but Docker preflight found no available daemon, so this turn
claims no owned-database route result. The source census confirms live local
consumers in required account routes, optional review identity, GraphQL customer/order,
and Commerce's storefront-scoped server session forwarding. Both Gateway and
transitional shopper HS256 forms remain accepted. Deployed format usage is still
unobserved; do not retire either verifier. Re-run the owned-worker regression when
its required Docker daemon is available. The eleven-phase goal remains active.

## 4 October continuation — real-worker compatibility matrix authored

The owned-DB customer-profile suite now covers the actual Gateway format policy across default,
dual, gateway-only, legacy-only, disabled and invalid modes, using both session formats and the
active synthetic profile route. Gateway typecheck and `git diff --check` pass. The official unit
runner could not start because the sandbox denied the TSX IPC socket; the prescribed owned-DB
runner found no Docker daemon and executed 0 of 23 suites. The production-worker matrix is
therefore authored but not runtime-verified. No runtime policy or issuer changed; see
[customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md). The eleven-phase programme
remains active, with owned-DB execution as the next concrete verification dependency.

## 4 October correction — hosted checkout order-ownership path is now connected

The older checkout-source correction above described the page's then-current `/api/orders`
bypass. Current source has since connected the live hosted COD flow to the signed checkout
state machine: the storefront BFF sends a valid canonical buyer session only server-to-server
when requesting the cart handoff; the gateway binds that buyer to the hosted checkout record;
the checkout-origin page verifies the signed cart; and hosted COD advances through contact,
delivery, payment-intent and confirm with per-step idempotency keys. Hosted online payment remains
gated until its separate provider path is ready. The remaining `/api/orders` BFF also verifies
the signed handoff, exact cart/coupon/site and optional buyer-session store before forwarding.

Fresh local checks on the current working tree: customer-web TypeScript typecheck passed; the
focused checkout-handoff, hosted checkout step, signed order-creation and buyer-link callback
tests passed 13/13; hosted payment-availability tests passed 4/4. The real-worker/Postgres hosted
checkout and order-ownership results remain in their specific acceptance reports; they were not
rerun here because Docker access is denied on this host. No browser, provider sandbox, live order
or hosted service was exercised. This corrects the old source finding; it does not close Phase 2
or Phase 8. See [authenticated checkout ownership](P2_AUTHENTICATED_CHECKOUT_OWNERSHIP_ACCEPTANCE.md)
and [hosted checkout](P2_HOSTED_CHECKOUT_ACCEPTANCE.md).

## 4 October continuation — real Identity PKCE link accepted on owned runtime

The previously pending Identity-to-Commerce PKCE and buyer/store-customer link journey now passes
through both local Next.js apps, the real Gateway worker and the owned disposable Postgres database
(10/10). The signed-in buyer in this fixture is seeded; the test verifies the store customer's email
and does not claim password, OTP, email-provider or browser sign-in. Exact integration and runner
evidence is in [customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md) and
[the sanitized owned run](P2_CUSTOMER_SESSION_OWNED_DATABASE_RUN.json). The local session issuers,
both Gateway compatibility formats and default dual-verifier policy remain unchanged.

Next: finish the route-by-route local legacy issuer/consumer matrix and a rollback-ready local
verifier-transition rehearsal. Hosted usage telemetry, browser sign-in, any deployed verifier
retirement, and the remaining operator/privacy/identity decisions still require separate evidence;
Phase 2 and the eleven-phase goal remain open.

## 4 October correction — local F2.1 caller inventory completed

The endpoint-by-endpoint Commerce/Gateway session matrix is reconciled to current source, including
the four active request-path HS256 signers, transitional recovery/guest exceptions, legacy and
canonical account routes, optional review and gated GraphQL consumers, and the separate historical
order claim. The real Identity PKCE and verified store-link path also passes 10/10 through the owned
runtime. Both legacy formats remain accepted by default; no hosted use, zero-use drain or authorized
cutover is inferred. See [customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md) and
[the updated issuer map](F2.1_IDENTITY_ISSUER_MAP.md). Continue the remaining Phase 2
operator/privacy/identity acceptance and owner decisions, then advance the locked later phases.

## 4 October correction — Merchant 360 moderation and impersonation have UI callers

The earlier Phase 2 decision record said no in-repository caller existed. The current Merchant 360
detail page has MFA-gated server actions that invoke impersonation start/end and merchant
suspend/restore; the focused source-contract suite passes 4/4. Caller existence is resolved. This
does not close D04.6 or backend authorization: the Gateway trusts the console service credential
and request-supplied actor/approver IDs, the second-approver check only compares IDs, and no
in-repository consumer uses the issued impersonation token. See the dated correction and open
security questions in [Phase 2 decisions](PHASE2_DECISIONS.md). Preserve the existing restricted
surface until the required operator identity and high-risk approval policy is resolved.

## 4 October correction — browser identity journey reaches owned Gateway and Postgres

Headless Chromium now follows the normal storefront sign-in redirect into the actual Identity
authorize page, submits Continue, redeems the one-time PKCE code through the real Identity route,
returns through the Commerce callback and reads the site-bound buyer session. The browser path,
Identity code issue/redeem, and the explicit buyer/store-customer link transaction run through the
production Gateway worker and a runner-owned Postgres/PostgREST fixture. The full
`storefront-customer-profile.postgres` suite passes 10/10, including legacy login/profile and
cross-store denial. The buyer account and initial signed session are synthetic and seeded; no
password/OTP/email-delivery login or hosted domain is claimed. See [customer session retirement](P2_CUSTOMER_SESSION_RETIREMENT.md)
and the [sanitized owned run](P2_CUSTOMER_BROWSER_OWNED_DATABASE_RUN.json). This supersedes the
earlier mock-only browser evidence, but does not close Phase 2 or authorize legacy issuer retirement.

## 4 October continuation — local verifier rollback sequence

The Gateway compatibility middleware now has a passing 11-test focused suite that rehearses dual
format → strict Gateway-only → dual rollback with valid tokens in both formats. The real-worker,
owned-Postgres session suite also passes 11/11, including that transition sequence; a temporary link
to the already-installed Commerce Next.js 16.1.6 dependencies supplied Identity's missing package
link and was removed after the run. Gateway typecheck passes. Runtime policy remains dual-format;
deployed usage, production rollback and verifier retirement remain unverified and unauthorized. The
eleven-phase goal remains active.

The 4 October owned runtime follow-up now starts canonical browser authorization from the real local
Identity email/password endpoint: a wrong password returns a generic denial without a cookie, and a
valid synthetic buyer proceeds through Chromium consent, PKCE, callback, site-bound session and
sibling-store refusal. The owned Gateway/Postgres suite passes 11/11; Identity and Gateway typechecks
and the runtime script syntax check pass. Credentials are submitted by the local test client, not
typed into Chromium; no external delivery or hosted login is claimed. See the dated
[credential and browser run evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#4-october-continuation--real-identity-credential-login-before-browser-pkce)
and [sanitized run record](P2_CUSTOMER_SESSION_CREDENTIAL_OWNED_DATABASE_RUN.json). Phase 2 and the
eleven-phase goal remain open; deployed verifier policy remains unchanged.

The next owned-run correction moved valid credential entry from the local HTTP test client into
Chromium itself. A signed-out browser submits the synthetic account credentials to Identity, then
completes consent, PKCE, the Commerce callback, site-bound session verification and sibling-store
refusal. The same 11/11 owned Gateway/Postgres suite keeps a real-endpoint wrong-password/no-cookie
negative control. See [browser credential evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#4-october-correction--credential-login-entered-in-chromium)
and its [sanitized run record](P2_CUSTOMER_SESSION_CREDENTIAL_BROWSER_OWNED_DATABASE_RUN.json).
Turnstile uses only the local dev test bypass; production configuration and session-issuer policy
remain unchanged. Phase 2 remains active.

The latest run (`6ec21ebba100`) also verifies the shared same-origin guard against Next's rewritten
internal URL using the forwarded storefront origin; focused flow/link/login tests pass 9/9, Commerce
typecheck passes, and the owned session suite remains 11/11. Chromium proves buyer credential entry,
consent and PKCE. The Account Settings native form attempt is still unresolved: Chromium blocked its
POST under that page's `form-action 'self'` before reaching the route, despite matching observed
document/target origins. The equivalent minimal CSP control passes; no policy was weakened. The
actual store-link transaction remains worker/database verified through the test client. Next: find
and fix the page-context CSP discrepancy, then rerun the explicit link UI in the owned browser lane.
See the [dated session record](P2_CUSTOMER_SESSION_RETIREMENT.md#4-october-correction--proxied-same-origin-validation-and-current-browser-evidence).

The next owned run (`1ab57802f691`) completes the first-link browser journey from a legacy-only
customer's Account Settings page. The UI uses a same-origin JSON POST and follows the returned
Identity authorize URL; the server keeps its Origin/Fetch Metadata guard and HttpOnly PKCE cookie.
Chromium signs in, grants consent, completes the callback, observes the successful link, confirms
legacy-cookie retirement and canonical-cookie installation, then verifies sibling-store denial.
The owned suite passes 11/11, focused flow/link/login tests 10/10 and Commerce typecheck passes. The
native form-action discrepancy itself remains undiagnosed; `form-action 'self'` is unchanged. This
supersedes the prior “next: browser Account Settings link” status, not the open Phase 2 identity,
issuer-telemetry or hosted-use requirements. See the [dated session evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#4-october-follow-up--account-settings-link-verified-in-chromium).

## 4 October continuation — operator support mutation transaction authored; owned acceptance pending

The current Gateway source routes support ticket creation, replies/internal notes,
assignment, escalation, resolution, CSAT and macro creation through one
service-role-only database transaction. Migration 265 adds actor/action/target/key
scoped durable receipts, request-hash conflict detection, atomic audit and
escalation/case linkage, and exact response replay. Authorization remains in the
production route and runs before each transaction/replay; the database function
is not executable by API roles. A paired rollback is present. The authored owned
suite covers exact and conflicting retries, multiple duplicate races, lost
responses across worker instances, revoked permission before replay, audit/case/
receipt-write fault rollback and API-role privilege refusal.

This continuation verified the focused Gateway support/operator contracts at
**18/18** and adjacent buyer-support/privacy/idempotency/operator-scope contracts
at **32/32**. Gateway typecheck and migration-safety validation pass. The owned
suite was invoked as runner `ec3ccc4c4218` but stopped at infrastructure
preflight: no real Docker daemon answered `docker info`; **0 tests ran**. The
database transaction, race/fault controls and privilege assertions are therefore
authored but not runtime-accepted. Keep Phase 2 and the eleven-phase goal open;
run the named owned suite when the owned Docker runtime is available and resolve
any failures before recording acceptance.

## 4 October correction — operator mutation owned-database acceptance

The owned runtime is available to the repository runner when invoked with reviewed elevated
execution. The production-worker suite `operator-mutation-integrity.postgres.test.ts` passes
**12/12**, with zero failures, skips or TODOs (`f2bcd63f2ef1`). It verifies exact idempotent replay
and payload conflicts across all seven support actions; audit, message, SLA, CSAT and linked-case
writes; simultaneous duplicate creates and every existing-ticket action; lost-response recovery
through a new worker instance; fresh permission checks before replay; actor isolation; malformed-key
refusal; same-key recovery after named audit/case/receipt trigger faults; typed-client key
preservation with fresh signed credentials; API-role privilege refusal; and rollback/reapply parity.
The runner cleaned its own disposable Postgres/PostgREST resources. This supersedes the preceding
zero-test preflight result for migration 265's local owned acceptance, not its historical record.

This closes the operator mutation integrity slice only. Phase 2 remains open for issuer and hosted
use evidence, operator identity/bootstrap/dual-control policy, order ownership/read journeys,
privacy fulfillment and other explicitly listed requirements; it does not grant release authority.

## 5 October continuation — atomic legacy address writes accepted on owned database

Migration 286's real Gateway address suite now passes 5/5 on the repository's owned Postgres and
PostgREST fixture, including insert-failure preservation, foreign-address denial, concurrent
default creates, disable-after-session-lookup denial, API-role refusal and rollback/reapply data
parity. The sanitized run report is
[`P2_LEGACY_STORE_CUSTOMER_ADDRESS_OWNED_DATABASE_RUN.json`](P2_LEGACY_STORE_CUSTOMER_ADDRESS_OWNED_DATABASE_RUN.json).
The earlier zero-test Docker preflight entry is superseded for this suite only.

The attempt also found and fixed a runner/guard mismatch: the runner's long suite database name was
refused by the ownership guard before the test could start. Database naming and validation now share
the same PostgreSQL-safe contract; the guard suite passes 14/14. Gateway TypeScript, migration
safety validation and `git diff --check` pass. The normal address UI contract also remains covered
by the 947/947 Commerce web test run, but no live-browser address form journey is claimed. No
restored or hosted database was changed.

Next F2.1 transition work is Gateway-issued storefront customer sessions through the Commerce BFF,
removing Commerce's duplicate HS256 signer while preserving verified store ownership. Its user-visible
session duration depends on whether the existing seven-day lifetime or Gateway's thirty-minute
lifetime is retained. That choice has been asked of the owner; both current token formats and the
dual verifier remain unchanged pending an answer. Phase 2 and the eleven-phase goal remain active.

## 5 October continuation — canonical registration screen verified in Chromium

The stale HTML registration bridge now preserves `screen=register` through Commerce buyer-auth
start to the actual local Identity authorize page. Chromium confirms that it displays “Create your
LetBuyy account,” then the existing buyer sign-in flow continues. The owned Gateway/Postgres suite
passes **11/11**, focused registration/start/PKCE tests pass **11/11**, and disposable resources
are cleaned; see the [sanitized run](P2_CANONICAL_BUYER_REGISTRATION_BROWSER_RUN_2026-10-05.json).
This does not create an account, send email, change legacy session policy or prove hosted adoption.
Commerce typecheck passes after moving a test helper out of an App Router route module; both focused
helper tests pass. Phase 2 and the eleven-phase goal remain active.

## 5 October continuation — hosted checkout browser and notification acceptance

The checkout-origin Commerce journey now passes through the runner-owned Gateway/Postgres/PostgREST
stack in Chromium for both COD and synthetic Razorpay. The online path verifies one confirmed/paid
order, capture transaction, ledger posting, `order.paid` event and tenant-signed confirmation-email
job; COD verifies that it produces no paid event or paid email. The browser acceptance exposed and
fixed the missing paid-event call and an order-line email query rejected by the tenant guard. See
[`P2_HOSTED_CHECKOUT_ACCEPTANCE.md`](P2_HOSTED_CHECKOUT_ACCEPTANCE.md#5-october-correction--hosted-buyer-journey-passes-in-owned-postgres-and-chromium)
and the sanitized [`F8_HOSTED_CHECKOUT_BROWSER_RUN_2026-10-05.json`](F8_HOSTED_CHECKOUT_BROWSER_RUN_2026-10-05.json).

This closes local synthetic hosted-checkout browser acceptance, not Phase 2 or Phase 8. Razorpay
sandbox and custom-domain sign-in were not exercised. Continue F2.1 only after the pending owner
choice on customer-session lifetime; independent next Phase 2 work remains the route-by-route
legacy buyer-session consumer transition and the outstanding owner/privacy requirements.

The 5 October source refresh in [`P2_CUSTOMER_SESSION_RETIREMENT.md`](P2_CUSTOMER_SESSION_RETIREMENT.md#5-october-source-correction--registration-no-longer-issues-a-legacy-session)
corrects the issuer count: `/api/customer/register` and Gateway `/customer/register` now route to
canonical buyer registration or return 410; neither signs a legacy customer session. Four active
login/reset issuance entrypoints remain (two Gateway, two Commerce), with an unused exported
Commerce federation-token helper. The session-lifetime choice remains unanswered, so F2.1 issuance
behavior remains unchanged.

## 5 October continuation — owned customer-session consumer suite passes

The real `storefront-customer-profile.postgres` Gateway suite passes **12/12**
with zero failures, skips, cancellations or TODOs (`3ac96d8fef6c`). The owned
worker/database journey includes four legacy account-data consumers under the
compatibility-policy matrix, a store-scoped Commerce session, the real Next
Commerce login and canonical Identity registration-entry path, and the
buyer-support intake rollback control. The initial browser failure came from a
missing local package link for Identity's declared and locked Tailwind version;
a temporary verified link was removed after this passing run. Exact scope and
cleanup are in the sanitized [run record](P2_CUSTOMER_SESSION_PROFILE_OWNED_DATABASE_RUN_2026-10-05.json).

F2.1 remains open: the seven-day versus thirty-minute lifetime choice has been
raised and is still unanswered; deployed usage, full-lifetime drain, supported
unlinked-customer recovery, hosted rollback and issuer/verifier retirement are
not established by this local suite. Keep the current dual-format policy.
Continue other dependency-ready Phase 2/3 work while that product decision is
pending; do not claim Phase 2 closure or hosted adoption.

## 5 October correction — normal legacy address form reaches the atomic writer

The account address page is now browser-verified through the Commerce BFF, real
Gateway worker and owned Postgres after a synthetic legacy password-reset
session. The same Chromium journey rejects attacker-origin POST/PUT/DELETE BFF
writes, selects the visible default-address control, creates and edits one
address, and verifies the exact store/customer row and default flag in Postgres.
The complete owned
`storefront-customer-profile.postgres` suite passes **12/12** with zero
failures/skips/TODOs/cancellations (`833f57d8788e`); the sanitized [run
report](P2_LEGACY_ADDRESS_FORM_BROWSER_OWNED_RUN_2026-10-05.json) confirms
runner ownership and cleanup. This fixes the legacy address BFF's missing
same-origin check and Gateway CSRF signature; it does not change the pending
session-lifetime policy or claim hosted acceptance. Merchant customer-merge
address handling and broader Phase 2 requirements remain open.

## 8 October continuation — review-draft principal binding

The mounted product-review form now keys draft retirement to the canonical buyer ID returned by the verified session BFF, rather than email. A same-email buyer switch clears and hides the prior review draft; verifier failure clears it as well. Focused React/context tests pass 3/3, the complete Commerce web test command exits 0, TypeScript passes, and scoped ESLint reports zero errors. The change does not establish the blocked Chromium/Gateway/Postgres mounted-account journey or resolve the open session-lifetime, hosted drain, unlinked-customer, or wider Phase 2 requirements. Details and limits are in [buyer reviews acceptance](P2_BUYER_REVIEWS_ACCEPTANCE.md#8-october-continuation--bind-a-review-draft-to-the-verified-buyer-id).

The follow-up test now exercises the real Commerce session BFF against a synthetic Gateway response: it passes the host-resolved store and signed cookie token to the verify-only endpoint, projects only buyer ID/email/verification state, fails closed on malformed principal data, and avoids Gateway calls when no cookie is present (**3/3**). All three Commerce web test stages pass **101/101**, **126/126**, and **947/947**; typecheck passes; scoped lint reports 0 errors and 36 existing design-token warnings. See the route-contract follow-up in the linked review acceptance.

## 8 October continuation — buyer-profile writes compare the loaded principal

The normal React and Liquid buyer settings callers now submit the canonical
buyer ID they loaded. Before PATCH, the Commerce BFF reads the current profile
with the same captured signed buyer session and resolved site, then compares
the Gateway-verified ID. Mismatch returns 409 without mutation; failed or
malformed identity preflight fails closed; the expected ID is comparison-only
and the Gateway PATCH receives only the two editable profile fields. The React
form also discards success/error results after its buyer-session generation
changes. Route regressions pass **63/63**, mounted settings passes **1/1**,
Liquid settings/wishlist tests pass **3/3**, TypeScript passes, scoped ESLint
reports 0 errors and 61 UI-token warnings, and `git diff --check`
passes. These are local synthetic-Gateway/jsdom results, not a real Gateway,
Postgres, Chromium or hosted write journey. This closes the local stale-form
guard only; Phase 2, buyer-session policy and hosted-use/retirement gates remain
open. Detailed scope is in [the session retirement evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#8-october-continuation--bind-profile-edits-to-the-loaded-buyer).

## 8 October continuation — account address writes bind to the loaded principal

The React address form sends its verified canonical buyer ID with create,
update, delete, and set-default operations. The Commerce BFF preflights the
current profile with the captured host-resolved signed session and refuses a
stale identity before mutation; unavailable identity checks fail closed. The
comparison ID is not forwarded as authorization. Route and mounted-address
regressions pass **65/65** and **1/1**, TypeScript passes, scoped lint reports
0 errors/35 existing UI-token warnings, and diff check passes. This is local
synthetic-Gateway/jsdom evidence, not live Gateway/Postgres/Chromium or hosted
acceptance. It closes only the stale address-form race. Phase 2 remains open
for the previously recorded policy, hosted drain, unlinked-customer recovery,
and other acceptance gates.

**Historical 8 October owned address-write integration status:** the initial isolated Postgres/Gateway/Chromium attempts were not accepted: they failed before the stale-address database assertion. Follow-up reports included missing Identity Tailwind setup and browser/Docker timeouts; disposable fixtures were cleaned. See the [latest 8 October report](P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_UNHANDLED_FIX_2026-10-08.json), [original report](P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_2026-10-08.json), and [dated session-retirement evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#8-october-continuation--owned-stale-address-retry-remains-blocked). This status is superseded by the successful 10 October run below.

**10 October owned stale-address browser/Postgres acceptance:** the focused executable suite passes **12/12** against owned Postgres 16/PostgREST, the real Gateway worker, local Commerce and Identity runtimes, and Chromium. After the shared signed cookie switches to buyer B, the browser submits buyer A's loaded address ID, the actual Commerce BFF returns 409, the conflict is rendered, and the owned database assertion confirms no address row was inserted for either buyer. Disposable containers, network and volumes were removed. See the [successful run report](P2_BUYER_ADDRESS_STALE_FORM_OWNED_RUN_PASS4_2026-10-10.json) and [implementation evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#10-october-continuation--owned-stale-address-journey-passes). This proves the local stale-address create-denial journey only; hosted behavior and remaining Phase 2 and eleven-phase requirements remain open.

**10 October owned stale-profile browser/Postgres acceptance:** the same real browser path now covers the canonical BuyerSettings form after the cookie changes from buyer A to buyer B. The real profile BFF confirms buyer B before a controlled stale buyer-A profile snapshot is displayed; submitting A's draft under B's cookie returns and renders 409, and SQL confirms neither buyer's profile changed. The existing stale-address check also passes. The isolated suite passes 12/12 and cleanup is empty; see the [successful run report](P2_BUYER_PROFILE_STALE_FORM_OWNED_RUN_PASS2_2026-10-10.json) and [detailed evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#10-october-continuation--owned-stale-profile-write-is-refused-after-buyer-switch). The first sandbox attempt ran zero tests due to Docker access and is preserved separately. This is local evidence only; session-duration policy, full issuer/consumer transition, hosted usage/drain and the remaining Phase 2 gates stay open.

**10 October stale-review submission guard:** the React review form now sends its rendered buyer ID as a compare-only header; the Commerce BFF validates it against a fresh signed-session profile read before forwarding the review. Mismatch returns 409 before the writer, missing identity returns 400, and failed identity preflight returns a sanitized 503. Buyer proxy tests pass 67/67, mounted review identity passes 1/1, Commerce typecheck and diff check pass. The Gateway owned-Postgres review writer suite passes 4/4 (`e72cf325c9b4`) with empty cleanup; this is separate from the synthetic-upstream BFF tests and does not claim a Chromium run for the new guard. See [review acceptance](P2_BUYER_REVIEWS_ACCEPTANCE.md#10-october-continuation--refuse-a-stale-review-draft-after-buyer-switch). Session policy, hosted-use/drain, and Phase 2/eleven-phase closure remain open.

**10 October stale-review owned browser correction:** the preceding record's statement that Chromium coverage of the review BFF guard was absent is superseded. The expanded `storefront-customer-profile.postgres` suite passes 12/12 with the real local Commerce/Identity runtimes, Chromium, Gateway worker and owned Postgres. It switches the shared cookie from buyer A to B, submits A's still-mounted review draft before revalidation, observes the BFF's rendered 409, and confirms SQL contains no review for either buyer. The successful report is [P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json](P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json); cleanup is empty. Focused BFF/component checks pass 67/67 and 1/1, Commerce typecheck/syntax/diff checks pass, and the separate Gateway review-writer suite passes 4/4. This adds local evidence for this race only; it does not close Phase 2 or the eleven-phase programme, and the owner session-duration decision remains pending.

**10 October stale-wishlist owned browser acceptance:** React and Liquid buyer wishlist writes now carry the server-rendered, gateway-verified buyer ID as a compare-only header. Liquid SSR resolves the canonical buyer profile and refuses to render an authenticated mutation identity if that profile is missing/unavailable; all ten product/grid/list/wishlist template instances in both shipped example bundles include the ID. The BFF compares the header to the buyer authenticated by the current host-bound session and refuses stale, missing, or uncheckable identities before the Gateway writer. Focused web proxy/drop tests pass 73/73, Liquid island/drop tests pass 8/8, theme bundle/parity tests pass 30/30, typecheck and syntax/diff checks pass. The owned Postgres 16/PostgREST + real Gateway + local Commerce/Identity + Chromium suite passes 12/12 (`runId 6a7eca1f734a`, 183.2 seconds, no cleanup failures). With the shared cookie switched from buyer A to B, Chromium sent A's rendered ID, received 409 and rendered the failure state; SQL confirms A's control wishlist row remained, B's stayed absent, and no stale DELETE reached Gateway. See [the dated run report](P2_BUYER_WISHLIST_STALE_CROSS_TAB_OWNED_RUN_FINAL3_2026-10-10.json) and [wishlist acceptance](P2_BUYER_STORE_WISHLIST_ACCEPTANCE.md#stale-cross-tab-write-protection--10-october-2026). This is local synthetic integration evidence only; hosted browser/provider acceptance and all remaining Phase 2/F2.1/D03/D04/D05 and eleven-phase requirements remain open.

**10 October stale order list/detail cross-tab status:** the initial owned-runner attempt was blocked at Docker preflight and ran 0 tests; that infrastructure attempt is preserved in [its report](P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_2026-10-10.json). After focused harness corrections, the final owned Chromium/Gateway/Postgres suite passes **12/12** and verifies buyer A's actual linked order is hidden during revalidation, buyer B's real list is empty, and buyer B's detail is denied (404); SQL confirms A's ownership link remains and B has none. The final report records empty container/network/volume cleanup: [successful run](P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-10.json). See the [detailed buyer-order acceptance record](P2_STOREFRONT_BUYER_ORDERS_ACCEPTANCE.md#10-october-continuation--owned-cross-tab-order-visibility-journey-passes). This adds local integration evidence only; it does not establish hosted behavior, decide session lifetime, or close Phase 2 or the eleven-phase programme.

**10 October buyer rewards cross-tab correction:** the React rewards client now hides balance/history while the canonical buyer session is revalidated, reloads on each verified session revision, and ignores stale in-flight results. The mounted provider test passes as part of the full Commerce suite (**104/104**, **135/135**, **947/947**); Commerce typecheck and `git diff --check` pass. This is jsdom with synthetic BFF responses, not a Chromium/Gateway/Postgres or hosted journey. The detailed scope is in [buyer rewards acceptance](P2_BUYER_LOYALTY_ACCEPTANCE.md#10-october-continuation--clear-rewards-data-across-buyer-session-changes). Phase 2 and the eleven-phase goal remain open.

**10 October buyer-support cross-tab isolation:** the support account page now clears ticket lists, selected conversations, messages, complaint/reply drafts, receipts, and pending/error state on each buyer-session revision. It reloads tickets only after verified session revalidation and ignores delayed ticket/conversation/write responses from an earlier buyer. If the verifier is unavailable, private support data remains hidden and retry is offered. A mounted React/provider failure-journey test covers buyer A → revalidation → same-email buyer B, a delayed A conversation response, and verifier failure; it passes **1/1**. The focused support BFF contract suite passes **6/6** (private host-scoped listing, caller store-ID rejection, malformed input, verified message scope, reply-field allowlist, same-origin canonical-session writes). Full Commerce tests pass **105/105**, **135/135**, and **947/947**; typecheck passes; scoped ESLint reports **0 errors and 4 warnings** (raw textarea and token-class warnings); `git diff --check` passes. The mounted UI test uses synthetic BFF responses; this change has no new Chromium, live Gateway/Postgres, or hosted run. It closes only this local stale-private-state path. The session-duration decision, issuer/consumer drain and all remaining Phase 2 and eleven-phase gates remain open.

**10 October support cross-tab integration attempt:** the owned Chromium/Gateway/Postgres regression harness now includes the real buyer-A support ticket, a delayed private conversation response, and a sibling-tab sign-in as buyer B, then asserts hidden state during revalidation, an empty B ticket list, and A-only ticket ownership in Postgres. Syntax, component, support-BFF, Commerce typecheck and diff checks pass. The owned runner stopped at Docker preflight (`P2_BUYER_SUPPORT_CROSS_TAB_OWNED_RUN_2026-10-10.json`, run `61f61c2aa6ec`): **0 tests** ran because no Docker daemon answered `docker info`; no containers, networks or volumes were created. Treat this as an infrastructure block, not owned integration acceptance. The same suite must be rerun when the local Docker daemon is available. Do not infer the cross-tab browser/database behavior from the harness or focused synthetic tests. Phase 2 and the eleven-phase programme remain open.

**13 October support cross-tab acceptance:** the 10 October zero-test Docker-preflight status above is superseded by the successful retry in [`P2_BUYER_SUPPORT_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-13.json`](P2_BUYER_SUPPORT_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-13.json). The owned Chromium/Gateway/Postgres journey passes **12/12** with zero skips, cancellations, or TODOs and empty fixture cleanup. Chromium loads buyer A's actual support data, switches the shared signed session to buyer B in a sibling Identity tab, keeps A's private support state hidden during revalidation, releases a delayed real A conversation response only after the switch and confirms it cannot repopulate the UI; B's actual support list is empty and SQL confirms the ticket remains A-only. This corrects local evidence only; session duration, hosted behavior, and all remaining Phase 2 and eleven-phase requirements stay open. Detailed scope: [`P2_CUSTOMER_SESSION_RETIREMENT.md`](P2_CUSTOMER_SESSION_RETIREMENT.md#13-october-continuation--owned-support-cross-tab-journey-passes).

**13 October F2.1 Liquid account-link contract repair:** runtime-generated buyer settings now use the sanitizer-safe `intent=link_store_customer` field accepted by the existing same-origin account-link route, instead of `name="action"`. The Liquid island contract suite passes **5/5** and the route's account-link tests pass **5/5**. This is local route/component verification, not a new browser or hosted Liquid-account journey; session-duration policy, legacy consumer retirement and Phase 2 remain open. See the [dated F2.1 evidence](P2_CUSTOMER_SESSION_RETIREMENT.md#13-october-continuation--liquid-settings-uses-the-sanitizer-safe-link-intent).
