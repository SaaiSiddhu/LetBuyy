# Staging private export delivery — 1 November 2026

## Observed defect and scoped repair

The public media bucket also holds private `exports/jobs`, `exports/sources` and `exports/results` objects. The Gateway checks current actor/store ownership, expiry and a bound download signature, but the separate R2 custom CDN domain bypassed that boundary. A harmless staging object under `exports/results` was anonymously readable with exact byte equality. A nonzero public control also returned 200. This demonstrated a storage-delivery gap; no customer file or production object was read.

A single Block rule, **`448f40ff18614cafbbd72312d69f6458`**, is now active in the existing `letbuyy.store` zone. Its expression matches only **`cdn-staging.letbuyy.store`** and the recursively decoded `/exports` path. The rule's exact saved expression, Block action and Active state were read back in the existing UI. Custom rules changed from 0/5 to 1/5; existing rules were not replaced. See [the exact policy](STAGING_EXPORT_CDN_POLICY.json).

This is an outer staging delivery restriction. Export bytes still share the public media bucket; complete permanent private-storage separation/cutover before final release certification. Other private object namespaces and production delivery are not certified by this check.

## Nonzero acceptance

- Before repair: public and private-prefix canaries both returned 200 and exact expected bytes.
- After repair: the fresh public control still returns 200 with exact bytes. Canonical export, encoded prefix, encoded separator, recursively encoded prefix and dot-segment variants return 403 without the private bytes.
- Both post-repair canaries were deleted and their absence was independently read back from R2. Earlier canaries were also removed.
- A real product export from the existing synthetic staging store completed with one row through **mobile BFF → signed internal Gateway session → SQL → R2**. The owner downloaded a one-row CSV whose job ID and row count matched the completed job, through the authenticated boundary with private/no-store headers.
- Another valid owner received 404 for the original signed URL; the URL alone received 401; the owner without its download signature received 403. Direct CDN requests for this actual job metadata and CSV result both received 403.
- The owned export job/result were removed, and the original owner subsequently received 404 for the job. Signed download URLs were kept in memory and not retained in evidence.

The eight real export checks are in `staging-private-export-bff-acceptance.json`; the six post-rule public/private URL checks and byte/cleanup readbacks are in `paired-staging-delivery-qualified.json`, under `/private/tmp/letbuyy-parity-continuation-20261101/`. Raw bearer requests to the Gateway were correctly rejected: the supported boundary is the BFF's signed internal session, not direct client bearer authorization. Those refused attempts created no acknowledged export job and were not treated as successful acceptance.

Initial generic Python requests received Cloudflare 1010. That was not a private-file control or application outage. The repeated probes used an honest descriptive application User-Agent, following [Cloudflare's documented client guidance](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/), with no firewall weakening or browser impersonation. The original failed probe receipts are retained. The actual unmodified Dart SDK independently reads the same scoped staging locations/suppliers successfully.

The CLI's existing OAuth scope cannot read WAF rule bodies (403); exact configuration was instead read back from the already authorized UI. [Cloudflare's supported recursive URL decoding](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/) informed the expression; the real encoded-path results qualify its observed behavior.

## Production boundary and remaining feature work

Metadata shows a separate production bucket and enabled `cdn.letbuyy.store` custom domain. **No production canary, private object read or production-matching rule has occurred.** Equivalent production protection needs separate verification/approval. A narrowly scoped proposal is prepared in [PRODUCTION_EXPORT_CDN_POLICY_PROPOSAL.json](PRODUCTION_EXPORT_CDN_POLICY_PROPOSAL.json); it does not authorize a release or a storage cutover.

Feature 28 remains partial. Native CSV upload is not implemented, and the current importer creates a fresh job for each request with no durable row recovery. Repeating a partly committed import can duplicate products. Complete the existing canonical product transaction, stable actor/store/file/job/row intent, current permissions, quota/usage replay, bounded processing, original-outcome recovery and both typed clients before accepting CSV import. Native share UI, selected export population/filter parity, staff/revocation and broad web/mobile device journeys remain open.

The separate production two-canary/conditional guard was subsequently approved and completed. [Production scope, confirmed bypass, exact policy/readback and cleanup](PRODUCTION_PRIVATE_EXPORTS.md). This closes the scoped production CDN policy gate, not permanent private storage or authenticated production CSV acceptance.
