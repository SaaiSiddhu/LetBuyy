# Accounts product journeys and in-app authentication UX

Status: Proposed. Applies to the hosted Merchant account experience described in [the overview](README.md). No runtime behavior is changed by this document.

## 1. Native entry and browser presentation

The signed-out Flutter screen contains the existing LetBuyy logo, a concise Merchant description, **Log in** as the primary action and **Sign up** as the secondary action. Necessary help, privacy and legal links remain secondary. There are no native email/password fields, provider credential forms, OTP fields, password-strength rules or embedded Turnstile widgets on this entry screen.

On a tap, disable duplicate submission, prepare the bounded request and open the in-app authentication browser. Use a short “Opening secure sign-in…” state with an accessible retry if opening fails. The user should see `accounts.letbuyy.com` in trusted browser UI. The native app must not imitate or hide that UI.

Android uses a Custom Tab with approved brand chrome and a clear close/back affordance. iOS uses `ASWebAuthenticationSession`, with its required presentation anchor and platform-owned controls. Native authentication should feel connected to the Merchant app without promising identical chrome across Android browsers and iOS versions. See [Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs) and [Apple authentication sessions](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession).

Opening authentication in a full separate browser app is an explicit compatibility fallback only if the in-app system browser is unavailable. Do not silently switch to a Flutter-owned credential WebView to satisfy this fallback.

## 2. Shared Accounts shell

Extend existing shared UI, `BrandLogo`, Accounts inputs, buttons, alert/banner system and `@letbuyy/ui` tokens. Preserve the purple/neutral LetBuyy palette, readable surfaces, restrained rounded corners and shared typography. Do not create an Accounts-only token source or duplicate the Merchant sidebar around authentication.

### Layout proposal

| Surface | Behavior |
|---|---|
| Desktop web | Focused form panel, restrained maximum width, useful surrounding space |
| Phone in-app browser | Single column, safe-area spacing, keyboard-visible primary action and natural vertical scrolling |
| Tablet | Compact centered form; multi-pane layouts only where they improve store/security management |
| Error or recovery | Same shell and position; preserve safe fields and explain the next action |
| Busy state | One pending action, stable dimensions, meaningful status text and finite network waiting |

Only one primary action appears per task. Keep secondary actions close to the field they affect. Errors must not move focus unexpectedly or clear passwords on every harmless UI interaction; passwords still stay out of durable storage and navigation arguments.

Use accessible labels, password-manager/autofill attributes, paste support, show/hide controls, correct email/numeric keyboards, focus restoration, error summaries and live announcements. Respect text scaling and reduced motion. Proposed touch-target floor is 44 CSS pixels, with measured WCAG AA contrast and no color-only status. Avoid a small OTP digit grid if it damages paste, autofill or screen-reader behavior.

## 3. Entry intent and existing browser sessions

Login and signup share one continuation engine but preserve their entry intent. “Sign up” must not unexpectedly authenticate a different remembered account and return before the person understands the selected identity.

For a valid recent Accounts session, show a compact **Continue as [account]** state when account choice or device binding needs confirmation. This protects against silently attaching a shared browser's account to the native app. That confirmation happens before final completion; after it, the ordinary return to Flutter is automatic. Always offer Use another account.

A recent session may avoid credential re-entry, but must still satisfy current account status, required MFA, freshness and the requested task. A remembered email/avatar is only a hint; it is not a session or target-account proof. Switching accounts revalidates the target and invalidates pending state belonging to the previous actor.

Neither selecting an email nor an upstream error means a new account should be created. Login failures stay on login; signup remains an explicit user action.

## 4. Login

1. Open the shared Accounts login screen with the native request attached server-side.
2. Enter email or choose an eligible remembered account.
3. Show the appropriate supported credential step, preserving the chosen email and Change email action.
4. Obtain any required managed bot proof and submit once.
5. Resolve required account checkpoints, including enrolled MFA and any approved reactivation rule.
6. Resolve current membership/setup state and complete the initiating request.
7. Automatically return to Flutter, validate the handoff and open the native destination.

Incorrect credentials produce a safe error with Forgot password and explicit Sign up. A throttled or unavailable account lookup remains a retryable error; it must not send the user to registration. Distinguish “unable to check right now” from “you have no stores.”

## 5. Signup

Retain the existing email-first proof model: email entry, verification code, then password setup under the one-use password-set intent. Add or refine profile/name capture only against a real persistence contract. A display name is preferable to mandatory first/last-name assumptions.

The browser collects and validates the password once using the canonical policy and a complete requirement display, including the maximum length. Flutter never receives or retains this password.

Email verification supports paste/autofill, clear expiry, resend eligibility derived from the server, wrong-code feedback and Change email. A refresh resumes the server-backed state or offers a safe restart. Resend behavior must state which older codes remain valid; avoid multiple indistinguishable active challenges.

Handle an existing verified email with a supported sign-in/recovery route, not another principal. An unverified account resumes verification. If a code is consumed but the next operation fails, the user needs a valid resumable password-set intent or an explicit re-verification step; do not trap them on an already-used OTP form.

Required legal acceptance and optional marketing consent are distinct. Store accepted versions through the existing consent owner. Optional marketing consent is not a condition for account access.

After account authentication is complete, automatically return to Flutter. For a newly registered owner with no store, Flutter briefly shows the signed-in no-store state and offers Create store; that action reopens the same hosted Accounts setup without requiring credentials again when the browser session remains valid. This honors automatic return after signup while keeping store creation hosted and separately intentional.

An explicit **Sign up and create a store** journey may be offered later as a compound task, but it must be labeled before entry and represented by an allowed server-side purpose. It must not quietly extend the default Sign up action or withhold the authenticated result behind optional setup questions.

## 6. Required MFA and recovery codes

Accounts displays a real MFA checkpoint when the backend requires it. Use the shared authenticator-code UI with clear retry, expiry and alternate supported recovery actions. Do not issue a normal native handoff before the factor succeeds.

Recovery codes need a complete unauthenticated challenge-resolution contract, not a link into a management page the locked-out merchant cannot access. Consume a recovery code once, revoke or replace affected proof according to policy, record an audit event and continue the same request only after authorization succeeds.

Account-management enrollment is different from login MFA. Enrollment must verify the new factor before activation, display codes under a one-time acknowledgement flow, and retain a usable recovery route. Disabling or replacing factors requires current proof. Money-operation step-up remains bound to its exact operation/site/amount context; a generic successful login or security review is not approval of a refund or payout.

## 7. Password reset

Forgot password stays within Accounts. The email request uses privacy-preserving messaging and sends through the existing transactional email path. No codes or reset URLs are exposed to Flutter, analytics or documentation.

When the user opens the email on the same device, the reset page may be in the mail app's browser rather than the original authentication surface. The browser screens must still complete safely. The flow can associate a bounded pending return request with the reset intent, but that reference must not itself authorize resetting a password or creating an app session.

After reset, require ordinary sign-in and enrolled MFA. Then automatically return to the initiating app request if it remains valid. If it has expired, restarting login from Flutter uses the newly valid credentials/session without replaying an old callback.

For cross-device reset, complete the password change on that device and tell the person to continue sign-in on their original device. Never send a code that can grant another device a native session without that device's pending PKCE proof. If the original browser notices invalidated session state, restart its login deliberately and preserve only safe context.

## 8. Reactivation and account restrictions

Model the reasons separately: inactivity verification, suspicious sign-in/security checkpoint, administratively restricted account and a store restricted for billing. A password, email code or provider login does not lift every restriction.

If an approved inactivity policy exists, Accounts explains the reason, masks the verified email destination, verifies a fresh purpose-bound code, runs required MFA and automatically returns to Flutter. The threshold, trusted-session exceptions and security-review requirement are policy inputs, not values copied from Shopify.

Until that backend and policy exist, expose no fake Reactivate button or guessed “three months inactive” rule. Use the existing supported verification path and accurately explain the restriction. Lost-email handling must link to an actual supported recovery process; do not fabricate automated identity review.

## 9. Automatic app return

All successful terminal account paths call one continuation resolver. Individual login/signup/reset/MFA handlers must not independently decide to open the web Merchant dashboard when the initiating request belongs to Flutter.

| Completed task | Native result |
|---|---|
| Login | Validate native session, then current store destination |
| Signup | Validate native session; enter existing store or signed-in no-store state |
| Reactivation plus required sign-in/MFA | Validate native session, then permitted destination |
| Password reset | Complete normal sign-in/MFA, then return; reset alone issues no app login |
| Switch account | Replace the app actor only after the target proof and successful new session bootstrap |
| Create store | Return the created site's identity as a hint; read current membership and setup state before opening it |
| Security management | Return to the app's security screen and refresh actual status |
| Session reauthentication | Resume the allowed original task after current authorization is rechecked |

On ordinary success, show only a brief “Returning to LetBuyy…” transition, invoke the exact registered callback and dismiss the browser when the OS bridge delivers completion. Flutter shows “Finishing sign-in…” while it redeems and validates. Do not require a routine Done button or manual code copying.

The OS may require user confirmation, suppress automatic app opening, or deliver a delayed callback. A fallback landing page can show **Return to app** and a safe restart instruction. It must not show a session token, repeatedly fire links, assume JavaScript can always close the browser, or redirect to an unvalidated scheme. This is exceptional recovery, not the main successful path.

An invalid native request stays on a safe Accounts error page. Do not fall through to `return_to`, an arbitrary web dashboard or a supplied callback URL.

## 10. Store selection and first-store creation

Authentication and store creation remain separate durable operations. Signup creates an identity; creating a store creates a `sites` record and owner membership. Neither action publishes a storefront or proves billing enrollment.

### Membership resolution

| Server result | UX |
|---|---|
| One accessible store | Open it after current checks |
| Several stores with an authorized intended store | Use the intended store |
| Several stores with no valid selection | Show one shared selection model; presentation may be native after login |
| Successful zero stores; creation allowed | Signed-in empty state with Create store |
| Outstanding staff invitation | Resume invitation acceptance under its own bound proof and fresh membership check |
| Discovery unavailable | Retryable error; no create-store inference |
| Access removed | Explain loss of access; show other authorized stores or a safe account action |

Native may render store selection using authorized API data. It must not grow a second account setup wizard. Creating another store from an existing native account opens a new bounded Accounts `create_store` request and returns automatically after creation.

### Hosted create-store sequence

1. Verify the signed-in actor can create a site; show the active account and a safe account-change action.
2. Collect a store name and validate the subdomain through Gateway.
3. Offer supported, optional business questions with Back and Skip. Only collect an answer if a named backend or setup action consumes it.
4. Show a short review and the actual applicable offer/plan information, if relevant.
5. Submit the stable creation intent to Gateway once; recover ambiguous outcomes by original intent readback.
6. Confirm the actual draft site and owner membership; save setup completion separately.
7. Automatically return to Flutter or the approved web destination.

Keep template/theme defaults in the accepted catalog contract. The native wizard's `minimal_modern` literal must not become the new default merely because it exists. Read current available themes and preserve the accepted included-theme behavior.

Publishing is an explicit later Merchant action with its own readiness/entitlement checks. No auto-publish in the new auth/create flow. If a plan is mandatory for a particular next action, explain that restriction; if an offer is optional, skipping it returns to the permitted draft setup state. Never charge merely because signup succeeded or an optional offer was viewed.

Store-created email failure does not undo a committed store. Show the durable store result, record/retry delivery separately and do not send a false published-store claim.

## 11. Onboarding questions

Use one shared answer contract and taxonomy. Reconcile web industry with mobile category instead of preserving incompatible shapes indefinitely. Recommended question groups are business stage, supported sales channels, supported product model and industry; the final list must map to actual setup capabilities.

Do not advertise live dropshipping, POS, social selling or digital-product integrations merely because a questionnaire option exists. Label preference-only collection accurately. Avoid collecting irrelevant sales volume or personal data in the initial release.

Persist progress server-side by actor and task, with a version and visible save state. A local native pending request contains transport recovery metadata only. A response loss must never force the merchant to invent a different subdomain for a store that already exists.

Optional questions must not block automatic return after the account task is done. If creation is the explicit task, allow Skip for personalization and finish creation with supported defaults.

## 12. Security center and account features

Accounts becomes the consistent home for account-owned settings reached from either client: profile, verified email, credential change/reset, MFA enrollment/recovery, active sessions and revoke actions. Reuse existing backend operations; mark missing capabilities unavailable until complete.

Native opens a purpose-bound Accounts management flow from its Profile/Security action and refreshes status on automatic return. The app cannot rely on a callback saying `mfa_enabled=true`; it must reread the server. Store staff roles and operation permissions remain in Gateway/Merchant, not in an account profile form.

A browser page authenticated as a different person must not manage the app's current actor without explicit account switching. Show enough account identity to avoid mistakes; avoid exposing personal or store data before authentication.

## 13. Provider and future methods

Google and Apple are Accounts-owned optional methods. Configure and qualify their callbacks, verified subject linking, cancellation, account linking, reactivation and MFA before displaying buttons. Native must not retain direct provider login as a second entry path after the hosted cutover.

Passkeys and the general OIDC provider stay deferred under current governance. Document the future seam and accessibility needs but do not make them dependencies of this release. No new WhatsApp/phone login, enterprise SSO or third-party application ecosystem is implied by “Shopify-level UX.”

## 14. Recovery UX matrix

| Condition | Required user experience |
|---|---|
| User closes browser | Return to entry/current screen; no error claiming bad credentials; explicit retry |
| Request expires | Clear explanation and restart from app; retain safe backend draft |
| Network fails before browser opens | Retry opening once by deliberate action; no hidden credential mutation |
| Network fails after code exchange commits | Treat as unknown; reconcile securely or restart through Accounts; never replay a used code for another session |
| App killed during browser flow | Restore encrypted pending state; handle valid cold-start callback or restart if state is lost |
| Second sign-in started | Latest request replaces/cancels previous; stale callback cannot replace the actor |
| Link reaches different device | No matching verifier means no native login; explain same-device return |
| Browser remains open | Safe Return to app recovery; no timer loop or repeated session creation |
| User returns before completion | Remain waiting/cancelled based on real task state; no optimistic signed-in state |
| Bootstrap service unavailable | Show bounded authenticated-setup retry; no empty actor, guessed store or forced signup |
| Store mutation outcome unknown | Reconcile original create intent; no new site or new subdomain until resolved |

## 15. Copy and quality bar

Use plain headings such as Log in, Create account, Check your email, Enter your authenticator code, Create your store and Returning to LetBuyy. Avoid technical implementation terms such as PKCE, token exchange or GUC in normal merchant screens.

Success copy names the completed operation: account verified, password changed, draft store created or store published. Do not use a generic success banner to blur them. Keep security reasons concise and provide a real next action. All supported languages use shared messages and layout tests, not platform-local hardcoded password or commercial text.
