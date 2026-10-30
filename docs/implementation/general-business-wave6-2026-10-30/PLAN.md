# General and Business Wave 6 — execution plan

**Release rule:** Wave 6 exits only when all eight journeys in [READINESS.md](./READINESS.md) have recorded browser/API/database/provider evidence. Source, mocks, local builds, and a green migration run are intermediate evidence. The live canary needs provider, security, finance, and owner approval.

## System boundaries

- `sites` is the one store record. General, Business, storefront preferences, web, and Flutter edit its canonical fields through the Gateway; `version` is the concurrency token. No second store table or profile authority is introduced.
- The Commerce Next runtime renders the buyer site from the public Gateway projection and the canonical Liquid theme release. The editor draft and release pointer remain separate; a profile edit updates current public facts without rewriting an older order, invoice, notification snapshot, or theme release.
- `merchant_kyc_documents` records evidence and provider decisions. Uploaded files belong only in a separately provisioned private bucket with scoped access, malware handling, retention, deletion, and audit controls. Document submission is never itself an approval.
- Merchant-owned Razorpay remains the payment and settlement rail. LetBuyy records and reconciles provider facts in its canonical ledger; it does not hold or disburse merchant funds.

## Ordered delivery

| Wave | Build and integration work | Exit evidence |
|---|---|---|
| 0. Contract and ownership | Freeze field ownership, permission matrix, public/private projections, provider roles, order/invoice number source, and current migration baseline. Inspect the actual production topology and deployment state before any release action. | A field-by-field contract with owner, reader, writer, sensitivity, retention, and API shape; validated dependency and migration ownership. |
| 1. Store profile | Complete `sites.version` compare-and-swap in General, Business, SEO, web, and Flutter. Preserve explicit clears, reject stale versions, project only opted-in contact, and carry name/SEO into editor preview, release, buyer page, canonical metadata, and order notification snapshots. | Two-tab and web/mobile conflict proof; API and DB readback; draft/publish/custom-domain browser capture; privacy assertions; order email snapshot before/after rename. |
| 2. Tax and identifiers | Reconcile the merged shipping/tax/invoice source with this branch's General and Business fields. Compute supplier and tax facts at order time; issue unique GST invoices only under the accepted registration rules; freeze invoice facts; derive examples from the real number generator. | Registered and unregistered order fixtures, concurrent invoice issuance, historical invoice immutability, actual order/invoice numbers compared with UI examples. |
| 3. Private KYC | Finish private upload lifecycle and a restricted reviewer/download path. Provision the private bucket, scan/quarantine files, define retention and deletion, and record read/write/review audits. Remove direct merchant write authority over provider decision fields at the database layer; route evidence submissions through the Gateway. Choose a contracted provider, implement its current signed result contract and replay protection, map pending/rejected/approved/outage states, and invalidate bank approval on account change. | Sandbox plus provider test cases for pending, rejection, resubmission, approval, bank change, duplicate callback, outage, and unauthorized access. A merchant database role cannot forge a provider decision. No live payout eligibility from sandbox, last-four digits, upload success, or an unverified callback. |
| 4. Payments | Bind the merchant's own Razorpay test account, signed callback, idempotent order/ledger posting, statement, and reconciliation. Keep credential changes and bank changes under audited authorization. | One actual sandbox charge and signed callback, exactly one order and balanced ledger effect across callback retries, matching statement/reconciliation and provider settlement reference. |
| 5. Merchant and buyer UX | Verify loading, failure, retry, conflict recovery, keyboard focus/labels, screen reader announcements, dark/light color contrast, responsive layouts, Flutter file and camera permissions, and verified custom-domain routing/canonical SEO. | Saved desktop/mobile captures and accessibility/device results for each affected flow; public domain and preview host checks. |
| 6. Release qualification | Run touched unit, contract, security, owned Postgres, browser, performance, rollback, and deployment gates. Reconcile any integration branch conflicts, apply paired migrations in an approved environment, and observe a bounded live canary after provider and human gates. | A filled eight-row acceptance ledger, migration/rollback record, CI and hosted parity, provider approval evidence, reconciliation, finance/security review, owner decision, and rollback path. |

The current source-backed Wave 0 field and access map is [FIELD_CONTRACT.md](./FIELD_CONTRACT.md). Wave 0 is not a release gate pass until the deployed topology, retention, and provider-specific data handling are verified.

## Provider decision for India beta

Prioritize **Cashfree Secure ID** for the first India-only PAN, GST, and bank/KYB sandbox evaluation. The owner's criteria are Indian-native coverage, affordable usage, and quick onboarding. Compare a complete written price, activation time, document transfer/OCR contract, webhook authentication, data location/retention, and support with **IDfy, Signzy, HyperVerge, and Sumsub** before signing. Published ₹3 bank verification pricing is not a complete KYB quote. Sumsub's published individual Basic plan has a US$149 monthly minimum; business verification is a custom quote, so it is a comparison candidate rather than the assumed beta default. The selected provider cannot substitute for Razorpay's own merchant approval or bank destination evidence. See [READINESS.md](./READINESS.md) for reviewed source links and current implementation state.

The present last-four identifiers cannot drive a full PAN verification API. A live provider flow needs a governed way to obtain full evidence through a private upload/OCR or provider-hosted step, minimize what LetBuyy stores, and bind every decision to the exact current merchant, document, and bank version.

## Stop conditions

Do not declare Wave 6 complete while any acceptance row is unverified. Do not bind identity files to public media, treat a local mock as a provider response, mark a merchant approved from document upload, or run a live payment/payout canary before the required provider and human gates. Record failed tests and unavailable infrastructure as open work with the exact retry command and result.
