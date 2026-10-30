# Warehouse command recovery — approved continuation

30 October 2026. Owner decision in this chat: **“Use current sequence after 413 (Recommended)”**. This resolves the historical MIG-R2 next-162 conflict for this task. It authorizes source and disposable local qualification with a paired rollback, not a hosted migration or deployment. Accepted develop/staging were re-fetched at `77584d19dc3dc557f29f9e2fbc7a967fe38e132c`; the reconciled tree's maximum migration remains 413. Recheck availability before creating 414.

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

## Current state

Decision received; source-numbering blocker resolved. The atomic warehouse migration, command owner and client recovery are **not yet implemented or accepted**. Shipping/settings source qualification is separately recorded in `SHIPPING_TAX_PARITY.md`. This document records the exact continuation boundary; it does not turn the proposed work into completed evidence.

