# Merchant account and store creation: web / Flutter audit

Date: 2026-11-02. Source baseline: `e4105581e` (`develop`).

Status: **source audit with selected local regression tests; not end-to-end certification**.

Scope: Merchant browser entry through Accounts, native Flutter entry, signup and email verification, password setup/reset, MFA, session restoration, store discovery/selection, onboarding persistence, creation and initial publication. This is an analysis document; no application fixes, schema changes, provider operations or deployments were performed.

The adjacent `PROPOSED_ACCOUNT_AND_STORE_CREATION_FLOW.md` describes a proposal. It is not evidence of current implementation. Shopify screenshots are reference observations, not LetBuyy behavior or mandatory scope.

## 1. Conclusion

Web and Flutter share important backend endpoints, but they do **not** currently implement one consistent journey. The strongest defects are the missing web MFA challenge, weaker Flutter signup validation, failure-to-empty routing, unverified native session fallback, outage-driven native logout, and incompatible store-creation completion/recovery behavior.

Do not solve this with another identity system. Preserve the Constitution's Accounts issuer boundary, Gateway enforcement, canonical shared contracts and `sites` ownership. Complete the existing systems under AUTH-R1, WIN-R4, ARCH-R17 and TEST-R5.

## 2. Current flow map

### Browser

1. Merchant unauthenticated entry hands off to Accounts. Accounts has remembered-account lookup, email-first login and store selection surfaces.
2. `/login` asks `/api/auth/lookup` whether the email exists and has a password.
3. Existing password account: reveal password, obtain Turnstile proof, submit `/api/auth/login`.
4. Existing passwordless account: enter `/set-password`; new account: enter `/signup`.
5. Signup requests email OTP, verifies OTP, receives a password-set intent cookie, then asks for a password. Setting the password creates a session.
6. Login determines zero / one / multiple stores, routing to onboarding / dashboard / store selection respectively. Explicit approved return context can take precedence in the browser.
7. Web onboarding collects site type, store details and survey answers, with a server-backed draft and final review.
8. Store creation creates a **draft**, attempts draft completion and a store-created email, then opens Merchant plan selection. It does not publish from this page.
9. Password recovery sends an email link; the reset commits through the canonical backend and returns to normal login, preserving enrolled MFA as a requirement.

### Flutter

1. Startup waits for stored-session restoration before `runApp`.
2. One login screen switches between sign-in and signup modes. It does not perform the same email-first lookup sequence as web.
3. Signup collects password and confirmation **before** requesting OTP. The password is carried in navigation arguments to the OTP screen.
4. OTP verification obtains the same password-set intent, then native code submits the previously collected password to `/api/auth/set-password`.
5. Native login submits to the same Accounts login route, with a code-entry retry when MFA is required.
6. A valid signed-in actor triggers membership discovery. StoreContext chooses the saved store if available, otherwise the first returned store; no-store discovery opens the wizard.
7. The wizard has seven steps: business stage, sales channels, product type, category, store name, subdomain and theme.
8. Native creation uses a persisted, actor-scoped idempotency key, creates the draft, immediately requests publication, adopts the resulting store and shows the published screen.
9. Native forgot-password requests the same email reset. The inspected app has no corresponding reset-link receiver to complete the email journey back inside Flutter.

## 3. Journey parity matrix

| Area | Browser | Flutter | Assessment |
|---|---|---|---|
| Identity authority | Accounts APIs | Same Accounts APIs through native HTTP | Shared authority; client protocol differs |
| Login entry | Email lookup, then password | Combined password form | Intentional design difference possible; errors currently diverge |
| Wrong password | Error on login | Certain credential errors switch to signup | Defect |
| Signup password timing | After email proof | Before email proof | Different state machines |
| Password rules | Canonical server rules; web UI mostly mirrors them | UI only checks length, letter and number | Defect |
| MFA login | API supports challenge; page lacks code UI | Code-entry retry exists | Blocking web defect |
| Recovery codes at login | No login recovery-code branch found | No login recovery-code branch found | Shared recovery gap |
| Email reset | Browser token flow | Email request; browser completion | Native handoff incomplete |
| Multiple stores | Selection page | Saved store or first store | Product behavior mismatch |
| Onboarding questions | Three-step web draft | Seven-step mobile wizard | Different contracts and semantics |
| Draft persistence | Server web draft | Mobile progress plus local pending-create request | No shared resume contract established |
| Store create retry | No create idempotency forwarded | Actor-scoped stable create key | Web gap; native replay obstacle |
| Completion | Draft then plan selection | Create then publish request | Major lifecycle mismatch |
| Google / Apple | Unavailable | Unavailable / coming soon | Shared unavailable capability |
| Passkeys | No completed login flow established | No completed login flow established | Deferred capability, not a regression |
| Inactivity reactivation | No equivalent checkpoint identified | No equivalent checkpoint identified | Proposal only |

## 4. Findings and evidence

Severity below describes repair priority, not a claim of a reproduced exploit. “Confirmed” means the source paths establish the behavior; runtime consequences still need the stated journeys.

### F01 — High: enrolled MFA can block browser login

The Accounts login API accepts `mfaCode` and returns `mfaRequired`. Gateway enforces active Merchant TOTP factors. Browser login sends email/password/challenge only and handles the response as a general error; it has no MFA challenge state or input. Flutter has a typed MFA-required exception and retry UI.

Evidence: `apps/platform/identity/src/app/login/page.tsx:155`; `apps/platform/identity/src/app/api/auth/login/route.ts`; `services/api-gateway/src/routes/auth.ts:148`; `apps/merchant/mobile/lib/screens/auth/login_screen.dart:294`; `apps/merchant/mobile/lib/services/store_auth_service.dart:171`.

Acceptance: enroll through either client, sign out, successfully log into both clients with a current code; reject absent, invalid and replayed proofs as appropriate. No session before completion.

### F02 — High: Flutter signup accepts passwords the server rejects

Canonical `PasswordSchema` requires 8–128 characters, uppercase, lowercase, a number and a special character. Flutter signup checks minimum length, a letter and a number. A value such as `password1` passes native validation and fails canonical password setting after the merchant has already entered their email OTP. This creates a recovery trap in the OTP step.

Evidence: `packages/auth-core/src/index.ts:8`; `apps/merchant/mobile/lib/screens/auth/login_screen.dart:518`; `apps/merchant/mobile/lib/services/store_auth_service.dart:287`; `apps/merchant/mobile/lib/screens/auth/otp_screen.dart`.

Web signup also manually mirrors rules instead of deriving all constraints; explicitly cover the server maximum in UI tests. Native should implement the canonical published policy, not another policy authority.

### F03 — High: native credential failure can become signup

The native login handler matches `invalid login`, `user not found` or `invalid_credentials`, switches `_isSignUpMode` to true and clears the error. An existing account with an incorrect password can be told to register; the signup API then rejects an already verified account with 409.

Evidence: `apps/merchant/mobile/lib/screens/auth/login_screen.dart:275`; `apps/platform/identity/src/app/api/auth/signup/route.ts:99`.

Acceptance: incorrect password stays on login with a safe error and recovery action; only explicit signup intent enters registration.

### F04 — High: web lookup errors become nonexistent accounts

Browser email continuation parses lookup JSON without testing `res.ok`. A rate-limit or service-error payload has no `exists` field, so the final branch sends the merchant to signup.

Evidence: `apps/platform/identity/src/app/login/page.tsx:132`; `apps/platform/identity/src/app/api/auth/lookup/route.ts`.

Acceptance: 429, 503, malformed response and network failure remain retryable lookup errors; none implies account absence.

### F05 — High: failed store discovery becomes onboarding on web

After authentication, the login route substitutes an empty array when `/stores` fails. A merchant with stores can therefore be directed to create another one during an upstream outage. Account switching has a similar failure-to-no-store fallback. Flutter StoreContext correctly distinguishes failed discovery from a successful empty list.

Evidence: `apps/platform/identity/src/app/api/auth/login/route.ts:150`; `apps/platform/identity/src/app/api/auth/switch/route.ts:139`; `apps/merchant/mobile/lib/app/store_context.dart:113`; `apps/merchant/mobile/test/store_session_boundary_test.dart`.

Acceptance: successful-empty alone means onboarding. Preserve the authenticated session while presenting a discovery error and deliberate retry.

### F06 — High: native login may persist an actorless session

After receiving a session cookie, native login and password setup fall back to `MerchantSessionUser(id: '', email: ...)` when authoritative session readback fails. The login path persists this and announces signed-in state. StoreContext subsequently rejects an empty actor ID. This is a contradictory partial login, not evidence of privileged backend access.

Evidence: `apps/merchant/mobile/lib/services/store_auth_service.dart:204`, `:308`; `apps/merchant/mobile/lib/app/store_context.dart:113`.

Acceptance: session readback failure yields an explicit pending/error state; never fabricate a user or emit signed-in before validating the actor.

### F07 — High: session outage, expiry and startup waiting are conflated

Accounts `/api/auth/session` converts upstream errors to `{authenticated:false}`. Native validation returns null for unsuccessful reads and exceptions; restore/refresh clears credentials on null. A transient failure can therefore force logout. Identity calls in the inspected native service have no explicit deadline, while startup awaits restoration before rendering the app.

Evidence: `apps/platform/identity/src/app/api/auth/session/route.ts:13`; `apps/merchant/mobile/lib/services/store_auth_service.dart:139`, `:362`, `:479`; `apps/merchant/mobile/lib/main.dart:192`.

Acceptance: distinguish invalid/revoked credentials from unavailable verification; render a bounded startup/retry state without granting offline privilege or destroying recoverable credentials on a transient error.

### F08 — High: creation has different lifecycle meaning

Web creates a draft and redirects to plan selection. Native immediately calls `publishStore`, then shows “Your store is published!”. Gateway create initializes draft state and publish performs its own admission. The native journey has no equivalent plan-selection step here.

Evidence: `apps/platform/identity/src/app/onboarding/page.tsx:474`; `apps/merchant/mobile/lib/screens/wizard/create_store_wizard.dart:531`; `services/api-gateway/src/routes/stores.ts:873`, `:1025`; `apps/merchant/mobile/lib/screens/wizard/store_published_screen.dart`.

This proves different client intent. It does **not** prove a live billing bypass: publish authorization, entitlement middleware, actual runtime configuration and resulting public reachability must be exercised before that conclusion.

### F09 — High: web create does not forward a stable create key

Web submits `attemptId`, but the Accounts create-store route does not forward a creation idempotency key to `/stores`. Its onboarding-completion request has a separate key, which cannot make the earlier store mutation replay-safe. Gateway already supports store creation replay keys; native uses them.

Evidence: `apps/platform/identity/src/app/api/auth/create-store/route.ts`; `services/api-gateway/src/routes/stores.ts:752`; `apps/merchant/mobile/lib/screens/wizard/create_store_wizard.dart:420`.

Acceptance: double submit, response loss and retry resolve to the same created site with authoritative readback, rather than a duplicate or confusing subdomain conflict.

### F10 — High: native pending-create recovery can block its own replay

Pending create persists request/key under the current actor. On restart, the wizard restores the request, checks subdomain availability, and requires `_isSubdomainAvailable` before submitting. If the original create committed but its response was lost, that merchant's own subdomain is now taken and can prevent reaching the idempotent replay. The saved state does not restore `_createdDraft` itself.

Evidence: `apps/merchant/mobile/lib/screens/wizard/create_store_wizard.dart:68`, `:367`, `:470`, `:531`.

Conditional fault-path consequence; not reproduced with a live site in this audit. Actor scoping is present and should be preserved. Acceptance must inject create-success/response-loss and publish-failure/restart, then recover the original site without requiring a new subdomain.

### F11 — Medium: onboarding answers do not share a semantic contract

Web uses `template_config.survey.industry`; native uses `template_config.onboarding.category`, business type, channels and product type. The inspected Gateway industry resolver reads `template_config.industry` or `survey.industry`, not native category. Consequently native category does not feed this industry-based Experience selection. First-party design paths have their own branch; do not claim every theme ignores all native answers.

Web and mobile also save through distinct `/onboarding/web-draft` and `/onboarding/mobile-progress` contracts. There is no established cross-client translation/resume behavior. Native survey-save errors are swallowed while the wizard continues.

Evidence: `services/api-gateway/src/routes/stores.ts:847`; `services/api-gateway/src/routes/onboarding.ts`; `apps/merchant/mobile/lib/screens/wizard/create_store_wizard.dart:329`, `:345`; `apps/platform/identity/src/app/api/auth/create-store/route.ts`.

### F12 — Medium: recovery has an incomplete cross-client continuation

Both clients request reset email from Accounts. Browser reset uses a token-bound backend operation and requires normal login afterward. Native has no inspected Android/iOS/reset-route receiver to bring the completed journey back into Flutter; `updatePassword` explicitly directs callers to Identity reset. Browser reset returns `/login` and the forgot-password link drops the original return context.

Evidence: `apps/platform/identity/src/app/api/auth/reset-password/route.ts`; `apps/platform/identity/src/app/forgot-password/page.tsx:109`; `apps/platform/identity/src/app/login/page.tsx:353`; `apps/merchant/mobile/lib/services/store_auth_service.dart:315`; native manifests and app routing.

Browser completion can be a valid product decision, but it needs explicit instructions and a safe return-to-app/login continuation. Password reset must not silently satisfy MFA.

### F13 — Medium: recovery codes cannot complete ordinary login

Security management supports recovery codes for disabling an enrolled factor. The inspected ordinary login enforcement verifies TOTP only, and native login requests an authenticator code. No login recovery-code branch was identified. A merchant who loses their authenticator may have recovery codes but cannot reach the authenticated management screen needed to use them.

Evidence: `services/api-gateway/src/routes/auth.ts:148`; `apps/merchant/web/src/components/security/useMerchantTotp.ts:90`; `apps/merchant/mobile/lib/services/two_factor_service.dart`.

Acceptance requires an explicitly authorized recovery contract, one-use consumption, throttling and session issuance after complete proof. Do not weaken MFA to work around missing UI.

### F14 — Security review: remembered-account switching has different proof semantics

The switch endpoint requires a valid current session plus the target email in the signed remembered-account cookie, then creates the target session without the normal password/TOTP authentication branch. It destroys the current session before resolving and creating the target; target lookup failure can also strand the user.

Evidence: `apps/platform/identity/src/app/api/auth/switch/route.ts:69` onward. Existing tests establish selected guards, not complete target-MFA or freshness behavior.

Review target-account proof freshness, revocation, MFA enrollment after account remembrance and failure atomicity. The signed cookie/current-session guards mean this must not be described as an unauthenticated takeover based only on this audit.

### F15 — Medium: native auth transport and challenge lifecycle are independently implemented

Native maintains a hand-built cookie jar and CSRF acquisition, including a synthesized double-submit token fallback; browser uses cookie renewal through `getAuthHeaders`. Native `_clearSession` clears secure-storage session fields but not the in-memory Identity cookie map. Native login and OTP screens also own embedded/fullscreen Turnstile paths instead of sharing the browser lifecycle contract.

Evidence: `apps/merchant/mobile/lib/services/store_auth_service.dart:391`, `:437`, `:525`, `:572`; `apps/platform/identity/src/lib/csrf-client.ts`; `apps/merchant/mobile/lib/screens/auth/login_screen.dart:346`, `:1540`.

These are protocol-maintenance and recovery risks. They are not a demonstrated CSRF bypass or bot bypass. Test expiry, challenge reuse, cancellation, resend, retry and account changes. A “quiet” challenge still must fail closed when verification fails.

### F16 — Medium: commercial copy and setup completion are not consistently sourced

Web onboarding includes literal Founding Program / ₹199 language; native creation completion follows publication. Displayed commercial terms need the accepted backend offer contract, and each client must read the resulting subscription/site/setup state rather than infer it from having reached the last step.

Evidence: `apps/platform/identity/src/app/onboarding/page.tsx:52`; native wizard and published screen above. This audit did not verify current live commercial terms.

## 5. Existing strengths to preserve

- OTP verification creates a server-bound password-set intent; callers do not select the target account merely by sending an email to password setting.
- Reset commits through the canonical reset contract, clears the session cookie and requires normal sign-in rather than treating email access as MFA.
- Account switching already has current-session, signed-account, CSRF and rate-limit guards; do not remove them.
- Flutter StoreContext has actor/epoch fencing, membership discovery and failure-versus-empty tests.
- Native pending-create keys are actor-scoped and Gateway already has create replay support.
- Both clients have security-management code for enroll, verify, recovery codes and disable. The missing browser login challenge must be completed against it.
- Social controls and the inspected OAuth callback are unavailable/fail-closed; there is no evidence here of a functioning Google provider journey.

## 6. Local verification performed

| Check | Result | Limits |
|---|---|---|
| Identity `auth-flow`, `auth-switch-guard`, `csrf-client` via Node + tsx | 18 tests passed; 0 failed | Selected source/local tests; not real email/provider/browser journeys |
| Flutter `merchant_mfa_login_test`, `store_session_boundary_test` via `flutter test --no-pub` | 12 tests passed | Mock HTTP and state tests; not installed-device acceptance |

Commands:

```sh
# Working directory: apps/platform/identity
node --import tsx --test src/__tests__/auth-flow.test.ts src/__tests__/auth-switch-guard.test.ts src/__tests__/csrf-client.test.ts

# Working directory: apps/merchant/mobile
flutter test --no-pub test/merchant_mfa_login_test.dart test/store_session_boundary_test.dart
```

Session-local logs: `/private/tmp/letbuyy-auth-parity-web-20261102.log` and `/private/tmp/letbuyy-auth-parity-mobile-20261102.log`. Flutter initially could not update its SDK cache under the sandbox; the authorized retry ran and passed. No app changes were necessary to run these tests.

The native MFA mock suite permits a successful login response followed by unavailable session readback; passing this suite does not disprove F06. Green selected tests do not establish complete parity.

## 7. Required verification before a repaired flow can be accepted

1. New email: proof request/delivery, wrong/expired/reused OTP, resend, password-policy parity, abandoned/restarted setup, session readback.
2. Existing email: wrong password remains login; passwordless/unverified entry resumes correctly; lookup 429/503 never implies new account.
3. MFA: both clients with active factor, invalid/current/reused codes, lost authenticator, recovery code, reset-password followed by MFA, remembered-account switch after MFA enrollment/revocation.
4. Sessions: rotated cookies, invalid/revoked token, transient 503/offline, bounded startup, logout-server failure, actor switch while requests are in flight.
5. Store discovery: successful zero/one/many memberships, saved inaccessible store, staff invitation, pagination and discovery failure.
6. Onboarding: supported questions, equivalent semantic answers, save failure, server/local resume and deliberate cross-client continuation.
7. Creation: double click, response loss after commit, same-key replay, payload change, domain conflict, publish failure, restart and original-site readback.
8. Entitlements: actual offer/trial/plan state, publication admission and public site reachability; no inferred billing bypass or success from screen labels.
9. Browser/device: signed-in desktop/mobile web and Android/iOS, keyboard/autofill/OTP accessibility, slow network, challenge expiry/cancellation and real reset email handoff.

Provider email delivery, hosted sign-in, real challenge verification, database-backed fault injection and Android/iOS installed-device journeys remain unverified in this audit. No production-ready verdict is supported.

## 8. Repair order for a separately authorized implementation

1. Unify authentication outcome semantics and complete browser MFA; align native password policy and credential-error handling.
2. Remove false-empty discovery and fabricated session success; distinguish outages from invalid sessions and bound startup requests.
3. Agree one create/draft/plan/publish lifecycle; reuse Gateway idempotency and add authoritative recovery before availability checks.
4. Align onboarding answer semantics and durable resume; preserve platform-specific presentation where useful.
5. Complete recovery continuation and evaluate target-account switch proof against MFA/revocation.
6. Verify the journeys above on both clients, then document source, provider, database and device gates separately.

No new runtime, parallel authentication service, new `stores` table, production credential capture, or automatic expansion into deferred passkeys/social providers is implied by this repair order.
