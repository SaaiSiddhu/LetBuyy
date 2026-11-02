# KYC evidence retention decision — 2026-11-02

**Owner:** `services/api-gateway` for evidence state and deletion jobs; `services/queue-workers` for scan-result delivery; `infrastructure/deployment/kyc-india-mumbai.cfn.json` for storage and monitoring. The owner delegated selection of a proper LetBuyy policy in this chat. This is the selected **product default**, not a claim that LetBuyy is an RBI-regulated entity or that a provider has accepted these terms.

## Decision

LetBuyy keeps raw KYC document bytes in its approved India-region private bucket only while they are needed for a specific verification attempt. It does not use a blanket S3 object-expiration rule: such a rule could delete the exact version still under review or leave another version of the same key behind. A version-aware database deletion job must remove **all** versions and delete markers for the key, verify no current document references it, then record a completed deletion receipt. A failed deletion remains retryable and visible to operations.

| Evidence state | Raw-document handling | Retained record |
| --- | --- | --- |
| Upload reserved but never attached | Existing one-hour upload grace; queue deletion at expiry and alert if all versions are not removed within 24 hours | Minimal receipt, outcome and audit; no document bytes or URL |
| Superseded by a new upload | Queue old key in the same transaction as replacement; attempt immediate deletion and alert after 24 hours | Replacement and deletion receipt |
| Provider finally rejects or approves | Once the contracted provider confirms it has received the evidence it needs and returns a signed, site-bound final decision, queue deletion of LetBuyy's raw copy; complete within 24 hours | Redacted provider, mode, decision, reason code, reference, timestamp, document type and final four only |
| Still pending after 30 days | Expire the attempt, require a new upload, and queue deletion within 24 hours; a delayed callback must not restore that attempt | Expired outcome and audit |
| Merchant withdraws or closes the account | Revoke access and queue every current private object for deletion within 24 hours | Redacted decision and audit for the post-closure period below |

The default for redacted KYC decisions and access/deletion audit is the active merchant relationship plus **one year after closure**. A separately recorded legal hold or a signed provider/regulated-entity obligation can extend a specific record, with named authority, reason, scope, review date and expiry. A hold does not silently extend all documents. LetBuyy must not retain or export a raw document merely to satisfy a payment provider's own record-keeping duty unless the contract explicitly assigns that duty and an India-only handling path is approved.

This is a deliberately short raw-byte policy. [India's DPDP Act provides for erasure once the specified purpose ends, subject to legal retention](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf), and the [2025 commencement notification phases the Act's relevant provisions](https://egazette.gov.in/WriteReadData/2025/267647.pdf). [RBI's five-year KYC identification-record rule is addressed to regulated entities](https://www.rbi.org.in/commonman/Upload/English/Notification/PDFs/MD18KYCF6E92C82E1E1419D87323E3869BC9F13.pdf); this decision does not assume that LetBuyy inherits that raw-document custody obligation. A signed provider contract and India-specific privacy/legal review must confirm the allocation before real document intake is enabled.

## Required implementation and acceptance

The existing migration 420/424 cleanup receipts and Gateway India cleanup worker cover orphaned and replaced objects in local tests. They do **not** yet schedule final-decision, pending-timeout or account-closure deletion, enforce the 24-hour deadline, or purge post-closure redacted records. These are release gates, not completed behavior.

Before real intake: add transactional state transitions for each row above; make provider finalization contingent on a signed provider result and evidence-transfer receipt; add a durable due-time and legal-hold record; enforce version-aware deletion and prevent stale callbacks; test outage/retry, held versus unheld records, object-version replay, cross-tenant access, and deadline alerts against real Mumbai S3/GuardDuty. Confirm the provider's own retention, data location, deletion API, and breach obligations in writing. Keep the current `ENVIRONMENT=test` guards until those checks, IAM denial tests, and human security/privacy/finance release gates pass.
