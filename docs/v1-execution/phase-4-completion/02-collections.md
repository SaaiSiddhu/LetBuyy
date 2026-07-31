# 02 — Collections

**Readiness: ~55% → ~62% (this phase fixed the edit/delete proxy).**

## Real
List, create, product assignment (add/remove via full-replace PUT), inline product search. Gateway GET(list)/POST/PATCH/DELETE + PUT products all present.

## Fixed this phase (verified)
- **Edit/delete proxy (was MISSING → would 404):** added `apps/merchant-control-plane/src/app/api/stores/[store]/collections/[collectionId]/route.ts` (PATCH + DELETE → `products.collections.update`/`remove`, ownership-checked via `resolveOwnedStoreId`, mirrors the products proxy). merchant-control-plane typecheck clean; contract test `lb-merchant-admin` 2/2.

## Remaining gaps (documented — UI, needs visual verification)
- **Collections page still lacks edit/delete BUTTONS** wired to the new proxy — the API path now exists; the UI control is the remaining step. HIGH (UI).
- No single-collection GET endpoint at the gateway (list only). MEDIUM.
- **Smart/automated collections** (rules/conditions) entirely absent — schema concept only, no gateway/UI. MEDIUM (V1.1).
- Collection image_url not in the create form; no sort-order control. LOW.

**Verdict:** manual collection create + assign is shippable; the edit/delete proxy is now in place, but the page buttons + smart collections remain.
