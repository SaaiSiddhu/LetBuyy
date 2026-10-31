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

## Latest continuation — 31 October 2026

Fresh details and reviewed native partial receipts/shipments now extend the qualified protocol/pages at `9bc3b34fc`: **630 Flutter / 60 shared-model / 1,970 Gateway / 218 web / 24 BFF / 34 owned / 114 governance passes**. Analysis/types and owned cleanup pass. See [the current receipt-review checkpoint](WAREHOUSE_RECEIPT_REVIEW.md) for exact sources, failures, installed debug APK and remaining selectors/creation recovery and acceptance gates. Earlier sections retain their source-specific evidence.

## Current source qualification — 31 October 2026

Implementation **`96153cd20bc3db3dd2c7539e3a77bd159820fb05`**, composed with technical route registration **`3ed8c6078139680b1902273169f5f11cdc17a1e9`**. Registration changes only the maintained route inventory, its matching lint baseline and ownership rationale; application/service/package code is unchanged. Draft migration **414** and its paired rollback remain source/local only.

All five effects use the existing stock writers and one immutable actor/site/action/target/normalized-intent acknowledgement in the same tenant transaction. Same-key stop returns an applied acknowledgement or persists a cancelled request acknowledgement that prevents delayed application. It does not undo applied stock. Owner authority is rechecked before replay/stop; foreign/replacement/revoked actors and ambiguous legacy evidence remain denied. Raw execution of the seven existing effect/line helpers stays closed. Whole-paise PO costs preserve header/line totals.

Both clients now retain the original normalized intent/key before sending. Native reuses encrypted `SecurityCommandStore`; web uses actor/stable-site-bound localStorage and the browser lock interface. Browser remount, slug rename and cross-tab intent races retain the same logical request. Current actor/site workspace keys retire old forms and reads. Invalid, foreign or mismatched receipts retain recovery state. Only matched applied/cancelled receipts clear it; historical acknowledgements do not repopulate current reads. New stock actions are blocked while a request or storage problem remains unresolved.

PO and transfer workspaces expose **Retry original / Stop original**, including when their lists fail. The exact six warehouse POST paths require **`X-LetBuyy-Warehouse-Protocol: 1`**. Downlevel callers receive **426 WAREHOUSE_CLIENT_UPGRADE_REQUIRED** before effects or private replay; normal reads are unaffected. The marker declares client compatibility, not actor authority. Gateway/SQL still enforce identity, ownership and effect-once execution. The native BFF preserves the original body/key/store/marker while translating session credentials.

Web uses canonical shared PO/transfer DTOs: ordered/requested/shipped/received counters, `partially_received`/`reserved` states, server PO totals, and explicit transfer receive `quantity`. Supplier and child joins are scoped and deleted children excluded. Missing/foreign/impossible records fail closed. Unavailable reads do not show false empty collections or stale action rows. `prepareWarehouseCommand` in commerce-core is the shared normalization owner for Gateway and web recovery.

### Exact local and owned evidence

- Original before `59d8aedc77e0`: **0/2 expected failures**. `b3986b37d9bf` also contained a fixture-name collision; `8ef6a510021a` lacked the owned pooled SQL binding and failed closed. Preserve them as failed receipts.
- Earlier apply/stop checkpoints: `32ab79fcae2b` **2/2**, `89e9646503f1` **12/12**, `dc5b4c3be74d` **16/16**, `211d2d517382` **21/21**, `1f67a5b3afd0` **23/23**. Cleanup verified.
- Canonical readback **`9d03afda6438`: 21/21**. Actual SDK → actual Gateway → owned PostgreSQL confirms partial PO/transfer quantities, server totals, deleted-line exclusion and foreign supplier/line refusal.
- Latest **`f69cf06138f2`: 27/27** (24 lifecycle/SDK/authority/compatibility + 3 guarded rollback), cleanup verified. Includes all five typed SDK effects, exact replay, changed-intent rejection, committed-lost-reply recovery, stopped unapplied create, all-six-path downlevel refusal, and unchanged mandatory receipt/stock/audit/outbox rollback and authority controls.
- Populated tenant red-team/fresh-grant run **`228fb0ceff59`: 8/8**, cleanup verified. SQL ownership/privilege source is unchanged by this web continuation.
- Full Gateway **1,929/1,929**; composed Merchant web **175/175**, including **55 actual proxy/SDK tests**, **9 storage/journal tests**, and rendered lifecycle/recovery cases. SDK acknowledgement tests **31/31** are in the Gateway total. BFF **21/21**; native app **613/613**; shared models **28/28**. Analysis and Gateway/web/SDK/BFF typing pass.
- Browser remount tests initially found lifecycle-only metadata persisted into the journal: **97 pass / 12 fail**. The captured envelope now contains only the explicit recovery fields; corrected rendered/journal suite **110/110**, later composed checks **175/175**. Typed fixture errors are retained in earlier logs.
- Initial governance at `96153cd20`: **113 pass / 1 fail**, correctly detecting the unregistered thin stop route. The exact path was added to the existing `gateway-proxy` inventory and lint baseline, with rationale. Unchanged boundary tests **6/6**; final composed gate at `3ed8c6078`: **114 pass / 0 fail/blocked/skip / 1 report-only not-applicable**. No rule was disabled or weakened.

These are composed local boundary proofs. Rendered React/JSDOM tests, real route modules and the separate actual SDK/Gateway/PostgreSQL suites do not constitute a headed authenticated browser-to-database journey or a device mutation journey.

## Artifact, rollout and acceptance limits

Source `96153cd20` arm64 debug APK: **148,974,620 bytes**, SHA-256 `36a15b03b23b5677edef2104544413bd023aa7dfb0821e24a245e94e35e7ee54`, installed hash verified. Configuration is `dart-defines/production.json`; signing is debug. Task AVD is Android 15/API35 arm64 `LetBuyy_Merchant_Parity`, console `emulator-5580`, isolated ADB server port **15038**, serial `127.0.0.1:5581`. No other server or AVD was stopped. The current allowlisted accessibility check observes **sign-in / security-check unavailable**. No current authenticated warehouse journey or intentional production stock write occurred. Private screenshots stay outside the repository.

Accepted develop/staging were re-fetched on 31 October at `77584d19`; their maximum migration remains **413**. Primary checkout remains at `a72196c6e` with **153 dirty paths**, untouched. Its unaccepted draft migration `411_gift_card_issue_replay_integrity.sql` must be reconciled separately before promotion; it is not accepted shipping/GST source and must not overwrite this task's accepted baseline.

There was no hosted migration, deployment, release signing, publication, provider operation or all-122 acceptance. Release signing currently requires the already-named production keystore environment; no substitute release identity was created. A client marker alone cannot prove that an older Gateway/BFF has the guarded owner. Fresh protocol-capability preflight is now qualified locally; see the linked continuation for its exact boundaries. Rollout must retain the atomic owner/schema and test mixed versions; the populated receipt journal intentionally blocks destructive DOWN.

## Latest continuation — 1 November 2026

Scoped option readers and native multi-line creation now extend the existing journal. A real two-variant failure exposed and corrected the draft 414 lookup's nonexistent variant deletion column. Final integrated source `97edec1ea` qualifies **694 native / 64 models / 2,006 Gateway / 38 owned warehouse+rollback / 8 role / 114 governance** passes. [Exact failure, correction, artifact and boundaries](WAREHOUSE_NATIVE_CREATION.md).

## Next required work

1. Preserve the scoped preflight, original-intent recovery, fresh detail review and current authorized selectors/multi-line preparation.
2. Complete application search/filter/sort controls and canonical location/supplier creation recovery.
3. Verify actual web/mobile fixture writes/conflicts and device journeys, then the remaining catalog/orders/settings/features, provider/money/buyer effects, measured performance, signed artifacts, staging/source/schema compatibility and production readback. All 122 inventory rows remain in progress.
