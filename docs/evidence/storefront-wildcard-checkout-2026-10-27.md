# Production storefront wildcard and discovery repair — 27 October 2026

Phase: `PHASE-STOREFRONT-WILDCARD-CHECKOUT-20261027`. Base: deployed `584037b53`.
Owner decisions: tenant stores stay under `letbuyy.store`; Circuit is first/default;
the public directory belongs at `storefront.letbuyy.com`; retire only reviewed DNS.
This phase preserves existing merchant designs, tenant guards, RLS, private-store
access, signing/replay protection and the Workers Free plan. Single agent.

## Implemented contracts

- Empty Liquid catalog pagination has no fabricated page number or navigation.
  The actual compositor regression first reproduced `Page 1 of 0`, then passed.
- Paired migration398 adds one fixed, service-only public directory projection.
  Only nondeleted, published, public stores qualify. Cursor pages are capped at24;
  account/configuration fields cannot be selected. Counts describe this same
  population: public stores, eligible catalog themes, active products and delivered
  orders. Private/draft/offline stores and deleted records are excluded.
- The shared contract is validated by Gateway and SDK. An unavailable read is
  distinct from an empty directory; counts render immediately and tenant links use
  the configured root. Public eligibility is read afresh, without shared caching.
- The adjacent finder now reads exact public handles, keeps canonical subdomain
  precedence, returns an ordinary miss for unknown handles and avoids the rejected
  unscoped fuzzy scan. Query changes retire pending results and redirect timers;
  an outage is shown as unavailable. Real mounted UI and Gateway/PG controls cover it.
- Creation/publication checks the verified wildcard on the configured Commerce
  project, without adding individual Vercel domains. Wrong project, preview branch,
  environment, redirect, unverified ownership, DNS failure and missing credentials
  remain pending. Existing published receipt replay survives provider unavailability.
- Future SQL inserts default to Circuit, matching the existing API creation default.
  Existing Core/modern drafts and saved configurations are not overwritten.

## Current verified evidence

Private evidence: `/private/tmp/letbuyy-storefront-recovery-20261027/`.
Encrypted database recovery material remains under the previously approved
`/private/tmp/letbuyy-production-release-20261025/fresh-recovery-20261026/`.
No record contents, credentials, bearer URLs or encryption keys are recorded here.

- Actual owned Gateway/PostgREST/PG: directory eligibility, nonzero product/order
  counts, cursor/revocation, strict payload/query validation, service-only ACLs,
  rollback and new-store idempotency/wildcard controls pass. Public finder positive,
  hidden-store and unknown-store controls pass against the real owned database.
- Fresh production and staging exports are private/encrypted, with decryption hash
  verification. Each was restored into isolated network-disabled Supabase PG17.
  Managed CLI identity Up/Down/Up passed; all522 retained tables stayed byte-equivalent;
  original migration aliases/history survived; final rehearsed history is326.
  No Supabase catalog helper or disabled constraint/trigger was used.
- Commerce and Merchant production builds passed; Gateway1808 unit tests,
  shared contracts18 and cross-runtime contracts361 passed. Final UI/build/lint
  and real governance qualification are tracked separately before activation.
- A broad behavioral run found the newly required owned-lane inventory entry and
  two existing verification defects. Clean584 reproduces the collection missing-pool
  failure and exact import-string assertion. The fixture now removes actual pool
  connection sources; canonical tenant transactions intentionally ignore the optional
  storefront-read flag. Required import bindings remain asserted independently of
  additional bindings. No production pool/role behavior was changed.
  A resource-conservation lifecycle test overlapped newly created rehearsal fixtures;
  its isolated rerun must complete after other fixtures stop. This is not a green
  full-gate claim.

## Hosting and DNS changes already applied

- After explicit action-time approval, saved the exact wildcard ownership TXT and
  verified `*.letbuyy.store` on Commerce. Existing wildcard CNAME and ACME NS pair
  remain. A never-registered hostname has valid TLS and the application's unknown-store
 404; Snaz returns200 Liquid. Its individual alias remains pending final removal proof.
- Attached and verified `storefront.letbuyy.com`, saved its provider-recommended
  DNS-only CNAME and ownership TXT. TLS and provider configuration pass. The old
  deployed app still returns application404 there until the new origin configuration
  is built. Commerce and Merchant production public-origin values are saved with
  both new and old platform aliases; tenant root and private secrets are unchanged.
- Owner explicitly approved the reviewed28-record retirement list. Native Cloudflare
  removed8 `.com` and20 `.store` records. Independent before/after BIND exports match
  exactly those deletions plus the two new discovery records; other exported records
  are identical. Live apps, mail/SPF/DKIM, staging, CDN, wildcard, certificate delegation
  and unproven records were retained. Provider-managed records were not selected.
  Removing DNS does not itself delete Vercel projects or their saved domain aliases.

## Remaining activation and acceptance

Final real governance gate; source integration `develop → staging → main` without
force push; managed staging migration and actual staged HTTP/compiled acceptance;
production migration/API and qualified web builds; real new production store with
Circuit, wildcard host and no individual Vercel registration; remove Snaz's individual
alias and recheck HTTPS; actual controlled checkout and natural production domain cron;
final Merchant/public-directory browser checks. No real payment, delivery, blanket
store publication or overwritten merchant design is authorized by this report.

The corrected read-only cron observer targets the verified deployed Queue name.
The previous observer incorrectly appended `-production` and returned Worker10007.
No unrelated financial/message sweepers were manually invoked. The domain cadence is
`17 */6 * * *`; the minute notification tick does not run this reconciler.

The first real gate was113/114: the required schema-derived registry lacked migration398 provenance. Regeneration adds that one source filename to sites and a generation timestamp; all317 tenant scope entries and columns are unchanged. Full validator rerun follows this correction.
