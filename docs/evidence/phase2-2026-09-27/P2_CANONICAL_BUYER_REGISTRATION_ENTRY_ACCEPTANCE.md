# Canonical buyer registration entry — local acceptance

Date: 4 October 2026 (Asia/Kolkata)  
Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`  
Source base: `0862687a5008d604d0df23357b2eb511293139fa`; source changes are in the current working tree.

## Outcome

The default LetBuyy Core and Urban Kicks Liquid registration pages now offer “Create or sign in with LetBuyy,” routing people to the existing first-party storefront PKCE flow. Login already offered “Continue with LetBuyy”; its source and generated fixture remain consistent. This gives account creation a visible route to the canonical buyer identity without adding another identity system.

The existing per-store password form remains available as a transitional migration path. This change does not claim that its issuers are retired, that every store customer has a verified buyer account, or that a login automatically links store data. Linking a store-customer relationship and claiming past orders stay as separate, explicit actions.

## Implementation and verification

The canonical theme fixture now includes the registration link, the two committed theme examples were regenerated from that fixture, and the Liquid auth contract test checks login and registration source plus rendered HTML. The generator also synchronized the already-modified shared order-claim source into both example bundles and refreshed their manifests/hashes.

| Check | Result |
| --- | --- |
| Focused Liquid auth suite | 9/9 passed, including rendered registration/login, preserved legacy form, and sanitized auth output |
| Full theme-engine suite | 1,873/1,873 passed; 57 test files; no failures, skips or TODOs |
| Theme-engine TypeScript | Passed after building its declared local `@letbuyy/shared-types` project-reference dependency |
| Example artifact generation | Wrote 76 files for each theme; drift suite passed in the full test run |
| `git diff --check` | Passed |

The initial full-suite attempt found an error in the new assertion because it passed the renderer result object instead of `liquid.layoutHtml`. The assertion was corrected; the focused and full reruns pass. The first standalone typecheck lacked the built shared-types project-reference output; building that declared workspace dependency resolved it without source or lockfile changes.

## Limits and next transition work

No browser sign-in, identity email delivery, PKCE callback against a running identity service, or hosted store was exercised. The repository's existing callback tests and earlier link-flow evidence are separate evidence and were not rerun by this slice. The CTA makes the canonical path reachable; it does not prove adoption or authorize a verifier/signer cutover.

The refreshed source census is recorded in `P2_CUSTOMER_SESSION_RETIREMENT.md`: the gateway has three per-store HS256 issuance points, and commerce login, register and password-reset completion re-sign that legacy format locally. Gateway verification accepts both the 30-minute gateway payload and seven-day commerce payload under the same shared secret. All dependent account/review/customer endpoints and their canonical replacements still need route-by-route migration evidence before issuance or verification is retired. RFC 8725 supports fixed algorithm, issuer, audience and token-purpose validation; RFC 9700 supports authorization-code PKCE for public clients. These standards do not determine LetBuyy's rollout duration or user-support policy: [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).

Phase 2 and the active eleven-phase goal remain open. No hosted cutover, external email, legacy data deletion or production release occurred.

## 5 October correction — legacy registration handoff verified in Chromium

The stale HTML form bridge now carries a narrow `screen=register` presentation hint through
`/api/customer/register` and `/api/buyer-auth/start` to Identity's `/buyer/authorize` page. The
start route forwards only the exact `register` value; unknown screen values are dropped. The hint
is not stored in the PKCE cookie and grants no additional authority. JSON registration remains
410, with no account fields forwarded.

The owned Commerce/Identity/Gateway/Postgres Chromium suite submitted the old HTML registration
form using synthetic fields, followed the real compatibility redirect and asserted the actual
Identity page showed “Create your LetBuyy account.” The same browser run then completed its normal
buyer sign-in/consent/PKCE checks. Runner result `d52439cdf4de` passed **11/11** with zero failures,
skips, cancellations or TODOs; its disposable database, PostgREST and container resources were
cleaned. See the [sanitized run record](P2_CANONICAL_BUYER_REGISTRATION_BROWSER_RUN_2026-10-05.json).
Focused registration/start/PKCE tests pass **11/11**, the auto-create route-helper regression tests
pass **2/2**, Commerce typecheck passes after moving that test helper out of the App Router route
module, and `git diff --check` passes.

This verifies the local registration entry and screen selection only. It does not create a buyer,
send verification email, complete account creation, change the pending session-duration choice,
retire legacy login/reset issuers, or establish hosted adoption. Phase 2 and the eleven-phase goal
remain active.
