# Buyer store wishlist — local acceptance

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`  
Source base: `0862687a5008d604d0df23357b2eb511293139fa`; the documented implementation and tests include the current working-tree changes.

## Outcome

The canonical storefront buyer can use a store's existing customer wishlist only after an explicit, verified `buyer_store_customers` relationship exists for the signed buyer and signed site. The gateway resolves the store-customer ID from that relationship; browser input cannot choose buyer, customer or site ownership. A buyer with no relationship sees an empty, explicitly unlinked state and cannot mutate the list. An inactive or deleted linked store-customer is reported as unavailable and cannot read or change wishlist data. Existing customer wishlist storage is reused.

Commerce proxies derive the site from the resolved host-bound buyer session, forward only that session and the allowed product fields, enforce same-origin write protections through the shared buyer-data session resolver, and project safe no-store responses. The account hub exposes the wishlist to buyer accounts; the page directs an unlinked buyer to the existing deliberate account-link flow. Guest and legacy store-customer wishlist behavior stays on its existing path.

## Verification

| Check | Result |
| --- | --- |
| Buyer wishlist gateway route tests | 6/6 passed |
| Buyer API proxy regression suite | 56/56 passed |
| Owned PostgreSQL suite `storefront-buyer-wishlist.postgres.test.ts` | 3/3 passed; run `c4e58b9fd2f3`, PostgreSQL 16 / PostgREST 16.2; runner cleaned its owned resources |
| Full gateway unit lane | 1,335 tests: 1,334 passed, 0 failed, 1 existing TODO (`LB-BIL-002`) |
| Customer web package test command | 1,071 passed across its 60, 65 and 946 test stages; 0 failed/skipped/TODO |
| Gateway and customer-web TypeScript checks | Passed |
| App API ownership and database-lane governance | 17/17 passed; route inventory ratchet updated 205→206 and gateway DB catalog 15→16 |
| Focused customer-web ESLint | Passed with 0 errors and 18 existing theme-token/color warnings |
| `git diff --check` | Passed |

## Security and evidence limits

The database suite drives the real local worker and owned Postgres/PostgREST, but uses the backend service credential for setup and calls. It verifies gateway ownership and signed-session checks; it is not buyer-role RLS proof. Unit and proxy tests cover absent/unverified links, inactive accounts, database failures, wrong sites, forged body principals, malformed product identifiers, identity/session isolation, and sanitized service failures.

No live browser, real buyer login, PKCE identity-provider round trip, hosted storefront, production database, independent review signature or deployment was performed. The link action itself is covered in the separate session-retirement evidence; this suite verifies wishlist behavior once relationship state exists. Loyalty, reviews and checkout association remain unconnected. The F2.1 legacy HS256 issuer/verifier retirement, D03 cutover, D04 operator bootstrap/MFA/dual approval, D05 privacy release/retention/deletion/legal hold, and whole Phase 2 remain open. This is one local Phase 2 journey slice and does not complete the eleven-phase goal.

## Liquid storefront integration addendum — 4 October 2026

The API acceptance above is now connected to the Liquid storefront journey in the current working tree. `composition-engine.tsx` loads the canonical wishlist only on wishlist, index, product, collection and search renders, using the host-bound buyer session and the signed buyer/site relationship endpoint. It resolves product cards through the current store's catalog service and supplies those verified products to the `buyer_wishlist` Liquid drop. A canonical buyer render does not also expose the legacy store-customer wishlist drop. Wishlist hearts post through `/api/buyer/wishlist` for linked buyers; unlinked buyers are directed to account settings, unavailable data fails closed, and guests and legacy store-customer sessions retain their existing behavior. Generated example bundles were refreshed from the SDK source.

| Current integration check | Result |
| --- | --- |
| Buyer wishlist drop tests (`node --conditions=react-server --import tsx --test src/lib/buyer-wishlist-drop.test.ts`) | 3/3 passed; signed site-bound fetch, linked IDs, unlinked/unavailable, guest and malformed responses |
| Liquid wishlist browser-island tests (`node --import tsx --test src/lib/theme-engine/liquid-wishlist-island.test.ts`) | 2/2 passed; canonical POST shape and no mutation for unlinked/unavailable buyers |
| Liquid SSR wishlist and neighboring account/order tests | 13/13 passed, including linked products and explicit unavailable/unlinked/guest rendering |
| Customer-web focused test stages | 64/64 and 73/73 passed |
| Root Liquid/theme contract group | 946/946 passed; includes the canonical registration transition assertion updated from the retired store-local form contract |
| Theme-engine test suite (`node --import tsx --test test/*.test.ts`) | 1,873/1,873 passed |
| Customer-web TypeScript check | Passed |
| Theme-engine TypeScript check | Passed |
| `git diff --check` | Passed |

This remains local source and automated verification. The Docker socket was unavailable during this work, so the owned-PostgreSQL suite was not rerun; the earlier dated DB evidence above remains the only owned-DB execution evidence. No live browser journey, buyer/provider round trip or hosted storefront was verified. This integration closes the Liquid presentation and mutation seam only; it does not close F2.1 issuer retirement, D03/D04/D05, or Phase 2.

## React product-detail follow-on — 4 October 2026

The React product-detail heart now reads and mutates the same identity-aware
wishlist context as the account and canonical buyer BFF. It no longer flips
component-local state that could claim a save without persisting it. While the
wishlist is loading or unavailable the control is disabled; an unlinked
canonical buyer is directed to the existing Account Settings link flow, and a
store account reported inactive/unavailable receives an explicit status.
Guest and legacy store-customer modes continue to use the provider's existing
behavior.

| Current check | Result |
|---|---|
| Commerce web TypeScript | Passed |
| Buyer API proxy suite | 61/61 passed |
| Wishlist identity mode tests | 3/3 passed |
| Buyer wishlist drop tests | 3/3 passed with the React server condition |
| Focused ESLint | Exit 0, 18 theme-token warnings in this large product component, no errors |
| `git diff --check` | Passed |

This is source/type/unit evidence, not an interactive browser/device journey.
The hosted account linkage, browser session, owned-Postgres suite and Phase 2
legacy-session retirement remain separate acceptance requirements. A direct
Node invocation of the Gateway route tests in this host failed during module
initialization (`createMiddleware is not a function` under the package's
declaration-alias path); it did not execute assertions and is not counted as
passing or as an implementation failure. The prior dated Gateway and owned-DB
results above remain their respective evidence.

## Stale cross-tab write protection — 10 October 2026

Buyer wishlist writes now compare against the buyer whose page state was loaded.
The React provider and every canonical Liquid wishlist island send the rendered,
gateway-verified buyer ID in `x-letbuyy-expected-buyer-id`; the ID is never part
of the mutation body and is only a compare value. The Commerce BFF resolves the
current host-bound cookie session, verifies its buyer profile, and refuses a
missing ID, profile outage, or changed principal before forwarding a POST or
DELETE. Liquid SSR now reads the canonical profile alongside the store wishlist
and fails closed if it cannot obtain a buyer ID. The seeded theme templates and
generated example bundles carry that ID into each wishlist island.

| Check | Result |
|---|---|
| Liquid wishlist-island and SSR drop tests | 8/8 passed; writes include only the compare header and absent server identity fails closed |
| Buyer API proxy plus wishlist-drop tests | 73/73 passed; stale, missing, and uncheckable identities do not reach the writer |
| Theme example and Liquid section parity tests | 30/30 passed; both generated bundles match source fixtures |
| Customer-web typecheck | Passed |
| Owned Postgres + Chromium cross-tab failure journey | The fifth run passed 12/12 (`runId 6a7eca1f734a`, PostgreSQL 16 / PostgREST 16.2, 183.2 seconds; cleanup failures 0 and no containers, networks, or volumes remaining). Chromium observed stale wishlist DELETE 409 with buyer A's compare header and visible failure status. Owned PostgreSQL confirmed A's control row stayed present, B's row stayed absent, and the Gateway saw no DELETE. The exact sanitized response body remains covered by BFF tests. Earlier runs are preserved below as diagnostic history, not acceptance failures for the final source. |

The owned run is required to establish the real-cookie/browser rejection and
the persisted A/B wishlist state. Until it passes, this change is locally
verified only. Hosted sign-in, production data, external buyer acceptance and
all remaining Phase 2/F2.1/D03/D04/D05 requirements remain open.

## Confirmed-mutation and concurrency follow-on — 4 October 2026

The shared React wishlist no longer applies speculative server-backed state.
While a buyer/store-customer save or removal is pending, duplicate clicks for
that product are ignored and the control exposes the pending state. Confirmed
responses update only that product through a functional state update, so two
different products can finish in either order without overwriting each other.
A failed write leaves the last confirmed list intact, reports a retryable
mutation error, and a result from a previous identity key cannot update the
newly selected wishlist. Guest localStorage behavior stays synchronous. The
React integration test switches stores while a write is pending and confirms
that its stale response cannot populate the next store's list; changing only
the signed-in buyer email has not been separately exercised.

The new React/jsdom context test exercises concurrent writes, duplicate-click
suppression, out-of-order success and failure, and preservation of a confirmed
item. Focused context/state tests pass 6/6; the full customer-web `test` script
passes, including the final root contract group 947/947. Customer-web
TypeScript passes; focused ESLint exits 0 with 18 theme-token warnings in the
existing large product-detail component; `git diff --check` passes. The normal
test script now uses Node's TSX import hook rather than spawning the TSX IPC
pipe, which was denied by this host's sandbox. No browser/provider/database or
hosted journey is claimed here.

**Next verification:** exercise product detail → wishlist → account wishlist
in a running local browser. Rerun the owned-Postgres suite when the Docker
socket is available; do not substitute hosted data.

## 8 October correction — linked buyer wishlist verified in Chromium and owned Postgres

The prior browser-verification item is now closed for this local journey. The
owned `storefront-customer-profile.postgres` suite passes **12/12** with zero
failures, skips, TODOs or cancellations (`4ec852a32e9e`). In Chromium, the
synthetic buyer signs in to the local Identity app, completes the verified
store-account link, saves the owned product from its product-detail heart,
receives the successful Commerce buyer-BFF response, then opens account
wishlist and sees the saved product. The browser's wishlist read and write
travel through the production Gateway worker; the suite verifies the persisted
row is owned by the store-customer resolved from the verified buyer/site edge.
See the sanitized [browser run record](P2_BUYER_WISHLIST_BROWSER_RUN_2026-10-08.json).

This is local synthetic browser/database acceptance, not hosted adoption,
buyer-role RLS proof, provider acceptance, or full multi-store journey
acceptance. Loyalty, reviews, checkout association and remaining Phase 2
requirements stay open. The runner removed its disposable database and
PostgREST resources.

## 8 October follow-up — refresh wishlist identity when a storefront tab returns

The earlier concurrency follow-on had not exercised a buyer-only switch while
keeping the storefront mounted. If another tab replaced the host-only buyer
cookie, a still-open tab kept the previous buyer session in React memory until
navigation; a wishlist read begun for that prior identity could also finish
late. The wishlist provider now revalidates the buyer session on visible-tab,
focus and page-show events. It immediately marks the current session as
refreshing and suppresses wishlist reads while the session check is pending, so
the previous list is hidden before the host-only cookie is revalidated. Once
the check completes, it advances the local session generation and loads the
matching identity; identity-key guards reject late reads/writes from the prior
generation. This also refreshes when the email is unchanged, so email alone is
not treated as the complete refresh signal.

The focused jsdom regression starts with buyer A's item visible, holds the
session response after a focus event, and verifies A's item disappears and no
new wishlist read starts until identity validation completes; it also hides A's
buyer-session and store-link indicators during that interval. The response
then switches to buyer B and the provider loads B's list and link state. It does
not exercise a real cross-tab browser switch, a late prior-account read, or a
same-email account switch; those remain separate browser/read-race checks. `node --import tsx --test
src/context/wishlist-context.test.tsx` passes **2/2**; the full Commerce web
test command passes **1,165 tests across its 95-, 123-, and 947-test
stages**, with zero failures/skips/TODOs; Commerce typecheck and focused ESLint
pass. This verifies the React identity-refresh behavior in jsdom, not a real
cross-tab Chromium account switch or hosted browser session. The 8 October
owned browser wishlist acceptance above remains the separate positive browser
and database journey. Phase 2 and the eleven-phase goal remain open.

## 8 October cross-tab buyer-switch browser acceptance

The owned suite now passes **12/12** with zero failures, skips, TODOs or
cancellations (`285d90778e4e`). In one Chromium browser context, a second tab
uses Identity's real “Use a different account” login, consent and PKCE callback
to replace the host-only buyer cookie while the first account-wishlist tab
remains mounted. The first tab revalidates its buyer session through Commerce's
real BFF and the owned Gateway/Postgres fixture. The test holds that response,
confirms the old product is hidden and no wishlist read starts, then releases it
and verifies the replacement unlinked buyer receives an empty wishlist and the
link-account prompt. The database-backed suite also retains its existing
customer-profile, cross-store, login, address, password-reset and atomic support
checks. See the sanitized [owned browser run record](P2_BUYER_WISHLIST_CROSS_TAB_BROWSER_RUN_2026-10-08.json).

To avoid colliding with existing developer Next processes, the spawned test apps
use unique, test-only `distDir` paths; the smoke runner waits for its own process
groups to stop before removing those paths. Headless Chromium did not emit a
focus event consistently on `bringToFront`, so the test explicitly dispatches
the lifecycle `focus` signal after the sibling-tab login; the cookie change,
Identity journey and Commerce/Gateway/Postgres requests remain real local
integration traffic. Identity's ignored `node_modules` directory was absent in
this checkout, so two temporary links to already-present Tailwind packages
were supplied for this run and removed afterward. Runner-owned containers,
database, PostgREST, network and volume cleanup passed; a post-run process check
found only the pre-existing developer Next servers. This is local synthetic
acceptance, not hosted adoption, role-RLS proof, or full Phase 2/eleven-phase
acceptance. Session lifetime, hosted telemetry/drain and remaining phases stay
open.

## 8 October browser-switch verification attempt — runner blocked before fixture startup

The owned browser suite has been extended with a synthetic second buyer who has
no store-customer link. A second Chromium tab now uses the normal Identity
“Use a different account” and credential-login/consent/PKCE path while the
first account-wishlist page stays mounted. The test holds the returning tab's
real Commerce buyer-session BFF response, checks that the previous product is
absent and that no buyer-wishlist read starts before identity validation, then
releases the response and checks the replacement buyer's empty, unlinked state
through the real Gateway/Postgres path.

This new browser assertion is **not yet accepted**. The exact owned-suite run
(`7e808703e7f3`) stopped during the runner's infrastructure preflight because
`docker info` did not find a real Docker daemon. The runner reports
`ownership: not started`, zero tests, and no created containers, networks or
volumes; its cleanup check was clear. `node --check
apps/commerce/web/scripts/customer-session-runtime-smoke.mjs`, API Gateway
typecheck, and scoped `git diff --check` pass, but they do not verify the new
journey. Rerun the owned suite when the repository runner can access a real
Docker daemon. No user data, hosted services, cookies, token issuers, session
lifetimes or authorization policy were changed by this test-only addition.

## 8 October jsdom identity-generation race follow-up

While the owned Chromium runner remains unavailable, the focused React test now
also holds an account-A wishlist read across a same-email identity refresh to
account B. It verifies the new identity generation starts its own wishlist
read even though the email is unchanged, and that A's late response cannot
replace B's confirmed list. `node --import tsx --test
src/context/wishlist-context.test.tsx` passes **2/2**, Commerce web typecheck
passes, and `git diff --check` passes. This closes the local state/read-race
checks only; it does not supersede the still-unexecuted second-tab Chromium and
owned-Postgres journey above.

## 8 October mounted account-surface refresh follow-up

The earlier cross-tab fix refreshed the buyer session and hid the old
wishlist, but the shared account chrome, settings, addresses, account sheet,
and review form still held page-local session state. A returning tab could
therefore keep rendering a prior buyer's email/profile/address or leave a
draft associated with the old principal after the cookie changed.

The storefront session provider now exposes its verified buyer email, ready /
refreshing / unavailable state, and generation to mounted account consumers.
Account chrome keeps its already-authorized subtree mounted but visually and
accessibly inert while revalidation is pending, preserving drafts without
displaying stale content. Settings reloads the canonical profile on each
session generation and waits for it before revealing the form; the canonical
buyer ID distinguishes a same-email principal switch from a routine focus
refresh, so only a real account change replaces an unsaved profile draft.
Addresses suppress the old list, reject late reads, reload for each session
generation, and compare canonical buyer IDs (not just email) before retaining
an open form; a same-email account switch or session-verification failure
discards the prior buyer's draft. The account sheet and product-review form use
the same provider instead of a one-time page-local session read; review drafts
are cleared when the verified email changes. No cookie, issuer, authorization,
or session-lifetime policy changed.

The focused account-address test exercises buyer A → pending focus
revalidation → a different buyer ID with the same email, verifies that A's
private address and open form are hidden/discarded and that B's own address
loads, then injects a 503 session
check and verifies the last address/form is cleared and an error remains
distinct from an empty address book. This test plus the buyer-session context
suite passes **3/3**. The full Commerce web suite passes (all three test stages,
1,165 tests, zero failures); Commerce typecheck and `git diff --check` pass.
Scoped ESLint exits successfully with 0 errors and 172 token/raw-color style
warnings.

The owned Gateway/Postgres/Chromium suite was attempted again
(`8b14fea1807f`) but stopped in preflight: `docker info` found no real Docker
daemon. It started zero tests and created no containers, networks, or volumes;
cleanup is clear. The mounted account-surface browser scenario is therefore
not yet verified in Chromium/owned Postgres. Rerun the owned suite when Docker
is available and add a real two-tab address/profile switch assertion.
Settings, account chrome, account sheet, and product reviews have local
typecheck/lint coverage but not a dedicated browser assertion yet. Phase 2 and
the remaining programme stay open.

## 8 October buyer-settings refresh verification

Added a focused mounted-component regression for the canonical buyer settings
page. It confirms the prior profile subtree is hidden and inert during a focus
session check, a same-email/same-buyer refresh reloads before showing the page,
a same-email/different-buyer-ID response replaces the profile, and a failed
session check leaves the last profile hidden behind an unavailable message.
The test runs through the real `CustomerAuthProvider` and `WishlistProvider`
with synthetic BFF responses; it does not claim a browser, Gateway or database
journey.

`pnpm --dir apps/commerce/web exec node --import tsx --test src/components/storefront/settings-client.test.tsx`
passes **1/1**. The full Commerce web test script exits 0 with the new test
included; Commerce web typecheck and `git diff --check` pass. Scoped ESLint
exits 0 with no errors and 39 existing theme-token/raw-color warnings in the
settings client. The hosted/owned Gateway/Postgres browser scenario is still
blocked because Docker access is denied. No token, issuer, session lifetime or
hosted configuration changed; Phase 2 and the eleven-phase goal remain open.

## 8 October account-sheet refresh verification

Added a mounted React regression for the open account sheet using the real
`CustomerAuthProvider` and `WishlistProvider` with synthetic BFF responses. On
focus, the previous buyer email and linked-orders action disappear while the
cookie session is pending; a successful response shows the replacement buyer,
and a 503 leaves the sheet on the guest sign-in path without exposing the prior
email. The test does not exercise a real browser, Gateway, or database.

`pnpm --dir apps/commerce/web exec node --import tsx --test src/components/account/account-bottom-sheet.test.tsx`
passes **1/1**. `pnpm --dir apps/commerce/web test` exits 0 across all three
stages (the final shared-runtime stage reports **947/947**); Commerce web
typecheck and `git diff --check` pass. Scoped ESLint exits 0 with no errors and
53 warnings in the component, including existing React effect and style-token
warnings. This closes the missing local mounted assertion for the account
sheet only. The owned Gateway/Postgres/Chromium lane remains unavailable due
to Docker access; the session-lifetime policy, hosted telemetry/drain, Phase 2
and Phases 3–11 remain open.

## 8 October review-draft identity-switch verification

Added a mounted React regression for the storefront product-review form, using
the real customer and wishlist providers with synthetic BFF responses. It opens
the review form under buyer A, enters a private draft title, then holds a focus
session refresh and verifies the old email/form are hidden. After buyer B is
confirmed, reopening the form shows B's identity and an empty title field; a
subsequent session-check 503 also hides the form and prior email. This is local
jsdom coverage and does not claim a real Chromium, Gateway, or database review
journey.

`pnpm --dir apps/commerce/web exec node --import tsx --test src/components/product/product-reviews-identity.test.tsx`
passes **1/1**. The full Commerce web script exits 0 across all three stages
(final shared-runtime stage **947/947**), typecheck and `git diff --check`
pass, and scoped ESLint has 0 errors with 36 existing design-token warnings.
Local mounted coverage now exists for settings, account sheet and review form;
account chrome still lacks a dedicated mounted assertion. The owned browser
account-surface journey remains unverified because its runner's Docker
preflight was blocked. No session or hosted policy changed; Phase 2 and the
eleven-phase goal remain open.

## 8 October account-chrome refresh verification

Added a mounted account-chrome test with the real customer and wishlist
providers and synthetic BFF responses. During a held focus revalidation, the
prior buyer details remain mounted but the account subtree is `aria-hidden`
and inert, so the returning tab keeps its existing content state without
exposing or allowing interaction with the old buyer's details. Once the new
buyer is verified, the replacement email appears. A 503 removes the prior
email, shows the account-check error, and does not redirect the customer away
from the page. This jsdom test does not claim a Chromium, Gateway, or database
journey.

`pnpm --dir apps/commerce/web exec node --import tsx --test src/components/storefront/account-chrome-client.test.tsx`
passes **1/1**. The full Commerce web suite exits 0 across all three stages
(final shared-runtime stage **947/947**), Commerce typecheck and
`git diff --check` pass. Scoped ESLint reports 0 errors and 9 existing
design-token warnings in the account-chrome component. The local mounted
assertion gap for the five account surfaces is now closed across settings,
addresses, account chrome, account sheet, and review form; the owned
Chromium/Gateway/Postgres account-surface journey remains a separate unverified
requirement because the recorded runner stopped at Docker preflight. No
session/hosted policy changed; Phase 2 and the eleven-phase goal remain open.

## 10 October correction — stale-wishlist owned browser journey passes

The preceding 8 October account-surface note and the earlier stale-write
paragraph's “until it passes” status are historical and superseded for the
stale-wishlist cross-tab mutation only. The owned
`storefront-customer-profile.postgres` suite passed **12/12** on 10 October
(`runId 6a7eca1f734a`) with Chromium, local Commerce and Identity runtimes, the
real Gateway worker, and owned Postgres 16/PostgREST. After a sibling tab
switches the shared cookie from buyer A to buyer B, Chromium submits the
wishlist ID rendered for A, receives and displays the BFF's 409, and the
database confirms A's control row remains, B's row remains absent, and the
stale DELETE never reaches Gateway. Runner cleanup reports no failures or
remaining containers, networks, or volumes. See the [sanitized run
report](P2_BUYER_WISHLIST_STALE_CROSS_TAB_OWNED_RUN_FINAL3_2026-10-10.json)
and [Phase 2 closure entry](PHASE2_CLOSURE.md#10-october-stale-wishlist-owned-browser-acceptance).

This closes that local stale-wishlist browser/Postgres journey; it does not
retroactively close the broader five-surface account-refresh scenario, hosted
behavior, buyer-session policy, F2.1 issuer/consumer retirement, or Phase 2 and
the eleven-phase programme. The seven-day versus thirty-minute owner decision
and hosted-use/drain gates remain open.
