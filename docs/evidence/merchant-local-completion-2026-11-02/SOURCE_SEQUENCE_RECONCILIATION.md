# Source numbering reconciliation decision

Read-only primary snapshot: `5614ffa7efcd93759c7bba63d1ea899d21253270`. Task baseline: `ab32485092cae0ac19145abf7b5a101fa3ea338e`. No hosted state was queried.

The task-owned category417 was authored only after417 was confirmed unused. Its owned/device qualification is preserved. A fresh cross-check now finds the primary checkout through432 and a different417. This is a new collision; no renaming, import, hosted migration or release has been executed.

| Item | Task worktree | Newer primary checkout |
| --- | --- | --- |
|414 | warehouse, per recorded owner decision | gift-card recovery |
|415 | gift-card recovery, per recorded owner decision | warehouse |
|416 | durable product imports | durable product imports |
|417 | newly authored, uncommitted category commands | managed sandbox payment connections |
|418–432 | absent from task baseline | newer Accounts/payment/KYC/core/theme migrations |

## Proposed bounded source/local reconciliation

1. Preserve the already approved task ownership: warehouse414, gift415 and CSV416. Do not reopen that decision or change applied history.
2. Review the newer primary source and paired migrations417–432, their dependencies and their recorded decisions before admitting them into this task worktree. Resolve references that assume the opposite414/415 mapping without weakening native catalog/provenance guards. Do not blindly copy the primary migration directory.
3. Renumber only the task’s uncommitted/unhosted category417 forward/DOWN to433, provided433 is still the legitimate unused number when execution starts. Update journal labels, provenance, registry, fixtures and documentation references; keep the original device/SQL evidence and source archive pinned to its original417 snapshot.
4. Rebuild/qualify the reconciled source locally: paired empty UP/DOWN/UP, retained-data refusal, role/GUC/tenant attacks, product/CSV/warehouse regressions, package/governance checks and affected normal web/native journeys. No hosted data, deployment, secret access, push, merge or production activation is included.

The primary migration filenames, exact hashes, rollback presence and migration-file WIP are recorded in `SOURCE_SEQUENCE_RECONCILIATION.json`. Primary source may advance again; a changed snapshot requires renewed read-only reconciliation.

## Why a decision is required

The attached task §12 says: “If there is a real new collision or authority conflict: Stop only the affected schema decision. Present the exact conflict. Continue independent authorized work.” Root MIG-R2 and PRIME-R1 require human resolution of a new numbering/authority conflict. New schema decisions are held; independent UI/audit work remains authorized.

## New primary source inventory

- `414_gift_card_issue_replay_integrity.sql` — paired DOWN present
- `415_atomic_warehouse_commands.sql` — paired DOWN present
- `416_durable_product_imports.sql` — paired DOWN present
- `417_managed_sandbox_payment_connections.sql` — paired DOWN present
- `418_merchant_accounts_mobile_handoff.sql` — paired DOWN present
- `419_kyc_private_metadata_gateway_only.sql` — paired DOWN present
- `420_merchant_razorpay_webhook_secret.sql` — paired DOWN present
- `421_kyc_last_four_reference_limit.sql` — paired DOWN present
- `422_kyc_profile_change_revocation.sql` — paired DOWN present
- `423_provider_gated_pricing_copy.sql` — paired DOWN present
- `424_kyc_private_object_cleanup.sql` — paired DOWN present
- `425_kyc_india_upload_intent.sql` — paired DOWN present
- `426_kyc_r2_india_provider_isolation.sql` — paired DOWN present
- `427_kyc_india_scanner_verdict.sql` — paired DOWN present
- `428_kyc_india_cleanup_due.sql` — paired DOWN present
- `429_kyc_india_early_scan_retry.sql` — paired DOWN present
- `430_core_public_contact_footer.sql` — paired DOWN present
- `431_attest_current_definer_role_closure.sql` — paired DOWN present
- `432_niche_theme_catalog_v210.sql` — paired DOWN present
