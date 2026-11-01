# Owned Android KYC unavailable-state repair — 2026-11-01

This is a synthetic local Android 35 emulator run. The current Wave 6 source at `54c068303` produced one debug APK, SHA-256 `d89886570c4b8703d35c19dff3dbb8756cd3782454fac558f4a1dd006a3a0a44`. The fixture checked the installed path and hash at the beginning and end. It is not a hosted, physical-device, provider, or live-payment certificate.

| Gate | Recorded result |
|---|---|
| Owned fixture | Run `e29b3c3452ad` passed 1/1, 0 failed; disposable Postgres, PostgREST, containers, networks, and volumes cleaned up |
| Profile conflict | Synthetic owner signed in through Identity and selected Light theme. A concurrent server edit made the native `PATCH /v1/stores/:id` return 409; Reload returned the newer name and discarded the stale draft |
| Persistent outage | Three Mobile BFF `GET /v1/kyc` calls returned 503 across automatic retries. The native screen stated verification was unavailable, offered Retry, and showed **no Add document action** or misleading upload invitation |
| Manual recovery | After the controlled outage was removed, tapping Retry made `GET /v1/kyc` return 200; the document list and Add document action appeared |
| Private upload | Android system picker selected a synthetic PNG; `POST /v1/kyc/documents/upload` returned 201. The owned DB had one site-bound PAN evidence row and the mock private bucket held one object. The native status remained in progress and said sandbox uploads could not enable live payouts |

Visual readbacks: [Light Settings](./settings-light-r6.png), [Store Details](./store-details-light-r6.png), [409 and Reload](./store-details-light-conflict-r6.png), [fresh server name](./store-details-light-reloaded-r6.png), [KYC unavailable](./kyc-error-light-r6.png), [KYC recovered](./kyc-recovered-light-r6.png), [private upload pending scan](./kyc-pending-light-r6.png). [Backend call and DB assertion receipt](./backend-verified.json).

The account, document, provider outage, and private bucket were synthetic fixtures. No Cashfree or Razorpay verification, real R2 object, malware scanner, physical phone, screen reader, or hosted buyer flow was exercised.
