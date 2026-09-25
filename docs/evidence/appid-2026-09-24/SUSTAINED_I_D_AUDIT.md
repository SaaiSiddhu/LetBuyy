# SUSTAINED-I — D1/D2/D4/D5/D6 audit against measured acceptance criteria

Workstream 7 of the owner's acceptance-closure directive. Measured against the actual repository
state at this phase's tip, not remembered from a prior session's summary. D3 (marketplace buyer
order visibility) is out of scope here — already `MERGED_DEVELOP`, see `SUSTAINED_D3.md`.

## D4 — personalized-account HTTP-caching leak: investigated first, per the owner's priority order

**No leak found.** Two independent mechanisms could plausibly have caused this class of bug in
`apps/commerce/web`; both were checked, one by direct empirical reproduction:

1. **Route-level ISR caching (`export const revalidate = 60`) combined with per-request session
   reads.** `apps/commerce/web/src/app/store/[subdomain]/{page.tsx,layout.tsx,[...path]/page.tsx}`
   all declare `revalidate = 60`, and the render path calls `getStorefrontCustomerDrop()` →
   `getSession()` (`lib/session.ts`), which reads the buyer's session cookie via `next/headers`'s
   `cookies()` **wrapped in a broad `try { … } catch { return null; }`**. In older Next.js versions,
   a swallowed `DynamicServerError` from a caught `cookies()` call is a well-known footgun that can
   cause a page to be incorrectly treated as static/cacheable despite reading per-request data — the
   exact shape of a personalized-caching leak. **Empirically tested, not merely read**: built a
   minimal, isolated Next.js 16.1.6 app (the exact version this repo uses, verified via
   `node_modules/.pnpm`) with two routes — one reproducing `getSession()`'s exact try/catch-wrapped
   `cookies()` shape plus `revalidate = 60`, one identical but unguarded (a control) — and ran a real
   production build. Result: **both routes are classified `ƒ (Dynamic)`** in Next's own build output,
   not `○ (Static)` — Next.js 16.1.6 correctly detects the dynamic API usage and overrides
   `revalidate` regardless of the try/catch, for both the guarded and unguarded case. The
   hypothesized footgun does not reproduce in this Next.js version.
2. **Next's fetch-level Data Cache, opted into per-call via `next: { revalidate, tags }`.**
   `apps/commerce/web/src/lib/api/client.ts`'s `storefrontApiFetch` defaults to `cache: 'no-store'`
   unless a caller explicitly passes `next`/`cache` options (`storefrontReadInit(...)`). Checked every
   call site in `customer-service.ts` (the module backing the personalized customer drop): all call
   `createStorefrontApiClient()` with no arguments, so every customer-data fetch inherits the
   `no-store` default. No personalized read opts into caching.

**Verdict**: `D4 = VERIFIED_REPOSITORY_FACT, no caching leak, no fix needed.` This is a negative
result reached by direct testing, not an absence-of-evidence claim.

## D1 — canonical buyer profile fields: NOT STARTED, confirmed unchanged

`buyer_accounts` (migration 223, `database/supabase/migrations/`) was created with `id, email,
password_hash, email_verified, status, created_at, updated_at` only. Checked every later migration
that touches the table (`255_buyer_verified_ownership_links.sql`: adds `email_verified_at`;
`257_buyer_email_challenges.sql`: adds `session_epoch` + its check constraint) up through the
current highest migration on disk, `259_marketplace_app_client_and_firebase_links.sql` — **no
migration ever adds `full_name`, `phone`, or any other profile field.** D1 needs a new migration; not
attempted in this phase without its own bounded schema-change plan (unchanged from SUSTAINED_D3.md's
original finding).

## D2 — buyer address book: NOT STARTED, confirmed unchanged

`grep -rln buyer_addresses` across every migration and `services/api-gateway/src` returns nothing —
no such table, no route references it. Same boundary as D1: needs its own migration + RLS phase.

## D5 — client/mobile UI wiring: NOT STARTED, more precisely characterized than before

Measured, not assumed: the gateway carries a substantial buyer-account route family under
`/storefront/buyer/*` — `register`, `verify-credentials`, `email-verification/{start,complete}`,
`password-recovery/{start,complete}`, `sessions/revoke`, `me`, `orders` (D3), `orders/claim`,
`return-requests`, `loyalty/:siteId[/history]`, `notifications[/unread-count][/:id/read][/read-all]`,
`support/tickets[/:id/messages]`, `product-views`, `follows`. Grepped every one of these path
fragments against `apps/commerce/web/src` and `apps/marketplace/mobile` (both the literal path
strings and, for the Dart mobile app specifically, its own `lib/data/marketplace_repository.dart`
repository layer): **zero matches for every single one**, including D3's own `orders` endpoint. The
mobile app does have real buyer **authentication** wiring (`lib/auth/buyer_sign_in_controller.dart`,
`buyer_session_store.dart`) — sign-in/session establishment is client-wired — but none of the
account-data routes above (orders, loyalty, notifications, returns, support, follows, product-views,
profile `/buyer/me`) has a confirmed client consumer in either surface. This is the same
"gateway-built, never wired" pattern this session found repeatedly in G1/G2/G3, now confirmed at
larger scale for the whole buyer-account route family, not just D3's one endpoint.

## D6 — buyer session lifecycle: substantially more complete than previously characterized

The prior summary said D6 was "session lifecycle beyond what already existed" with `/buyer/sessions
/revoke` noted as pre-existing. Measured now: the *full* lifecycle already exists at the gateway
layer — registration (`/buyer/register`), credential verification, email verification
(`start`/`complete`), password recovery (`start`/`complete`), and sign-out-everywhere
(`/buyer/sessions/revoke`, backed by `buyer_accounts.session_epoch`, migration 257). This was built
in an earlier session's phase (APPID-P4a, referenced in `docs/active/BRANCH_DISPOSITIONS.md`'s
history), not by SUSTAINED-D3 and not new in this phase. What is genuinely missing: a plain
single-device logout endpoint distinct from sign-out-everywhere (not found by name), and — per D5
above — none of it is wired into either client. `D6`'s backend is closer to done than `NOT_STARTED`
suggested; its *client integration* is the actual gap, and that gap is D5's, not a separate one.

## Where D3's endpoint actually belongs, and why D5 is `BLOCKED_INFRA` here, not merely deferred

`apps/commerce/web`'s own account UI (`account-bottom-sheet.tsx:592`, a real nav link to
`${basePath}/account/orders`, `basePath` scoped to the current store's subdomain) already exists —
but per D-ONE-BUYER's own design ("a storefront shows only the buyer's orders at the server-resolved
store"; "marketplace order views span merchants"), that page is *correctly* scoped to one store's
`store_customers` order history, a different realm from D3's cross-store `buyer_accounts`-based
`/buyer/orders`. Wiring D3's endpoint into that page would conflate the two realms D-ONE-BUYER
deliberately keeps separate — not a fix, a new bug. The client D3's endpoint actually belongs in is
`apps/marketplace/mobile` (the cross-store Marketplace app), which already has real buyer
authentication wiring (`lib/auth/buyer_sign_in_controller.dart`) but no orders screen consuming it.

**This makes D5 `BLOCKED_INFRA` in this container, not merely unprioritized**: the Flutter SDK is
not on `PATH` here (the same constraint recorded in every phase's infrastructure ground truth since
SUSTAINED-B), so a Flutter UI change cannot be built or verified (`flutter build`/`aapt dump badging`)
from this environment. Implementing D5 without that verification would be exactly the "DDL-real,
wiring-dead presented as done" failure mode this programme's own rules name — writing Dart that
cannot be proven to compile or run is not safer than not writing it. D5 is recorded `BLOCKED_INFRA`,
not implemented, not skipped silently.

## What this phase implements vs. leaves open

Per the owner's explicit instruction not to invent a second buyer-account or session model: D1/D2
each need a new migration (schema-change work with its own RLS/rollback discipline) — deferred for
the same reason SUSTAINED_D3 gave originally, a schema change deserves its own bounded phase. D4
needed no fix (verified clean, above). D5 is `BLOCKED_INFRA` (no Flutter SDK in this container,
above) — the correct client for it is Flutter, and this container cannot build or verify Flutter. D6
is substantially built already (a prior session's work); its own remaining gap is the same D5 client
wiring, not additional backend work. **Net: no D-item code change lands in this phase** — the
programme's own rule against `TARGET` reported as `CURRENT` applies here too: an audit that finds
real, well-evidenced reasons not to implement is not the same as skipping the audit, and is recorded
as such.
