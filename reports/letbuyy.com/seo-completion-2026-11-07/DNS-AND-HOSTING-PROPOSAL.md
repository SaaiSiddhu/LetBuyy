# DNS and hosting proposal — access verified, changes unapplied

The owner approved preparing the recommended legacy destinations and logged into Cloudflare in the existing Chrome profile. The DNS read-access blocker is **closed**. No provider settings changed.

Cloudflare shows full DNS setup for `letbuyy.com`. The relevant before-state is known: apex and `www` are DNS-only CNAMEs to `c69d9eec88d448f3.vercel-dns-017.com`, both with 10-minute TTL; Accounts is DNS-only to `671daaee66e0b650.vercel-dns-017.com`, also with 10-minute TTL. Searches for `seller` and `developer` return no records; two public resolvers independently return NXDOMAIN for all three legacy names. The zone has **0 of 10 Single Redirect Rules in use**. This is a scoped read, not a full export of unrelated email/TXT records.

Authenticated Vercel project-domain GET returned six verified marketing domains. It confirms the apex redirects to `www` with 308 and the `.store` apex currently redirects to its own `www`. None of the three legacy names is bound to the marketing project. The earlier registrar-oriented CLI command returned an access error, but the project-specific read succeeded. The following are actual Vercel config recommendations for the **currently unbound names**, not evidence that a new binding is active.

| Legacy root | Current rank-1 Vercel CNAME recommendation | Proposed exact GET/HEAD 301 |
|---|---|---|
| `seller.letbuyy.com/` | `cname.vercel-dns.com.` | `https://accounts.letbuyy.com/lookup` |
| `developer.letbuyy.com/` | `56c6f6b7962b9b74.vercel-dns-017.com.` | `https://www.letbuyy.com/in/resources/developers` |
| `developers.letbuyy.com/` | `cname.vercel-dns.com.` | `https://www.letbuyy.com/in/resources/developers` |

Both destination pages returned HTTP 200 on a fresh read. This establishes that they open, not that an authenticated merchant journey completed. The two draft Single Redirect rules match exact hosts and `/`, only for GET/HEAD, and discard query strings. Per [Cloudflare's Single Redirect documentation](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/), the source host must be proxied. The existing DNS-only apex/www/Accounts records are outside this proposal. No wildcard DNS, query forwarding, arbitrary POST redirect or new runtime is proposed.

The **diff is reviewable and unapplied**. Before enabling anything, confirm the proposed host bindings with Vercel and refresh exact CNAME/verification values, verify TLS and proxy behavior for each new source host, and test the response for unmatched paths. `/api` is eligible for a redirect to the current API getting-started guide only if historical evidence establishes documentation intent; `/sdk` still lacks an attested exact match. Do not catch all deep paths with a root redirect. Rollback removes only the newly created entries/rules/bindings after recording their IDs.

Existing `.store` assignment is now verified, but `.store` consolidation is still a separate per-path proposal preserving locale and excluding private/commerce paths. Do not reconnect the Firebase apex or replace active buyer-app policies with merchant terms; the buyer app stays active and its policy/support work remains deferred.

[Proposed diff](DNS-AND-HOSTING-PROPOSED-DIFF.json) · [Draft rule bodies](PROPOSED-REDIRECT-RULES.json) · [Cloudflare observations](evidence/cloudflare-current-dns.json) · [Vercel bindings](evidence/vercel-project-domains-readonly.json) · [Per-host recommendations](evidence/vercel-proposed-domain-config.json) · [Destination checks](evidence/proposed-target-health.json)
