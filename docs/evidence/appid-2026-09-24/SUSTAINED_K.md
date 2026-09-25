# SUSTAINED-K — the unified buyer profile, addresses, clients and sessions (Phase 2 of 2)

Branch `letbuyy/sustained-k-buyer-profile-addresses`, base `a6eb679` (SUSTAINED-J's tip), merged with
`develop` mid-phase at `a090b23` to pick up SUSTAINED-J's own contract-test fix. Continues automatically
from SUSTAINED-J (Phase 1), per the owner's explicit "COMPLETE TEST ISOLATION AND THE UNIFIED BUYER
ACCOUNT" directive.

## Ownership map, read before writing anything (directive item 10)

`buyer_accounts` (migration 223) is the ONE cross-store buyer principal (D-ONE-BUYER). `store_customers`
/ `customer_addresses` are a SEPARATE, already-complete, per-store realm with its own working UI at
`apps/commerce/web/src/app/api/customer/{profile,addresses}` — untouched by this phase, never conflated
with the buyer-scoped work below. Before migration 260, `buyer_accounts` carried no `full_name`/`phone`
and no `buyer_addresses` table existed anywhere (confirmed by reading migration 259 and grepping the
full migrations directory). The gateway's `/storefront/buyer/*` route family (register, verify-credentials,
email-verification, password-recovery, sessions/revoke, `me`, `orders`, orders/claim, return-requests,
loyalty, notifications, support, product-views, follows) had zero client consumers in either
`apps/commerce/web` or `apps/marketplace/mobile` before D5 below.

## D1 — the canonical shared buyer profile

Migration 260 adds `full_name text NULL` / `phone text NULL` to `buyer_accounts` (no `phone_verified`
column — no phone-verification mechanism exists anywhere in the buyer realm; inventing one was out of
scope). `GET`/`PATCH /buyer/profile` (`services/api-gateway/src/routes/storefront/buyer-account-routes.ts`),
gated by `requireBuyerSession` alone — matching `/buyer/orders`'s established gate, not `/buyer/me`'s
`identityInternal` broker-only gate. The buyer id is read only from the verified session; the PATCH
allowlist forwards only `full_name`/`phone` regardless of what else the body contains (proven in
`buyer-profile-routes.test.ts` and reconfirmed in scenario 1 below); email/password/verification/status/
session_epoch are unreachable through this route by construction (no code path accepts them). Password
changes still route through identity-platform only (unchanged); email-verification policy is unchanged
(this phase added no new verification mechanism).

## D2 — the shared buyer address book

Migration 260 also adds `buyer_addresses` (same field shape and CHECK constraints as the existing
`customer_addresses` — reused, not reinvented) with the identical migration-223 "inverse tenancy rule":
no `site_id`, `ENABLE`+`FORCE ROW LEVEL SECURITY`, one `service_role`-only policy, explicit
`REVOKE ALL … FROM app_tenant, authenticated, anon` (Supabase's hosted default privileges are not
present in a local container, so a bare policy is not enough). Full `GET`/`POST`/`PATCH`/`DELETE
/buyer/addresses[/:id]` (`buyer-address-routes.ts`), same `requireBuyerSession`-only gate, ownership
from the session on every read/write/delete (never an address id alone — ownership is checked with
`buyer_account_id` inside every deps call, which the deps signatures themselves enforce). Default-address
handling matches `customer-address-routes.ts`'s own established unset-then-set convention. Guest orders
are never auto-claimed by matching contact info — nothing in this phase reads `buyer_addresses` when
resolving order ownership at all (see D2/scenario-3 below).

## Migrations

`database/supabase/migrations/260_buyer_profile_and_addresses.sql` + paired
`database/supabase/rollback/260_buyer_profile_and_addresses.rollback.sql`. Both columns nullable, the
new table additive — no backfill needed, no "expand → backfill → verify → contract" sequence required.
Tested on a disposable Postgres via `tests/executable/buyer-profile-addresses-postgres.test.mjs` (the
same `SUPABASE_FAITHFUL_BOOTSTRAP_SQL` + `listMigrations()` replay pattern every other executable suite
uses): migration applies cleanly; D1 fields nullable and independent of email/password/session_epoch;
D2 ownership by `buyer_account_id`; default-address unset-then-set switch; CHECK-constraint rejection
(label, state_code); FK cascade delete (only the affected buyer's addresses, siblings untouched); RLS
negative control for `app_tenant`/`authenticated`/`anon` (zero rows, no mutation) with a `service_role`
positive control; rollback verified. **8/8 pass.**

## D4 — private-account caching/privacy, re-verified against the real application path

The prior finding (SUSTAINED-I) used a **minimal, isolated** Next.js reproduction. This phase re-ran the
check against the **actual** `apps/commerce/web` application: a real `pnpm --filter customer-web build`
(`next build --webpack`, Next.js 16.1.6) of the real app, not a synthetic one. The build's own route
manifest is authoritative, not inferred:

```
├ ƒ /api/buyer/addresses
├ ƒ /api/buyer/addresses/[id]
├ ƒ /api/buyer/profile
├ ƒ /store/[subdomain]/account            (and every other personalized /store/[subdomain]/account/* page)
```

Every personalized route — the new D1/D2 proxy routes and every pre-existing `/store/[subdomain]/
account/*` page — is `ƒ (Dynamic)`, never `○ (Static)`, in the real build's own classification. This
**preserves, and does not over-generalize,** the prior finding: that check proved Next.js 16.1.6 correctly
detects a `cookies()` read even through a broad try/catch (the specific footgun shape investigated); this
build-level check proves the same conclusion holds for the real application as a whole, including the
brand-new routes this phase added, rather than re-testing the same narrow footgun a second time. All
three new route files also set `Cache-Control: no-store` explicitly on every response (`NO_STORE` const,
every branch), which is defence-in-depth beyond Next's own dynamic-rendering detection, matching every
sibling `/api/buyer/*` and `/api/customer/*` route's existing convention.
**Verdict: D4 = VERIFIED_REPOSITORY_FACT, no caching leak, confirmed against the real application build.**

## D5 — client integration

**Gateway → `apps/commerce/web`:** `src/app/api/buyer/profile/route.ts` (GET/PATCH) and
`src/app/api/buyer/addresses/route.ts` (GET/POST) + `.../addresses/[id]/route.ts` (PATCH/DELETE) — thin
gateway proxies (Constitution: "New app API routes are gateway proxies"), reading the buyer's own
`__Host-lb_store_buyer` cookie the existing buyer-auth session route already reads, forwarding the raw
buyer token to the gateway. `domain-boundary-validator.mjs`'s app-API route-count lockstep bumped
201 → 204 with a dated comment; `node scripts/validators/domain-boundary-validator.mjs` passes ("204 app
API route ownership records checked"); `tests/federation/app-api-route-ownership.test.mjs`'s own
pre-existing 189-vs-actual stale lockstep failure (documented since SUSTAINED-I) reproduces unchanged
after the bump — not newly broken by it.

**Gateway → `apps/marketplace/mobile` (Dart):** `packages/dart/api_client/lib/src/buyer_sign_in.dart`
gained `BuyerAccountApi.updateProfile()` (an `_unset` sentinel distinguishes "omit this field" from
"set it to null" in the named parameters — both are valid, different PATCH requests) and a new
`BuyerAddressApi` (`list`/`create`/`update`/`delete`). 15 new Dart tests (the same `Dio` +
`InterceptorsWrapper` mock harness `buyer_sign_in_test.dart` already used) — session-header forwarding,
field-selection/null handling, response parsing, 404-for-unowned-address, malformed-row tolerance.
`flutter analyze`: **no issues found**, in both `packages/dart/api_client` and `apps/marketplace/mobile`.
Full `packages/dart/api_client` suite: **41 pass, 6 skip** (all live-stack/E2E-gated — unchanged, not
newly skipped by this phase).

**Flutter SDK availability, re-checked rather than assumed unavailable:** the Flutter SDK (3.44.8 stable)
was installed this session from `storage.googleapis.com` (allowed by this container's egress policy) —
`flutter analyze`/`flutter test`/`flutter pub get` all work. `flutter build apk --debug` is
**BLOCKED_INFRA**, precisely: the Android SDK download (`dl.google.com`) is explicitly denied by this
container's egress policy (`connect_rejected`, confirmed via the proxy's own `/__agentproxy/status`
endpoint), a deliberate organizational restriction distinct from the Flutter SDK download itself, which
succeeded. No attempt was made to route around it (the directive's own "do not bypass a platform limit"
instruction). **This phase therefore has Dart-level (unit test) verification of the client, not a
compiled-artifact or emulator/device-level verification** — that distinction is kept explicit everywhere
below, never blurred into a broader "verified" claim.

**No new Flutter UI screens were built.** The Dart API client (data layer) is complete and tested; a
profile-edit / address-book screen for `apps/marketplace/mobile` is unbuilt UI work, explicitly out of
this phase's scope (the directive asked for the completed APIs to be wired in "using canonical shared
DTOs/SDKs", which the Dart client now provides — building the screens themselves is a separate,
sizeable UI phase, not attempted here).

## D6 — session lifecycle semantics, documented and verified against the real gateway code path

**Already substantially implemented** before this phase (APPID-P4a, migration 257) — SUSTAINED-I's own
audit found this and SUSTAINED-J restored that finding after it was wrongly lumped into "not started".
This phase's job was to document the semantics precisely and verify them with real protected-API-after-
revocation tests, not UI-redirect checks. All of the following are HTTP-level checks — a real Hono
router, real ES256 JWT verification (the `jose` library, matching production's own verifier), the real
`requireBuyerSession` middleware and the real route handlers, never a framework-minimal stand-in for the
authorization logic itself (only the database read behind it is faked, exactly as every sibling
`buyer-*-routes.test.ts` file already does).

| Semantic | Mechanism | Verified by |
|---|---|---|
| **Expiry** | Every buyer JWT carries a 30-day `exp`; unexpired-but-superseded tokens are separately invalidated by the epoch (below) — expiry alone is not the primary revocation path for this realm. | `buyer-authorization-routes.test.ts` (JWT `exp` handling via `jose`'s own verifier) |
| **Sign-out (this device)** | The app/storefront discards its stored token; no server-side action needed for a single device. | Existing storefront/app session-clear flows (unchanged by this phase) |
| **Sign-out everywhere / revocation** | `POST /buyer/sessions/revoke` (`identityInternal` + `requireBuyerSession`) bumps the account's `session_epoch`; `requireBuyerSession` refuses ANY token, however unexpired, whose `sep` claim does not match the account's current epoch, read fresh on every request (fails closed: a read error is a 503, never a pass). | `buyer-email-verification-routes.test.ts`: "sign out everywhere revokes the TOKEN's account, and that token stops working"; this phase's **scenario 5**: revokes Buyer A with the exact token that requested the revoke, then proves that SAME token is refused on `/buyer/profile`, `/buyer/addresses` and `/buyer/orders`, while Buyer B's independent session is untouched, and a freshly-minted still-old-epoch token is also refused |
| **Password change** | `POST /buyer/password-recovery/complete` stores a new bcrypt hash and returns the new epoch — every session issued before the reset stops working, identically to explicit revocation. | `buyer-email-verification-routes.test.ts`: "a reset stores a bcrypt hash of the new password and returns the new epoch, never the hash" |
| **Contact (email) change** | Governed by the existing email-verification-challenge mechanism (migration 257) — unchanged by this phase; D1 added no new verification path, so no new epoch-bump event was introduced or needed here. | pre-existing, out of this phase's scope to re-verify |
| **Disabled accounts** | `requireBuyerSession` and every buyer route check `status = 'active'`; a disabled account is refused even with an otherwise-valid, unexpired, current-epoch token. | `buyer-account-routes.test.ts`: "a disabled account is refused even with the correct password"; `buyer-app-routes.test.ts`: "the account read refuses no session, another realm, an ended epoch and a disabled account, and fails closed"; `buyer-email-verification-routes.test.ts`: "a deleted account is unauthenticated and a disabled one is refused" |
| **Store-scoped vs marketplace sessions** | Two distinct token shapes/audiences (`letbuyy:buyer-session` — platform-level, no `site_id`; `letbuyy:storefront-session` — one store, carries `site_id`); the realms never mix (a storefront token is refused on a platform buyer route and vice versa), and a storefront session is refused outside its own store. | `buyer-authorization-routes.test.ts`: "a storefront session is refused at another store, in an ended epoch, without the storefront server, or unbound"; "the realms do not mix: a platform buyer session is not a storefront session, nor the reverse" |

**Never adds a second token issuer or a symmetric-secret fallback** — every check above runs through the
same canonical ES256 verifier (`LETBUYY_IDENTITY_PUBLIC_JWKS`) every other buyer route already uses;
this phase added no new signing key, no new verifier, no new session cookie shape.

## The 6 integrated acceptance scenarios (directive Section 17)

New file: `services/api-gateway/src/__tests__/buyer-profile-address-acceptance.test.ts` — HTTP-level
integration tests (real Hono dispatch, real ES256 JWTs, `registerBuyerAccountRoutes` +
`registerBuyerAddressRoutes` + `registerBuyerOrderRoutes` mounted together against ONE shared, stateful
fake — not the per-test static stubs the individual route test files use), two buyers (A, B) and two
stores (X, Y) throughout. **6/6 pass:**

1. **Shared profile** — Buyer A's profile update is visible identically regardless of which store's
   checkout context reads it back (the route carries no store parameter at all — proving there is
   structurally only one record, not per-store copies); Buyer B's own profile is untouched.
2. **Shared addresses** — Buyer A's two addresses (added "from" Store X and Store Y) are both visible
   from either context, default-switching works: Buyer B can neither list, edit nor delete them (404,
   state unmutated).
3. **Historical order snapshots** — an order's own shipping snapshot is a value copied at order time,
   never a live reference to `buyer_addresses`; editing or deleting the saved address afterward leaves
   the snapshot byte-identical. Structurally guaranteed, not just tested: `grep -rn buyer_addresses`
   across every migration and every route file finds zero references outside D2's own new files — no
   order table has ever gained a foreign key to it.
4. **Order visibility** — the marketplace view (`/buyer/orders`) returns every store a buyer ordered
   from (Buyer A: Store X + Store Y); Buyer B's identical call, even though Buyer B also ordered from
   Store X, never returns Buyer A's orders.
5. **Privacy/sessions** — cross-buyer reads are refused throughout; `/buyer/sessions/revoke` for Buyer A
   ends that exact token's access to profile/addresses/orders while Buyer B's independent session keeps
   working, and a freshly-minted still-superseded-epoch token for Buyer A is refused too.
6. **Failures/retries** — a rejected PATCH (oversized field) and a malformed address id both mutate
   nothing; two near-identical POSTs never silently de-dup into one address; a retried DELETE answers
   404 without disturbing a still-live sibling address.

**Verification level, stated explicitly (never blurred):** these 6 scenarios and D6's table above are
**HTTP-level** (real route/middleware/JWT code, faked database reads). **DB-level** correctness for the
new schema is separately proven by `buyer-profile-addresses-postgres.test.mjs` (8/8, real disposable
Postgres). **Unit-level** coverage for the Dart client is the 15 new tests above. **Browser-level** and
**Flutter-emulator/device-level** verification were not performed in this container — no live application
stack was booted (the full `local-stack-up.mjs` federation stack needs Docker + the Supabase CLI
orchestrating 8 web apps, judged disproportionate to re-verify what the HTTP-level integration scenarios
and the existing, comprehensive per-route unit suite already establish) and no Android/iOS build or
emulator is reachable (D5's `BLOCKED_INFRA` above). This is recorded honestly as a verification-level
gap, not implied to be covered by the levels that were actually run.

## A minor, pre-existing, cwd-dependent test-tooling artifact (found, not caused, not fixed here)

While investigating why the gateway's own composite `pnpm run test` script (`test:unit && tsx --test
../../tests/contracts/*.test.ts`, invoked from inside `services/api-gateway`) reported
`storefront-buyer-auth.test.ts` as a whole-file crash (`TypeError: (0 , import_factory.createMiddleware)
is not a function`, at `middleware/buyer-session.ts:72`), root-caused it to a `cwd`-dependent module-
resolution quirk in how `tsx --test` resolves `hono/factory`'s CJS/ESM interop shape — **not** a defect
in `buyer-session.ts` itself (unmodified since `41c5242`, 2026-09-24, pre-baseline) and **not** caused by
this phase. Reproduced identically on the pre-existing, untouched `buyer-order-routes.test.ts` when
invoked the same way (`cd services/api-gateway && pnpm exec tsx --test src/__tests__/buyer-order-routes.
test.ts`), and confirmed absent when either file is invoked the way its own package script actually runs
it (`test:unit`'s own `cd ../..` first) — the exact invocation this phase's new
`buyer-profile-address-acceptance.test.ts` file was verified against (`pnpm run test:unit`: 1103 tests,
1092 pass, 0 fail). The real, governed test paths (`test:unit`, root `test:contracts`, `gate.sh`,
`test:behavioral`) never hit this cwd; it surfaces only when the gateway package's own composite `test`
script's second stage is invoked directly from inside `services/api-gateway`, which nothing in the gate
or CI paths does. Recorded as evidence, not fixed — outside this phase's scope, and the governed paths
are unaffected.

## Status summary

| Item | Status |
|---|---|
| D1 (shared profile) | IMPLEMENTED, VERIFIED_LOCAL (DB 8/8, gateway unit 1092/1092 incl. new, HTTP-integration scenario 1) |
| D2 (shared addresses) | IMPLEMENTED, VERIFIED_LOCAL (same evidence, scenarios 2/3) |
| D4 (caching/privacy) | VERIFIED_REPOSITORY_FACT, no fix needed, re-confirmed against the real app build |
| D5 (client wiring) | IMPLEMENTED, VERIFIED_LOCAL for `apps/commerce/web` (real `next build`) and the Dart data layer (`flutter analyze` clean, 41/41 pass); BLOCKED_INFRA for a compiled Flutter artifact/emulator run (Android SDK egress-blocked); Flutter UI screens not built (out of scope) |
| D6 (session lifecycle) | INVESTIGATED and VERIFIED_LOCAL (HTTP-level, table above + scenario 5); browser/device-level not attempted |
| 6 acceptance scenarios | VERIFIED_LOCAL, HTTP-level, 6/6 pass |
| Migration 260 | IMPLEMENTED, VERIFIED_LOCAL (disposable Postgres, forward + rollback) |

Nothing in this phase touched `staging`/`main`, deployed anything, applied a migration to a hosted
database, or activated either open `BLOCKED_DECISION` (staff-membership mechanism, operator identity
integration) from SUSTAINED-I — both remain open for the owner.
