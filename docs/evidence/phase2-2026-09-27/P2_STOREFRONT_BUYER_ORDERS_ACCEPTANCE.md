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
