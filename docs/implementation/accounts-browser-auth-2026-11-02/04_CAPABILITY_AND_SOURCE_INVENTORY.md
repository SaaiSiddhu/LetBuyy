# Accounts capability inventory and audit traceability

Status: Source-informed proposal inventory, 2 November 2026. “Existing” means identified in source at `e4105581e`, not hosted/provider/device certification. General ownership remains defined by the Constitution and DOC 03.

## 1. Existing account and backend capabilities

| Capability | Existing source owner | Proposed disposition |
|---|---|---|
| Email/account lookup | Accounts `api/auth/lookup` and login page | Retain; handle errors without inferring account absence; review privacy of explicit existence output |
| Password authentication | Accounts login route and restricted Gateway custom-auth adapter | Retain; one hosted UI and shared typed outcomes |
| Signup/email OTP | Accounts signup, verify-OTP, token and email helpers | Retain; host entirely on Accounts |
| Password creation | Accounts set-password and password-set intent | Retain one-use authority; resolve post-OTP failure/resume |
| Password policy | `packages/auth-core/src/index.ts` | Retain canonical rules; no native duplicate policy after migration |
| Password reset | Accounts send-reset/reset, Gateway complete-reset operation | Retain; add bound native continuation only after normal sign-in/MFA |
| Authenticated session inspect | Accounts session and Gateway custom session | Extend transport/error distinction; no false unauthenticated result on upstream failure |
| Sole Merchant signing helper | Accounts `identity-issued-session.ts` | Reuse; qualify signer custody/configuration and registration contract |
| Session register/revoke | Accounts facade and Gateway restricted custom session operations | Reuse/converge; add required atomic handoff registration |
| Current-device login notification | Accounts device and email helpers | Reuse; associate native device honestly, not browser user-agent alone |
| Remembered accounts/switch | Accounts cookies, accounts/switch routes | Repair target proof/freshness/MFA/failure behavior before native reuse |
| Store discovery/selection | Accounts stores/select and Gateway membership/store APIs | Reuse authoritative successful zero/one/many handling |
| Site creation | Gateway `stores.ts`, Accounts create-store proxy | Reuse; forward stable create idempotency and recover original result |
| Creation replay | Gateway store-creation idempotency | Complete the Accounts caller and unknown-outcome readback |
| Web onboarding draft | Gateway `onboarding.ts`, migrations 283–285 and Accounts draft proxy | Retain as convergence starting point; qualify exact live schema and semantic fit |
| Mobile onboarding progress | Gateway mobile-progress, native wizard | Migrate supported unique answers/progress; retire duplicate frontend after parity |
| MFA enrollment/verification/disable | Gateway `two-factor.ts`, web `useMerchantTotp`, native `two_factor_service.dart` | Reuse authority; add Accounts surfaces/adapters and no-store account behavior where absent |
| MFA credential enforcement | Gateway authenticate check plus Accounts login response | Complete browser challenge UI; preserve no-session-before-proof |
| Recovery-code management | Current security-management flows | Reuse underlying code ownership; login recovery resolution needs a complete contract |
| Native secure storage | `flutter_secure_storage` and current session service | Retain abstraction for pending proof and credential custody |
| Native BFF | Existing bearer/session forwarding and internal signing | Retain transport role; no credential minting or database access |
| Actor-isolated bootstrap | Flutter AuthWrapper and StoreContext | Preserve; remove fabricated actor fallback upstream |
| CSRF renewal | Accounts `csrf-client.ts` | Reuse for browser mutations; do not copy native cookie synthesis |
| Bot verification | Accounts Turnstile component and server verification | Centralize all account challenges in Accounts; qualify lifecycle/hosts |
| Transactional email | Accounts email helpers and current canonical email infrastructure | Reuse; distinct delivery/verification outcomes and retry semantics |
| Buyer first-party code flow | Accounts buyer authorize/token, buyer authorization helpers and code persistence | Pattern reference only; preserve buyer realm and do not grant Merchant privileges |
| Operator exchange | Migration 332 and current operator issuer owner | Atomic pattern reference only; no Merchant use of operator proof |

## 2. Required new or extended capabilities

| ID | Capability | Required boundary and result |
|---|---|---|
| N01 | Fixed first-party Merchant client registry | Exact Android/iOS/env/callback/purpose binding; public-client semantics |
| N02 | Native request initiation | Bounded Accounts request with S256 challenge and safe state/context |
| N03 | Shared Accounts continuation | All terminal account paths choose web/native completion through one resolver |
| N04 | Merchant code completion/exchange | One-use hashed code, proof binding, atomic session registration and replay rejection |
| N05 | Native authentication-browser coordinator | Custom Tabs / ASWebAuthenticationSession, cancellation, cold/warm callbacks and latest-request fencing |
| N06 | Native association configuration | Exact hosted App/Universal Link files, signed app entitlements and compatibility callback profile |
| N07 | Native session inspection transport | Current Accounts session authority accepts appropriate native credential; typed invalid versus unavailable |
| N08 | Backend-backed post-auth result | Actor and permitted next action; current membership/readiness readback |
| N09 | Create-store intent recovery | Stable key and result across response loss, restarts and taken-own-subdomain cases |
| N10 | Shared setup answer contract | Versioned taxonomy/draft and real consumer mapping |
| N11 | Recovery continuation | Same-device reset return, cross-device safety and expired-request restart |
| N12 | Login recovery-code resolution | Required proof, one-use consume, rate limits and audit before session issuance |
| N13 | Hosted account security/session center | Reuse enrollment/session/revoke operations; fill no-store and account-owned API gaps |
| N14 | Honest failure and restricted states | No actor invention, no failure-as-empty, no fake provider/status UI |
| N15 | Operational evidence | Redacted lifecycle metrics, failure runbooks, exact artifact/schema/client matrix |

These are extensions inside existing owners, not fifteen services. Required API/schema additions are reviewed at Phase 1 and should be the minimum needed to complete those named behaviors.

## 3. Policy and separately gated features

| Feature | Proposal status | Condition |
|---|---|---|
| Inactivity reactivation | Planned checkpoint; no current equivalent identified by audit | Approve reason/threshold/exceptions and implement actual backend verification/status transition |
| Suspicious-login checkpoint | Policy extension only where current engine supports it | Define deterministic reasons and proof; no new fraud-ML platform |
| Lost email/manual identity review | Unresolved supported-recovery capability | Real owner, procedure, abuse controls and permissions before advertising help |
| Google sign-in | Provider extension | Accounts-owned callback, stable subject linking, configured consent, cancellation and account-security tests |
| Apple sign-in | Provider extension | Same complete Accounts provider qualification; current native Google URL scheme is not evidence |
| Passkeys | Deferred | Current governance trigger/review; not a core release dependency |
| General OIDC discovery/provider | Deferred | Do not activate skeleton routes or public third-party clients |
| Profile/email change | Extend only after current contract inventory | Verified ownership/change/revocation rules; no UI-only save |
| Secondary recovery email/phone | Optional future capability | Verified new address/number, durable model and approved recovery policy |
| Risk/device trust enhancements | Optional bounded improvement | Deterministic policy, privacy and real backend verification; no fake trusted-device labels |
| Browser account-to-buyer connection | Existing distinct workflow | Preserve explicit consent/verified ownership and buyer-only session; outside this Merchant cutover |
| New realm, enterprise SSO, third-party marketplace | Out of scope | No silent expansion to copy Shopify ecosystem scale |

## 4. Existing native source disposition

| Source/surface | Target disposition | Removal gate |
|---|---|---|
| `screens/auth/login_screen.dart` credential form | Replace reachable entry with two hosted actions; retain useful neutral shell assets | New account journeys and callback lifecycle verified |
| `screens/auth/otp_screen.dart` | Retire native account verification form | Hosted OTP/signup/resume and all caller routes qualified |
| Native forgot-password/password update form | Replace with hosted purpose link | Real reset email and MFA/native return accepted |
| `services/store_auth_service.dart` credential methods/cookie jar | Collapse to canonical session/handoff client; preserve callers during bounded migration | No native password/OTP caller; session lifecycle/legacy-client gate green |
| Login-screen Turnstile WebViews and challenge route | Retire auth-specific challenge UI | Accounts challenge expiry/retry/provider checks green |
| `screens/wizard/create_store_wizard.dart` | Retire first-store creation workflow after hosted replacement | Unique answers migrated, original-create readback and device journeys green |
| `store_published_screen.dart` invoked by signup/create | Remove misleading create-means-published path; preserve unrelated useful workspace UI | Draft/publish separation verified and zero route callers |
| AuthWrapper/StoreContext | Retain and adapt bootstrap | Actor fencing and discovery-error tests stay green |
| Native MFA settings/operation approval services | Migrate only account-owned management when hosted parity is real; retain exact operation step-up | No loss of sensitive-operation proof/approval behavior |
| `webview_flutter`, `url_launcher`, existing schemes | Audit feature callers; retain needed non-auth usage | Zero remaining consumer before dependency/config deletion |
| Secure storage and native identity/signing config | Preserve | No blanket deletion; changes require exact scoped migration |

No source is deleted during planning. Follow DEL-R1–6 in the implementation, with zero importers plus applicable build/test/governance/replacement-serving gates. Do not turn an auth cleanup into whole-repo dependency removal.

## 5. Audit finding traceability

| Audit | Target correction | Main phase | Acceptance |
|---|---|---|---|
| F01 web MFA dead end | Shared hosted challenge before native/web completion | 2 | A06–A08 |
| F02 password-policy mismatch | Accounts owns password capture and canonical validation | 2, 4, 8 | A02 and policy boundaries |
| F03 wrong-password signup switch | Explicit login versus signup intent; remove old caller | 2, 8 | A03 |
| F04 lookup failure becomes new account | Typed error and `res.ok` handling in shared flow | 2 | A04 |
| F05 discovery failure becomes onboarding | Successful-empty alone enables no-store onboarding | 2, 4 | A29–A30 |
| F06 native empty-actor fallback | Verified session + actor bootstrap only | 4 | A28 |
| F07 outage/logout/startup conflation | Explicit unavailable state, bounded startup, canonical revoke/expiry handling | 2, 4 | A11, A28, A40 |
| F08 create/publish lifecycle split | Hosted draft creation; later explicit publication | 5 | A33, A36–A37 |
| F09 missing web create key | Accounts forwards stable create intent | 5 | A33–A34 |
| F10 own-subdomain replay obstacle | Resolve original create outcome before availability conflict | 5 | A34 |
| F11 divergent answers/drafts | One versioned semantic contract and visible save state | 5 | A35 |
| F12 reset return gap | Bound continuation plus normal reauthentication/MFA | 6 | A09–A11 |
| F13 login recovery-code gap | Authorized one-use challenge resolution | 6 | A08 |
| F14 remembered switch proof | Fresh target proof/revocation and atomic actor replacement | 2, 6 | A05, A39 |
| F15 independent native auth transport/challenge | OS browser, code exchange, secure native session transport; retire native cookie jar | 3, 4, 8 | A14–A28, A44 |
| F16 terms/completion hardcoding | Backend offer/catalog/state readback; accurate draft status | 5 | A36–A38 |

## 6. Source evidence and confidence

The current audit and inspected paths support capability/location statements here. They do not prove hosted provider availability, live signing custody, current inbox delivery, app-store association, real device return or complete database rollback. All required proposed APIs, schema and callback modes remain unimplemented until a separately authorized execution produces evidence.

The native pubspec currently includes URL launch, WebView and secure-storage dependencies; no complete Merchant hosted-auth callback coordinator was identified. Android package and iOS bundle IDs are `com.letbuyy.store`, and the inspected iOS deployment target is 15.0. Existing Google URL registration must not be confused with working Accounts native callback support.

The earlier selected tests passed 18 web and 12 Flutter cases. Those suites cover parts of the old account and session boundary; they are neither newly run nor a completion gate for this proposed migration. New acceptance is defined in the delivery matrix.
