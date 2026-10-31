# Warehouse command recovery — approved continuation

30 October 2026. Owner decision in this chat: **“Use current sequence after 413 (Recommended)”**. This resolves the historical MIG-R2 next-162 conflict for this task. It authorizes source and disposable local qualification with a paired rollback, not a hosted migration or deployment. Accepted develop/staging were re-fetched at `77584d19dc3dc557f29f9e2fbc7a967fe38e132c`; the reconciled tree's maximum migration remains 413. Migration 414 was subsequently authored here with its paired rollback after this check; no hosted migration was run.

## Evidenced gap

The five mutations are in `services/api-gateway/src/routes/inventory.ts`. PO create/receive and transfer create/receive call the existing stock RPC and then separately complete `IdempotencyExecutionAdapter`. A stock transaction can commit before its HTTP acknowledgement is saved. Transfer ship directly calls its RPC without that inner receipt. Its baseline function accepts an already-shipped transfer, rewrites line state, and returns the header without lines.

The five domain functions and two receiving-line helpers are already present in `database/supabase/migrations/000_baseline.sql`. They remain the stock/effect implementation. This work must not build another inventory engine, event bus, ledger, auth system or runtime.

## Required implementation and tests

1. Put the existing stock effects, their existing audit/outbox writes and a durable completed acknowledgement in one database transaction. Use the canonical tenant transaction adapter under `app_tenant`, validated actor/site GUCs and current live owner checks, including on replay. Keep owner-only warehouse authority; the existing product-write guard alone must not silently grant warehouse access to staff.
2. Bind each logical key to actor, site, operation, target and exact original command. Serialize same-key concurrency. Retain immutable acknowledgements for recovery; the expiring generic HTTP cache must not be the effect-once authority. Bypass outer HTTP replay only for the exact five route shapes after their domain receipt owner is implemented.
3. Keep PO/transfer headers, lines, receipts and stock effects scoped to the selected site. Lock authoritative resource state; return full stable header/line snapshots, including on ship/replay. Refuse changed-payload/actor/site/key reuse and ambiguous legacy commands instead of reapplying them.
4. Review and close direct Data API execution of the five raw RPCs and two line helpers once all active callers move to the guarded owner. Preserve function bodies and grants/configuration provenance for rollback. Test direct caller roles, GUC mismatch/unset context, foreign lines/locations/products, revoked owner and staff denial with populated positive controls.
5. Reuse the existing encrypted `SecurityCommandStore` on mobile. Persist the original intent/key before dispatch, restore it after restart and offer Retry original. Do not generate a new key after an uncertain outcome or infer completion from a refreshed status. Resolve explicit authoritative line quantities before receiving and preserve their original intent across retry.
6. Add canonical shared DTOs and bounded list/detail reads where the current WMS forms require them. Replace raw-ID entry and first-page/capped “complete” assumptions with actual authorized selections. Wire both web and mobile to the same command contract.
7. Prove dropped response recovery, same-key races, changed-body conflict, receipt-write failure rolling back all stock/audit/outbox effects, revoked access before replay, and terminal/partial receive behavior. Include database privilege/RLS, regression and rollback tests. A populated immutable receipt must prevent a destructive DOWN.
8. Qualify source, native/widget/API/database/browser journeys and current APK identity separately. No all-122, provider, hosted write or release-ready claim follows from these local checks.

## Current source qualification — 31 October 2026

Source `31d17b437fbc9139b5015545579840419d798502` completes the guarded apply/stop protocol and native encrypted recovery controls. Migration **414** and its paired rollback remain local draft source. No hosted migration or deployment occurred.

All five warehouse commands use the existing stock writers and one immutable actor/site/action/target/intent-bound acknowledgement in the same tenant transaction. The same-key stop operation returns any applied acknowledgement or persists a cancelled acknowledgement that blocks a delayed apply. It never represents an already-applied stock movement as reversed. Current owner authority is rechecked before private replay/stop; foreign or replacement owners, revoked access and legacy uncertain evidence remain denied.

Mobile persists the normalized original intent and stable key in the existing encrypted `SecurityCommandStore` before dispatch. A restored app retries that exact request. Same-intent concurrent taps share one in-flight request; changed intent is refused while unresolved. Missing, foreign, impossible or mismatched acknowledgements retain the original journal. Only a fully matched applied/cancelled receipt can clear it. Late account/store/session responses cannot clear the opening actor's request. Current reads are invalidated after acknowledgement; a historical receipt never repopulates a current list.

Purchase-order and transfer screens provide **Retry original / Stop original**, including when their primary lists are unavailable. New stock actions remain disabled until secure recovery storage is readable and no request is pending. A stop confirmation retires after A→B→A or account changes. Partial receive intent captures explicit line IDs and quantities. Whole-paise purchase costs are validated in both API schema and guarded SQL; positive 0.29/12.25 costs preserve header-to-line totals.

- Original before `59d8aedc77e0`: **0/2 expected failures**, proving committed effects after mandatory acknowledgement failure and raw `app_tenant` execution. Initial `b3986b37d9bf` also contained a separate fixture-name collision; initial after `8ef6a510021a` lacked the pooled SQL binding and failed closed. These are retained, not recast as successes.
- Earlier apply-only qualification: `32ab79fcae2b` **2/2**, `89e9646503f1` **12/12**, `dc5b4c3be74d` **16/16**. Stop protocol `211d2d517382` **21/21**. Latest composed run **`1f67a5b3afd0`: 23/23** (20 lifecycle/authority/precision + 3 rollback), verified cleanup.
- Current tenant red-team/fresh-grant run **`228fb0ceff59`: 8/8**, cleanup verified. The first retry used a stale test path and exited before suite execution; corrected canonical path is `tests/executable/tenant-redteam-postgres.test.mjs`.
- Full Gateway **1,877/1,877**, shared acknowledgement **29/29**, native app **613/613**, shared models **28/28**. Native journal **17/17** and inventory workspace **18/18** are included in the app total. Mobile/shared analysis and Gateway/web/SDK types pass.
- Exact-source disposable-clone governance: **114 pass, 0 fail/blocked/skip, 1 report-only not-applicable**.
- Native test-fixture compile/typed-map/header-name errors and four older scope fixtures were corrected; final full suites pass. Earlier failed logs remain under `/private/tmp/letbuyy-warehouse-*`.

## Device and release limits

Debug APK at this source: **219,779,455 bytes**, SHA-256 `0ffb0b96792516a329738615deb1d201f3a639cd1a42b2a767995fd44f79af8d`, installed hash verified on the same task-owned Android 15/API35 arm64 AVD. The default shared ADB port was occupied; an isolated task server uses port **15038**, serial `127.0.0.1:5581`, paired to emulator console `emulator-5580`. No other server or AVD was stopped. Ownership metadata remains in the task's private temporary directory.

The restored emulator returned to sign-in with a security-check-unavailable state. Authenticated latest-build warehouse acceptance is **not demonstrated**. Its screenshot contains an account identifier and remains private; it is not committed. Earlier authenticated read screenshots describe their own earlier source only. There was no production stock write, provider operation, signing/publication, hosted migration or deployment.

## Next required work

Complete web durable WMS recovery and strict acknowledgement consumption; complete authorized selectors, full list/detail pagination/counts, and native partial-line editing. Canonical web DTO/status drift is currently being repaired separately: the old web model used `quantity`/`received_quantity`/`partial`/`pending` instead of actual ordered/requested/shipped/received counters and `partially_received`/`reserved`, and transfer receipt payloads used `quantity_received` instead of `quantity`. That continuation needs its own source and runtime receipts before acceptance.

Native list/read models still need complete parent/child/supplier scope and metadata qualification beyond the repaired counters. Real web↔mobile fixture writes/conflicts, browser/native acceptance, provider/financial checks, performance, signed artifacts, staging/source-schema compatibility and release rollback remain open. All 122 rows remain in progress; no complete parity or production-ready claim follows from this checkpoint.
