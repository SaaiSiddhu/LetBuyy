# Staging415 maintenance proposal — 1 November 2026

Status: prepared; **not authorized for hosted execution**. The latest owner decision explicitly approves warehouse414 + gift-card415 **source/local only**. This proposal extends only staging. `scripts/supabase/README.md` requires fresh verified recovery/restore, exact history admission and an approved maintenance window before hosted execution.

## Concrete candidate

| Item | Qualified identity |
| --- | --- |
| Source | `7b76ffed97e9f1f4c18e9dc0162ada3e7257ddd6` |
| Hosted migration requested | `415_gift_card_issue_replay_integrity.sql` only; paired rollback retained |
| Forward / DOWN source SHA256 | `7428049658b49d6223b928cd11f65a6a8f4b809411efbf57417b5862d699da3d` / `4a88c350b741c37e866be721a6f21eca240aeb486926ee12fd472214a745e76a` |
| Prepared journal batch | `e8457e86473d49985794c312a7a278da6329ab51cef4a15452b757880a8dee4d` |
| API main module | `34204b6c3396fb9c8771526b9cc4dd0a7ee60d6308bc318305dec333c13eeceb`; both WASM modules retained |
| Protected Merchant prebuilt tree | `685cf603aa7ee1cb57b7f03745e1a12fad16cc99e938082bedf5011adda77f04` |
| Current read-only database precondition | Staging342 history rows;414=`atomic_warehouse_commands`;415 and replay index absent |

Local proof:114 governance validators;95 checks across nine current owned Gateway/Postgres suites; the unchanged tenant red-team cases pass in an isolated cluster; 1,636 Merchant,2,027 Gateway and75 UI checks; typing/build and output secret checks. Approved encrypted pre414 staging snapshot rehearsal preserves all523 original tables and proves exact UP/DOWN/UP history and gift-card function/index rollback. Details and retained failed attempts are in MERCHANT_SOURCE_INTEGRATION.md.

## Requested maintenance window and checks

1. Re-read current staging migration history and exact API/BFF/Accounts/Merchant source, settings and alias metadata. Abort on unreviewed source drift or any changed migration identity. Preserve current production application aliases, Worker versions, production database, credentials, all existing protections and both export CDN rules.
2. Refresh the approved private encrypted **staging** recovery backup (public commerce, auth/session data, storage metadata, migration history; no provider-role passwords or plaintext retained), keeping old archives. Restore the fresh snapshot in an isolated owned local PG17 container. Rehearse415 only against the already committed414 state, preserve every original row/history and verify the paired rollback/function/index. Verify existing gift-card issue keys have no duplicates; stop for reconciliation if they do.
3. Reconcile the fresh history digest. Prepare a new415-only journal if freshness requires it, preserving exact source/executed provenance. Execute once on one certificate-verified staging maintenance backend. Inspect history, index, function/ACLs and retained state before any retry. **Never execute414 again** or mark unexecuted SQL applied.
4. Activate the exact admitted **staging API** and protected **Merchant Preview/staging** artifact. Preserve all existing secrets/bindings,64-variable budget and deployment protection. BFF and Accounts source/versions remain the existing qualified ones unless an independently evidenced compatibility repair is needed. No new provider secret, paid upgrade, public protection exception, Git push, main/staging branch promotion or production application/schema activation is included.
5. Run named synthetic owner/staff/current-permission web↔native SDK and UI journals, two-store retirement and denied access, original-key replay/readback and stock conservation. Preserve the existing13 immutable warehouse receipts. A controlled native test transport may keep existing Vercel access outside the app; no bypass token in the APK or alternate identity issuer. Report normal password/SSO/CAPTCHA acceptance separately.
6. Preserve committed415 and its durable data if a later client/artifact check fails. Stop new synthetic mutations, reconcile the exact outcome and select compatible forward recovery. Do not blindly DOWN415 after use, roll back414, erase money/warehouse receipts or restore raw write grants.

## Scope and limits

Staging project only, with current protected `admin-staging.letbuyy.com`, existing Accounts staging and BFF/API staging origins. Fresh encrypted backup stays in the private task recovery area with the existing separately protected recovery key; no credentials or private row contents in reports. Synthetic commerce only; no real charge, refund, payout, registrar order, account/legal acceptance, outgoing customer communication or publication.

Production remains limited to the separately approved, completed CDN export guard. Full122 acceptance, permanent private export storage, durable CSV import, provider sandbox and signed-release gates remain open.
