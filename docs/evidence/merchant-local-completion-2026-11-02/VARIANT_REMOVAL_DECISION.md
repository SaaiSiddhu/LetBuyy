# Variant removal: source/local product decision

Current source includes migrations through437. No schema change is proposed for hosted execution.

The current canonical `apply_product_edit_v1` removes omitted variants physically and refuses removal when inventory, order, purchasing, transfer, return or price-history references exist. Canonical insertion records price history, so a normally created saved variant is already protected. Unsaved draft rows can be removed safely; their option definitions are cleared when the last row is removed. The current API's refusal must never be bypassed by deleting history or stock records.

Decision needed under AGENTS.md PRIME-R1: “When the correct action is unclear ... escalate to a human ARB decision; do not improvise architecture.” The user authorized local implementation but has not chosen the business behavior for retained variants.

Recommended: retire a saved variant in the existing `product_variants` authority only when its physical/free/held/committed/incoming quantities are zero and no open purchasing/transfer/fulfillment work depends on it. Preserve its UUID, all price/order/audit records and stock history. Exclude retired variants from sellable catalog, new cart/checkout, selectors and new stock commands; historical order views keep their saved facts. Retiring a held or operationally active variant returns an actionable refusal with zero effects. Unsaved rows continue to be removable without server effects.

Alternative: keep the existing rule that every referenced variant must remain; make the saved-row UI explain the restriction and retain the current no-write response. This does not deliver per-variant retirement.

If retirement is approved, implement one nullable `deleted_at` marker on the canonical table, using only the existing product command/receipt and canonical transaction, never a second variant table or service. Use the legitimate next unused sequential migration (438 at this snapshot, recheck before writing) with paired guarded DOWN. The DOWN must refuse retained retired rows rather than re-expose them. Preserve exact function/role/ACL profiles and test expand/backfill/read parity, populated retention, empty rollback/reapply, concurrent stock/retirement and replay. No retained object/history is deleted.

Affected owners to qualify before closure: shared Product contracts; canonical product snapshot/edit/creation; storefront product/variant projections and Liquid drops; canonical cart and checkout fact capture; inventory reserve/adjust/absolute setters; warehouse selection/new purchasing/transfer commands; web/native editors and readback. Every writer must refuse retired IDs under current tenant/role context. Cover positive controls, foreign tenant, missing context, revoked staff, stale version, lost reply and buyer cart created before retirement. Keep money/order history immutable.

This is a reviewable proposal, not an implementation or migration approval receipt. Continue the already authorized new-product creation, native draft removal, permission and buyer verification independently. Production/staging changes, merge/push and provider operations remain outside this local assignment.

## Human decision received 2026-11-08

The user explicitly approved: “Retire when stock/open work are zero (Recommended)”. This admits the reviewed canonical-table retirement change, migration438 with guarded paired DOWN, and source/local qualification only. Hosted execution, provider effects, merge and push are excluded. This decision supersedes the proposal’s pending wording above.
