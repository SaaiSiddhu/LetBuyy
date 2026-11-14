# Legacy property and DNS plan — no changes applied

## Verified estate

The owner controls DNS and the legacy project; the buyer app stays active. Authenticated Firebase Hosting lists five sites. Current displayed versions are main `0e45aa` (8 January 2026), seller `9279d9` (25 December 2025), admin `80c22c` (27 December 2025), store `6480a7` (8 January 2026) and storefront `414a0c` (20 December 2025).

Custom mappings for apex letbuyy.com, seller.letbuyy.com, letbuyy.store, check.letbuyy.store and kathirstore.letbuyy.store show “Needs setup.” Admin has two default Firebase domains. These are observed associations, not instructions to activate them. Full release IDs, deployed-file archives and source matching are not yet available.

The legacy root, privacy URL and even robots.txt return the same 3,245-character sales body and Create Next App title. The Play listing links that property. Buyer-app privacy/data-practice publication is explicitly deferred by the owner; do not invent a policy or substitute merchant terms.

Google and Cloudflare public DNS independently return NXDOMAIN for seller.letbuyy.com, developer.letbuyy.com and developers.letbuyy.com. They remain distinct names. GSC page rows record the old developer root at 2 clicks/34 impressions, `/api` at 1/24 and `/sdk` at 0/23. Their purposes and equivalents need path-specific handling.

The current marketing apex/www DNS points toward Vercel. Cloudflare zone read works, but DNS record queries return 403. Do not reconnect the Firebase apex: it could move the active website.

## Reviewable path proposals, not applied rules

| Old surface | Proposed handling | Required proof |
|---|---|---|
| seller.letbuyy.com/ | Permanent migration to canonical account lookup if seller intent matches | Current Accounts lookup is 200 and used by marketing; identity owner must confirm the relevant return journey. |
| Historical seller paths | Map verified equivalents; intentionally retire unsupported paths | Real inbound/GSC path inventory. Do not wildcard everything to the home page. |
| developer.letbuyy.com/ | Candidate 301 to `/in/resources/developers` | Existing hub is 200; confirm old portal purpose. |
| developer.letbuyy.com/api | Candidate 301 to the existing API getting-started guide only if it was documentation | Do not send actual API requests to an HTML guide. |
| developer.letbuyy.com/sdk | Inspect historical purpose and current supported SDK documentation first | No exact equivalent is attested; do not invent a target. |
| developers.letbuyy.com | Leave inactive pending an explicit supported purpose | A spelling variant does not authorize a frozen developer runtime. |
| www.letbuyy.store locale pages | Per-path permanent consolidation to equivalent `.com` pages | Verify domain assignment, locale/path/query handling and private/app exclusions. Current root/pricing canonicals point `.com`; commerce-tag canonical strips locale. |
| Firebase buyer policy/support | Deferred publication | Actual app-specific facts and later owner review/authorization. |
| Stale Firebase apex association | Leave unchanged until deliberate cleanup review | Preserve the current Vercel route; no hosted cutover or deletion. |

An exact DNS mutation is not ready: provider record state and destination-domain assignment are incomplete. Do not invent CNAME targets, TTLs or proxy settings from public answers. This packet supplies paths, intended status/target, dependencies, validation and recovery without pretending to be an executable approved DNS diff.

Before approval, export records and bindings, identify full Firebase versions and backups, and test the exact source-to-target matrix. After an approved change, verify DNS/TLS, redirect length, intended content, locale/query behavior and private-account paths. Restore only the captured record/rule/version if material behavior fails. No DNS, redirect, release, Auth or Firestore data was modified.
