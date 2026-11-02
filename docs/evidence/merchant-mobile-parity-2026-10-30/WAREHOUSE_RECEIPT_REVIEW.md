# Fresh warehouse details and reviewed receiving — 31 October 2026

Source `9bc3b34fcafb3171c6485ca16ad2f624470871cf`, branch `codex/merchant-mobile-parity`. This extends the qualified [protocol and exact parent pages](WAREHOUSE_PROTOCOL_AND_PAGES.md). Migration 414 remains source/local only. No push, hosted migration, deployment, production business write, provider operation, release signing or publication occurred.

## Connected behavior

Canonical scoped GET detail routes now serve purchase orders and transfers. Query and target parameters use shared schemas; current ownership and selected-site binding are checked before lookup. Deleted/missing parents return unavailable/not-found. Complete canonical header/line DTOs validate IDs, child/supplier scope, counters, dates, statuses and costs. SDK reads pin explicit site/target and no-store; new Dart verified-read factories refuse incomplete or foreign records. Ordinary details do not grant command permission.

Both web action forms fetch a fresh current-account detail before opening. The existing partial-receipt forms use its ordered/shipped/received counters and reject invalid local quantities before saving an intent. Late detail replies retire across store A→B→A. Two additional thin GET proxies remain in the existing gateway-proxy class; inventory/baseline/rationale are paired, count 235 and freeze tests unchanged.

Mobile receives now open an explicit line review after a verified fresh read. The review displays actual document number, product/SKU and variant identity when present, observed quantities and remaining receivable units. Whole units must be between zero and each current remainder; zero skips a line and all-zero receipts are refused. The confirmed explicit lines flow into the existing encrypted original-key journal and atomic backend owner. A committed lost reply retains recovery; retry does not change its key or quantities. Reserved transfers require shipping first, and shipping itself has fresh-detail validation and an explicit confirmation. Current server authority is checked again on dispatch.

Canonical document numbers are preserved in shared Dart models. Real UUIDs plus the partial status initially caused the old card header to grow until the Receive button was off-screen. The repaired card separates number, status and location content and bounds title/location wrapping. Real phone taps now pass with full IDs. Dialog controllers survive their exit transition and retire on store/context changes without dispatch.

## Qualification

- Active Flutter **630/630**, clean analysis. Focused reviews cover distinct variant lines, partial and zero quantities, fractional input, fresh denial, lost committed reply, shipment cancellation and store A→B→A retirement. Full pre-fix run **629 pass / one fail** is retained; the failure reproduced the off-screen transfer control, not an authority exception.
- Shared Dart models **60/60**, clean analysis; 31 strict document-read checks include populated positive controls and malformed identity, scope, lines, counters, dates, costs and supplier joins. Shared Dart API **97 pass / six existing local-stack buyer-auth skips**, clean analysis. Skips are not accepted journeys.
- Gateway unit/contracts **1,970/1,970**, including 51 canonical row/page/query/detail SDK checks and 42 acknowledgement/preflight checks. Gateway, SDK and Merchant web typing pass.
- Composed web **218/218**, including 83 actual Next proxy/SDK checks, rendered fresh-quantity preparation, denied/foreign details, retired reads, journal/recovery, settings and error contracts. These are composed local boundaries; authenticated headed browser-to-database acceptance remains open.
- Actual BFF transport **24/24**, clean typing. Tests include paged query preservation, fresh detail paths, credentials replaced by the internal session channel, no-store and unchanged upstream 403/503 outcomes; no unauthenticated forwarding.
- Owned Gateway/SDK/PostgreSQL/PostgREST run **`a933a87029ed`: 34/34** (31 lifecycle/protocol/page/detail plus three guarded rollback cases), zero skips, verified cleanup. Fresh SDK details reflect a later committed partial receipt while the earlier object stays unchanged; same-owner wrong-store lookup is 404, foreign access is denied, malformed scope is rejected, corrupt child scope fails closed and deleted parents disappear. Earlier command/receipt atomicity, replay, permission, 1,005-record pages and count recovery checks remain green.
- Exact-source governance **114 pass / zero fail/blocked/skip / one report-only not-applicable**. Unchanged app API boundary tests **6/6**, technical route inventory **235**.

Earlier local check failures are retained: the new SDK fixture initially expected a path without canonical `/v1` (39 pass / 12 fail); corrected SDK checks pass 51/51. New Dart interpolation findings and Worker/browser RequestInit test typing were corrected before qualification. No gate or authority assertion was weakened.

Receipts: `/private/tmp/letbuyy-warehouse-detail-owned-db.json`, `/private/tmp/letbuyy-warehouse-detail-governance.json`, and the corresponding `letbuyy-warehouse-detail-*` test/build logs. Owned cleanup confirmed zero containers, networks and volumes.

## Artifact and remaining acceptance

Arm64 debug APK: **148,998,801 bytes**, SHA-256 **`ad390df0fb34ec779a374aa6f2f8b1d85dbc90234226eba4c9ab179012a5d11a`**. Installed hash matches on the owned Android 15/API35 AVD `LetBuyy_Merchant_Parity`, console `emulator-5580`, isolated ADB port15038 / `127.0.0.1:5581`. Configuration targets the production endpoints; signing is debug. The allowlisted current observation is sign-in/security-check unavailable. No authenticated latest-build warehouse screen, device mutation, physical-device acceptance or release candidate is claimed. Private screen/account text and credentials are excluded.

Next source work includes authorized paged location/supplier/product/variant selectors and multi-line native creation, application list filters/search/sort, stronger list-option contracts and durable location/supplier creation recovery. Trace the current native security-check failure before authenticated device acceptance. Real web↔mobile fixture writes/conflicts, staff/owner journeys, remaining feature inventory, provider/money/buyer outcomes, performance, signed artifacts, staging and rollback/release gates remain open. None of these local results closes the full 122-item programme.
