# Buyer email verification, recovery and session ending (APPID-P4a, 2026-09-24)

What APPID-P4a measured, built and proved, on branch `letbuyy/appid-p4a-buyer-verification`
(`08a89f4e` database, `41c52429` gateway, `4624c7d9` identity-platform). Gate results are in the
phase's `EXECUTION_LEDGER.md` row. Deployment steps are E-12 to E-14 in `EXTERNAL_ACTIONS.md`.
Nothing here is deployed.

## At the claim

- A buyer account is created with `email_verified = false`, and nothing could set it. Since APPID-P3
  (migration 255) an unverified buyer cannot link a store's customer record or claim an order, so no
  buyer could do either.
- There was no buyer password recovery.
- A buyer token lived 30 days, and nothing could end it early.

## Found on the way: buyer sign-in could not work in production

Two independent breaks sat on the path identity-platform uses for buyer registration and sign-in.
Development hid both.

1. **Wrong internal caller.** The gateway's buyer credential routes accepted only the `storefront`
   internal app. identity-platform, their only caller, signs as `accounts`, so each call got a 401,
   which identity-platform reports as "Invalid email or password." Fixed: the routes accept
   identity-platform alone. The test signs with identity-platform's own
   `createLetbuyyInternalAppHeaders` through the production wiring, and fails when the old app name is
   planted back.
2. **Unknown rate-limit buckets.** identity-platform asks the gateway's limiter for a bucket by name,
   and the gateway answers 400 for a name it does not know. Outside development identity-platform
   reads any failure as "not allowed". `buyer-register`, `buyer-login` and the merchant `switch`
   bucket (SEC-H7) were missing, so all three flows answered 429. Development skips the remote check.
   Fixed: the two tables are now equal, and `tests/contracts/identity-rate-limit-buckets.test.ts`
   keeps them equal, entry by entry. This also makes merchant account switching reachable in
   production (E-14).

## What was built

| Layer | Change |
|---|---|
| Database (257) | `buyer_email_challenges`: six-digit codes generated in the database and stored only as `sha256(salt ‖ code)`. A code lives 10 minutes, allows 5 wrong tries and works once, under a row lock. A newer code supersedes older ones. Each buyer may start at most 5 per purpose per hour. A code proves only the address it was sent to. `buyer_accounts.session_epoch`: advanced by a password reset and by `revoke_buyer_sessions`. Every function is audited and revoked from `PUBLIC`, `anon`, `authenticated` and `app_tenant`. |
| Gateway | `requireBuyerSession` requires the token's epoch (`sep`, 1 when absent) to equal the account's current epoch, and the account to be active. If it cannot read the account it answers 503; it never falls back to trusting the signature. Internal routes, callable only by identity-platform, start and complete verification (with a buyer session) and recovery (one 202 for every address), and sign out everywhere. |
| identity-platform | Every buyer token carries the epoch. New routes: `verify-email/{send,confirm}`, `recover/{send,confirm}`, `logout` (this browser only) and `sign-out-everywhere` (every device, copies included). Gateway error codes map to identity-platform's own wording. |
| auth-core | `LETBUYY_BUYER_SESSION_HEADER` and `LETBUYY_BUYER_SESSION_EPOCH_CLAIM`, so each wire contract has one name for both ends. |

**One departure from the claim.** The claim planned to send codes through identity-platform's email
path. Instead the gateway sends them itself, directly rather than through the queue, and no
response carries a code. Whoever can both start a challenge and read its code can take the account
over. The internal signature that authorises identity-platform is not unique to it (see below), so
returning codes over that channel would widen what a leaked internal secret can do, from "call the
gateway" to "take over any buyer account".

## Evidence

| Claim | Check | Result |
|---|---|---|
| Codes are single-use, hashed at rest, limited and expiring | `tests/executable/buyer-email-challenges-postgres.test.mjs` on real Postgres | 10 of 10 |
| Two requests with the right code cannot both succeed | same suite, two concurrent psql sessions; plant: remove the challenge row lock | passes; with the plant, both requests verify (`['verified', 'verified']`) |
| The API and tenant roles cannot call the functions or read the codes | same suite, as `anon`, `authenticated`, `app_tenant` | refused |
| An ended epoch's token is refused; a failed epoch read is a 503 | `buyer-email-verification-routes.test.ts`; plants: drop the epoch comparison, wave a failed read through | passes; each plant fails |
| No response carries a code | same file; plant: return the code from the start route | passes; the plant fails |
| Identity comes from the token, never the body | same file (verify, revoke) | passes |
| Recovery gives one answer for every address | same file (5 scenarios, one distinct response) and a source contract on `recover/send` | passes |
| identity-platform reaches the buyer routes, the storefront does not | same file, identity-platform's real header builder; plant: the old `storefront` app name | passes; the plant fails |
| The two rate-limit tables agree | `identity-rate-limit-buckets.test.ts`; plant: drop `buyer-login` from the gateway | passes; the plant fails |
| Every minted buyer token carries the real epoch | identity `buyer-session-epoch.test.ts` and `buyer-session-realm-separation.test.ts`; plants: drop the claim, mint a constant epoch | passes; each plant fails |
| The seven existing buyer route suites exercise the epoch check | plant: remove the fake epoch read from one harness | 13 of 17 tests fail with it removed |

Gateway unit: 1007 pass, 0 fail, 9 skipped, 2 todo. Contracts: 301 of 301. identity-platform: 25 of
25 and 6 of 6. Typecheck and lint are clean.

## Not done, and known limits

- **No full-stack run.** P4a's chain from identity-platform through the gateway to Postgres was
  proven piece by piece (the three layers above), not in one running stack. That run is planned for
  APPID-P4b, when hosted buyer pages make a browser run possible.
- **Recovery timing.** Recovery answers every address with the same body, but only an address with
  an account gets an email, so it answers more slowly. Registration still answers 409 for a taken
  address. Both are recorded, not hidden.
- **Application logout does not revoke the token.** It removes the cookie from this browser. A copy
  of the token stays valid until it expires or the buyer signs out everywhere.
- **Finding, for a later phase: the internal signature is weaker than its name.** It signs the app
  name, a timestamp and a nonce, but not the method, path or body. The replay cache lives in each
  isolate's memory. With legacy single-secret acceptance on (the default), anyone holding
  `INTERNAL_API_SECRET` can sign as any app, `accounts` included. The same channel carries
  `/auth/custom/emails/send`, which sends whatever recipient, subject and body the caller asks for.
  Closing this is a code change first: callers send `X-LetBuyy-Internal-Caller`, per-caller secrets
  come from `INTERNAL_API_KEYRING`, legacy acceptance is turned off, and the signature binds method,
  path and body. Only then is it an owner configuration step.
