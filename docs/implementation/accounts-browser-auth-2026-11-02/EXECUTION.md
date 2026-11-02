# Unified Merchant Accounts implementation — 2 November 2026

Core source is implemented in the existing Accounts, Gateway, auth-core and Flutter owners. Local database, production-build browser and native build verification is recorded below. **Installed-device authentication and hosted release acceptance are still open.** No production database migration, domain registration, deployment, signing configuration change, commit or push was performed.

The original four specifications and their A01–A45 acceptance requirements remain the scope. The implementation follows Constitution Amendment 3's first-party PKCE permission, IDN-R1, WIN-R4, CODE-R1–4 and DEL-R1–6. It introduces no issuer, auth realm, runtime, password store, tenant table named `stores`, general OIDC provider or payment flow.

## Delivered behavior

- Flutter's reachable signed-out entry has Log in and Sign up actions. Both use Accounts in Android Custom Tabs or iOS ASWebAuthenticationSession. Existing native credential forms and creation wizard remain in source for gated cleanup, with their application routes directed to the hosted journey.
- Accounts owns email lookup, verified signup, canonical password validation, MFA and recovery codes, reset, account selection and hosted store creation. Unsupported provider/passkey buttons and inert alternatives were removed. Email-link verification for an existing password account leads to normal password/MFA sign-in; it cannot independently mint a session.
- Native authorization uses a fixed client/environment/callback registry, S256 PKCE, protected state, separate launch and cancellation proofs, explicit browser SSO approval and an exact source browser session. Only a 60-second one-use code crosses the callback. The independently registered native session travels in the HTTPS exchange response body. Browser cookies remain in the browser.
- Migration 416 adds bounded handoff persistence with FORCE RLS and restricted grants. Code consumption, canonical JTI consumption and canonical `sessions` registration commit together. Concurrent exchanges produce one session. Expiry, source revocation, wrong actor/client/environment, forged signing keys and cancellation fail closed. Cancellation can revoke the particular native session whose exchange reply was lost.
- Login consumes a TOTP counter or recovery code durably after password proof. Email verification cannot bypass an enrolled factor. Signup can resume an interrupted passwordless account, while racing/stale setup intents cannot overwrite an already saved password.
- Flutter validates the authoritative actor before accepting a candidate credential, serializes secure session writes, fences old private requests during account changes, handles warm/cold duplicate callbacks and preserves sealed credentials on verification outages. A crash during exchange retains cancellation proof without retaining a redeemable verifier. Logout clears local access before waiting for server revocation and reports an unconfirmed remote outcome honestly.
- Failed lookup, session verification and membership discovery have retry states; they do not mean a new account or zero stores. Intended site references are only hints until current membership resolves. First login supports zero, one or multiple memberships.
- Native Create store and Manage security use actor-bound hosted tasks. The shared onboarding draft saves industry/channel intent and creates one draft site. The Accounts API transport preserves the caller's stable idempotency key instead of allowing the SDK's generated key to replace it. A committed creation with a lost response recovers the original site on reload. Creation does not publish or purchase a plan.
- Hosted account security works without a site: enroll/verify/disable an authenticator, acknowledge recovery codes, inspect up to 25 active sessions, and revoke all sessions after password and required factor proof. A newly enrolled factor requires fresh sign-in before completing another native handoff.

## Callback and configuration contract

The TypeScript registry in `packages/auth-core/src/merchant-native-registry.ts` generates `apps/merchant/mobile/lib/services/merchant_auth_contract.g.dart`. Run `node --import tsx scripts/generators/generate-merchant-auth-contract.ts --check` to check parity.

| Environment | Accounts origin / Android callback | iOS callback |
|---|---|---|
| Production | `https://accounts.letbuyy.com` / `/merchant/auth/callback` | `com.letbuyy.store.accounts://auth/callback` |
| Staging | `https://accounts.staging.letbuyy.com` / `/merchant/auth/callback` | `com.letbuyy.store.accounts.staging://auth/callback` |
| Development | `http://localhost:9002` / `/merchant/auth/callback` | `com.letbuyy.store.accounts.development://auth/callback` |

The staging hostname is a source registry choice, **not evidence of provisioned DNS or hosting**. Deployment must provision that exact estate or revise the registry and generated contract together before distributing a client. Development Accounts can use a loopback listener on another port for owned browser tests; the Android callback remains the fixed localhost:9002 URI. Android's platform bridge itself opens localhost:9002 in debug builds. No arbitrary external redirect URI is accepted.

Required server-first release order:

1. Apply reviewed migration 416 with its paired DOWN available. Gateway and Accounts must use matching schema/source and the existing Identity signer/public verifier configuration. The signing key stays Accounts-owned.
2. Set the correct `APP_ENV`/`NEXT_PUBLIC_ENV`, Accounts origin and issuer for that estate. `LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED` is disabled by default outside development and must be explicitly enabled only after server qualification.
3. Configure `LETBUYY_ANDROID_APP_LINKS_SHA256` with this estate's approved public signing-certificate SHA-256 fingerprints. The association endpoint returns an unavailable empty result when missing/invalid; no fingerprint was guessed. Verify HTTPS `/.well-known/assetlinks.json`, package `com.letbuyy.store`, signing identity and OS association readback.
4. Build Flutter with matching `IDENTITY_BASE_URL`, `ACCOUNTS_ENVIRONMENT`, `BFF_BASE_URL` and other existing estate configuration. Android Gradle's `LETBUYY_ACCOUNTS_CALLBACK_HOST` property selects the exact production or staging callback host; it must agree with the Dart environment. Development HTTP handling is debug-only on Android. iOS uses the registered environment-specific ASWebAuthenticationSession callback scheme, including its supported older-iOS mode.
5. Qualify installed staging and release-signed clients, configured email/challenge providers, cancellation, backgrounding and process death. Distribute the hosted-auth client only after its server and associations are serving.

No client secret is embedded in Flutter. The app does not scrape HTTP-only cookies, use a credential WebView, place an access token in a URL, or fall back to a generic external browser when the required authentication surface is unavailable.

## Verification evidence

Owned database/browser runs use disposable, labelled Postgres and REST containers. The browser runtime uses an isolated source candidate under the host temporary directory, with no checkout `.env` files loaded. It builds and starts the production Next artifact and reaches the real mounted Gateway, database and BFF code. Synthetic recipients are restricted to `example.invalid`; provider acceptance is intercepted and the official Turnstile test keys are used. The OS callback is captured by Playwright rather than opening a real installed app. Consequently this proves the **local browser/backend chain**, not inbox delivery, real challenge-provider failure handling, or device return.

| Check | Result / evidence |
|---|---|
| Shared auth-core suite | 50 passed, including RFC 7636 vector and strict callback attacks; `letbuyy-accounts-auth-core-final.log` |
| Accounts unit/source suite | 62 passed; `letbuyy-accounts-identity-qualified-tests.log` |
| CSRF/session/password/recovery/email/rate-limit contracts | 46 passed; `letbuyy-accounts-web-contract-qualified.log` |
| Existing Identity persistence/password-intent boundaries | 6 passed; `letbuyy-accounts-final-boundary.log` |
| Gateway auth forgery/issuer/session/fail-closed/rate-limit suite | 31 passed; `letbuyy-accounts-gateway-final-tests.log` |
| Native handoff / password-intent race / MFA replay / DOWN and reapply | 14 passed against real Postgres; owned run `eea427311b6e`, `letbuyy-accounts-mobile-db-last.json` |
| Existing auth-repair and JTI SQL regression | 7 passed; owned run `b32d151f1278`, `letbuyy-accounts-auth-regression.json` |
| Canonical tenant red-team SQL suite | 2 tests passed; owned run `53db2e7baf3d`, `letbuyy-accounts-tenant-regression.json`; positive controls and denial cases retained |
| Full Flutter regression | 399 passed, including the two-action entry, PKCE/state, cold start, lost-reply cleanup, cancellation, verification outage and logout races; `letbuyy-accounts-flutter-qualified.log` |
| Flutter analysis | No issues in 13 affected source/test items; `letbuyy-accounts-native-qualified-analyze.log` |
| Accounts and Gateway typechecks | Passed; `letbuyy-accounts-identity-qualified-typecheck.log`, `letbuyy-accounts-gateway-final-typecheck.log` |
| Generated callback contract / diff whitespace | Passed |
| Sole-issuer and durable-MFA governance | Identity security gate passes; canonical validator and 59 negative controls pass; 23 shared identity regressions pass |
| Owned-lane governance | 15 passed; `letbuyy-accounts-db-lane-final-v2.log` |

The browser fixture covers wrong password, lookup outage, required MFA, signup with OTP/password, explicit SSO consent (GET cannot authorize), code exchange/replay, a distinct native credential, real BFF zero-store readback, failed web store discovery and retry, no-store security, creation committed/reply lost/reload, draft status and membership readback, same-browser reset followed by required MFA/recovery, authenticator enrollment/activation/disable and logout everywhere. The existing public-signup browser regression also passes.

The final Accounts browser run is `458d3e14a9db` (one complete multi-step journey, zero failures); report `letbuyy-accounts-browser-delivery.json`. The paired public-signup regression passed in run `5639b5b45deb` (two browser suites, zero failures). The final native boundary suite passed 232 tests after the last credential-transport hardening; its result and artifact fingerprints are in [verification.json](verification.json).

Local logs and JSON reports named above are under `/private/tmp/`; they are temporary verification outputs, not committed production evidence. Native build outputs stay under the Flutter build directory and are not source authority. Final delivery builds passed: Android debug APK (`letbuyy-accounts-android-delivery-build.log`) and iOS simulator Runner.app (`letbuyy-accounts-ios-delivery-build.log`). Compiler warnings about older Android SDK metadata and iOS plugins lacking Swift Package Manager adoption did not prevent the debug/simulator builds; release builds/distribution are not certified here.

## Acceptance matrix

“Local” below identifies actual browser/backend or unit/database proof. Every required device/provider dimension remains a release gate until exercised in that environment; source presence does not satisfy it.

| Case | Current evidence / remaining gate |
|---|---|
| A01 | Entry widget, local browser login/handoff and native state tests pass; installed Android/iOS browser return pending. |
| A02 | Local OTP/password signup/handoff passes; real inbox and both devices pending. |
| A03 | Browser wrong-password rejection stays on login. |
| A04 | Browser lookup 503 and rate-limit contracts pass; configured-provider 429 exercise pending. |
| A05 | Explicit browser SSO confirmation and actor-bound task rejection pass; device account-change journey pending. |
| A06 | Browser has no session before MFA; native return follows accepted proof. Devices pending. |
| A07 | Durable counter replay rejection and recovery-code concurrency pass. |
| A08 | Browser recovery-code login and exactly-once DB consumption pass; devices pending. |
| A09 | Same-browser reset revokes sessions, requires normal MFA and returns a new native handoff locally; inbox/device pending. |
| A10 | Continuation is host/browser-bound and native verifier remains device-owned; actual two-device reset journey pending. |
| A11 | Browser fixture verifies existing sessions revoked by reset; installed app reauthentication pending. |
| A12 | Unavailable: no approved inactivity/reactivation policy/backend exists. No invented threshold or support promise. |
| A13 | Hosted no-store security commands and fresh-factor handoff guards verified; native-origin device journey pending. |
| A14 | CSRF contracts and test-key challenge flow pass; actual challenge expiry/provider failure acceptance pending. |
| A15 | Duplicate native taps open one browser in coordinator tests. Device UI pending. |
| A16 | Exact path/host/query/state/request rejection tested in TS/Dart and DB. Devices pending. |
| A17 | Wrong PKCE denies without consuming a valid exchange. |
| A18 | Real DB concurrent redemption creates exactly one native session. |
| A19 | DB cancellation revokes only a lost-response native session; native crash cleanup retains no verifier. Device network fault pending. |
| A20 | Cancellation/commit locks and native generation-fencing tests pass; OS race pending. |
| A21 | Protected pending state/cold-start tests pass; real process death on both platforms pending. |
| A22 | Duplicate callback coordination tests pass; actual warm/cold OS delivery pending. |
| A23 | Old/missing pending state cannot replace the actor in native tests. Device pending. |
| A24 | Cross-environment/client exchange denied; registry parity checked. Hosted config acceptance pending. |
| A25 | Android association endpoint and exact manifest implemented; release certificate/OS verification pending. iOS uses the chosen system-session scheme, not a claimed Universal Link implementation. |
| A26 | ASWebAuthenticationSession compiles with the supported older-iOS callback API; OS-version matrix pending. |
| A27 | Exceptional Return to app action and safe restart page implemented; OS/browser fallback exercise pending. |
| A28 | Native outage retains sealed credential and no fabricated actor; web retry states implemented. Device pending. |
| A29 | Browser discovery failure remains retryable, then actual empty routes to setup. Native membership error UI remains guarded. |
| A30 | Existing native store-context/actor tests and zero-store BFF/browser readback pass; full one/many device journeys pending. |
| A31 | Expected actor/owner-site/registry grants and tenant red-team pass; device removed-membership journey pending. |
| A32 | Existing invitation path retained; no new invitation authority. Full invitation regression/device acceptance pending. |
| A33 | Stable actor/attempt key survives SDK transport; existing idempotency implementation retained. Local lost-response test creates one site. Device double-submit pending. |
| A34 | Browser fault injection proves committed site readback before subdomain conflict and correct native site hint. |
| A35 | Saving failure blocks creation with retry text; source/contract guards pass. Explicit browser draft-save outage injection pending. |
| A36 | Real DB readback is draft; browser fixture observes no publish call. |
| A37 | Account creation does not purchase/enroll. Actual plan/provider flows remain separate and are not certified by this task. |
| A38 | Site result survives notification handling in source; synthetic email acceptance passes. Actual provider outage/delivery retry pending. |
| A39 | Cancellation preserves original actor and fences writes in native tests. Device pending. |
| A40 | Local logout precedes slow/unavailable remote result in native test; failed remote revoke is reported. Device pending. |
| A41 | Browser global logout revokes all account sessions in DB; live multi-client denial/readback pending. |
| A42 | Full-code OTP paste/autofill input, labels, recovery fields, responsive entry and 390px browser inspection implemented; full web/Android/iOS accessibility matrix pending. |
| A43 | N/A: Google/Apple/passkeys are not enabled by this work. |
| A44 | Callback/launch pages use no-store/no-referrer/private CSP; app links bypass Flutter route telemetry; no credential/verifier logging added. Hosted platform access-log redaction and device analytics capture audit pending. |
| A45 | DOWN preserves canonical sessions and reapply passes. Legacy source retained and unreachable; deletion and whole-release rollback remain gated. |

## Open gates and rollback

The legacy `identity-security-gate.mjs` SEC-C2 assertion expected obsolete symmetric-secret checks in the unchanged Console verifier. It now checks delegation to the existing sole-Identity public verifier, forbids restoring a local symmetric verifier/signer, and executes the canonical session-security validator. The canonical validator was also retargeted from stateless TOTP verification to the actual durable counter/recovery-code consumer, with active-actor binding, row locking and replay checks. All 59 validator negative controls pass, as do 23 shared realm/RBAC/OAuth/session regressions. `identity-security-gate.mjs` passes (`letbuyy-accounts-identity-security-qualified.log`). No Console runtime or issuer behavior was changed, and no guard was disabled.

Hosted staging/prod signer/verifier/schema alignment, real Turnstile and email delivery, exact estate provisioning, approved Android certificate fingerprints and installed release-signed Android/iOS return tests are outstanding. No connected Android device was available. A simulator compilation is not an installed browser-session acceptance result. No product latency budget or production-performance claim was inferred from test duration.

Rollback is server-first and drained: stop new handoffs, let the 15-minute request lifetime drain, restore the prior compatible Accounts/Gateway/client artifacts (including callers of the new registration/MFA RPCs), then apply migration 416's DOWN if required. Preserve the canonical sessions/JTI witnesses and all sites/users. Do not run DOWN while current code still calls those RPCs. Distributed-client rollback and deletion gates require the actual serving/device evidence above. Keep the retained native source until DEL-R1–6 acceptance is green.
