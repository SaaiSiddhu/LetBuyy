# Accounts open-form CSRF renewal

Status: implemented and locally verified; production activation pending qualification and its own release decision.

The owner reported `POST /api/auth/login` returning 403 with “Invalid request. Please refresh and try again.” Browser inspection found no canonical or legacy CSRF cookie on the preserved filled form. A separate network reload issued the existing host-only cookie; the owner retried verification privately and confirmed reaching Merchant. This restored the current session, but it does not deploy the permanent repair.

The existing shared Accounts header utility now waits for one bounded, same-origin, uncached HEAD to `/lookup` when its CSRF cookie is absent. The existing proxy issues the cookie. Concurrent callers share renewal, then reread the real cookie. No password, OTP or mutation body is sent during renewal. A failed renewal prevents the mutation; a later explicit attempt can recover. Credentials are sent once, not replayed. All existing callers await the utility, including signup, recovery and buyer account connection. Buyer account switching reports renewal/logout failure and clears its loading state. Server CSRF, cookie attributes/lifetime, Origin checks, Turnstile, rate limits, session/realm checks and signing authority are unchanged.

Local evidence in `/private/tmp/letbuyy-accounts-csrf-20261101/`:

- Isolated Accounts package: 62 tests and a separate six boundary tests passed; all 61 root auth contracts passed. These sets overlap and are not combined as unique coverage.
- Focused Gateway auth/session/issuer/buyer security: 31 passed. Accounts type checking passed.
- Production-built Identity + actual Gateway/PostgREST/owned PostgreSQL: five existing membership browser tests passed, retaining their collection, pagination, isolation and recovery assertions. The normal login first removes only the CSRF cookies from the filled form, proves a direct missing-CSRF request is still rejected, then observes exactly one renewal HEAD and one successful credential POST followed by the real Merchant redirect. No positive cookie/session/API injection is used. Merchant and Commerce in this fixture remain development clients; challenge uses the existing public test-key transport. This is local browser proof, not hosted staging sign-in.
- A negative control omitting only the renewal call fails behavioral unit assertions; exact source restoration passes all eight renewal tests.
- Initial source-checkout fixture was refused because a real local app environment file exists. A subsequent sandbox attempt could not access Docker; both raw failures remain. The successful run used an isolated snapshot with no copied app environment files and the real Docker daemon. Its runner removed owned test resources.

No schema, database, Worker, DNS, provider credential, payment or carrier change is included. Hosted CI/staging/live verification and release provenance are recorded separately when actually observed.
