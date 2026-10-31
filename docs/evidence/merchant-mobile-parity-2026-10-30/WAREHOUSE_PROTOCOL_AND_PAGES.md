# Warehouse protocol and parent pages — 31 October 2026

## Qualified source

Server preflight: `b1563d2b165feb4fb78556b46d826113296dda2f`. Connected parent pages: `dcff47de1d7e0d985906200c2909bb480ac9d820`. Verified far-page recovery: `a45d682829744b8ce4e8bf010fd62b7c5b13a25d`. All are local commits on `codex/merchant-mobile-parity`; no push, hosted migration, deployment, provider operation, release signing or publication occurred.

Both clients require a fresh, private server descriptor matching the current actor, site, protocol, guarded execution policy and stop support. The SDK checks before each POST and binds its receipt to the descriptor's actor. An older/unavailable server receives no warehouse POST; an existing pending request remains recoverable with its original intent/key. The descriptor describes guarded code and does not assert migration readiness or grant permission. The actual Gateway rechecks authority and refuses execution without its atomic SQL binding. The existing protocol marker still refuses unsupported older clients before stock effects/private replay.

Purchase-order and transfer parents now have canonical validated page/limit, status, literal number search and deterministic newest/oldest ordering. The selected store is mandatory; exact matching counts, scope, continuation, populated canonical rows and duplicate identities are checked. Gateway reads exclude soft-deleted parents/lines and preserve supplier/child scope. SDK and Dart transport carry bounded pages. Both apps show count/page controls, recover Previous after a denied page and retire the old store's rows. Filter/search/sort controls still need application UI; the transport contract alone does not complete them.

Out-of-range PostgREST pages require an exact count read with the same store and filters. A missing/failed count cannot become zero. If the population has grown into the requested page, empty data fails validation and requires a refresh. Pages are current reads and do not promise a snapshot spanning multiple requests.

## Verification and reproduced failures

- Full active Flutter: **623 pass, zero fail**, clean analysis. Native widget fixtures exercise real page taps at 390×844, denied next-page recovery, old/mismatched metadata and store retirement. They caught the initial FAB overlap; page controls now sit above the list.
- Gateway unit/contracts: **1,958 pass, zero fail** at `a45d68282`, including SDK acknowledgement/preflight **42** and canonical row/page/query **39** checks. Gateway, SDK and web typechecks pass.
- Composed web: **200 pass, zero fail** across rendered lifecycle, actual Next proxy/SDK, browser journal, error recovery and settings contracts. Actual list requests carry the current actor header. This is composed local evidence, not an authenticated headed browser-to-database journey.
- Shared Dart models: **29 pass**, clean analysis at `b1563d2b1`; unchanged by pagination. Shared Dart API: **97 pass, six existing environment-dependent skips**, clean analysis. Skips are not acceptance evidence.
- BFF: **22 pass**, clean typecheck at `b1563d2b1`; its source is unchanged by pagination. Route-boundary tests remain **6/6**, technical inventory **233**. Both preflight and final composed governance pass **114, zero fail/blocked/skip, one report-only not-applicable**.
- Owned preflight run `574f385f5ba3`: **30/30**. Initial page run `0844909ec1c8`: **30 pass / two fail**, reproducing the far-page range defect. Repaired composed run `f4fe172c783a`: **32/32** (29 command/protocol/page cases plus three guarded rollback cases). Both document populations contain **1,005** synthetic records; tests reach the final page, check stable ties, literal wildcard search, status matching, deletion, failed count recovery and revoked access. Each runner verified zero remaining owned containers, networks and volumes.
- A broader package test command also entered the full DB lane. The exact task-owned runner PID 21271 was stopped through its cleanup handler, exit 143. Subsequent queries of its ownership labels found zero containers, networks and volumes. No whole-database-suite pass is claimed.

Raw receipts: `/private/tmp/letbuyy-warehouse-preflight-owned-db.json`, `/private/tmp/letbuyy-warehouse-preflight-governance.json`, `/private/tmp/letbuyy-warehouse-pages-owned-db.json` (failed reproduction), `/private/tmp/letbuyy-warehouse-pages-range-owned-db.json`, `/private/tmp/letbuyy-warehouse-pages-range-governance.json`; corresponding test logs retain earlier failures.

## Artifact and open acceptance

The `dcff47de1` arm64 debug APK is **148,982,797 bytes**, SHA-256 `537b0d76c0fcda523ef187b575b008c90a4cc63d827520c0947b42e1c9a81bd0`. Installed bytes match on task AVD `LetBuyy_Merchant_Parity`, Android 15/API35 arm64. Its native/Dart source is unchanged at `a45d68282`. Production endpoint configuration is used; signing is debug. Isolated ADB is port 15038 / `127.0.0.1:5581`, console `emulator-5580`; the shared server was preserved.

The allowlisted screen check observed Merchant sign-in and security-check unavailable. No authenticated latest-build warehouse screen, device stock mutation, physical device or signed release was accepted. Account text, credentials and private screenshots are excluded from repository evidence.

Next required source work: fresh scoped PO/transfer detail reads and stronger native read validation; native partial-line receiving with explicit review; authorized location/supplier/product/variant selectors and multi-line creation; application search/status/sort controls and durable location/supplier creation recovery. Then real web↔mobile fixture writes/conflicts, remaining feature inventory, provider/money/buyer outcomes, performance and release gates. Migration 414 remains source/local only; production must retain its atomic owner/schema and qualify mixed versions. Full 122-item acceptance remains open.
