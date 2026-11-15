# Native human-verification recovery — 1 November 2026

Source `8be82e4afb63c388c02bfd9f8392c259e7711fd9`. This is a client presentation/lifetime repair on the two existing native verification surfaces. Identity remains the sole issuer; existing BFF/Identity verification, CSRF, MFA, replay, credential and permission enforcement are unchanged. No password or token was written into source, commands, logs or evidence. No credential, reset, email, membership, financial or other production business mutation was submitted.

## Observed problem and implemented behavior

The task emulator initially showed security-check unavailable. Allowlisted diagnostics from source `9bc3b34fc` observed public provider code `600010`, clock skew zero and Android WebView `124.0.6367.219`. These observations alone do not establish a configuration/browser root cause. A host-side public BFF health read returned 403, so its configuration flags remain unobserved.

The client treated every WebView resource error as a terminal challenge error. [Cloudflare's WebView troubleshooting](https://developers.cloudflare.com/cloudflare-challenges/troubleshooting/challenge-solve-issues/) describes expected failing DNS probes and advises against treating those subresource errors as fatal. The repaired client ignores explicitly non-main-frame resource failures. Main/unknown-frame and actual widget/script failures still clear proof and show a retry state. No network/origin allowlist, user agent, provider key, server check or security setting was weakened.

Previously, a failed password request could leave the already-consumed inline proof selected for another attempt. A shared ephemeral attempt state now consumes proof before an auth request, clears it on real failure/expiry/malformed callbacks and fences old callbacks after retry, consumption or disposal. A dedicated screen cannot return a proof twice or pop an underlying route after dismissal. The two surfaces share one escaped HTML renderer using the supported normal widget size and existing light/dark theme. A separate Retry control restarts verification without submitting credentials. Missing configuration stays unavailable.

The first source edit accidentally removed the adjacent password-reset declaration. Analysis caught both missing-symbol errors before qualification. It was restored; its complete declaration is byte-for-byte identical to `9bc3b34fc` (SHA-256 `877a6b826879ce8bd8b63988c290ddbffeeb1f1267fd2ed73008e4ddde21b419`). Reset/auth regressions pass. No deletion was retained.

## Qualified evidence

- Full active Flutter **641/641**, clean analysis. Eleven new checks cover single consumption across failed/successful attempts, stale callbacks, nonfatal probes, actual/unknown-frame failure, expiry, malformed proof and single completion. The exact generated JavaScript executes in a bounded Node VM fixture and emits the expected token/error/expiry channels; this is local bridge evidence, not provider acceptance.
- Existing auth/MFA/reset/service regressions **216/216**; composed with the first ten helper checks **226/226**, and all eleven are included in the final 641. There is no double-counting of these subsets.
- Exact-source governance **114 pass / zero fail/blocked/skip / one report-only not-applicable**. Server, shared packages, database and Merchant web source are unchanged from `9bc3b34fc`; its Gateway 1,970, shared models 60, web 218, BFF 24 and owned PostgreSQL 34 receipts retain their own source identity. They were not rerun or relabelled as new authentication evidence.
- Arm64 debug APK **148,988,532 bytes**, SHA-256 `86051ec64636eb76bf535e26f4f672331447d039793b8446858fe53fdb69b236`; installed bytes match. Configuration targets production endpoints; signing is debug.
- On the owned Android 15/API35 emulator, the new Retry control was actually tapped. Error cleared and the real human-verification control was offered. The user had explicitly authorized completing this pending check; the checkbox was tapped once and the native UI showed **Security check passed**. No opaque token or private screen text was retained.

The last step proves frontend widget/callback completion. **Server Siteverify acceptance, credential submission, Merchant session creation and authenticated warehouse acceptance were not attempted.** The computer-control surface reports the Mac is locked; manual unlock is required for secure interactive credential input. The user was asked to unlock while independent source work continues. No password was routed through ADB or a command line.

After this observation, only task AVD `LetBuyy_Merchant_Parity` was restarted in visible mode for secure input after unlock. Its data and installed APK were preserved; shared ADB/other devices were untouched. Console remains `emulator-5580`; the separate ADB server is port15038 / `127.0.0.1:5581`. The earlier in-memory proof is not carried across that restart.

Receipts: `/private/tmp/letbuyy-native-verification-governance.json`, `letbuyy-native-verification-android-artifact.json`, `letbuyy-native-verification-android-read-acceptance.json`, `letbuyy-merchant-turnstile-diagnostic-read.json` and corresponding test/build logs. No hosted migration, deployment, release signing, publication, provider payment or all-122 acceptance follows from this checkpoint.

Next: secure authorized sign-in and read-only owner/device checks after unlock; complete paged authorized warehouse selectors, multi-line native creation, app filters and durable location/supplier creation recovery; continue the rest of the 122-item inventory and its cross-client, provider, performance and release gates.
