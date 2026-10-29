# Merchant mobile parity — source handoff

30 October 2026, Asia/Kolkata. Branch `codex/merchant-mobile-parity`; base `55975acd0da3fd39bcff56168e19b05ff598bc43`. Worktree `/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy`. Primary checkout `/Volumes/Projects/LetBuyy` retains its substantial uncommitted Merchant web/UI work. No source was copied over that work.

## Qualified checkpoint

Latest source `753734ed581da332bfb1b66def881fa6758c762a`: 502/502 mobile tests, clean analysis, Gateway/client/web typechecks, shared model 12 pass and shared transport 97 pass/6 environment skips. History BEFORE run `08cc52ccd8a6` reproduced 6 defects with populated controls; final AFTER/contract run `086cc05cb2e1` passes 6/6 with cleanup. Native history now has a reachable product-filtered reader; its server binds the explicit store, current read grant and deterministic page/count. Scope acknowledgement prevents silent downlevel results. See `HISTORY_PARITY.md`. Latest exact-source clone governance passes 114/114. History APK bytes 148,869,275; SHA-256 `00be028035c9888a8b8c75babafa9f7d83e4ae086bcd075ab083a95a0455c5a0`, installed hash verified. Its native history journey remains unaccepted because Android System UI ANR repeated after a scoped reboot; the same owned AVD is now restarting with 4GB RAM/auto GPU, preserving its app data.

`fff025100c2ced7bcbc2fa0c18b99f0cfc7e800a`: 489/489 Flutter tests and analysis pass, shared Dart models 12/12, Merchant web typecheck and existing inventory adjustment component tests 8/8 pass. Inventory audit/reservation owner suites pass 17/17 in run `bf383e105a03` with cleanup; clone governance passes 114/114. See `INVENTORY_PARITY.md` for the bounded scope, runtime environments and open inventory work.

Earlier catalog checkpoint `496e8d36a241ed4f3de5025b6ed6a5ca3f3cd99a`: 459/459 Flutter tests and analysis pass, Gateway typecheck and 19 focused Gateway checks pass. Latest catalog read run `8c8f943da31a` passes 7/7 with cleanup. The latest exact-source disposable-clone governance gate also passes 114, with zero fail/blocked/skip and one report-only not-applicable. The exact latest APK built, its installed hash matches, and read-only catalog price/filter recovery was observed. Catalog read/editor privacy and final presentation/stale-page recovery checkpoints are committed. See `CATALOG_PARITY.md` and `PRODUCT_EDITOR_PARITY.md`.

- Inventory list/form lifetimes cover five existing screens; quantities retain missing-versus-zero, variant/location labels and backend low-stock range. Page metrics and local page filtering are labelled. Stock commands freeze their explicit target and intent in the existing encrypted journal; interrupted replies offer the same-key “Retry original,” with matching receipt and current authority required. The web parser preserves zero sellable quantity. Full native history/reservations/receipts/analytics and durable WMS lifecycle acceptance remain open.
- Customer services, list/detail/forms/exports retire old actor/store/query generations. Search and page browsing use the server. Segment create/edit/preview/readback uses canonical rules and statuses; web thresholds remain rupees and the segment PATCH BFF binds the selected store. See `CUSTOMER_PARITY.md`.
- Native storefront URLs, QR labels, copy/share/visit and settings use the canonical storefront root and active/TLS-qualified custom URL. Dashboard unavailable metrics remain unavailable; observed money preserves two decimal places. Gateway dashboard source counts canonical nondeleted customers/products, preserves paise and refuses failed mandatory reads instead of reporting zero.
- Domain registry/DNS/verify/history/primary/redirect/removal and checkout-address/readiness/fallback use the canonical existing owner. See `DOMAIN_PARITY.md`.
- Store selection rejects unknown/forged local models, retires A→B→A generations and orders preference writes against logout. Shipping/tax/money/domain screens fence stale-store actions.
- Payout release uses existing MFA proof and a stable encrypted retry key with readback. Razorpay sandbox connection is reachable without the stale plan restriction. Shared Merchant fee display is the constitutional 0%.
- Live registrar purchase is source-blocked until the canonical server can verify payment bound to actor, store, domain, quote, amount, environment and retry identity. This guard is not a live registration implementation and has not been deployed by this chat.

## Evidence

All receipts have bounded environments; no sum of these tests establishes production acceptance.

- Customer scope 17, native segment editor 6 and product editor/media 15 and catalog scope/widget 13 are included in the earlier 459-test checkpoint. Web form/BFF 3 and focused Gateway customer 11 pass; web/Gateway typechecks pass.
- Owned Gateway/PostgreSQL runs: payout `4500cb6bbc09` (24/24), domains `18910d8675cc` (10/10), customers `b545a4e97bf4` (4/4), dashboard `4998c1398392` (4/4), catalog `cc86ad39d07f` (5/5). Each runner confirmed no remaining owned containers, networks or volumes. Provider fixtures are synthetic.
- Product owner suites: run `f4f40c591ca4` passed summary 5/5 and staff 1/1, but atomic edits 89/90 failed a mandatory prepared-slot prerequisite (default 0). The unchanged atomic edit/rollback suite reran with supported `--prepared-transactions 2`, run `037c14a5b75d`: 90/90 pass and cleanup verified. Preserve the failed prerequisite receipt as well as the successful rerun.
- Customer-cache unsafe negative control failed as required; exact service restored and restored test passed. Receipts and source scopes are in `QUALIFICATION.json` and the domain/customer reports.
- Earlier source `75984e1efe15b476ea5d6d587b6da7103ce34699` iOS simulator debug build succeeded without production signing. Bundle manifest SHA-256 `0dc24f727644142a9788b6ef3541ca77a12e759937b882490487f2f1f0c33997`; Dart kernel SHA-256 `95e376babe12a54574f21430162427e9d94217fbf5fbcd935db558e0f70a9834`. This is not the latest Dart source.

## Android acceptance now observed

The user authorized ADB on the task-owned emulator and subsequently authorized the human-verification step. On the next observation the app was already signed in; no separate CAPTCHA click was issued or demonstrated. Authorized credentials were entered through the emulator and were not written to source, reports or command-line arguments.

The API 35/Android 15 arm64 emulator is `emulator-5580`, AVD `LetBuyy_Merchant_Parity`, owned under `/private/tmp/letbuyy-merchant-emulator-b2xr88lq`. Existing Jai-Shop AVDs were untouched. CUA could not select this emulator; the approved ADB fallback supplied actual UI input and screenshots.

Source `496e8d36a241ed4f3de5025b6ed6a5ca3f3cd99a` debug APK: 148,731,288 bytes; SHA-256 `6d44501ebe971d1edbf50f365130ae89396ef396799a3d80acd7df7719b8167d`. Flutter engine is arm64; plugin native libraries additionally contain armeabi-v7a and x86_64. The installed APK hash matches. Configuration is `dart-defines/production.json`, BFF `https://bff.letbuyy.com/v1`, issuer `https://accounts.letbuyy.com`.

Observed read-only owner journeys: authenticated dashboard; customer list and freshly loaded detail; server customer search returning no matches; rebuilt canonical storefront label; unavailable visitor/conversion values displayed as no data; catalog server search/page labels/older-server filter refusal; an existing product editor after successful fresh read without a save. The empty search image `android-customer-search-66543.png` contains no private customer rows. Private list/detail captures remain outside the repository. No production business mutation, payment, message, theme publication or provider operation was intentionally performed.

This is debug signing, not an Android release. Release key properties and the complete signing environment are absent. The current app remains signed in on the owned AVD for continuing approved read-only checks; logout and stop that exact emulator before discarding its owned directory. Do not touch other AVDs or broad-kill processes.

## Still open

The 122 rows remain an in-progress programme, not 122 accepted fixes. Native owner mutations, staff restrictions/revocation, web↔mobile writes/conflicts, complete catalog/media/options/collections/import, inventory/orders/settings journeys, provider sandbox, money effect-once/reconciliation, buyer checkout/GST/shipping outcomes, accessibility, signed Android/iOS, staging comparison and rollback remain open.

The primary web change set and the separate active shipping/tax work in the linked **Merchant Web Backend Enhancement** chat must be reconciled through accepted source before claiming parity. Do not overwrite, silently import or message that chat without user authorization.

Current continuation: finish exact history APK read-only/compatibility inspection after the owned emulator runtime recovery, then complete native reservation/receipt/analytics and durable warehouse lifecycle parity. History source and selected-store API repair now have populated real database proofs; that Gateway code is not deployed by this chat. Five workspace lifetimes and the stock-command retry boundary now have local/runtime evidence; PO/transfer/supplier/location lifecycle recovery remains open. Native catalog server queries/private cache and product-form context ownership now have bounded local/database/emulator receipts. Real CSV import/job retry remains open. The existing mobile “Import” screen selects existing catalog records; it is not CSV import. The existing server CSV job creator allocates a new job per request, so uncertain retry needs canonical owner work before a reliable native CSV flow can be accepted.

No push, merge, PR, deployment, migration or production-ready certification has occurred. Current verdict: **qualified source checkpoints and bounded authenticated emulator reads; full Merchant parity and release candidate remain in progress**.
