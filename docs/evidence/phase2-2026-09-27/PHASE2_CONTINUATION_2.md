# Phase 2 continuation (2) — correcting the prior verdict, closing real engineering gaps

Continuation of `PHASE2_CONTINUATION.md` (HEAD `628ff971`). That document's own final verdict —
"B, partially complete, specific decisions remain" — was premature: it rested on a checkpoint 8
that was actually a re-login test, not a true existing-session revocation test, and on a privacy
"status" field that mapped a merely-resolved ticket to a word indistinguishable from "fulfilled."
Both are corrected below, along with several real engineering defects found only by pushing the
real product flows further than the prior pass did — none of them were visible from source review
or from the fixture-based database journey; all were found by actually using what had just been
fixed.

Branch: `letbuyy/phase2-shared-buyer-identity`. Worktree: `.../LetBuyy-phase2`. Starting point for
this document: `628ff971`. Commits added this pass: `b9078bd9`, `f85eda37`, `d59ebd24`, `a0321641`
(see §2), plus this evidence commit.

## 1. Corrections to the prior pass's specific overclaims (Section 18)

**"All independent work complete."** Wrong when written. Five real, live defects remained
reachable through the actual product UI at that point (staff permissions silently dropped on
create, write-implies-read missing from the authorization primitive, the product-detail route
500ing, a real check-then-insert race in privacy intake, an optimistic privacy status word, and a
cross-tenant/cross-privacy leak in an unrelated ticket-listing endpoint). All are fixed this pass,
each with a real regression test confirmed by revert-and-watch. See §2.

**"Existing session revoked" based on re-login.** The prior checkpoint 8 logged the staff member
back in and observed denial — proof re-login doesn't recreate access, not proof an *existing*
session loses it immediately. This pass built a genuine dual-session test: the owner authenticated
entirely out-of-band via `curl` (real CSRF handshake, real bcrypt-verified login, the documented
local dev-auth-bypass token in place of solving Turnstile headlessly), so the revoke happened
without the browser's session ever being touched, then the *exact same, never-refreshed* browser
session was replayed against the same permitted endpoint. It failed immediately — no refresh, no
re-login, no new token. Full detail in §4.

**"Completed" privacy requests based on ticket closure.** Corrected: `resolved`/`closed` now reads
back as `closed_no_fulfillment` unless a real fulfillment outcome was explicitly recorded (nothing
records one today — no export or erasure execution exists). See §5.

**"Phase 2 unrelated" without a pre-Phase-2 comparison.** Corrected with an actual reproduction:
a temporary worktree at the merge-base commit (`130b669d`, the exact commit this mandate itself
named as "historical primary develop"), dependencies installed, the two specific commands re-run.
Both previously-uncertain lanes reproduce the *identical* named failure at the *identical* position
in the base run. See §7.

**"Dormant scaffold ready to activate" without implementation readiness.** The prior document
already called the identity-foundation scaffold's repositories "dormant"/"stub," but did not
inventory *which* pieces are real versus null-returning stubs before naming it as D03's target.
§6 does that inventory explicitly.

## 2. What was implemented and verified this pass

All four fixes below were found by *using* the product, not by reading source in isolation — each
one blocked the next real step of the required journey. Every fix has a real regression test,
confirmed failing against the pre-fix code by revert-and-watch (`git stash` on just the changed
route file, re-run, restore), and the full gateway suite was re-run clean after every commit.

1. **`packages/auth-core`'s `planEmployeeStaffCreate` silently dropped the `permissions` field.**
   merchant-web's real "Add staff" form already computes and sends
   `permissions: permissionsForRole(role)`; the gateway discarded it, so every staff member ever
   created through the real UI got `employees.permissions = {}` regardless of role — the
   fail-closed RBAC gate refused every action for every real hire. Commit `d59ebd24`.
2. **`staff-permission.ts`'s `evaluateStaffPermission` had no write-implies-read rule**, but every
   "write" role in the staff catalog (`roles.ts`: manager, editor, fulfillment, marketing, support)
   grants `<resource>:write` without the matching `<resource>:read` — only the read-only "viewer"
   role lists `:read` explicitly. A real Manager, added through the real UI with fix #1 applied,
   was refused reading the product list it could otherwise write to. Widened *only* a `:read`
   requirement to also accept the matching `:write` grant; the reverse is never true. Commit
   `d59ebd24`.
3. **`GET /products/:id` 500'd via the tenant guard for everyone**, and even fixed, would still
   have denied staff (owner-only `verifyStoreOwnership`, no staff fallback). Fixed the same way as
   every other Phase 2 bootstrap-by-id case: `getSupabaseAdminUnguarded`, bounded to one row,
   re-verified against the product's own `store_id` via ownership or `assertStaffPermission`.
   Commit `a0321641`. Fixing this required updating two *pre-existing* source-contract tests
   (`products.test.ts`, `tenant-isolation.test.ts`) whose literal-regex assertions matched the old
   inline shape — extended, not weakened: both now also assert the new staff-permission fallback.
4. **`GET /employees/tickets` (pre-existing, unrelated route) had no `site_id` predicate at all** —
   found while auditing whether reusing `support_tickets` for buyer privacy requests could leak
   through an unrelated consumer (Section 11's explicit instruction). It already 500'd via the
   tenant guard for everyone (mislabeled a 503 "schema unavailable"), but fixing that the wrong way
   (an unguarded client instead of a real predicate) would have let any active employee of any
   store read every ticket platform-wide, including buyer privacy requests. Scoped to the caller's
   own store; this both unbreaks the endpoint and excludes platform-level (`site_id IS NULL`)
   privacy tickets as a direct structural consequence, not a special case. Commit `b9078bd9`.

Also in `b9078bd9`: the privacy-status and idempotency-atomicity fixes (§5), and null/array/scalar
JSON-body hardening for the privacy route (a `null` body previously reached a raw property access;
now uniformly rejected with 400 before any property read, per Section 11's explicit warning).

**Full gateway suite after all four commits: 1144/1154 pass, 0 regressions, 9 skipped / 1 todo
(both pre-existing, unrelated — the todo is `LB-BIL-002`, a named, intentionally-marked-incomplete
billing case unrelated to Phase 2). Typecheck clean on both `services/api-gateway` and
`packages/auth-core`.**

## 3. Handling the tool-rejection correctly (Section 5)

The prior pass's drafted fix (link staff to any `users_custom` row matching the invited email,
unconditionally) was declined by the permission classifier; no reason text was recoverable beyond
the tool's own generic explanation. Per the mandate: investigated the actual policy before
retrying, rather than resubmitting the same change. `apps/merchant/web/src/app/accept-invite/`
(a real page, a real API route, both reachable) states the policy explicitly, in its own UI copy:
*"Ask the store owner to add you as staff directly ... instead of sending an email invite."*
Direct-add with no acceptance step is confirmed, not inferred.

What changed from the declined draft, precisely because "an email match alone is not proof of
ownership" (the mandate's own stated concern): linking now requires the matched account to be
**email-verified** (`users_custom.email_verified = true`), not merely matched by text. An
unmatched or unverified email leaves the row exactly as before (`user_id` null, `status: 'invited'`
— a named, narrow, permanent limitation, since no accept-invite flow exists to complete it later).
This revised edit was **not** declined — submitted once, accepted, tested (commit `d59ebd24`;
`employee-create-identity-link.test.ts`, 4/4, confirmed by revert-and-watch). Also fixed in the
same change: re-adding an email already staffed anywhere (`employees.email` is unique
platform-wide) previously fell through to a raw 500 with the Postgres constraint message —
including the email — in the response body; now a clean `409 EMPLOYEE_ALREADY_EXISTS` with nothing
leaked.

## 4. Real provisioning, then real existing-session revocation (Sections 6–8)

Synthetic identities: `phase2b-owner@example.invalid` (owns Store One via `sites.custom_user_id`,
`email_verified: true`) and `phase2b-staff@example.invalid` (`email_verified: true`, no `employees`
row until added through the real UI). Both created via direct SQL — fixture setup only; every
authenticated action from here on used the real login flow, never a token or database shortcut.

**A. Provisioning through the real product flow.** Owner logged in through the real merchant-web →
identity-platform flow (real bcrypt verify, network-confirmed `200 OK`). Opened the real "Add
staff" modal, entered the staff email, selected the "Manager" role, submitted. Result, read
directly from `employees` afterward: `role: manager`, `user_id` correctly linked, `status: active`
**immediately** (no acceptance step, matching confirmed policy), and — after fix #1 above —
`permissions: {"granted": [...9 real keys...]}`, not `{}`. Re-added after the first attempt was
deliberately deleted to prove the fix against a clean run, not a lucky first pass.

**B. Independent staff login.** Logged out the owner (real `POST /api/auth/logout`, `200`), logged
in as the staff identity independently (real bcrypt verify, network-confirmed `200 OK`, separate
session).

**C. A permitted action, for real.** `GET /store-one/products` — after fix #2 (write-implies-read),
returned the real catalog (200, real seed data rendered) for a Manager holding `products:write`
but not the literal `products:read` key.

**D. A forbidden action, for real.** `GET /store-one/settings/users` (viewing/managing other
staff) — `403 "Not authorized for this store"`. Employee management stays hardcoded owner-only
regardless of any staff grant; confirmed via the real UI's own rendered error state, not inferred.

**E. True existing-session revocation — the corrected core of Section 7.** With the staff browser
session live and untouched:
1. Authenticated as the **owner**, entirely out-of-band, via `curl`: `GET /login` to capture the
   `letbuyy_csrf` cookie, `POST /api/auth/login` with that token echoed in `X-CSRF-Token` and
   `turnstileToken: 'dev-bypass-token'` (the documented local dev-auth-bypass literal —
   `canUseIdentityDevAuthBypass`, gated on `NODE_ENV=development` and
   `LETBUYY_ENABLE_DEV_AUTH_BYPASS=true`, both part of the standard local setup — not a bypass of
   any control that exists in a real environment). Real bcrypt verify, `200 OK`. The resulting
   `lb_session` value was extracted directly from the response header into a shell variable and
   used only via an explicit `Cookie:` header on subsequent `curl` calls — never printed, never
   written to a cookie-jar file (curl has a known quirk failing to persist host-only `localhost`
   cookies to its jar format), and deleted from disk immediately after use.
2. From that **separate, out-of-band** session — the browser's own cookie jar was never touched —
   called the real revoke endpoint: `DELETE /api/stores/store-one/users/<id>` → `200
   {"success":true,"data":{"deleted":true}}`.
3. Returned to the **staff browser tab, without any navigation, refresh, or re-login since before
   step 1** — same tab, same session, nothing about it touched during the revoke — and repeated the
   *exact same* permitted request via an in-page `fetch`: **`404 "Store not found"`**, immediately.
4. A full page reload of the same route: still `404`. A different protected route
   (`/store-one/orders`): also `404`. Neither a refresh nor a different endpoint restored access —
   ruling out a one-time fluke or a route-specific cache.
5. **Separately**, the owner's own out-of-band session was re-used to confirm its own access was
   unaffected by performing the mutation: `GET /api/stores/store-one/products → 200`,
   `GET /api/stores/store-one/users → 200` (`employees: []`, `staff_used: 0`, correctly reflecting
   the deletion).
6. **Separately again** (a distinct check from step 3, not a substitute for it): logged the staff
   identity back in fresh through the real UI (`users_custom` remains valid — an account and a
   store membership are different things, correctly). Navigated to the same product route: still
   `404`. Re-login does not recreate membership.

All fixture data and the `curl` session artifacts were deleted immediately after (`users_custom`,
`sites.custom_user_id`, cookie/header capture files); confirmed at zero rows / no files remaining.

## 5. Privacy correctness and concurrency (Sections 9–11)

**Status truthfulness.** `buyerFacingStatus` no longer maps `resolved`/`closed` to a
success-reading word. It maps to `closed_no_fulfillment` unless `metadata.fulfillment_outcome`
carries a recognized value (`'fulfilled'`) — nothing writes one today, so this branch is provably
always `closed_no_fulfillment` until real export/erasure execution exists (D05). An unrecognized
ticket status reads as `unknown`, never defaulted toward anything resembling success. 8 new tests
cover the full matrix: `open`→`received`; the three `pending_*`/`escalated` statuses→`in_review`;
`resolved`/`closed` without an outcome→`closed_no_fulfillment` (asserted **not** `completed`,
**not** `fulfilled`); with a recognized outcome→`fulfilled`; with an *unrecognized* outcome value→
still `closed_no_fulfillment` (guards against a typo silently reading as success); a `null`
`metadata` value → handled without throwing.

**Concurrency — a real check-then-insert race, closed at the database.** `findOpenRequest` then
`createRequest` was not atomic: two concurrent identical requests could both pass the check before
either committed. Migration 262 adds a partial unique index
(`requester_user_id`, `metadata->>'privacy_request_type'` WHERE `topic='privacy' AND status NOT IN
(resolved,closed)`); `createRequest` now attempts the insert directly and catches SQLSTATE `23505`
specifically (the identical pattern `contact-public.ts` already uses for its own idempotency),
re-reading the winning row rather than erroring or fabricating a duplicate. **Proved directly
against real Postgres, not simulated**: two genuinely concurrent connections (`docker exec psql`,
launched via shell backgrounding so both connections race for real) inserting the identical
`(buyer, type)` pair — exactly one succeeded, the other failed with the exact constraint violation
the route is built to catch; exactly one row existed afterward. Cleaned up immediately.

**Input hardening.** A `null`, array, or scalar JSON body is now rejected uniformly with 400 before
any property access (previously, a literal `null` body — valid JSON, does not throw on parse —
would have hit `payload.type` and thrown).

**Cross-realm leakage (Section 11's explicit instruction).** Investigated whether reusing
`support_tickets` let merchant staff or other consumers read buyer privacy notes. Found and fixed
the real leak in `GET /employees/tickets` (§2, item 4) — a pre-existing, unrelated route, not the
privacy route itself, but a direct consequence of the reuse decision. The legitimate operator-side
`support.ts` queue (`requirePermission('support:view')`, platform-level, not merchant-facing) was
reviewed and is correctly scoped where it enriches a specific site's context (`.eq('site_id',
site.id)` present); it was not changed.

Full test count for the privacy route: **28/28** (`buyer-privacy-routes.test.ts`), covering
auth-required, cross-buyer list scoping, invalid type, null/array/scalar bodies, wrong-typed and
oversized notes, the create/idempotent-replay/conflict-inside-create paths, two distinct database-
failure paths, the full status matrix, and response-field minimization (exactly six keys —
`id, reference, type, status, created_at, updated_at` — no raw ticket status, no requester id, no
internal fields).

## 6. D03 — org-model activation readiness, inventoried (Section 14)

Not "a dormant scaffold, ready to activate" — an inventory of what is real versus stub, since the
mandate correctly rejects presenting activation as turnkey.

**Schema: fully present, fully empty.** All 22 target tables named in
`identity-foundation/repository-boundary.ts`'s `IDENTITY_FOUNDATION_WRITER_OWNERS`
(`principals`, `organizations`, `org_memberships`, `teams`, `sessions_v2`, `oauth_clients`, ...)
exist in the schema today, confirmed zero rows in every one.

**TypeScript layer: real interfaces, explicitly stubbed implementations.**
`repository-implementations.ts`'s `createDormantPrincipalRepository()` — the name is literal, not
descriptive shorthand — has `findById()` return `null` unconditionally and hardcodes
`status: 'pending_migration'`; `links` is an in-memory `Map`, never touching the database. Every
sibling factory (`createDormantSessionService`, `createDormantRefreshTokenService`,
`createDormantCookiePolicyService`, `createShadowPermissionEngine`) follows the identical pattern.
**None of these are ready to activate as-is** — activating `FEATURE_ORG_MODEL` today would connect
real routes to repositories that answer every query with "nothing found."

**What is genuinely ready:** the *planning* layer. `migration-scaffold.ts`'s backfill functions
(`planPrincipalBackfill`, `planCustomerPrincipalBackfill`, `planCredentialBackfill`,
`planAuthenticatorBackfill`, `planOrgGraphBackfill` — the last explicitly typed against
`LegacySiteMembershipRow[]`) are pure, plan-only functions with no side effects — these could be
exercised against a disposable local database today to validate the backfill *shape*, without
activating anything live.

**What activation actually requires, in order:** (1) real (non-dormant) implementations of
`PrincipalRepository`/`SessionServiceV2`/`PermissionEngine` against the now-empty target tables —
unbuilt; (2) a backfill run from `employees`/`users_custom`/`site_memberships` using the
already-real planning functions — untested end-to-end; (3) `shadow-compare.ts`'s old-vs-new
comparison running in production traffic before cutover — unbuilt; (4) the flag flip itself. This
is a multi-phase implementation project, not a configuration change, and D03 is the question of
whether and when to fund it — not resolved here, and not presented as smaller than it is.

`site_memberships`/`site_roles`/`site_role_permissions` remain untouched, for the same reason as
the prior pass concluded: they are this plan's own named target tables for the "membership" domain
(`LEGACY_REPOSITORY_TABLES.membership`), properly RLS-hardened, zero rows, zero risk either way.

## 7. Full-gate attribution — a real reproduction, not an inference (Section 15)

A full parallel-environment baseline build was not attempted in the *prior* pass, and that pass
described it as infeasible given its own time framing — this pass does not repeat that framing.
Instead: a temporary worktree at the merge-base commit (`git worktree add`, the sanctioned,
reversible mechanism this skill already uses for phase branches), a real `pnpm install
--frozen-lockfile` (fast — the pnpm content-addressable store made it near-instant), and the exact
two commands the gate itself runs for the two previously-uncertain lanes.

| Lane | Command | Baseline (`130b669d`) result | HEAD result (prior gate run) | Attribution |
|---|---|---|---|---|
| `tests:all` | `node --test --test-concurrency=1 tests/*/*.test.mjs` | 1802/2083 pass, **266 fail** | first failure `not ok 5 - WS12 G6 migrated REST endpoints remain the external source of truth for parity reads`, ~520 more | **Identical named test, identical position (`not ok 5`), in both runs.** Pre-existing, unrelated to Phase 2 |
| `test:@letbuyy/merchant-web` | `pnpm --filter @letbuyy/merchant-web test` | 735/771 pass, **36 fail** | first failure `not ok 4 - phase-aa [security]: settings/route.ts validates custom_css server-side`, 35 more | **Identical named test, identical position (`not ok 4`), in both runs.** Pre-existing, unrelated to Phase 2 |

The worktree was removed (`git worktree remove --force`) immediately after; the primary checkout
and every other active worktree were never touched. `Object.keys` methodology note: Node's test
runner numbers these per `test()` call, not per assertion — the exact aggregate counts (266 at
baseline vs. ~520 "more" reported by the gate's own `+N more` summary at HEAD) are not directly
comparable without knowing the gate script's own counting method for that line, so the *count* is
not claimed to match exactly — the **specific named first-failing test, at the same position, in
both runs** is the load-bearing fact, and it matches exactly for both lanes.

A fresh full gate run was also launched this pass (after all four fixes landed, sha `a0321641`,
`20260928-000738`) to capture the current, complete picture rather than continuing to reason from
the prior stale record. Result: **`failed=5`**, and every one of the five is now fully accounted
for:

| Lane | Result | Classification |
|---|---|---|
| `lint` (`@letbuyy/customer-web`) | red | Pre-existing, unrelated — identical across three gate runs spanning this whole programme; Phase 2 touches zero files under `apps/commerce/web` |
| `validators:sweep` — `stale-artifact` only (113/114) | red | Pre-existing, method-only (the gate's own note: fails by method when run outside the orchestrator's cleanup plan) — **`tenant-isolation` is no longer in this list**, confirming the registry-regeneration fix (prior document, commit `6c965b30`) holds cleanly |
| `tests:security+auth` | **green** | Resolved — confirmed stale in the very first record checked this session, not a live regression (prior document §1) |
| `ui:validate` | red | Pre-existing, unrelated — identical across runs; Phase 2 touches no UI/frontend files |
| `tests:all` | red, first failure `WS12 G6 migrated REST endpoints...`, `+519 more` | **Pre-existing, proven by real baseline reproduction** (§7 table above): identical named test, identical position, at the merge-base commit |
| `test:@letbuyy/merchant-web` | red, first failure `phase-aa [security]: settings/route.ts...`, `+35 more` | **Pre-existing, proven by real baseline reproduction**: identical named test, identical position, at the merge-base commit |

**Net Phase-2-attributable count across this entire continuation: zero currently-red lanes.** The
one lane this pass did introduce (`tenant-isolation`, from migration 262 not being reflected in
the checked-in registry snapshot) was found, fixed, and verified within the same pass, before this
final gate run — which is why it does not appear above.

## 8. Privileged bootstrap lookups, reviewed against the mandate's explicit checklist (Section 13)

Every `getSupabaseAdminUnguarded` call site added this pass (`employee.ts`'s
`verifyEmployeeOwnership`, `products.ts`'s new `loadProductByIdUnguarded`) re-checked against all
four documented conditions, not asserted by resemblance to the others:

- **Bounded lookup by an immutable identifier**: both key by a UUID primary key (`employees.id`,
  `products.id`), each `.single()`-bounded to exactly one row.
- **Authentication before lookup**: both routes resolve `customUser` from the authenticated
  session before the bootstrap read runs.
- **Ownership/permission verification before disclosure or mutation**: confirmed by re-reading
  both handlers directly — in neither case does the bootstrap-read result reach the response body
  or a mutation before the ownership/staff-permission check that follows it.
- **The client-controlled parameter narrows, never widens, authority**: `products.ts`'s LIST route
  takes a client-supplied `store_id`, but `assertStaffPermission`'s underlying `resolveGrants`
  query filters by *both* that `store_id` *and* the authenticated caller's own `user_id` — a
  malicious caller naming an arbitrary store they do not belong to simply matches zero rows; the
  client value can never substitute for the server-verified identity that actually grants access.
- **No enumeration / no error-detail leakage**: confirmed for both — a nonexistent id and an
  existing-but-unauthorized id return the *identical* generic error (`NOT_FOUND` /
  `FORBIDDEN` with a fixed message), never distinguishing the two cases.
- **No reusable escape hatch**: both are single-purpose functions against one named table each, not
  a generic table/query passthrough.

The pre-existing entries (`payment-route-support.ts`, `internal-store-access.ts`/
`storefront-callback-site.ts`, `marketplace-listings.ts`) were reviewed in the first and second
passes and are unchanged this pass; not re-audited a third time absent any change to them.

**Gateway runtime tenant isolation (Section 12) — the `service_role` bypass, reconsidered.**
Re-confirmed: `service_role` (what every gateway query connects as) has `rolbypassrls = true` at
the Postgres level, so RLS itself provides no protection for gateway traffic — this is not new
information this pass, and it is not being treated as a defect to fix: the actual backstop for
that path is `tenant-scoped.ts`'s application-layer query-guard Proxy, which is real, tested (the
allowlist contract tests), and was exercised correctly by every fix in this document (each one
either satisfies the Proxy's scope-predicate requirement directly or uses a documented, narrow,
re-verified bypass). The one thing re-checked specifically this pass, per Section 12's explicit
warning ("a query containing a store_id filter is not necessarily authorized if the caller
controls that store_id"): every client-supplied store/site id this pass's fixes touch is used only
to *narrow* a query that is *also* constrained by the server-resolved authenticated identity,
confirmed above — never substituted for it.

## 9. D04 and D05, broken into the mandate's own named items — not collapsed

**D04 — eight distinct items, not one "operator policy" blocker.**

1. **Named per-person operator identities.** `VERIFIED` — already true.
   `PLATFORM_CONSOLE_ALLOWED_EMAILS` is a list of individual, real email addresses; login is
   magic-link (sent to that specific address, not a shared credential) plus, in production,
   a per-principal TOTP secret (`PLATFORM_CONSOLE_TOTP_SECRETS`, JSON/CSV keyed by email — the
   fallback to one shared `PLATFORM_CONSOLE_TOTP_SECRET` is gated to non-production runtimes only).
   No decision needed on this item.
2. **Restricted reviewer permissions.** Gateway-side (`review:view`/`review:decide`, `employees`-
   keyed) `VERIFIED`, tested (F2.6). Console-session-level representation of this tier:
   `NOT_IMPLEMENTED` — a console session carries no `review:*` scope at all; the two systems remain
   unconnected. `BLOCKED_DECISION` for whether/how to wire them together.
3. **Moderator permissions.** No such tier is defined anywhere in either system.
   `NOT_IMPLEMENTED`, `BLOCKED_DECISION`.
4. **Administrative role assignment.** No mechanism exists to assign any tier to a person beyond
   being present on the flat, environment-provisioned allowlist. `NOT_IMPLEMENTED`,
   `BLOCKED_DECISION`.
5. **Per-user MFA.** Factor existence is `VERIFIED` in production (item 1). Self-service
   enrollment/rotation is `NOT_IMPLEMENTED` — today's per-principal secrets are provisioned
   out-of-band via environment variable, not through any in-product flow.
6. **Bootstrap authority.** `NOT_IMPLEMENTED`, `BLOCKED_DECISION` — no document names who is
   authorized to add the next operator's email/TOTP secret. Compounded by a new finding this pass:
   `POST /api/console-auth/login` explicitly refuses to send a magic link in production
   (`magic_link_delivery_not_configured` — no email-delivery mechanism is wired to this route at
   all), so even an already-bootstrapped operator's login path is unproven end-to-end in a real
   production deployment through this specific route.
7. **Recovery.** `NOT_IMPLEMENTED`, `BLOCKED_DECISION` — environment-variable rotation is the only
   path; no in-product recovery flow exists.
8. **High-risk approval.** `NOT_IMPLEMENTED`, `BLOCKED_DECISION` — no multi-party/dual-control
   mechanism exists anywhere in either system; the gateway's `review:decide` is single-operator.

**Recommended path (unchanged from the prior document, re-confirmed against this sharper
breakdown):** items 2–4, 6–8 are naturally sequenced *after* the merchant-realm identity-platform
OIDC migration (the existing wave-1 plan) lands, since the identity-foundation scaffold's own
per-principal shape (§6) is what any of these would be built against; building them against
today's flat allowlist first risks throwaway work. Item 5's self-service enrollment UI could
reasonably be built independent of that sequencing, since the per-principal secret storage already
exists — named as a candidate for independent work if the owner wants it prioritized ahead of the
larger migration.

**D05 — eight distinct items, not one retention blocker.**

1. **Request intake.** `VERIFIED` — built and tested this pass (§5).
2. **Technical export scope** (which fields/tables an export would actually contain).
   `NOT_IMPLEMENTED`/undefined — no export mechanism exists yet to have a scope; this is a
   distinct question from *whether* to build export at all, and remains unanswered even once that
   is decided.
3. **Joint buyer/merchant records.** Named, unresolved: `buyer_order_links` connects to `orders`
   rows that are simultaneously the merchant's own business/accounting record with its own,
   likely-longer retention obligation. `BLOCKED_DECISION`.
4. **Export authorization** (who approves a release, what identity proof is required before data
   leaves the system). `NOT_IMPLEMENTED`, `BLOCKED_DECISION`.
5. **Retention.** `BLOCKED_DECISION` — no duration or legal-basis classification exists for any
   category; F2.7 already named the affected categories precisely (`buyer_accounts`,
   `buyer_addresses`, `buyer_order_links`).
6. **Deletion execution.** Correctly `NOT_IMPLEMENTED`. Independently corroborated by the
   identity-foundation scaffold's own `compliance-rights.ts`: `planIdentityErasure`'s
   `CryptoShredPlan` hardcodes `erasePrincipal: false`/`deleteLegacyRows: false` and requires
   `humanRequired: 'HR-LEGAL-DPDP-PA'` — the same "do not execute irreversible deletion without
   accepted policy" conclusion, reached independently by whoever built that scaffold.
7. **Legal hold** (whether a deletion or export can be blocked by an active legal/compliance
   matter). Not modeled anywhere. `UNKNOWN` — named as genuinely unaddressed, not assumed away.
8. **Incident ownership** (who is responsible if a privacy request is mishandled or delayed past a
   compliance deadline). Not addressed anywhere. `UNKNOWN`.

**Recommended path:** resolve retention duration + legal-basis classification (item 5) and legal
hold (item 7) together first — both plausibly need the same legal/DPO input
(`compliance-rights.ts`'s own `HR-LEGAL-DPDP-PA` marker points at India's DPDP Act specifically),
and both gate what "export scope" (item 2) and "deletion execution" (item 6) can even mean. Items
1 and 3 (data-category inventory) are already done; nothing further proceeds independently of the
legal input for items 2, 4, 6 without risking rework.

## 10. What remains — named precisely, not silently deferred

- **D03/D04/D05** remain genuinely open owner decisions (§6 above for D03; D04/D05 restated with
  the sharper breakdown this pass's mandate requires — see the session's final verdict message).
- **Console login's production path**: found this pass, not previously named precisely —
  `POST /api/console-auth/login` explicitly refuses in production
  (`magic_link_delivery_not_configured`) because no email-delivery mechanism is wired to it. This
  reinforces, rather than duplicates, the already-named "no in-product bootstrap/recovery" gap
  (D04): the console's only login route cannot complete a login in production at all today.
- **TOTP is already per-principal in production** (`PLATFORM_CONSOLE_TOTP_SECRETS`, keyed by
  email), contrary to how the prior pass's D04 wrote it up — corrected here; the fallback to a
  single shared secret (`PLATFORM_CONSOLE_TOTP_SECRET`) is explicitly gated to non-production
  runtimes only, and console **authentication itself is magic-link (no password), which is a
  distinct fact from the *authorization*-tier question (no role concept) that remains the real,
  unresolved D04 gap**.
- **Buyer/customer session symmetric-key deviations** (HS256 customer realm, HMAC console session):
  unchanged this pass; adversarial coverage already exists and re-verified fresh in the prior
  document.
- **Export generation and deletion execution**: correctly unbuilt, D05-gated.
