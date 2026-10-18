# Canonical buyer reviews — local acceptance

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`  
Source base: `0862687a5008d604d0df23357b2eb511293139fa`; implementation and acceptance suite are in the current working tree.

## Outcome

Canonical storefront buyers can submit product reviews through the existing `/api/reviews` form endpoint. The Next route resolves the host-only, site-bound buyer cookie, forwards the signed buyer session to `/storefront/buyer/reviews`, and strips browser-supplied store and customer identity. The gateway requires the verified buyer session and an explicit verified `buyer_store_customers` relationship to an active store customer at that exact site. It derives name/email from that relationship, rejects duplicate or inactive-product reviews, requires Turnstile, stores the review as `pending` and `is_verified=true`, and returns only a review ID and pending status.

The transitional `/storefront/reviews` endpoint now also ignores request-body `is_verified`. A customer badge and authenticated name/email require a valid signed customer session, an exact store match, and a live active `store_customers` row. Anonymous submissions remain possible but are always unverified. The response no longer returns the stored review row or customer email.

## Evidence

| Check | Result |
| --- | --- |
| Buyer gateway route tests (`node --import tsx --test services/api-gateway/src/__tests__/buyer-review-routes.test.ts`) | 4/4 passed: signed site/customer derivation, forged identity ignored, unlinked/inactive denial, Turnstile/product gate, wrong-site and malformed input |
| Storefront buyer proxy tests (`tsx --tsconfig tsconfig.json --conditions react-server --test src/app/api/buyer/buyer-proxy-routes.test.ts`) | 58/58 passed, including safe payload projection, host-bound site, cookie-to-session-header forwarding and hidden upstream details |
| Real-worker owned Postgres/PostgREST review suite (`node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/storefront-buyer-reviews.postgres.test.ts`) | 4/4 passed on the final run: verified buyer persistence, unlinked/legacy-unverified/inactive refusal, wrong-site/invalid/duplicate/archived-product refusal, anonymous badge-spoof refusal, and legacy signed-customer derivation. The suite ran against a per-suite disposable database cloned from the fully migrated fixture. |
| Gateway TypeScript | Passed |
| Commerce web TypeScript | Passed |
| Gateway database-lane governance | 12/12 passed; catalog now explicitly contains seventeen owned gateway suites |
| `git diff --check` | Passed |

One initial owned-DB assertion expected Postgres boolean text as `t|f`; the database correctly returned `true|false`. The assertion was corrected and the full suite rerun successfully. No implementation behavior was changed to satisfy a mistaken expectation.

## Limits and next work

This is local worker/proxy/database evidence, not a browser identity-provider session, custom-domain browser run, hosted database, production Turnstile check, or release. No legacy issuer was retired. Storefront review submission now uses the canonical account when signed in and already linked, but the canonical account still needs a normal connected-store experience for unlinked customers. Loyalty and checkout/order association remain open in the wider Phase 2 migration; evidence does not imply Phase 2 closure or completion of the eleven-phase programme.

## 8 October continuation — bind a review draft to the verified buyer ID

The mounted review form previously cleared its private draft only when the verified buyer email changed. The session verifier already returned the canonical buyer ID to the server-side Commerce BFF, so the BFF now includes that ID in its no-store browser response and the shared buyer-session context retains it. The review form compares the verified buyer ID across session generations and hides/clears the previous form when the principal changes, even if two accounts share the same email. A verifier failure also clears the prior identity and draft. The ID comes only from the Gateway-verified session response; it is display-state metadata and is never accepted as request authority.

The mounted jsdom regression keeps buyer A's draft while revalidation is pending, returns buyer B with the *same* email and a different ID, and verifies A's form is discarded before B can open a fresh one. A later session-verifier failure keeps the old draft hidden. The focused review/context tests pass **3/3**, the Commerce web `pnpm test` command exits 0 (including its final 947/947 root contract group), TypeScript passes, scoped ESLint has 0 errors and 36 existing token/color warnings in the review component, and `git diff --check` passes. This is a local rendered-state regression, not browser/Identity/Gateway/Postgres or hosted acceptance. The existing Docker preflight block on the two-tab mounted account journey remains; Phase 2 and the eleven-phase goal remain open.

### 8 October route-contract follow-up

Added direct tests for the actual `/api/buyer-auth/session` route with only the Gateway `fetch` seam replaced. The route tests verify host-to-store resolution, server-side storefront-token forwarding to the verify-only Gateway endpoint, no cookie forwarding, a no-store response containing the verified buyer ID/email, malformed principal data failing as a retryable 503 rather than being presented as signed out, and an absent-cookie fast path (**3/3**). The full Commerce web command passes **101/101**, **126/126**, and **947/947** across its three stages; Commerce typecheck and `git diff --check` pass. ESLint reports 0 errors and the same 36 existing review-style warnings. The ID remains display/session-switch metadata and never becomes a client-selected authority field. No Docker, provider, hosted, migration, issuer, or session-lifetime behavior changed.

## 10 October continuation — refuse a stale review draft after buyer switch

The mounted review form now submits the canonical buyer ID it rendered in the
`x-letbuyy-expected-buyer-id` comparison header. When a canonical buyer cookie
is present, the Commerce BFF re-reads the profile through the captured signed,
site-bound session before forwarding the review. If another tab replaced the
shared cookie after this page loaded, the IDs differ and the BFF returns 409;
the review mutation is never sent. Missing rendered identity returns 400 and an
unavailable profile check fails closed as 503. The comparison value is not
forwarded to Gateway and never grants authority.

The mounted React regression confirms the same-email buyer switch clears
buyer A's private draft and that a fresh buyer B form sends B's canonical ID.
The real Commerce route tests prove a matching session can proceed, a mismatch
stops before the review writer, missing identity stops before the profile call,
and an unavailable profile check is sanitized and stops before review
mutation. The buyer proxy suite passes **67/67**, the mounted review identity
test passes **1/1**, Commerce typecheck and `git diff --check` pass. The
separate real Gateway/Postgres review suite passes **4/4** in owned
Postgres/PostgREST (`e72cf325c9b4`); cleanup reports no remaining containers,
networks, or volumes. The initial sandbox runner attempt executed zero tests
because it could not access Docker; the successful reviewed run and zero-test
attempt are recorded in
[`P2_BUYER_REVIEW_IDENTITY_OWNED_RUN_PASS_2026-10-10.json`](P2_BUYER_REVIEW_IDENTITY_OWNED_RUN_PASS_2026-10-10.json)
and [`P2_BUYER_REVIEW_IDENTITY_OWNED_RUN_2026-10-10.json`](P2_BUYER_REVIEW_IDENTITY_OWNED_RUN_2026-10-10.json).

This closes the local stale-review submission boundary at the Commerce BFF
and protects the mounted draft on verified buyer changes. The owned database
suite exercises the Gateway writer separately; no Chromium test for this new
BFF comparison, production Turnstile, hosted identity flow, issuer retirement,
hosted telemetry/drain, or Phase 2/eleven-phase closure is claimed. The pending
seven-day versus thirty-minute session choice is unchanged.

### 10 October owned browser/Postgres follow-up — stale review is refused before revalidation

The preceding limitation (“no Chromium test for this new BFF comparison”) is superseded by this follow-up. The owned `storefront-customer-profile.postgres` executable suite opens a real local Chromium storefront page as buyer A, fills a private review draft, completes the sibling-tab Identity account switch to buyer B, verifies B's canonical session, then submits from A's still-mounted page before it revalidates. The actual Commerce review BFF returns 409 with the review-specific reload message; the browser renders the alert. The request's comparison header contains A's loaded buyer ID, and the BFF refuses the write under B's cookie before calling the Gateway writer. The owned Postgres assertion finds zero product-review rows for the synthetic product under either buyer's email.

The owned run passes **12/12** with zero failures, skips, cancellations or TODOs. Postgres 16, PostgREST, the real Gateway worker, local Commerce and Identity runtimes, and Chromium were exercised; runner cleanup reports no remaining containers, networks or volumes. Report: [`P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json`](P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json). The initial 11/12 attempt had already observed the intended 409 but failed a harness-only headless tab-focus assertion after the product behavior; that unsupported assertion was removed and the full suite rerun successfully. Its historical failure remains recorded in the separate run log.

Focused checks also pass: buyer proxy routes **67/67**, mounted review identity regression **1/1**, Commerce typecheck, smoke-script syntax, and `git diff --check`. The separate canonical Gateway review-writer Postgres suite passes **4/4** (`e72cf325c9b4`); it remains distinct evidence from the 12-test Chromium/BFF suite. These results establish local acceptance for this stale-review cross-tab denial journey only. They do not establish hosted behavior, production Turnstile, the pending seven-day versus thirty-minute session decision, issuer retirement, hosted telemetry/drain, or Phase 2/eleven-phase closure.

The successful owned browser/Postgres command was:

```sh
node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/storefront-customer-profile.postgres.test.ts --kind gateway-db --jobs 1 --log-dir /private/tmp/letbuyy-review-stale-cross-tab-owned-pass-20261010 --json-out docs/evidence/phase2-2026-09-27/P2_BUYER_REVIEW_STALE_CROSS_TAB_OWNED_RUN_PASS_2026-10-10.json
```

The focused commands were:

```sh
pnpm --filter @letbuyy/customer-web exec -- node --conditions react-server --import tsx --test src/app/api/buyer/buyer-proxy-routes.test.ts
pnpm --filter @letbuyy/customer-web exec -- node --import tsx --test src/components/product/product-reviews-identity.test.tsx
pnpm --filter @letbuyy/customer-web typecheck
node --check apps/commerce/web/scripts/customer-session-runtime-smoke.mjs
git diff --check
```
