# Storefront sign-in through identity-platform: first-party code and PKCE (APPID-P4b, 2026-09-24)

What APPID-P4b built and proved, on branch `letbuyy/appid-p4b-buyer-code-pkce` (`85e044c1` database,
`f7f54f23` gateway, `25ca6cba` identity-platform). Gate results are in the phase's
`EXECUTION_LEDGER.md` row. Deployment order is E-16 in `EXTERNAL_ACTIONS.md`. Nothing here is deployed.
Storefronts use it from APPID-P4c, which adds commerce/web's start, callback and logout routes.

## The design, and why

- **Its own code table, not 159's.** 159's `authorization_codes` belongs to the general OIDC provider
  the founder deferred (ART-07). It is keyed by `principals`, so filling it for buyers would give them
  a second identity root beside `buyer_accounts`, which D-ONE-BUYER forbids.
- **A storefront session is bound to one store.** A storefront keeps its session in a cookie on the
  store's own host, and a merchant can repoint a custom domain at their own server. So the storefront
  gets its own token: a separate audience, a signed `site_id` and the session epoch, lasting 7 days.
  The gateway accepts it only at that site, only through the storefront's own server (the
  `storefront` internal signature), and only in the account's current epoch. A harvested cookie
  therefore works nowhere but the store it came from, and not even there without LetBuyy's server.
- **No silent authorization.** A code is issued only by a CSRF-checked POST from identity-platform's
  own page, after the buyer clicks "Continue to <store>" and has been told what the store will
  receive. A code issued on arrival would let any page bounce a signed-in buyer through
  identity-platform to its own store and learn who they are.
- **The callback is checked twice and never trusted before that.** Its shape is exact, and its host
  must be a published store's primary host, resolved by the storefront's own resolver. A request that
  fails either gets an error on identity-platform's page and is never redirected.
- **The token exchange reads no cookie**, so CSRF has nothing to protect there. It is not rate
  limited by address, because every storefront shares a few server addresses. The code is 60 seconds,
  single use, burned by any failed attempt and useless without the verifier.

## Found by the local run, invisible to the tests

The flow ran against a local identity-platform, gateway and Supabase (all migrations, 258 included).
Before it passed, it found two defects that the route tests could not see, because each test injects
the dependency that was broken:

1. **The callback's host lookup was refused by the gateway's tenant guard** for custom domains (a 500
   and a misleading "unavailable" page). It is a bootstrap lookup made before any tenant is known.
   It now uses `getSupabaseAdminUnguarded`, which it meets all four documented conditions for, from a
   one-function file added to that client's allowlist.
2. **(APPID-P4a) local email verification could never work.** The local env generator's Resend key
   looks real to a placeholder check, so the gateway tried the provider, failed and answered 503. A
   database on this machine now always sends codes to the console, never the provider.

## Evidence

| Claim | Check | Result |
|---|---|---|
| Codes are single use, hashed at rest, 60 seconds, PKCE-bound | `tests/executable/buyer-authorization-codes-postgres.test.mjs`, with RFC 7636's own verifier and challenge | 10 of 10; plants (no PKCE check, no burn on failure) each fail it |
| Two redemptions racing cannot both win | same suite, two concurrent psql sessions | exactly one `redeemed` |
| A code outlives no sign-out-everywhere and no disabled account | same suite | refused, reason audited |
| A callback is one exact shape at a store's own host | `buyer-authorization-routes.test.ts`; plant: drop the round-trip check | passes; the plant fails |
| The buyer is the session's, never the body's | same file; plant: let the body name the buyer | passes; the plant fails |
| A storefront session works at its own store only, only via the storefront server, only in the current epoch | same file; plants: drop the store check, drop the storefront gate | passes; each plant fails |
| The realms do not mix | same file, both directions | passes |
| The token route touches no cookie and takes its site only from the redemption | `buyer-session-realm-separation.test.ts` | passes |
| The whole flow works across the three runtimes | local driver: register, authorize page, continue, exchange, storefront read, every negative, email verification, sign-out-everywhere | 29 of 29 checks |
| It works in a browser | browser pane: register through the page, "Continue to Store One", redirected to the exact callback with the code and the state | as described |

## Not done, and known limits

- **commerce/web does not call it yet.** The start, callback and logout routes, the `__Host-` cookie
  and the store's sign-in entry point are APPID-P4c.
- **The hosted pages are English only.** identity-platform's merchant pages also offer Hindi and
  Tamil. Translating security-critical copy by machine was not done; it is recorded instead.
- **The storefront session is not revocable one by one.** Signing out of one store (APPID-P4c) will
  remove its cookie; ending every session is sign-out-everywhere, which the epoch enforces.
