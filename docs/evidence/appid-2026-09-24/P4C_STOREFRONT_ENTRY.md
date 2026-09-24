# Buyers sign in to any storefront with their LetBuyy account (APPID-P4c, 2026-09-24)

What APPID-P4c built and proved, on branch `letbuyy/appid-p4c-storefront-sign-in` (`71531b8e` cache
headers, `7627410c` sign-in routes, `bcebe540` entry points). Gate results are in the phase's
`EXECUTION_LEDGER.md` row. Deployment is E-17 in `EXTERNAL_ACTIONS.md`. Nothing here is deployed.

## What a buyer sees

On a store, the account sheet's first step offers **Continue with LetBuyy** under the store's own
email sign-in; Liquid stores show the same link in their login section. It leads to identity-platform,
which names the store. The buyer signs in or creates an account, then chooses to continue, and lands
back on the page they started from, signed in at that store. The account sheet then says so and offers
to sign out of LetBuyy at this store only.

## The storefront's end, and why

- **Two `__Host-` HttpOnly Secure cookies** on the store's own host: the flow (state, PKCE verifier,
  return path, callback), cleared whatever happens, and the session. `__Host-` forbids a Domain
  attribute, so no other store's subdomain can plant one (cookie tossing between `*.letbuyy.com`
  stores); HttpOnly keeps both from theme scripts.
- **The callback comes from the request host**, forced to https outside localhost and written exactly
  as the gateway accepts it. **return_to** must be a path on this store.
- **The callback** requires the flow cookie, a state that matches it in constant time and the callback
  the flow started with, exchanges code and verifier server to server, and confirms the session is
  for the store this host serves. A failure is shown on a plain page, never retried automatically.
  No token and no code is ever put in a URL.
- **Who is signed in here** is decided for the store THIS HOST serves, resolved on the server, and by
  the gateway, only through this store's signed internal request.
- **Sign-out** ends the session at this store only, and only for a request from this store's pages.

## Found on the way

1. **Every storefront API answer was publicly cacheable (fixed).** The "all pages" header rule also
   matched `/api/*`, and a next.config Cache-Control wins over the route's own. So sessions and
   profiles went out `public, max-age=300, stale-while-revalidate=3600`. The same rule cut
   production's immutable asset cache to five minutes, and in development it served stale code
   (it hid this phase's own edits for minutes). A contract now evaluates the real config with
   Next's own path matcher in both environments. Whether any shared cache stored an answer is E-17.
2. **A session was read at the wrong store (fixed before commit).** The session route first took the
   store from the cookie, so a cookie issued at one store was read at another. Browsers never send a
   host-only cookie across stores, and the gateway still confined the token to its own store, but a
   storefront must answer for the store it serves. It now resolves the store from its host.
3. **Four storefront Liquid tests already fail on `develop`, outside the gate's default lanes** (W2,
   F5, "storefront resolver and composition engine render full Liquid documents", "Liquid storefront
   plans bind catalog data"). Checked on a clean `develop` checkout; not caused by or fixed in this
   phase.
4. **Store account pages are publicly cacheable too** (the page rule, not changed here). APPID-P6,
   which builds buyer-backed account pages, has to give them a private cache policy.

## Evidence

| Claim | Check | Result |
|---|---|---|
| The storefront builds what the other two ends accept | `tests/contracts/storefront-buyer-auth.test.ts`: every callback passes the gateway's parser, the authorize URL passes identity-platform's, the challenge reproduces RFC 7636 | 10 of 10 |
| return_to, the flow cookie, state comparison and the signed path are strict | same file; plants: accept `//host`, drop HttpOnly, widen the path to a prefix | passes; each plant fails |
| API answers carry no cache directive from the config; pages keep theirs; assets are immutable only in production | `tests/contracts/storefront-cache-headers.test.ts`; plant: the old `/:path*` rule | 3 of 3; the plant fails all three |
| The whole flow holds at the HTTP level | local driver through commerce/web, identity-platform, the gateway and Supabase: cookies' attributes, a missing flow cookie, a wrong state, a replayed code, the code at another store, the session at another store, sign-out from another site, a malformed host | 17 of 17; plants (no state check, store from the cookie) fail it |
| It works in a browser | from a store's account sheet: Continue with LetBuyy, sign in at identity-platform, continue, back on the store signed in; the other store sees no session; sign-out ends only this store's | as described |

## Not done

- **Account pages, addresses and order history for a signed-in buyer**: APPID-P6.
- **Checkout sign-in** on `checkout.<root>`: its tenant comes from a verified handoff, not the host, so
  it needs its own design; not started.
- **The per-store customer login** still works beside this; retiring it is APPID-P7's decision.
