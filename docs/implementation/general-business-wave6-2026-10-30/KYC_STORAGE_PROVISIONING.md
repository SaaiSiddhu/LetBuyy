# Private KYC storage and scanning gate

**Status: real-document intake closed.** On 2026-11-01 the owner required both KYC document storage and malware scanning to remain in India. No India-region storage account, scanner, retention policy, or deployed upload path has been accepted. This is a provisioning and verification plan, not approval to collect PAN, bank, address, or identity files.

## Current implementation boundary

- The existing `KYC_PRIVATE_BUCKET` is a Cloudflare R2-shaped **owned-test fixture only**. The Gateway rejects its use for deployed upload, cleanup, and Console download even if `KYC_UPLOAD_ENABLED=true`; the binding validator rejects `KYC_PRIVATE_BUCKET` in default, staging, and production Wrangler manifests. Public `R2_BUCKET` continues to serve ordinary media and must never hold KYC bytes.
- Owned tests cover file type/size checks, tenant ownership, idempotent receipt reservation, private object metadata, redacted reads, replacement/orphan cleanup, and reviewer access with step-up, reason, scan verdict, and audit. They do not prove India residency, a trusted scan, production retention, or provider verification.
- The upload route currently receives file bytes through the Cloudflare Gateway before writing the fixture. An India-region bucket alone would not establish that the entire real-document path meets the owner's India-only requirement. The approved implementation must document and test upload transit, temporary storage, logs, scanner, event delivery, download, backups, and deletion.
- A read-only Wrangler check on 2026-11-01 reached an account that returned `10042` for R2 bucket listing and `10007` for the named Gateway Workers. The repository does not pin an account ID. That observation does not establish the deployed LetBuyy account's resources and is no longer a KYC storage selection criterion.

## India-region candidate and decisions

AWS S3 in Mumbai (`ap-south-1`) with same-region GuardDuty Malware Protection for S3 is the first candidate to evaluate. [S3 region placement](https://docs.aws.amazon.com/en_in/AmazonS3/latest/userguide/Welcome.html), the [Mumbai endpoint](https://docs.aws.amazon.com/general/latest/gr/s3.html), and [GuardDuty's S3 scanner](https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html) describe the relevant platform capabilities. No AWS account, contract, cost, region configuration, or successful upload has been verified here. Security and privacy owners must approve the complete data flow, including any processing outside India, before provider setup or real files.

| Gate | Evidence required before staging intake |
|---|---|
| Account and region | Owner-controlled AWS account, staging and production S3 buckets in `ap-south-1`, exact account/bucket/region readback, least-privilege IAM, encryption and private access, and explicit denial of cross-region replication or export. |
| Upload path | A signed, short-lived, site/document-bound upload or equivalent India-only ingress; content length/type/hash checks; no real bytes in Cloudflare Worker memory, logs, queues, or public media; safe abort and retry behavior. |
| Scanner | GuardDuty plan scoped to the Mumbai buckets (or another approved India-only scanner), trusted verdict ingestion with exact bucket/key/version binding and replay control. Only a completed no-threat verdict may become `clean`; pending, threat, unsupported, skipped, error, and outage remain blocked. |
| Private review | Step-up Console permission, reason, audit-before-byte-read, same-site/current-document check, India-only download path, and no public URL or accidental key/digest disclosure. |
| Retention | Approved periods for pending, rejected, approved, replaced, and abandoned evidence; deletion requests and legal holds; lifecycle and cleanup behavior proven without removing current evidence. |
| KYC processor | Signed agreement, permitted document transfer and residency terms, PAN/GST/bank ownership response contract, callback authentication, idempotency, rejection and resubmission behavior. Cashfree Secure ID has no account yet. |

## Implementation and acceptance sequence

1. Confirm the AWS account and written India-only data-flow decision. Keep all real upload flags off while account, bucket, scanner, and retention work proceeds.
2. Implement one deployed India-region private-storage adapter in the canonical Gateway/Console path. Keep the R2-shaped object store confined to owned tests; do not create a second live KYC storage system.
3. Use India-only ingress for real bytes. Bind the upload session to the authenticated site, document type, file digest/size and expiry; verify the completed object before creating or updating the canonical evidence row. Preserve idempotency and orphan/replacement cleanup.
4. Ingest authenticated scanner results for the exact current object version. Block provider review and reviewer download until a trusted clean verdict exists; handle duplicate, late, forged, and outage events without upgrading status.
5. Run synthetic staging journeys for web/mobile upload, tenant denial, file and scan failures, reviewer download, orphan/replacement cleanup, outage/retry, and retention. Record account, region, deployed SHA, bucket policy, scan event and database readback. Only then seek security/privacy approval to accept real staging documents.
6. Contract and integrate the KYC and payment providers, then pass all eight Wave 6 journeys and finance/security/owner live-canary gates. A file upload or clean malware scan is never proof of identity or bank ownership.

**Safe pause:** keep real upload admission disabled while preserving the approved India-region storage, scanning, review, and cleanup access for any already accepted evidence. Do not delete current documents or roll back evidence migrations without a reviewed recovery and retention plan.
