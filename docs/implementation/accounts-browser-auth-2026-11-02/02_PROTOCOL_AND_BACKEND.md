# First party native handoff and backend contracts

Status: Proposed engineering contract. Endpoint and record names below are design candidates, not implemented APIs. Read with [the overview](README.md) and [delivery gates](03_DELIVERY_AND_VERIFICATION.md).

## 1. Existing implementation and reuse boundary

Accounts already has login/signup/verify-OTP/set-password/reset/session/logout routes, an asymmetric Merchant issuance helper, session registration through a restricted Gateway adapter, and browser account/device handling. Flutter already consumes the Accounts session through Mobile BFF and Gateway. Complete these paths rather than adopting another auth SDK as an issuer.

There are also buyer-specific first-party authorization-code endpoints and an operator exchange transaction. Their bounded-code and atomic-consumption patterns are useful references. Their realm, principals, callbacks, sessions and permissions are not Merchant contracts. Do not issue a buyer credential to Merchant, change a buyer table to accept merchant IDs, or copy a privileged operator exchange verbatim.

General `/oauth2/*` routes delegate to a disabled/skeleton provider helper. The new first-party Merchant flow must not depend on enabling that provider flag. Constitution Amendment 3 permits the native first-party code flow without general discovery or external clients.

Source ownership:

| Source | Role in this programme |
|---|---|
| `apps/platform/identity/src/app/api/auth/*` | Existing public account actions; add one shared continuation result |
| `apps/platform/identity/src/lib/auth/session.ts` | Existing create/validate/destroy facade; extend the canonical service boundary |
| `apps/platform/identity/src/lib/auth/identity-issued-session.ts` | Existing sole asymmetric issuance helper; no signing in Flutter, BFF or Gateway |
| `services/api-gateway/src/routes/auth.ts` | Existing protected account/session persistence adapters; narrow and converge, do not build a second auth decision engine here |
| `services/api-gateway/src/routes/stores.ts` and `onboarding.ts` | Durable site creation, membership and onboarding authority |
| `services/mobile-bff/src/index.ts` | Current native session transport and internal request signing |
| `packages/auth-core` and canonical shared contracts | Published request/result/error schemas and session semantics |
| `apps/merchant/mobile/lib/services/store_auth_service.dart` | Replace credential entry responsibilities with a browser-handoff session client |
| `apps/merchant/mobile/lib/app/auth_wrapper.dart` and `store_context.dart` | Preserve actor isolation and post-auth authorized bootstrap |

No package may import an app root. If an identity-package owner is not named for a new shared contract, resolve it through DOC 03 before adding exports. Use generated Dart contracts where the current generator supports the shape; otherwise record the bounded generator extension, not a permanent hand-copied protocol.

## 2. Protocol principles

1. Accounts alone authenticates the account and issues the native credential.
2. The initiating Flutter installation creates fresh unpredictable `state` and an S256 PKCE verifier/challenge for every request.
3. The server resolves a fixed first-party client and exact allowed callback. A URL from the phone does not define callback trust.
4. The browser completes normal credentials and required checkpoints. App return is a terminal continuation, not a bypass of those checkpoints.
5. The callback contains only a short-lived opaque code, request correlation and echoed state, or a bounded error. No reusable credential or personal profile data.
6. Flutter checks its pending request before redeeming the code over HTTPS with its verifier.
7. Redemption and registration have one durable consumption boundary. A code cannot create two sessions under concurrency.
8. The resulting native session is distinct from the browser cookie session but belongs to the same actor and revocation authority.
9. Membership, roles and intended task access are read from current server state, not trusted callback fields.
10. Failed verification remains an error, not an empty user, empty store list, signup request or successful native login.

The browser surface and proof mechanism follow the native-app and PKCE model in [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) and [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html). This is a bounded LetBuyy first-party protocol, not a claim that the deferred general OAuth/OIDC provider is implemented.

## 3. First-party client registry

Keep a small deployment-controlled allowlist for Merchant Android and iOS, separated by production, staging and local-development environments. A public client identifier is not a secret and is not proof that the caller is a genuine installed app. Do not embed a client secret or internal service key in Flutter.

Proposed registry fields:

| Field | Purpose |
|---|---|
| Client ID and environment | Exact known first-party app and release environment |
| Realm and permitted audience/session kind | Merchant only; retain live revocation and current permission checks |
| Exact callbacks and callback IDs | HTTPS/scheme path and OS compatibility profile; no wildcard hosts |
| Allowed purposes | Login, signup, create store, account switch, manage security, reauthenticate |
| Minimum supported version/callback mode | Compatibility policy driven by real supported builds |
| Enabled/retired state | Bounded rollout and retirement; fail closed if unrecognized |

Browser Merchant callbacks remain an independent allowed client/destination contract. Never broaden web `safePlatformReturnTo` to admit arbitrary app schemes or all subdomains for this migration. Native callback selection uses its own exact registry entries. Invalid native context must not fall through to permissive web-return logic.

## 4. Native request creation

Flutter generates a CSPRNG verifier of valid PKCE length, uses S256 only, and generates independent state with at least 256 bits of entropy. A new authentication attempt gets new values; neither an email nor a device identifier is a verifier.

Proposed native pending state in platform-protected storage:

- Request ID, client ID, environment, callback ID and expected issuer.
- PKCE verifier and state; local creation/expiry times.
- Allowed original native route identifier and optional intended site hint.
- Local operation generation used to reject stale callbacks.
- Stage: opening, browser active, callback received, exchanging or bootstrapping.

Never use SharedPreferences for these secrets. Scope and clear pending material on success, cancellation, expiration, explicit account change and logout. A browser-active process may be killed, so pending proof must survive the supported cold-start path. If OS secure storage is locked/unavailable, show a retry; do not fall back to plaintext.

The app submits challenge and bounded context to Accounts, receives a validated Accounts URL, checks its origin, then opens it in the authentication browser. Pending request creation grants no login, membership or account existence access. Rate-limit it and bound payload size even though it is a public-native initiation endpoint.

## 5. Proposed endpoint family

Names are provisional and should be finalized with the existing canonical API contract review before implementation.

| Surface | Authentication and effect |
|---|---|
| `POST /api/auth/mobile/requests` | Public native initiation; validate known client/callback/purpose, S256 challenge and bounded state/context; persist pending request |
| `GET /mobile/authorize?request=...` | Accounts browser entry; validate pending request, bind browser flow and render/resume the shared account journey; no session grant from GET arrival |
| Existing signup/login/OTP/password/MFA APIs | Existing protections; attach valid native continuation server-side and produce a shared next action |
| `POST /api/auth/mobile/complete` | Accounts same-origin browser operation; CSRF, valid session, current required proof, browser-flow/request binding and request actor checks; issue one-use callback code |
| `POST /api/auth/mobile/exchange` | Native HTTPS redemption; exact client/callback/request/code/state and PKCE verifier; atomically consume and register native session |
| `POST /api/auth/mobile/cancel` | Optional bounded cancellation using a separate request-management proof; never authorize by public request ID alone |
| Native session inspect/revoke | Reuse existing Accounts session operations with explicit native bearer transport, rather than hand-building cookies |

Add native bearer support at the existing session boundary without weakening cookie-origin or CSRF behavior for browser mutations. Bearer inspection must not allow callers to choose another user. Cookie inspection and native bearer inspection must return the same typed authenticated/unauthenticated/unavailable distinctions.

Do not add a public unprotected request-status endpoint exposing the chosen email, authentication status or stores. A minimal management/cancel proof may be returned at creation and stored securely; never put it in the browser URL. If status is implemented, it returns only bounded request lifecycle state under that proof, not account data or credentials.

## 6. Shared continuation engine

Use one Accounts-owned continuation model for web and native. Each handler completes its own account operation, then asks the resolver for the next allowed action. Do not copy native redirect logic into every page.

Conceptual continuation input:

```text
client kind: merchant_web | merchant_native
purpose: login | signup | create_store | switch_account | manage_security | reauthenticate
pending request reference, environment and expiry
current actor and authoritative proof/checkpoint state
bounded intended route, intended site and invitation reference
durable onboarding/create intent reference when relevant
```

Conceptual outcomes:

```text
authenticate | verify_email | set_password | require_mfa
require_reactivation | select_account | select_store | create_store
show_restriction | retry_unavailable | complete_web | complete_native
```

The resolver must preserve the initiating native request across password reset, method changes, OTP resend and account checkpoints without leaking it through unrestricted return URLs. A request may require the account to be selected or confirmed. Once bound to an actor, changing actors requires explicit reauthorization/rebinding; stale proof from the first actor cannot complete for the second.

For shared-browser SSO, require a deliberate continue/confirmation before initial native-device authorization where needed. Subsequent successful account completion automatically invokes the bound terminal return. A third-party page must not trigger account-data release merely by navigating a signed-in browser through a GET endpoint.

## 7. Code issuance and atomic redemption

### Proposed lifetimes

These are design defaults to test, not current production values:

| Item | Proposed limit |
|---|---|
| Pending browser request | 15-minute absolute lifetime; explicit restart after expiry |
| One-use callback code | 60 seconds from successful completion |
| Native session | Existing approved Merchant absolute/idle policy; do not silently change it here |
| Completed/expired metadata | Bounded retention under the existing security/audit policy; retain no plaintext codes |

Account recovery, onboarding drafts and committed sites may outlive a browser request. Expiry restarts the handoff while preserving those durable operations. No unlimited extension while a browser remains open.

Before code issuance, recheck the account, browser session, required proof, request purpose, client, expiry and target-task eligibility. Issue a cryptographically random opaque code, store only its hash, bind it to the challenge and exact request/callback/client/actor, and return it only to that callback.

At exchange, validate all input shapes with canonical Zod schemas. Check allowed issuer/environment/client/callback, request state, expiry, code hash and S256 verifier. Use a row lock/conditional one-use transaction so simultaneous redemptions cannot both succeed. Changing callback, environment, actor or purpose never creates a valid exchange.

Prepare signing capability before effectful redemption. Accounts prepares the identity-issued credential through its existing signer; the narrow persistence adapter verifies it. The database transaction consumes the handoff, consumes/registers the session identity as applicable and inserts the live session record atomically. A failure must not leave a consumed code without the intended registered session, or a session without its consumption witness.

The existing sequence of JTI consumption followed by a separate session insert is a review target. Do not simply wrap that non-atomic sequence in another route and claim atomic handoff. Extend the existing canonical registration contract rather than introducing an independent native session table or another issuer.

Do not persist raw PKCE verifiers, passwords or challenge codes on the server. Do not add general SQL transports to make the transaction convenient. Gateway's temporary account-persistence adapter remains internal and narrow; authentication decisions and signing stay Accounts-owned.

### Exchange response

Proposed success includes the opaque or signed credential under the resolved canonical Merchant session representation, authoritative expiry, actor ID, session identity, and a typed next-action/bootstrap reference. Mark the response `Cache-Control: no-store`. It is returned in the HTTPS response body to native, never appended to a redirect or written to local browser storage.

The implementation must reconcile the registry's opaque-session wording with current Identity-signed Merchant session code before fixing the concrete response shape. Preserve the sole issuer and existing BFF/Gateway verifier contract. A new mobile JWT format, new realm or custom refresh-token family is not a default solution.

Redemption is one-use. If the response is lost after commit, do not replay the same code to mint another credential. Initial release recovery should restart the first-party request, using the recent browser account session to avoid needless password re-entry; audit/revoke or expire the orphan native session under the same session service. A future retransmission mechanism would require an explicit bounded proof/storage design and is not assumed here.

## 8. Callback validation and cold start

Flutter accepts a callback only if it matches the pending environment, exact registered scheme/host/path, expected request ID and unpredictable state. Reject duplicate security parameters, fragments or URL credentials that the contract does not permit, extra callback destinations, and unknown query fields according to the finalized schema. Validate before changing navigation or requesting a session.

The app must possess the verifier. A callback opened from email, clipboard or another device is not enough. Ignore/reject stale generations and consumed requests. Serialize exchange and session replacement so a warm callback plus a cold-start intent cannot run two independent exchanges.

On cold start, initialize the callback coordinator and protected pending-state reader before ordinary auth routing can discard the callback. Buffer one validated event until dependencies are ready. A missing/expired pending request leads to Restart sign-in, never “signed in” from URL data.

The request ID, browser handle, code and state are private flow metadata. They must be redacted from access logs, crash reports, navigation telemetry, link previews, support screenshots and analytics. Callback/fallback pages use no third-party analytics, `no-store`, a restrictive CSP and `Referrer-Policy: no-referrer`; strip transient query data from displayed history when safe without losing the OS callback.

## 9. Platform callbacks and in-app browser lifecycle

### Android

Use Custom Tabs. Register exact HTTPS App Links with a path limited to the auth callback and the correct production package/signing certificate association. `android:autoVerify` is not acceptance evidence by itself; validate association and actual installed-release handling. Debug and staging signing identities must not broaden the production callback trust.

Host `/.well-known/assetlinks.json` with the exact accepted package and signing fingerprints. The inspected application ID is `com.letbuyy.store`; preserve it. Verify Play signing versus local upload signing during release; do not guess fingerprints or rename the published app.

Receive both warm `onNewIntent` and cold-start callbacks through one coordinator. Bring the native app forward and reconcile/dismiss the Custom Tab through the tested platform lifecycle. Do not depend on `window.close()`.

### iOS

Use `ASWebAuthenticationSession`, retain the session object/presentation anchor for its lifetime, and route success/cancellation into the same coordinator. The inspected project targets iOS 15.0 and uses bundle ID `com.letbuyy.store`; preserve those identities.

Prefer claimed HTTPS callbacks on supported OS/browser-bridge combinations. Configure the appropriate associated-domain services and association document for the actual authentication-session API and Universal Link handling used. Do not assume that an `applinks` entitlement alone satisfies every version's HTTPS authentication callback requirements.

For supported versions requiring a custom-scheme authentication callback, register one exact application-owned reverse-domain scheme/path with a distinct callback ID and PKCE/state validation. Choose that compatibility mode before starting the request; never silently change the redirect during exchange. The existing Google URL scheme in Info.plist is not a Merchant callback and must not be reused.

If the chosen bridge cannot meet the supported-version matrix with verified success/cancellation behavior, it fails the spike gate. Do not raise minimum iOS or remove support silently, and do not substitute a credential WebView.

### Host and association choice

Candidate HTTPS callback: a dedicated path on a separately associated first-party link host served by the **existing Accounts deployment**, for example `https://app-links.letbuyy.com/merchant/auth/callback`. This is a proposed hostname, not a configured domain or a new runtime. Check existing owned deep-link hosts first and reuse a suitable one before creating an alias.

A separate callback host can avoid same-origin browser-navigation ambiguity, but actual platform behavior still requires device tests. Hostnames, exact paths, custom scheme and association documents are finalized in Phase 1; no DNS/domain action is authorized by this document. Local development uses separately registered callbacks and never changes production allowlists.

## 10. Session custody and API bootstrap

Store the native credential only in platform-protected storage through the existing secure-storage abstraction. No HTTP-only cookie scraping, cookie-jar copying, URL token extraction, new native password authority or JavaScript bridge.

After exchange, validate the session through the canonical native session inspection boundary and fetch authorized Merchant bootstrap via BFF/Gateway. A valid actor ID and usable current authorization result are required before entering an actor-scoped workspace. A callback's intended site is a hint; re-resolve membership.

If session inspection succeeds but membership discovery is unavailable, retain the verified credential and show a retryable setup state. If verification is unavailable before actor establishment, keep the credential sealed as pending and show no private workspace. Never synthesize `id: ''` or convert an outage to “no stores.”

Keep BFF verify/forward only. It may retain existing internal request signing to Gateway; those signatures are transport assertions, not newly issued account credentials. It cannot create a session, trust an email from the app, or query the database directly.

Expired/revoked sessions return to Accounts through an in-app browser request. First release can reauthenticate through the recent browser session without adding a new refresh grant. If canonical rotation is used, its reuse detection, atomicity and native credential-update behavior must be qualified. Never silently extend expiry because Flutter reopened.

## 11. Logout and account switching

Default Log out revokes the native session at Accounts and clears native private state, pending flows, cached memberships and actor-scoped data. A failed server revoke is recorded as pending/unknown; local sign-out still removes local access. Do not present global server revocation as complete without readback.

Browser SSO may remain signed in after native logout. Explain that the next login can offer Continue as the same account, with Use another account. “Sign out of all sessions” is a distinct Accounts action with confirmation, current proof and authoritative revocation readback.

Switch account uses the hosted flow. Do not destroy a working native session merely because a browser opens. Freeze account-dependent writes during switch, and replace/clear old actor state atomically after the new actor is proven; cancellation restores the unchanged original context. If old authority is revoked while switching, enforce the revocation immediately.

Current remembered-account switching needs explicit target freshness/MFA/revocation qualification before it becomes part of mobile SSO. A signed remembered-account list is not a substitute for proving the currently required target-account policy.

## 12. Persistence and schema proposal

First inventory existing live identity-owned handoff/intent primitives and their owners. Migration 159's generic authorization/session shadow tables and `sessions_v2` are not automatically eligible: DOC 03 names the shadow session stack for elimination. Buyer authorization-code tables are buyer-owned. Reuse a current approved first-party primitive only if its ownership and realm isolation fit.

If none fits, propose one minimal Accounts-owned Merchant handoff request/consumption record, not a new identity subsystem. Conceptual fields:

| Group | Fields |
|---|---|
| Identity | ID, client ID, environment, Merchant realm, purpose and request version |
| Binding | Exact callback ID, S256 challenge, state binding, browser-flow binding |
| Proof | Authorized actor, originating canonical session reference, completed proof/freshness references |
| Lifecycle | Created/expires/completed/consumed/cancelled times and legal state |
| Code | Hashed code and code expiry, unique consumption witness |
| Outcome | Native session reference, created-site/create-intent reference if relevant |
| Operations | Audit columns, cleanup/retention metadata and safe reason codes |

Use database time for expiry and enforce legal transitions. The record is neither a consent ledger nor a generalized workflow engine. No raw secrets or redundant copied profile/store data. Restrict direct access, enable/force RLS where required, use audited narrow RPC grants and keep service-role exposure internal. Provide indexes, paired DOWN, rollback proof and current sequential migration numbering discovered at implementation time; historical “next migration 162” text is not a usable number now.

The same transaction boundaries protect cancellation versus completion, double redemption and revocation during exchange. Prepared but unused signing material does not grant access until the canonical session record commits. Append-only security audit records are separate from mutable short-lived request lifecycle rows.

## 13. Account, onboarding and site operations

Authentication sessions, password-set intents, reset capabilities, first-party handoff codes and store-creation idempotency keys are different proofs for different purposes. Do not reuse one as another merely because they share a request ID.

Preserve Gateway creation idempotency, but make Accounts forward a stable actor-bound key and request fingerprint. Persist one create intent, one resulting site and owner membership. On retry, resolve that result **before** treating its now-taken subdomain as a new conflict. An incomplete completion/email side effect must not create a second site.

Return the created-site reference in a typed result/bootstrap, not an authority-bearing arbitrary native route. Recheck ownership at app bootstrap. Setup answers use one versioned contract whose fields are actually consumed by the theme/setup resolver. Account completion never auto-publishes or creates a subscription.

## 14. Error and security contract

Proposed stable reasons include request invalid/expired/cancelled, callback mismatch, state mismatch, PKCE invalid, code expired/consumed, proof required, account restricted, session revoked, discovery unavailable and rate limited. Public error messages should not expose account existence or database details. Internal structured logs use redacted correlation IDs and safe reasons.

Use canonical `AppError`/formatting on service boundaries and Zod validation for inbound payloads. Native distinguishes definitive invalid/revoked proof from retryable transport/service failure. Error callbacks are sent only after callback trust is established; malformed initial requests stay on Accounts.

Security tests must cover redirect injection, encoded path/host ambiguity, duplicate query parameters, cross-environment mix-up, request substitution/login CSRF, stale account binding, forged actor/site, lost verifier, replay and parallel consumption. Use the exact redirect and replay guidance in [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) as an implementation review reference. No shared native client secret, broad CORS, TLS bypass or generic bearer link is an acceptable shortcut.

## 15. Provider and operations dependencies

Production requires the actual Accounts domain, supported Turnstile hosts, working email delivery, correct signer/verifier configuration, narrow database operations, exact native associations and trusted release signing. Existing private-JWK environment code is source evidence, not proof of compliant hosted KMS custody; qualify the accepted signer arrangement against ART-05 before release.

Provider login remains Accounts-owned and separately configured. App attestation, device fingerprinting or certificate pinning are not substitutes for PKCE/current authorization and are not required new platforms in this proposal. Keep the release focused on the real account and Merchant journeys.
