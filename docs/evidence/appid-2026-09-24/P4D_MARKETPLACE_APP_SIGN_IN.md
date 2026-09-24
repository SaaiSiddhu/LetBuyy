# The marketplace app signs buyers in with their LetBuyy account (APPID-P4d, 2026-09-24)

What APPID-P4d built and proved, on branch `letbuyy/appid-p4d-marketplace-mobile` (`dbdd192b`
migration 259, `2d6ae00b` identity-platform and gateway, `db25638e` the Dart protocol, `d4bd403c` the
app, `60df60df` one more protocol test). Gate results are in the phase's `EXECUTION_LEDGER.md` row.
Deployment is E-18 in `EXTERNAL_ACTIONS.md`. Nothing here is deployed, and no mobile build was
published. The feature is compiled out of the app unless it is built with
`--dart-define=LETBUYY_BUYER_SIGN_IN=true`.

## What a buyer sees, with the flag on

Profile, under Account Settings: a **LetBuyy account** card with **Sign in with LetBuyy**. The system
browser opens identity-platform, which says where the buyer is going ("Continue to the LetBuyy app").
The buyer signs in or creates an account there and presses Continue. The browser closes back into the
app, which now says "Signed in as …". If the app's existing Firebase account proves the same email
address, the card says that account is linked. The buyer can sign out of LetBuyy on this device.

## Existing support, checked first

Before this phase, identity-platform's first-party code + PKCE flow (APPID-P4b, migration 258) served
one client, the storefront: the database allowed only `letbuyy-storefront`, every code named a site,
and the token endpoint minted only storefront sessions. The app had `url_launcher`, `app_links` and
`crypto` declared but signed in only through Firebase, and `letbuyy_api_client` had no buyer sign-in.
So this phase completes the canonical flow for a native client instead of adding a second one.

## The mobile requirements

| Requirement | What the app does | Proved by |
|---|---|---|
| Identity-hosted sign-in in the system browser, code + PKCE | Android opens a Custom Tab through the app's own intent, never a WebView (url_launcher's in-app mode falls back to one when no Custom Tabs browser exists, so it is not used on Android); iOS uses SFSafariViewController. S256 only; a code without it is never issued. | gateway and identity tests; device runs |
| Validate state | Exactly one `state`, equal to the attempt's in constant time. A callback that fails is ignored and does not spend the attempt. | protocol tests; plant "protocol ignores the state"; device T4 |
| Validate redirect destinations | `com.letbuyy.letbuyy:/oauth/callback`, compared exactly by the database, the gateway, identity-platform and the app. No host lookup is ever made for it. | executable 259; gateway and identity tests; three plants |
| Validate client identity | Client `letbuyy-marketplace-app`. A table constraint ties "has a site" to the storefront client. identity-platform mints by the client the database recorded for the code, never the one the request names. | executable 259; `grantForRedemption` tests; plants |
| Bind the code | The code is redeemed only with the verifier of the attempt that asked for it; any failed redemption burns it. | local stack: another verifier is refused, and the right one then fails too |
| Nonce where required | Not used, deliberately. A nonce binds an OpenID Connect ID token; this flow issues none (the general OIDC provider stays deferred, ART-07). State and PKCE are what RFC 8252 requires. | this record |
| Short-lived, single-use codes | 60 seconds, single use under a row lock (258, unchanged). | local stack: a spent code is refused |
| Platform-protected storage | The attempt and the session are in flutter_secure_storage: EncryptedSharedPreferences under a Keystore key on Android (reset if a restored backup cannot be decrypted), the Keychain with `first_unlock_this_device` on iOS. | device: no preferences file holds a token, key name or verifier in plain text |
| No client secret | None exists. The app is a public client; nothing it ships is a credential. | code |
| Preserve deep links and published identity | `aapt dump badging`: `com.letbuyy.letbuyy`, versionCode 4013, versionName 1.0.10. MainActivity's filters (App Links for `https://letbuyy.com`, `letbuyy://open`) and launch mode are unchanged; a separate activity takes only the new scheme. iOS gains one URL type; the existing three are unchanged. | debug APK manifest dump; `plutil -lint` |
| Cancellation, interruption, expired sessions, app resume | Returning to the app without a callback ends the attempt. An attempt survives the process being killed, and the callback that restarts the app completes it. An ended session (expiry, password reset, sign out everywhere, a disabled account) signs the app out when it starts, or when it resumes more than 15 minutes after the last check. | controller tests; device T2, T3, T6, T7 |

## Firebase (§7)

- **Decisions read first:** D-10 (Firebase leaves in one cutover, after the D-9 areas), FB-3 (17 of the
  24 screens that read the Firebase uid key Firestore with it), D-ONE-IDENTITY (Firebase Auth is
  transitional, with a named retirement gate).
- **Compatibility:** nothing Firebase-dependent changes. The app still signs in with Firebase, and
  every screen still reads the Firebase uid. LetBuyy sign-in is additive and behind the flag.
- **The bridge, `buyer_firebase_links`** (migration 259): *narrow purpose*, a mapping FB-4 needs to move
  each screen's data to the right buyer, granting no access or session; *authority boundaries*, written
  only by `link_buyer_firebase_uid`, which the gateway calls after verifying a Firebase ID token (RS256,
  Google's securetoken keys, project `letbuy-y`, `email_verified`, email/password or Google only) and the
  buyer's session, and which links only when the buyer's verified address equals the Firebase one; *no
  second canonical account*, `buyer_accounts` stays the one buyer and nothing is created or merged;
  *retirement gate*, dropped with the Firebase project at FB-5; *security tests*, below.
- **Stable identity mapping:** a uid maps to one buyer, the first verified owner keeps it, and it is
  never re-pointed; a conflict is refused and audited for a person to resolve.
- **Activation blocker, exactly:** turning this on changes nothing for Firebase-era data until FB-4
  moves each of the 17 Firestore-keyed screens to gateway data keyed by buyer. And a Firebase user who
  signed in by phone, anonymously or with a custom token has no proven email, so the bridge cannot
  link them; linking them needs a verified-phone path, which is an owner decision (D-ONE-BUYER forbids
  matching on an unverified identifier).

## Found on the way

1. **identity-platform ahead of the gateway would have broken storefront sign-in (fixed before
   commit).** The new token endpoint chooses by the client the gateway reports, which an older gateway
   does not send. It now reads a missing client as the storefront, the only client 258 allowed. An app
   code redeemed through an older gateway still gets nothing, because it carries no site.
2. **url_launcher's in-app browser falls back to an embedded WebView** when no browser supports Custom
   Tabs. RFC 8252 forbids that for sign-in, so Android launches its own browser intent.
3. **Signing out on one device is local.** The session is deleted from the device; there is no
   per-token revocation, so a copied token stays valid until it expires (30 days) or the buyer signs out
   everywhere. Recorded, not changed: it is the same model as identity-platform's own session.
4. **A debug build initializes the native Firebase SDK by itself** (its init provider), with analytics
   collection on in the manifest. The emulator runs below may therefore have sent debug heartbeat or
   analytics events to `letbuy-y`, as every debug run of this app does.

## Evidence

| Claim | Check | Result |
|---|---|---|
| 259 on real Postgres: app codes, 258's rules kept, the site constraint, link outcomes, conflict and disabled buyer, grants, rollback restores 258's function byte for byte | `tests/executable/marketplace-app-client-postgres.test.mjs`; plants: app callback unchecked, unverified buyer linked, uid re-pointed | 7 of 7; each plant fails it |
| The gateway serves the app client, the account read and the link as designed | `buyer-authorization-routes`, `buyer-app-routes`, `firebase-id-token` tests; plants: any app callback, no client/site check on redeem, unverified address, any provider, buyer from the body | 24 of 24; each plant fails them |
| identity-platform accepts the app only with its callback and mints by the recorded client | `apps/platform/identity/src/__tests__/buyer-authorization.test.ts`; plants: any callback, app session for any site | 8 of 8; each plant fails it |
| The protocol | `packages/dart/api_client/test/buyer_sign_in_test.dart`; plants: state ignored, host accepted, expiry ignored, redirects followed, http anywhere | 16 of 16; each plant fails it |
| The protocol against the real identity-platform and gateway | `buyer_sign_in_local_stack_test.dart` with `LETBUYY_LOCAL_STACK=1`, Supabase through 259 | 5 of 5, including a spent code, another verifier, and sign out everywhere ending the app session; a forged Firebase token got 400 after the gateway fetched Google's real keys |
| The app's lifecycle and card | `apps/marketplace/mobile/test/buyer_sign_in_controller_test.dart`; plants: attempt spent by a forged callback, no cancel on resume, ended session kept | 18 of 18; each plant fails it |
| Nothing else in the app or client broke | `flutter test` in the app; `dart test` in the client; `flutter analyze` on the whole app | 46 of 46; 32 passed and 6 skipped (the 5 local-stack tests, and the existing "lists real storefront products from the staging gateway"); no issues |
| It runs on Android | Android 15 emulator (a throwaway AVD, deleted afterwards), debug build of a scratch entry point that shows the card without the Firebase sign-in in front of it (not committed), servers reached through `adb reverse`. Chrome showed its first-run screen, which accepts Chrome's terms, so it was not used; the host made the two requests a signed-in browser makes and delivered the callback the way a browser does. | T1 signed in, in the same process and the same MainActivity (no second copy); T2 the app was killed while the browser was open and the callback completed the sign-in in a new process; T3 Back from the browser, "Sign-in was cancelled."; T4 a forged callback was ignored and the real one then completed the attempt; T5 a replayed callback changed nothing; T6 a restart kept the session; T7 after sign out everywhere, the next start signed out |

## Not done

- **iOS was not built or run:** this machine has no CocoaPods. The iOS path (SFSafariViewController and
  the callback as an app link) is written but unexercised.
- **Chrome closing its Custom Tab** on the callback was not observed, because the emulator's Chrome was
  at first run and opened in its own task. The callback activity's flags handle both cases; the
  app-in-front result was observed.
- **A real Firebase ID token** was not used: that needs a user in the live project.
- **The app's own sign-in screens are still Firebase's** until FB-4. A claimed `https` callback (App
  Links) would be stronger than a private-use scheme, and needs E-18's `assetlinks.json`.
