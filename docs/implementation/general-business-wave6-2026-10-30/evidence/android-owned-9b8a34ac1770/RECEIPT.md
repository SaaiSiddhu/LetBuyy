# Owned Android Light-theme, conflict, KYC retry, and private upload — 2026-11-01

This is a **synthetic local Android 35 emulator** run, not a hosted, physical-device, provider, or live-payment certificate. The single installed debug APK had SHA-256 `1d7ebbd2e2474ec805790e97bd0cda6e3731d8acbfeb86c96bc282484c405e80`. The owned fixture checked its installed path and hash before and after the journey.

| Gate | Recorded result |
|---|---|
| Fixture | Run `9b8a34ac1770`: 1/1 passed, 0 failed; disposable Postgres, PostgREST, containers, networks, and volumes cleaned up |
| Native sign-in and light theme | Synthetic owner signed in through Identity, opened Settings, selected Light, and read Store Details at 320×640 |
| Concurrent edit | A server edit landed while the native tagline draft was open. Mobile BFF `PATCH /v1/stores/:id` returned 409; the screen offered Reload; `GET /v1/stores/:id` returned 200 and displayed the newer name without retaining the stale draft |
| Persistent KYC outage | Three Mobile BFF `GET /v1/kyc` calls returned 503, including automatic retries. The screen showed “Verification details are temporarily unavailable” with a Retry control. After removing the controlled outage, a manual Retry returned 200 and restored the document list |
| Private upload | Business PAN used the Android system photo picker and synthetic PNG. Mobile BFF `POST /v1/kyc/documents/upload` returned 201. Exactly one site-bound PAN evidence row with a private object key and one object in the mock private bucket were asserted in owned Postgres |
| Merchant state | The KYC screen showed “In progress” and stated sandbox uploads were not provider reviewed and could not enable live payouts |

Visual readbacks: [Light Settings](./settings-light-r5.png), [Light Store Details](./store-details-light-r5.png), [409 and Reload](./store-details-light-conflict-r5.png), [server value after Reload](./store-details-light-reloaded-r5.png), [KYC error](./kyc-error-light-r5.png), [KYC after Retry](./kyc-recovered-light-r5.png), [pending scan](./kyc-pending-light-r5.png). [Backend assertion and call receipt](./backend-verified.json).

The private bucket was an in-memory test adapter, and the document and account were synthetic. This run did not contact Cashfree, Razorpay, a malware scanner, a real R2 bucket, a live buyer storefront, or an actual screen reader.
