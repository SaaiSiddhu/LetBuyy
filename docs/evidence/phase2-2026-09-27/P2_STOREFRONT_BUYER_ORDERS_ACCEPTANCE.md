# P2 canonical storefront order-list boundary — local acceptance

3 October 2026. Exact source `dfa1e83fe951ab257f99930d41c818edb9240f6a`, branch `letbuyy/phase2-shared-buyer-identity`. Wider Phase 2 and eleven-phase goal remain ACTIVE.

## Behavior

The new `/v1/storefront/buyer/storefront-orders` read reuses the canonical buyer/order link query and the existing storefront token verifier. It requires the signed site to match the requested site, checks the live account/epoch, filters links by verified buyer AND signed site, and scopes order hydration to those links. An unlinked order with the same email is not returned. The platform `/buyer/orders` keeps its platform audience and cross-store behavior; order claims/revocation retain existing authority. The thin `/api/buyer/orders` proxy independently resolves this host, forwards only the distinct session header and authoritative site, accepts only pagination query fields, uses no-store and sanitizes failures. It owns no commerce data.

A real platform cursor defect was also reproduced: the second page was empty when three orders shared a link timestamp. Both order channels now paginate by the complete `(linked_at, order_id)` ordering tuple. UUID/time cursor validation prevents raw filter syntax injection and returns 400 for invalid cursors. Order metadata is mapped only when its site agrees with the link. App route ratchet and lint baseline deliberately increase 204 → 205, with the proxy's ownership documented; database lane 14 → 15.

## Evidence

| Verification | Result |
| --- | --- |
| Valid real-worker red control `0d2a5a9290c2` | All five scenarios failed before implementation; observed valid storefront 401 and platform timestamp-tie page 2 omission |
| Final owned database run `b0b9f8879eb6` | 8/8 in two suites: five storefront order scenarios and three existing merchant predicate/helper regressions; zero fail/cancel/skip/TODO |
| Buyer isolation/site ownership | Same buyer across two stores, two buyers at one store, matching-email unlinked order and query-supplied buyer substitution |
| Token/lifecycle/refusal | Wrong/missing site or audience, expired/revoked/disabled sessions, malformed/injecting cursors, sanitized link-read failure |
| Pagination | Three tied links fetched once each, in order, on both platform and storefront channels |
| Next proxy tests | 36/36, including order query forgery, pagination projection, error/status/no-store and malformed response checks |
| Full commerce script | 1050/1050 (60 + 45 + 945), no failures/skips/TODO |
| Gateway unit/contract | 1324 passes plus one existing TODO, zero failures/skips; 322/322 actual contracts |
| Typecheck/inventory tests | Gateway and commerce passed; owned lane + route inventory 17/17 |
| Exact governance | 114/114 required validators pass, zero fail/blocked/skip; one report-only not-applicable, disposable clone |
| Cleanup | No failures or remaining owned containers/networks/volumes |

The initial red run `e526314b37d7` had a fixture defect: repeated synthetic-order calls reused an idempotency key and returned the same order, producing duplicate ownership rows. It is excluded as order/pagination proof. The helper now uses its generated product ID for a distinct SKU and order idempotency/request key; email remains deliberately shared to test that email alone grants no order link. The negative control was rerun successfully against distinct orders before source changes. Shared merchant-helper regression passes.

This is a signed-token real-worker/service-role database proof plus real Next-handler/fake-upstream proof. It does not prove RLS, live identity redirect, browser account navigation, order detail, provider readiness, independent review, deployment or whole customer issuer retirement.

Primary design reference checked 3 October: [PostgREST logical operators](https://postgrest.org/en/stable/references/api/tables_views.html#logical-operators) documents combined AND/OR filters used for the complete cursor tuple. Verified buyer and site predicates remain outside that pagination disjunction.

## Next active work

Continue connecting the remaining account surfaces: shared profile, addresses, account hub and store-customer-specific preferences. Merchant-specific wishlist/review/loyalty/consent must use a verified store-customer relationship, separate from order ownership. Do not fabricate a store-customer principal from the buyer UUID or invent consent/stats. Keep local/hosted/release distinctions and D04/D05 decisions.

## Follow-on — React and Liquid order journeys (3 October 2026)

The order-list boundary above has since been extended through detail and both normal storefront renderers. The canonical order remains `buyer_order_links` + the signed storefront site; neither UI looks up order history by an email address.

| Area | Implemented behavior | Verification |
| --- | --- | --- |
| Gateway detail | Signed storefront buyer session, exact linked buyer/site/order tuple, site-scoped order read, existing safe line-item hydrator and explicit item field projection | Owned Postgres gateway lane: 104/104 across 15 suites, including 7/7 storefront buyer-order scenarios; gateway unit: 1324 pass + 1 existing TODO |
| Browser proxy | Existing `/api/buyer/orders` proxy accepts an `order_id` selector without creating a new app-local API route; forwards only host-derived site and buyer session; projects buyer-safe order/item fields; no-store and sanitized errors | Buyer proxy 39/39; full commerce web package test command passed; web typecheck passed |
| React account | Canonical buyer order pagination, explicit LetBuyy sign-in state, retry/failure state, order detail, and account-sheet link to linked orders | Full commerce web package test command passed (its 945 repository contract tests also passed); gateway proxy tests exercise the positive, negative and malformed-response cases |
| Liquid account | Separate allowlisted `buyer` drop only on order templates; host/session revalidation per render; cursor-based order history; canonical linked detail; guest and unavailable states are distinct. Store-customer `customer` remains null on order routes. Example bundles regenerated from source. | Theme-engine suite 1869/1869; focused Liquid/order allowlist tests 249/249; theme-engine typecheck passed |

This is local source and package verification, not a live browser/PKCE journey, device run, hosted change or release. The React and Liquid contracts share gateway ownership checks, but a running storefront/browser session and current identity-platform redirect are not claimed as verified here. Phase 2 and the eleven-phase goal remain active.

## Follow-on — React account identity, profile and address integration (4 October 2026)

The React account chrome now recognizes the host-bound LetBuyy buyer session as an account principal, so buyer-only shoppers can reach the previously implemented linked order list/detail. Wishlist remains visible only when the separate store-customer session is authenticated. The existing address book selects the buyer profile/address APIs for a verified buyer session and uses buyer-scoped create, edit, default and delete operations; the store-customer flow remains on its existing endpoints. Account settings now edits the canonical buyer name/phone and shows the email verification state, while store-customer marketing preferences/password remain scoped to their existing customer session.

| Verification | Result |
| --- | --- |
| Commerce web TypeScript | Passed after resolving dependencies from an existing local checkout; no source or lockfile changes from dependency setup |
| Targeted ESLint | Passed; the unsuppressed run reported 87 theme-token/color warnings and zero errors |
| Buyer API proxy regression | 39/39 passed, covering buyer profile/address forwarding, host/session boundaries, write-origin checks, ownership, sanitized errors and no-store behavior |
| Diff whitespace check | Passed |

At this first 4 October check, only the React account integration was in scope; Liquid profile/address/account-hub integration was completed later the same date below. No live browser sign-in, identity-provider redirect, or hosted flow was established. The package-wide web test script could not start because `tsx` is not linked into this checkout; the focused proxy suite was invoked directly from the local cached runtime. The eleven-phase goal and Phase 2 remain active.

## Follow-on — Liquid account identity, profile and addresses (4 October 2026)

The Liquid account hub, profile/settings and address templates can now render a separate verified buyer drop built from the host-bound buyer session plus the existing `/storefront/buyer/profile` and `/storefront/buyer/addresses` reads. Liquid settings uses the canonical profile API and omits store-only password/marketing controls for buyers. The address island selects buyer-scoped create/edit/default/delete endpoints and reports failed loads or writes instead of presenting an outage as an empty address book. Buyer account sign-out clears only this store's buyer session. Store-customer rendering and its legacy APIs remain available when no buyer session exists. The Liquid hub no longer redirects a buyer away before its account template can render.

| Verification | Result |
| --- | --- |
| Commerce web TypeScript | Passed |
| Theme-engine full suite | 1,869/1,869 passed, zero failures/skips/TODO |
| Focused Liquid account, registry and generated examples | 258/258 passed |
| Liquid renderer/hydration contracts | 34/34 passed |
| Generated bundles | Urban Kicks and LetBuyy Core examples regenerated and compared by tests |
| Diff whitespace | Passed |

These are local source and contract checks. No live browser/PKCE, real session, deployed gateway or hosted storefront journey is claimed. Theme example regeneration is package output, not an app/store publication. Phase 2 and the eleven-phase goal remain active.

## Follow-on — explicit store-customer relationship action (4 October 2026)

React and Liquid buyer settings now offer a separate, explicit “Connect this store account” action. It requires a same-origin POST and fresh LetBuyy PKCE sign-in; the callback uses the new signed storefront session to call the existing verified relationship transaction for only the signed store. The outcome is shown without disclosing another account's identity. A failed link does not discard the valid storefront session. Historical orders remain a separate verified action: the React and Liquid order lists offer “Find past orders”, routed through the existing `/api/buyer/orders` handler to the claim transaction for only the signed store. JSON errors are sanitized, and native Liquid form submissions return to the same safe account path with a status code.

Gateway relationship/claim tests passed 21/21, storefront buyer proxy tests passed 45/45, PKCE/link flow tests passed 5/5 (including a mocked callback journey), Liquid/theme SSR/runtime contracts passed 48/48, and canonical Liquid orders passed 5/5. Targeted ESLint and the commerce-web TypeScript check passed. The gateway-wide TypeScript check remains non-clean on unrelated dependency/type diagnostics. No live browser, identity-provider, real-database, deployed gateway or hosted journey is claimed. This does not close Phase 2 or the eleven-phase goal.

## Follow-on — linked buyer wishlist (4 October 2026)

The React account wishlist is now available to canonical buyers only through the existing verified store-customer relationship and remains site-scoped. See [buyer store wishlist acceptance](P2_BUYER_STORE_WISHLIST_ACCEPTANCE.md) for local PostgreSQL, gateway, proxy and UI evidence. Live browser authentication, and the remaining loyalty/reviews/checkout journeys, are still open.

## Follow-on — React order views revalidate after buyer switches (8 October 2026)

The linked-order list and detail client previously fetched only on mount. The
account chrome hid its child tree during cross-tab session revalidation, but
kept it mounted; after another buyer's session was verified, the old list/detail
could therefore become visible again without a request under the new buyer.
Both clients now bind rendered results to `buyerSessionRevision`, reload after
each verified generation, and hide results until the matching read completes.
The list aborts and ignores stale reads, clears the prior page before reload,
and ignores an in-flight historical-order claim result after the session
generation changes. The detail stores results with the order ID and session
generation, aborts obsolete reads, and renders the new buyer's 404/unavailable
state instead of retaining the prior order.

Mounted React tests run the real account chrome and buyer-session/wishlist
providers with synthetic API responses. They verify buyer A's order list/detail,
the hidden loading boundary during a held cross-tab revalidation, buyer B's
empty list or denied detail, and session-check 503 without exposing A's order.
The focused test passes **2/2**. `pnpm --dir apps/commerce/web test` passes all
three stages (**101/101**, **123/123**, **947/947**; zero failures, skips,
cancellations or TODOs). Commerce typecheck, focused ESLint (0 errors/warnings)
and `git diff --check` pass. This is local jsdom and synthetic BFF coverage,
not Chromium, Gateway/Postgres or hosted acceptance. Session-lifetime policy,
hosted telemetry/drain, D03/D04/D05 and the remaining Phase 2/3–11 requirements
remain open; no identity, issuer or lifetime policy changed.

## 10 October continuation — owned cross-tab order visibility journey passes locally

The owned Gateway/Postgres browser suite seeds one synthetic linked order for buyer A and first reads the buyer-A list and detail through the real Commerce BFF. After a sibling tab completes a real local Identity sign-in as buyer B, Chromium rehydrates those captured buyer-A responses to model already-rendered client state, holds session revalidation, and verifies the order is hidden while the replacement session is unresolved. Releasing the hold sends the list/detail reads through the real Commerce BFF, Gateway and Postgres: buyer B receives an empty list and a 404/unavailable detail. SQL assertions preserve buyer A's ownership link and confirm buyer B has none. This covers the stale-read privacy race locally; it changes no production behavior or session policy.

The first runner attempt stopped at Docker preflight before tests; later retries exposed and corrected test-harness assumptions about closed background tabs and headless focus refresh. The final focused executable suite passes **12/12**, with zero failures, skips, cancellations or TODOs. The owned report records empty cleanup: no runner-owned containers, networks or volumes remain. Smoke-script syntax, Commerce typecheck, and `git diff --check` pass. The successful report is [`P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-10.json`](P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-10.json); the initial zero-test report and intermediate retry reports remain preserved for audit.

```text
node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/storefront-customer-profile.postgres.test.ts --kind gateway-db --jobs 1 --log-dir /private/tmp/letbuyy-order-cross-tab-owned-20261010-retry10 --json-out docs/evidence/phase2-2026-09-27/P2_BUYER_ORDER_STALE_CROSS_TAB_OWNED_RUN_RETRY10_2026-10-10.json
```

The standalone mounted React test remains 2/2 jsdom/synthetic-BFF evidence; the run above adds local Chromium, Gateway and Postgres evidence. Neither local result establishes hosted behavior. The seven-day versus thirty-minute session-lifetime decision, issuer transition, telemetry/drain, unlinked-customer recovery and remaining Phase 2/3–11 requirements remain open.
