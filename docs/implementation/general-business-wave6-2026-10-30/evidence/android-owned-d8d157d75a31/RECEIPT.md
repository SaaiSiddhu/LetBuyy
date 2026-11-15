# Owned Android General and KYC journey — 2026-11-01

This is a synthetic, local Android 35 emulator run, not a hosted or physical-device release certificate. The single installed debug APK had SHA-256 `1d7ebbd2e2474ec805790e97bd0cda6e3731d8acbfeb86c96bc282484c405e80`; the owned-device fixture checked its installed path and hash at the beginning and end.

| Gate | Observed result |
|---|---|
| Owned runner | `d8d157d75a31`: 1 test passed, 0 failed; Postgres, PostgREST, containers, networks, and volumes cleaned up |
| Identity and initial read | Synthetic owner logged in through Identity; Mobile BFF `GET /v1/stores` returned 200 and Store Details displayed the owner site's name |
| Stale save | Server changed the same `sites` row while the Android tagline draft was open; Mobile BFF `PATCH /v1/stores/:id` returned 409; Reload called `GET /v1/stores/:id` (200) and displayed the server name, with the stale tagline gone |
| KYC private upload | Normal Settings → Business verification → Business PAN → Android photo picker uploaded a synthetic PNG; Mobile BFF `POST /v1/kyc/documents/upload` returned 201 |
| Database and private object | Exactly one owner-site `business_pan` evidence row had a private object key; the mock private bucket held one object |
| Merchant state | KYC displayed “In progress” and security-scan pending; no provider approval or live payout was inferred |

Visual readbacks: [dashboard](./dashboard-steady-final.png), [Store Details](./store-details-final.png), [409 and Reload](./conflict-final.png), [reloaded server value](./reloaded-final.png), [KYC before upload](./kyc-final.png), [KYC after upload](./kyc-pending-final.png).

The fixture used a task-owned emulator and disposable Postgres; the document was synthetic and its storage was an in-memory private-bucket adapter. It did not contact Cashfree, Razorpay, a malware scanner, a real R2 bucket, or a live buyer storefront.
