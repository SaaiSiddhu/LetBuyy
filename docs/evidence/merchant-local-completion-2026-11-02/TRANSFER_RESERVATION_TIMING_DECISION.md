# Transfer stock timing: shipment commitment approved

Human approved3November2026: **Commit when shipped (Recommended)**. Implement the recommended existing-kernel plan below. Local-only source and owned qualification; no hosted execution, provider operation, push or release.

## Proven defect

Owned run `6947c206da30` executed4tests:1positive pass,3behavioral failures,0skip; runner1and empty cleanup. Baseline source is the already archived warehouse-label23b83f0f… plus the new diagnostic `merchant-transfer-cart-reservation.postgres.test.ts`. Raw reports/logs remain under `/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8/transfer-cart-negative-v1*`.

With20units:

- Canonical `reserve_inventory` holds4without decrementing raw `available`:20available/4reserved. The actual public cart accepts16and rejects17. This positive control passed.
- Existing transfer create instead writes16available/4reserved. The real cart and canonical kernel subtract the hold again and expose12; the actual public cart wrongly rejects16with409.
- An existing canonical customer hold18still lets a transfer of4commit201, even though only2units remain unheld. The expected no-effect409refusal failed.

These are real Gateway/public-cart/database observations. Direct SQL kernel probes are domain tests, not normal Merchant-login or tenant-isolation proof.

## Established authority and unresolved policy

DOC03at205names the **single reserve→commit lifecycle** as Inventory's winner. No approval is requested to keep a competing stock authority.

The unresolved choice is **when an outbound shipment commits that canonical reservation**. Today shipping updates the document; the old transfer hold remains until destination receiving. Moving commitment to shipment changes existing stock timing and retained-data interpretation. Neither current authority nor a prior human decision specifies that timing. [AGENTS.md PRIME-R1](../../../AGENTS.md:45) says: “When the correct action is unclear … escalate to a human ARB decision; do not improvise architecture.” This decision applies that rule; no new runtime, allocation engine or second reservation system is proposed.

## Recommended: commit the canonical reservation when shipping

1. Transfer create uses the existing canonical reserve kernel. Add the minimum nullable reservation reference to existing transfer lines; preserve all original IDs, commands and immutable receipts.
2. Shipping commits that reservation once. Source location stock is then committed out; destination receiving adds the exact received units without subtracting source stock again. Transit quantities remain derived from existing transfer-line shipped/received counters, not a new authority.
3. Private quantity projections must have one explicit basis: physical stock, reserved subset and current free/sellable units. Do not count a hold twice. Audit adjustment, catalog-cache and default-fulfilment consumers before changing their displayed/input basis. Do not sum all locations into a cache by assumption.
4. Reconcile retained pending transfers under locks. Require exact reservation/transfer conservation; refuse ambiguous or oversubscribed populations rather than inventing stock. Convert eligible records through the same canonical kernel, retaining original warehouse acknowledgement bytes. Fully received historical records remain intact.
5. Use next legitimate migration436only if still unused after preflight; current worktree max435and read-only primary max432/HEAD5614ffa7…were verified3November. Ship paired DOWN. Preserve current414/435and native catalog/provenance guards. Any new collision remains a separate source reconciliation.
6. DOWN proves empty/install UP→DOWN→UP. It must refuse when converted or newly committed operational evidence prevents a lossless reversal; retained-data recovery then uses a compatible forward repair. Never erase business/audit receipts to green rollback.
7. Qualify positive controls, both oversell and undersell refusals, current/default/other locations, variants, multi-line atomicity, concurrent reserve/transfer/ship/receive, duplicate/replay/stop, stale authority, historical acknowledgement equality, retained data and strict rollback. Update existing v11 stock expectations only for the approved timing, preserving the failed baseline. Run full relevant suites/governance and fresh normal web↔Android/compiled-runtime readback.

Illustration:20physical, reserve4→20raw/4reserved/16free; ship4→16raw/0reserved/16free/4in transit; receive1→16at source+1at destination/3in transit. Unrelated customer holds survive every step.

## Alternative: retain commitment at destination receiving

Keep the existing timing, but complete **partial commitment inside the canonical reservation owner**, with original reserved intent and cumulative committed/released amounts represented explicitly and validated across every kernel caller. Each partial receipt commits exactly its quantity. This is a wider kernel/schema cutover affecting release/expiry, replay, order and retained-data contracts; a bespoke transfer-only subtraction path is not acceptable.

Both choices remain local-only. Normal location/supplier and PO/transfer v11acceptance stays separately pinned to its original source/APK; it does not certify either unimplemented proposal.
