# Delivery phases and acceptance for hosted Merchant authentication

Status: Proposed implementation and verification programme. No phase is marked started or complete by this documentation. The earlier audit's local tests are historical evidence, not validation of the proposed handoff.

## 1. Programme rules

Work in the existing Accounts, Merchant and Gateway owners. Preserve dirty source and unrelated work. Do not create parallel identity services, activate OIDC/passkeys, move money rules or fill reserved runtimes. One agent owns this programme unless the owner explicitly authorizes delegation.

Implementation requires explicit authorization separate from this planning request. During implementation, normal engineering decisions within the approved canonical contracts can proceed; named policy/governance/release decisions below are resolved at their actual gates. Do not request repeated approval for routine reversible work or treat this plan as authorization to deploy.

## 2. Phase 1 — Freeze contracts and qualify the OS browser bridge

### Work

- Refresh the source/branch baseline and create a bounded consumer map for Accounts login/reset/session, native auth routes, BFF, Gateway sessions, store discovery and onboarding.
- Finalize the first-party Merchant client registry and exact environment-specific callbacks. Preserve `com.letbuyy.store` Android/iOS identities and current signing.
- Reconcile canonical Merchant session representation and live registration/revocation behavior before defining the native exchange response. Do not introduce another issuer/token format.
- Inventory live identity intent/code primitives and determine whether a minimal new handoff record is required. Do not revive dead shadow OAuth/session tables.
- Spike Android Custom Tabs and iOS `ASWebAuthenticationSession` with the current supported OS versions, warm/cold callbacks, cancellation, email-app context switch and protected pending storage.
- Select the Flutter bridge only after proving those cases. A generic URL launcher call is not a completed authentication coordinator; a package that requires activating deferred OIDC is not selected by default.
- Finalize the exact create-store lifecycle: draft creation, optional onboarding, plan restrictions from backend and explicit later publication.

### Deliverables and exit

Reviewed API/state contract, source ownership map, callback/environment matrix, schema/RPC disposition, device spike evidence and a migration manifest. Exit requires a real automatic return on Android and supported iOS modes, without sharing a browser cookie or embedding a client secret. This is transport qualification, not account E2E acceptance.

## 3. Phase 2 — Repair the shared Accounts journey

### Work

- Add browser MFA challenge/retry against the existing server-required factor contract.
- Correct lookup error handling and failed store-discovery routing.
- Remove wrong-password-to-signup semantics from the surviving shared flow.
- Use canonical password validation, error codes, OTP/password-set transitions and recovery intent behavior.
- Introduce one continuation resolver for browser and native requests. Preserve native context through signup, password reset, MFA and safe account changes.
- Separate required checkpoints from optional security recommendations.
- Review remembered-account proof freshness, current MFA/revocation and failure atomicity before enabling seamless target switching.
- Distinguish invalid/revoked sessions from retryable verification unavailability.

### Deliverables and exit

Accounts can complete normal login/signup/reset and enrolled MFA in a regular browser using the shared UI. Tests prove 429/503 never mean “new account/no stores.” The native handoff is still disabled until later gates. Do not migrate Flutter to a shared web flow with a known MFA dead end.

## 4. Phase 3 — Add the narrow first-party code handoff

### Work

- Add canonical request/result/error schemas and the fixed first-party client registry.
- Implement request creation, browser request binding, CSRF-checked completion and PKCE exchange inside the existing Accounts owner.
- Add/reuse narrow durable request persistence with expiry, hashed codes, actor/browser/purpose/client binding and one-use consumption.
- Extend canonical session registration so code consumption, JTI witness and session insert share the required atomic boundary.
- Validate the accepted signing arrangement; signing stays Accounts-owned, consumers verify only.
- Add rate limits, redaction, no-store responses, safe callback pages and expiry/cancellation cleanup.
- Add public/native bearer inspection at the canonical session boundary with a reviewed origin/transport contract.

### Deliverables and exit

Database-backed concurrent exchanges produce exactly one permitted session. Wrong verifier, wrong callback, expired request, forged actor, cross-environment code, cancelled intent and replay all fail closed. Rollback restores the prior building tree and supported clients. No native rollout yet.

## 5. Phase 4 — Integrate Flutter entry, callback and session lifecycle

### Work

- Replace the signed-out entry with Log in and Sign up actions opening the in-app system browser.
- Implement one native lifecycle coordinator for pending PKCE/state, browser open/cancel, warm/cold callback, exchange and bootstrap.
- Use platform-protected storage for pending proof and session custody. Clear stale actor/private caches on actual session replacement, not on transient network failure.
- Preserve AuthWrapper/StoreContext actor fencing and successful-empty versus error behavior.
- Remove fabricated empty-actor session fallback from the reachable new path.
- Bound startup/network waiting and support retry without forced signup/logout.
- Preserve current BFF/Gateway tenant and membership enforcement. Test wrong-site hints and removed membership.
- Implement honest native logout, hosted account switch and reauthentication for expired/revoked sessions.

### Deliverables and exit

Installed Android/iOS builds finish real Accounts login and return to a native authorized workspace. Cancellation, duplicate callbacks, process death, stale state, unavailable session readback and unavailable memberships all produce the intended UI. Old native forms remain unreached behind the bounded compatibility rollout; deletion waits for Phase 8.

## 6. Phase 5 — Consolidate hosted store creation and onboarding

### Work

- Route native Create store into Accounts under a distinct authenticated task.
- Reconcile onboarding questions, industry/category taxonomy and actual consumers into one published contract.
- Consolidate durable drafts with explicit state/version and visible save/retry behavior. Do not require optional answers for account return.
- Forward a stable actor-bound store-creation idempotency key and request fingerprint from Accounts to Gateway.
- Recover the original site's result before subdomain-availability checks; cover creation committed/response lost and restart.
- Read current catalog defaults and backend commercial terms; remove native hardcoded creation/theme/offer assumptions after replacement is verified.
- Return created draft/site references and resolve current membership on native bootstrap.
- Keep plan enrollment, provider payment and publication separate. Remove automatic publication from the new create flow.

### Deliverables and exit

Web and native-origin browser setup create exactly one draft site and owner membership, save supported answers and return to the right workspace. Store-created email retries do not duplicate sites. Actual plan/readiness restrictions and explicit publication behave consistently.

## 7. Phase 6 — Complete recovery, security and account-owned management

### Work

- Complete reset-email continuation, same-device and cross-device behavior, normal MFA after reset and automatic native return.
- Complete login recovery-code handling before advertising it as the lost-authenticator route.
- Provide Accounts-hosted security/session management backed by existing operations, including a no-store account where required. Do not create a dummy site to manage account MFA.
- Support actual current-session revocation, logout everywhere, factor status/readback and profile fields only where durable backend contracts exist.
- Implement reactivation only if an approved policy and a real backend proof/restriction lifecycle are available. Otherwise keep it unavailable and record the accurate recovery behavior.
- Add provider login only as a separately approved/configured feature with its own identity-linking tests. Do not put it on the critical path for email authentication.
- Preserve exact operation-bound approvals for refunds and other sensitive Merchant actions.

### Deliverables and exit

Accepted recovery/security journeys finish in both clients and return correctly. Lost email/factor cases lead to real supported paths, never an invented support workflow. Deferred/provider capabilities are honestly absent. If reactivation is requested as a release feature, missing policy/backend is an open gate, not a waived implementation detail.

## 8. Phase 7 — Qualify staging and production-shaped operation

### Work

- Run appropriate unit, integration, contract, E2E, security, performance, regression, rollback and deletion validation for touched auth/site boundaries.
- Test staging Accounts and installed staging-signed Android/iOS builds with actual associations and configured challenge/email providers.
- Exercise release-signed association behavior through the appropriate device distribution channel; debug-build success is not production signing proof.
- Verify full source/artifact/schema/config alignment, CI results, signer/verifier custody, domain associations and approved privacy handling.
- Collect redacted evidence for both successful and failed journeys; no credentials, OTPs, verifier values, callback bearer URLs or private user records.
- Measure request/open/credential/checkpoint/return/exchange/bootstrap stages separately and define acceptable latency budgets from baseline measurements. No arbitrary performance claims from unit-test timing.

### Deliverables and exit

An acceptance matrix records each case as source-, database-, browser-, provider-, device-verified, blocked or not applicable with a reason. All core security/recovery gates pass. Hosted/provider/device blockers remain explicit and cannot be replaced by mock tests.

## 9. Phase 8 — Controlled release and gated native cleanup

### Work

- Prepare exact reviewed artifacts and a compatible server-first rollout. Follow the authorized `develop → staging → main` process when a release is separately authorized.
- Register native association documents and callbacks before distributing the client that depends on them. Keep staging/prod trust separate.
- Roll out the hosted-auth client under a bounded first-party client/version gate; watch completion, cancellation, replay, exchange and bootstrap failures.
- Keep old supported clients working against the same canonical Accounts backend for a finite compatibility window. This is an old client version, not a permanent second issuer or new duplicate password authority.
- Stop all native credential-form/OTP/wizard callers, then remove the unused auth-specific screens, services, duplicated validation, Turnstile WebViews and stale provider configuration after import/build/test/governance/device gates.
- Retain `webview_flutter`, URL schemes or browser utilities if other live Merchant features still need them. Audit usage first; do not delete dependencies or signing files by association.
- Record final single-path routing, retirement/version policy, rollback drill, operational runbook and remaining deliberately deferred capabilities.

### Deliverables and exit

All supported new Merchant clients start account actions through Accounts, automatic native return is operating, obsolete credential/create paths have zero live callers, and cleanup is reversible and validated. No known critical auth finding remains open. Production readiness is declared only for the observed accepted scope.

## 10. Verification matrix

Each row needs its own evidence and result; a checkbox here is not a test implementation. DB means real transaction/authorization validation, and device means an installed Android/iOS journey where applicable.

| ID | Scenario | Required outcome | Main evidence |
|---|---|---|---|
| A01 | Login from signed-out app | In-app browser; correct Accounts origin; native return | Browser + both devices |
| A02 | Signup from app | Email proof, canonical password, automatic native return | Email + browser + devices |
| A03 | Wrong password for existing email | Remain login; no automatic signup | Contract + browser |
| A04 | Account lookup 429/503 | Clear retry; no inferred new account | Contract + browser |
| A05 | Browser has another account session | Account shown/confirmed or changed; no silent actor substitution | Browser + devices |
| A06 | Enrolled MFA login | No normal handoff before valid factor | DB + browser + devices |
| A07 | Invalid/expired/reused factor proof | Reject under actual replay/freshness policy | Security + DB |
| A08 | Recovery code login | Exactly one permitted consumption | DB + browser + devices |
| A09 | Reset link same device | Change password, normal sign-in/MFA, return | Email + browser + devices |
| A10 | Reset link another device | Password change allowed; no unauthorized app session transfer | Security + two-device journey |
| A11 | Reset revokes existing native session | Old credential denied; clear reauthentication | DB + device |
| A12 | Approved reactivation checkpoint | Correct reason/proof; restrictions respected; return | DB + email + devices |
| A13 | Optional security review | No fake factor activation; continuation preserved | Browser |
| A14 | CSRF and Turnstile expiry/resend | Fail closed, deliberate fresh retry, preserved safe input | Provider + browser |
| A15 | Duplicate native button tap | One active browser request | Native state + device |
| A16 | Wrong callback/state/request | No exchange or actor replacement | Security + device |
| A17 | Wrong PKCE verifier | No session; no successful consumption | DB + security |
| A18 | Replay/parallel exchange | Exactly one successful native session | DB concurrency |
| A19 | Exchange response lost after commit | Safe restart/reconciliation; no second mint from used code | Fault injection + device |
| A20 | Cancel races with completion | Defined terminal state; no late account substitution | DB concurrency + native |
| A21 | App killed while browser active | Valid cold-start resume or safe restart | Both devices |
| A22 | Warm and cold callback duplicated | One coordinator and one accepted result | Native + device |
| A23 | Older callback after new login | Stale request rejected | Native + device |
| A24 | Production code in staging app | Rejected | Security + deployed config |
| A25 | Release App/Universal Link association | Correct app/version; no unrelated link capture | Release-signed devices |
| A26 | Supported older iOS callback mode | Proper system session completion; no WebView fallback | Device version matrix |
| A27 | Browser does not auto-open app | Safe exceptional Return to app action | Devices + browser |
| A28 | Session inspect unavailable | No fabricated actor or forced invalid-session conclusion | Contract + device |
| A29 | Store discovery unavailable | Retry; never infer zero stores | Contract + browser + device |
| A30 | Zero/one/many memberships | Correct authorized destination | DB + both clients |
| A31 | Intended site is forged or access removed | No cross-tenant entry | Security + DB + device |
| A32 | Staff invitation pending | Exact invitation proof and current membership | DB + browser + device |
| A33 | Create store double submit/retry | One site and owner membership | DB concurrency + browser |
| A34 | Create commits; response lost | Original-site readback before subdomain conflict | Fault injection + both origins |
| A35 | Draft/onboarding save fails | Visible save error/retry; no false completion | Browser + DB |
| A36 | New store completion | Draft remains draft; no implicit publication/charge | DB + Merchant UI |
| A37 | Offer skipped or enrollment fails | Actual allowed setup; no invented subscription | Contract + configured provider if used |
| A38 | Store-created email unavailable | Durable site survives; delivery state honest | DB + provider failure |
| A39 | Switch cancelled | Original actor stays; writes remain fenced | Native + device |
| A40 | Native logout/server failure | Local access cleared; remote outcome accurate | DB + device |
| A41 | Logout everywhere | All affected sessions denied after authoritative revoke | DB + multi-client |
| A42 | Keyboard, autofill, paste, text scale, screen reader | Complete tasks without clipped/hidden actions | Web + Android/iOS accessibility |
| A43 | Provider method cancelled/denied if enabled | Preserve original request; no silent account link | Real provider + device |
| A44 | Logs, analytics, cache and referrers | No credentials/codes/state/verifiers/private callback URLs | Security + artifact inspection |
| A45 | Cleanup/rollback | No live legacy caller; previous accepted build restored without schema loss | Import/build/test/governance + rollback |

## 11. Nine testing classes applied

| Class | Required evidence |
|---|---|
| Unit | Parser/state transitions, typed outcomes, URI matching and expiry decisions |
| Integration | Canonical account/session adapter, atomic DB exchange, revocation, membership and create intent |
| Contract | TS/Dart request/results, invalid and unavailable outcomes, environment/client compatibility |
| E2E | Hosted browser through real email/checkpoints into installed native workspace |
| Security | Forgery, replay, actor/realm/site escalation, CSRF, redirects, proof reuse and exact binding |
| Performance | Bounded waits and measured end-to-end latency under representative network/device conditions |
| Regression | Existing browser Merchant, buyer realm isolation, staff invitation and sensitive operation step-up |
| Rollback validation | Paired migration recovery, signed client compatibility and accepted artifact rollback |
| Deletion validation | Zero live callers plus required build/tests/governance and observed replacement serving |

Preserve existing RT-1, RT-2, RT-7 and auth forgery/session guard tests. Add meaningful behavioral cases; do not satisfy coverage by file presence or tests mirroring implementation details.

## 12. Release and rollback strategy

Ship compatible Accounts contracts before the mobile build. A server gate can stop starting new mobile requests without invalidating all active web sessions. Already issued requests either complete under their accepted contract or expire safely; a kill switch must never redirect to an arbitrary callback or bypass security.

A release rollback means the last qualified Accounts artifact and compatible native entry policy. It does not mean re-enabling the known broken web MFA journey, native empty-actor fallback, automatic publication or old account-switch security defects. If no safe prior artifact exists, show an honest temporarily unavailable account entry instead of weakening proof.

Retain the acceptance evidence, schema rollback pair, exact build/version/callback configuration and bounded compatibility window. Do not rollback or drop data merely to restore UI. Existing sites, users, audit, consents and sessions retain their canonical recovery rules.

## 13. Operations and observability

Measure privacy-safe counts and durations for request created, browser opened, checkpoint required, account complete, callback received, exchange accepted, bootstrap complete, cancelled, expired and failed by stable reason. Separate account success from app arrival and store creation from publication. An HTTP 200 or app foreground event is not successful login.

Use non-secret redacted correlation IDs in runbooks. Restrict callback query logging at hosting/proxy/crash layers as well as application logs. Provide runbooks for association failure, email/challenge outage, signer unavailable, callback replay, exchange outcome unknown, store-create unknown outcome and lost factor.

Monitoring should report meaningful failures without collecting passwords, email codes, MFA seeds, state, verifiers, raw tokens, authorization codes or private callback URLs. Operational evidence distinguishes provider accepted, delivered/inbox observed, app resumed, session valid and workspace authorized.

## 14. Decisions to finalize at implementation review

| Decision | Proposed default | Gate |
|---|---|---|
| Browser mode | Custom Tabs / ASWebAuthenticationSession | Phase 1 device spike |
| Exact callback host/scheme and OS compatibility modes | Reuse owned associated host where possible; exact HTTPS plus tested older-iOS profile | Phase 1 |
| First-party request/code lifetimes | 15 minutes / 60 seconds | Phase 1 security review |
| Concrete canonical Merchant session response | Extend current accepted owner; no third format | Phase 1 contract review |
| Profile/security center fields | Only current durable contracts; fill named gaps | Phase 6 |
| Reactivation threshold and lost-access policy | No fabricated threshold or workflow | Before exposing reactivation |
| Optional offer and plan ordering | Backend terms; account return never gated by an optional offer | Phase 5 |
| Google/Apple scope | Separate configured capability; hidden until complete | Separate provider gate |
| Passkeys/general OIDC | Remain deferred | Separate governance trigger |
| Minimum supported old-client window | Measured installed versions and explicit retirement policy | Before Phase 8 |
| Production activation | Reviewed exact artifacts and complete applicable gates | Explicit release authorization |

These are review points for a concrete implementation, not a request to approve vague architecture now. This planning package does not resolve commercial or inactivity policies by assumption.
