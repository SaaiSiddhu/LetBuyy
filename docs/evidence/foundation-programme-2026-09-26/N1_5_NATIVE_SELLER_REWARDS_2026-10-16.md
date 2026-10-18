# N1.5 native seller rewards — 16 October 2026

The Android product page previously had no route to the existing canonical buyer loyalty balance/history. A valid widget reproduction observed zero `Seller rewards` controls. This slice adds that entry point, a buyer-session-bound Dart transport and a read-only seller-rewards screen over the existing Gateway endpoints and loyalty ledger. It introduces no points writer, merchant programme configuration, rate, redemption or earning policy.

The screen shows seller-specific points, a bounded recent 25-entry activity window, not-enrolled, enrolled zero and paused states. Outage and malformed responses are errors rather than invented empty/zero balances. Ledger integer strings retain precision; unsafe numeric values are refused. The buyer is resolved solely from the canonical session header. Seller path selection grants no buyer authority, and no client-supplied buyer/customer identifier is sent.

Private records disappear from the visible tree when the current session changes. Requests capture session/generation; stale successes/errors cannot replace another buyer's data. Seller changes also invalidate pending reads. Retry is single-flight, and late completions after disposal cannot publish. Existing profile, orders, guest cart/wishlist and privacy flows retain their owners.

Evidence under `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.5`:

- `native-rewards-entrypoint-red-executable.log`: valid missing-control failure on the previous product page. The earlier `native-rewards-entrypoint-red.log` is an SDK sandbox-access diagnostic, not a behavioral reproduction.
- `native-rewards-sdk-current.log`: seven transport/precision/denial checks pass.
- `native-rewards-widget-current.log`: retained first run, ten pass/one assertion ambiguity because a balance and ledger row both say 17 points. The corrected assertion targets the balance key.
- `native-rewards-widget-corrected.log`: 13 checks pass, including the preserved product-detail cases, account and seller changes, outage/retry, duplicate retry taps and disposal.
- `native-rewards-analysis-current.log`: all eight affected screen/wiring/SDK/test items pass analysis. `native-rewards-gateway-types.log` records the maintained Gateway type check.
- `native-rewards-db-result.json`, run `f2648adc2a6a`: five actual Gateway/PostgREST/PostgreSQL checks pass with no skipped/cancelled/TODO cases and empty owned cleanup. Native buyer sessions alternate A/B/A, ignore forged buyer selectors, retain distinct balances/history, handle absent programmes and read outages, recover and reject revoked sessions. This service-role integration is not a replacement for RLS or normal device authentication.
- `native-rewards-source-changes.json` and the before directory preserve the exact implementation boundary. Baseline evidence remains separately bound to immutable manifest 10446aa2.

The current ARM64 debug APK is `2b5f05d7ed93278b045799224cd5ba39133687c29f266292c783f9befc963012`, compiled from the immutable build-source manifest `6e45ff70` and installed-byte verified on the fresh API-35 ARM64 AVD `letbuyy_rewards_445e54e2a0`. The dedicated device fixture was subsequently source-bound by manifest `26e03ae0`; no product source changed between build and proof.

Actual device run `1a8610ce5a53` passed 1/1 with no skipped/cancelled/TODO cases in 746.5 seconds including setup/cleanup. Its ten independently acknowledged stages cover two normal browser registrations/consents/callbacks, A's 17-point balance/history, an app-process restart, an actual PostgREST history-read outage (three injected failures), actionable error without stale/zero points, Retry recovery, logout, B's separate 29-point balance/history and B's process restart. The run recorded 85 actual backend requests. Its synthetic display ledger rows were provisioned only after each normal registration; no buyer token, cookie or callback was injected. Official CAPTCHA test transport was used; provider inbox delivery is not claimed.

This was a supervised journey. The first controller overshot the seller card; inspection found the existing button. The next controller tapped the partially clipped button behind the fixed cart bar. The corrected controller requires a fully visible button. Both controller failures, scripts, screenshots and the successful continuation are retained. The same app, registered accounts and owned database were preserved; no acceptance assertion or product source was changed to recover. This is not an unattended-CI verdict.

`native-rewards-device-result.json` records empty owned PostgreSQL/container/network/volume cleanup. The exact private emulator was then stopped with its verified AVD/PID/serial; the stopped receipt and screenshots/XML, driver logs, normal-consent records, stage acknowledgements and backend observations are saved with hashes in `native-rewards-device-evidence-1a8610ce5a53/manifest.json`. Shared ADB, existing AVDs, restored Supabase and Edynox services were preserved.

Implementation, local integration and named Android device checks are verified for this read slice. Synthetic owned ledger entries used for display/isolation do not certify earning, checkout, refunds or merchant configuration. Physical devices/distribution, provider delivery, hosted acceptance, broader N1.5 review/loyalty lifecycle and the N1 phase remain open.
