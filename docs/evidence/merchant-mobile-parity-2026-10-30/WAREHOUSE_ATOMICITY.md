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

## Current source qualification

Guarded owner source `125bcd1d3`; native counter repair `f44bc93af6fbaab3034aca30567d29fd3e2883a6`. Migration `414_atomic_warehouse_commands.sql` and its paired rollback are implemented in source. All five Gateway commands now use the existing stock writers and one immutable, actor/site/operation/target/intent-bound acknowledgement in the same tenant transaction. Raw execution of the five effects and two receiving-line helpers is closed. Original bodies remain; their search-path and actual privilege deltas are journaled for guarded rollback. The existing technical tenant registry includes the private receipt owner.

- Corrected before run `59d8aedc77e0`: **0 pass / 2 expected fail**, proving a committed PO after acknowledgement failure and direct raw `app_tenant` access. Initial `b3986b37d9bf` retains one real atomicity failure and a separate tenant-name fixture collision.
- Initial after `8ef6a510021a` lacked the owned pooled SQL binding and failed closed with 503; it is not a successful runtime proof. Correctly bound `32ab79fcae2b`: **2/2**.
- Expanded `89e9646503f1`: **12/12**. Final `dc5b4c3be74d`: **16/16** (13 lifecycle/authority + 3 rollback). Every run has verified resource cleanup.
- Final coverage includes mandatory receipt-write rollback of stock/document/audit/outbox; concurrent same-key exact responses; changed-body/parent conflicts; partial and terminal PO receive; full transfer-line ship snapshots and stock conservation; receive-all quantities frozen at first accepted execution; revoked/replacement owner and product-write staff denial; foreign products/locations/lines; unset/forged SQL context and temporary shadows; direct receipt read/update/delete denial; ambiguous legacy-key quarantine; empty DOWN/reapply; retained-evidence, changed-definition and actual prepared-writer DOWN refusal.
- Tenant red-team and fresh-database raw-access/opaque-journal run `441313f95296`: **8/8**. Existing protections were retained; the new private table is named with its one guarded callable owner.
- Acknowledgement contract tests: **16 pass / 3 fail before**, **19/19 after**. Full Gateway **1,867/1,867**, Gateway/web/SDK typing pass. Exact combined-source governance **114/114**.
- Actual server counters decoded as zero on native before: **0/4** focused model tests. The shared model now uses canonical ordered/requested/shipped/received fields and refuses missing/fractional/impossible counts. After **4/4**, full shared models **20/20**, full app **592/592**, clean analysis.

This remains local source qualification. The installed Android artifact is still settings source `863f556b1`; it does not contain the later quantity-model repair. No new hosted migration, deployment, production stock write, signed release or all-122 acceptance occurred.

## Next required work

Native and web durable WMS recovery, strict acknowledgement consumption, complete authorized selectors/list/detail pagination, explicit receive-line preparation, and actual client journeys remain open. PO/transfer mobile actions still use their old per-tap request path; the new server receipt is not yet consumed by the encrypted client journal. The list/read models still need their complete parent/child scope and metadata qualification beyond the repaired counters.

A pending original request can become permanently inapplicable after a concurrent terminal change. Do not clear it based only on a refresh or invent a new key. Before accepting recovery UX, provide a server-authoritative way to stop an unapplied logical request: serialize on the same original key, return any already-applied acknowledgement, or retain an immutable cancelled acknowledgement that prevents a delayed apply. Bind original actor/site/action/target/intent and quarantine ambiguous legacy evidence. Clients must distinguish applied and cancelled outcomes before clearing their encrypted intent or showing success. This stop/cancel protocol is **not implemented**; the current receipt schema represents applied commands only and requires a target ID, so create-cancellation needs explicit schema/contract work in the unreleased draft and paired rollback tests.

No carrier/provider or financial acceptance, native effect-once acceptance, broad performance SLO, release rollback certification or complete feature parity follows from these local backend proofs.
