# Private KYC storage provisioning gate

**Status: decision and account access pending. No bucket was created, bound, or exposed.** This is the reviewable storage gate for [Wave 6](./PLAN.md), not permission to accept real PAN, bank, address, or identity files.

## Current account observation

- On 2026-11-01, the one account authenticated in this worktree's Wrangler session returned Cloudflare API code `10042` (“Please enable R2 through the Cloudflare Dashboard”) for a read-only bucket list. Read-only deployment lookups returned `10007` (“Worker does not exist on your account”) for both `letbuyy-api-staging` and `letbuyy-api`. The repository's `wrangler.toml` does not pin an account ID. **This does not prove that LetBuyy's deployed Cloudflare account has R2 disabled or lacks buckets.** Confirm the intended account before changing billing, storage, or bindings.
- The committed Gateway config binds public `R2_BUCKET` media in default, staging, and production environments. It has no `KYC_PRIVATE_BUCKET` binding. The Gateway now requires both a distinct private bucket **and** explicit `KYC_UPLOAD_ENABLED=true` before accepting new documents. With the switch false, status stays readable and the bucket remains available for cleanup and restricted review.
- The Gateway now rejects a direct runtime alias where `KYC_PRIVATE_BUCKET` and public `R2_BUCKET` are the same binding object. Its cleanup drain also refuses that alias before any delete. The Cloudflare binding validator rejects a future Wrangler configuration that gives private and public bindings the same `bucket_name` in the default, staging, or production Worker, including reuse across environments. Deployed binding values and private/public access controls still require verification in the intended Cloudflare account before enabling intake.

## Decisions required before provisioning

| Decision | Required owner/security answer | Why it gates creation |
|---|---|---|
| Cloudflare account | Exact account that owns the deployed Gateway Workers and whose R2 service is enabled | The local Wrangler identity cannot be assumed to be that account. |
| Data location | Whether India-only storage/processing is required for KYC bytes | Cloudflare's `apac` location hint is **best effort**, not an India residency guarantee. Its documented R2 jurisdictions are EU, US, and FedRAMP; no India jurisdiction is listed. If India-only is required, approve a suitable storage provider and architecture change before collecting documents. |
| Retention and deletion | Periods for pending, rejected, approved, replaced, and abandoned files; deletion requests; legal holds | A guessed bucket-wide expiry could destroy current evidence. A bucket lock could prevent the existing immediate replacement cleanup. |
| Malware scanning | Scanner/operator, verdict authentication, quarantine rules, retry/outage behavior, and audit trail | Uploaded bytes currently remain `pending`; no trusted production scanner can mark them clean. |
| KYC processor | Contracted provider, permitted data transfer, callback signature/idempotency, and bank ownership checks | A private upload is evidence received, never verification or payout eligibility. |

## Approved implementation sequence after those decisions

1. Confirm the Cloudflare account and R2 entitlement. Record the account ID in managed deployment configuration without putting credentials or personal documents in source or chat.
2. Create separate staging and production buckets with approved geography and names. Keep both private: no `r2.dev` public URL and no custom domain. Cloudflare says R2 buckets are private by default, but verify both settings after creation.
3. Apply the approved retention/lifecycle design and check its interaction with replacement cleanup, audit records, and any legal hold. Do not set a blanket expiry while policy is undecided.
4. Add `KYC_PRIVATE_BUCKET` to each intended Gateway Wrangler environment and its binding-ownership manifest. Keep `KYC_UPLOAD_ENABLED=false` through deployment. Never alias the existing public `R2_BUCKET`.
5. In staging, prove authenticated owner upload, private `put/get/delete`, blocked public access, scanner pending/clean/rejected/outage, stepped-up reviewer download and audit, orphan/replacement cleanup on an idle scheduled tick, and failure/retry readback. Use synthetic documents until privacy and provider terms permit real ones.
6. Turn on staging intake only after security/privacy sign-off; record the exact config and deployment SHA. Production intake and a live payout canary require the contracted KYC and Razorpay evidence plus the Wave 6 finance/security/owner gates.

**Safe rollback:** set `KYC_UPLOAD_ENABLED=false` to stop new intake while preserving the bucket binding for existing evidence, reviewer access, and cleanup. Do not empty the bucket, disable its only access path, or roll back a migration that has cleanup records without a reviewed retention and recovery plan.

## Product constraints verified from primary sources

- [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/): `apac` is a location hint; jurisdictional restrictions are separate and the listed jurisdictions do not include India.
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/): buckets are private by default; `r2.dev` and custom domains are explicit public-access controls.
- [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) and [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/): expiration is asynchronous and lock rules can defer deletion.
- [R2 data security](https://developers.cloudflare.com/r2/reference/data-security/): R2 encrypts objects and metadata at rest and uses TLS in transit; these properties do not resolve data-location or retention decisions.
