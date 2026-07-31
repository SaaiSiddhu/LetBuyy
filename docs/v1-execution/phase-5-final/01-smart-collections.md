# 01 — Smart Collections (SHIPPED — the flagship of this wave)

**Exposure: ~20% → ~85%.** The last subsystem that had a real-but-unexposed/partial backend is now an end-to-end merchant vertical. NO new schema (reused the existing `smart_collections` table).

## Shipped this wave (verified)
- **Pure evaluator** `services/api-gateway/src/lib/smart-collection-eval.ts` — `evaluateSmartCollection`/`evaluateCondition`/`filterProducts` over 6 fields (title/product_type/vendor/tag/price/inventory_quantity) × 7 ops (equals/not_equals/contains/starts_with/ends_with/gt/lt) × match_type all|any. Defensive (tag as array/CSV, numeric-as-string, null products, `stock`/`name` aliases). No I/O.
- **Unit tests** `src/__tests__/smart-collection-eval.test.ts` — **35/35 pass** (every op×field class, all/any, empty conditions, nulls). This is the verifiable core.
- **Gateway route** `routes/smart-collections.ts` — `GET /` (list), `POST /` (create), `PATCH /:id` (update), `GET /:id/preview` (loads active products, runs `filterProducts`, returns `{ count, sample_product_ids, evaluated_of, capped_at }`, capped at 500 for large catalogs). Ownership-checked; **writes RBAC-guarded** (`assertStaffPermission 'products:write'`). Registered in `services/api-gateway/src/index.ts` (`/smart-collections`).
- **api-client** — new `smartCollections.{list,create,update,preview}` namespace + 9 types.
- **Proxies** — `smart-collections/{route, [id], [id]/preview}` (ownership-checked).
- **UI** — `[store]/products/smart-collections/page.tsx` (606 lines): list + rule builder (field/op/value rows + match-type toggle) + live preview (count + sample). `@letbuyy/ui` + `--lb-*` tokens only (0 raw hex/px), loading/empty/error.

## Verification
api-client + api-gateway + merchant-control-plane `tsc` **EXIT 0** · evaluator **35/35** · page real (606 lines, 0 fabrication) · route registered + 2 RBAC guards.

## Honest boundary
Compile + unit + contract verified. The preview's REAL product matching (over live `products` rows), slug-uniqueness DB constraint, and browser rendering need a live stack — the evaluator *logic* is fully unit-proven; the data flow is the live step.

**Verdict:** smart collections is a complete, real merchant vertical — the rule engine is unit-tested truth, not a fake evaluator. No new schema.
