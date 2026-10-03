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

Connect normal account surfaces to these canonical reads. Existing `account-liquid.ts`, `customer-drop.ts`, Liquid hydration islands, React fallback account context/settings/addresses/orders and account bottom sheet still contain legacy assumptions. Order detail must use the verified link + signed site and the existing order-item hydrator; never use legacy email history. Merchant-specific wishlist/review/loyalty/consent must use a verified store-customer relationship, separate from order ownership. Do not fabricate a store-customer principal from the buyer UUID or invent consent/stats. Keep Liquid canonical, preserve local/hosted/release distinctions and D04/D05 decisions.
