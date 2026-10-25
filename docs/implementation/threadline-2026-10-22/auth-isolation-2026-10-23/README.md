# Threadline isolated merchant / buyer auth proof — 23 October 2026

The fresh run `ff9941a78139` passes normal merchant and buyer sign-in, buyer consent and callback, simultaneous-session reload checks, and 17 live HTTP auth cases. The existing owner preview, merchant credentials, browser tabs and session were not used or changed by these tests.

This is functional integration evidence from a pinned working-tree snapshot through migration **385**. It is not an immutable release acceptance for the other nine themes, a hosted deployment, or a checkout/payment certification.

## Actual browser proof

Fresh IAB tabs **46** (merchant) and **47** (buyer), in the same browser profile:

1. Merchant app redirected to this run's accounts lookup page. Existing synthetic credentials went through normal email lookup and password sign-in, reaching the new admin dashboard.
2. A full merchant reload retained the authenticated Threadline dashboard.
3. The published buyer storefront initially required its own buyer sign-in despite the merchant session.
4. “Continue with LetBuyy” started an authorization-code flow with S256 PKCE, state and the exact storefront callback.
5. Existing synthetic buyer credentials reached explicit store consent. Continuing completed the callback and displayed “Your account”.
6. Buyer reload retained the buyer account. Merchant reload still retained the merchant dashboard.
7. Store-only buyer sign-out cleared the buyer store session after reload; merchant reload remained authenticated.
8. A second normal consent/callback restored the buyer store session without asking for the identity password again. Final reloads retained both independent sessions.

All 13 tabs present at the initial inventory remained present at the final inventory. No pre-existing tab was navigated, reloaded, signed out or used to supply credentials. No browser cookies or storage were injected, cleared or copied.

**UI limitation:** immediately after the buyer sign-out form action, the visible account page still showed the previous signed-in content. A full reload showed signed out. The evidence proves session removal after reload; immediate account-page refresh remains a separate UI defect reported to the coordinator.

[Browser assertions](browser-auth-proof.json) · [merchant screenshot](merchant-final.jpg) · [buyer screenshot](buyer-final.jpg) · [signed-out screenshot](buyer-signed-out.jpg)

## Live HTTP checks

A separate HTTP client used the new fixture's real normal login routes and server-issued cookies. It did not access the browser cookie jar or any owner origin. **17 passed, 0 failed**:

- Merchant lookup and password sign-in, exact admin destination and authenticated session positive control.
- Missing-CSRF merchant login rejected with 403.
- Merchant platform cookie limited to this run's parent; HttpOnly, Secure, SameSite=Lax.
- Merchant credentials do not create a buyer session or authorize a buyer grant.
- Buyer login creates a separate host-only cookie; buyer-only credentials do not authenticate the merchant.
- Real consent code / PKCE callback creates a host-only storefront session accepted for this store and issuer.
- Wrong state, substituted callback host, absent originating flow and consumed-code replay rejected with 400.
- Wrong PKCE verifier rejected and burns the code; later correct-verifier redemption also rejected.
- Unregistered external callback origin rejected.
- Merchant and buyer positive controls remain authenticated after the negative callback checks.

[All cases and cookie attributes](http-auth-proof.json) · [exact HTTP acceptance script](http-auth-proof.mjs)

## Fixture boundaries and evidence

| Surface | Exact local origin |
| --- | --- |
| Identity | `http://accounts.threadline-ff9941a78139.localhost:51235` |
| Merchant | `http://admin.threadline-ff9941a78139.localhost:51236` |
| Buyer | `http://syn-threadline-ui-41eb3f07.localhost:51237` |

The platform parent is `threadline-ff9941a78139.localhost`; the buyer host lies outside it. Node DNS verified every origin resolves exclusively to loopback. The gateway bridge remains on `127.0.0.1`. No production host policy, CSRF check, authentication or certificate validation was weakened.

The private state file is run-scoped and mode 0600. State, mail captures and client logs use exclusive creation. The current source/asset snapshot includes tracked, dirty and untracked files, with only the three candidate Next configurations changed to bound build workers to two. Builds ran serially. Draft migrations 386/387 were not applied.

Core project-reference build, core noEmit, and five origin/config unit tests passed on the candidate. The initial capture contained the wider programme's Zod compile issue; only its approved corrected source was refreshed before app builds. An accidentally workspace-scoped package declaration build also completed successfully; no production source or authentication setting was changed by that command.

The initial runner was interrupted before app startup. The resumed runner used **--no-reap**, one job and fresh run `ff9941a78139`. Its lifecycle install/editor/publish/Liquid/rollback assertions reached their proof before the manual browser hold. Two owned running containers, one network and one volume were verified by this run's exact labels. The fixture is intentionally held for subsequent Editor/Marketplace work; a final runner exit or cleanup result is **not** claimed. The manual hold is bounded to six hours from readiness.

[Source/config snapshot](source-snapshot.json) · [owned runtime check](owned-runtime-proof.json) · [build log](candidate-core-build.log) · [typecheck log](candidate-core-typecheck.log) · [five-test log](candidate-origins-unit.log)

IAB3 and the heavy-build window were explicitly released to the coordinator after final screenshots. The new proof tabs are marked for handoff. Existing owner runtime `e3596680a4c1` was not restarted, finished, reaped or reconfigured. Existing owner credentials remain unchanged and are not reproduced here.
