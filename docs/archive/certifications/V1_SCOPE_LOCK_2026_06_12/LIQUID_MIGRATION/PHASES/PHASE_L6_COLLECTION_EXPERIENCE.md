# PHASE L6 — COLLECTION EXPERIENCE

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only.

1. **Purpose.** Render `/collections/:slug` (and `/shop`) through a Liquid `collection` template with the real collection + its products.
2. **Repository Reality.** The collection route delegates to the composition engine (`collections/[slug]/page.tsx:128`) and fetches real products via `getCollectionWithProducts`; but `buildLiquidCommerceContext` reconstructs `collection` from `plan.route` + scraped products and **discards the real title/description** (`composition-engine.tsx:301-308`); no `collection` template exists (→ `index` fallback). `product-grid` parity section iterates `{% for item in collection.products %}` (`theme-bundle.ts:1059`).
3. **Current State.** Collection products available; title/desc lost; no template; unstyled.
4. **Target State.** A `collection` template binding real `collection.title/description` + the product loop with pagination/sort.
5. **Files To Modify.** `composition-engine.tsx:301-308` (pass real `collection` drop incl. title/desc — add a `collection` field to `SectionRenderData`/`types.ts` and populate from `collections/[slug]/page.tsx`); `theme-bundle.ts` (`collection` template + grid section).
6. **Files To Create.** None.
7. **Files To Delete.** None.
8. **Dependencies.** L5.
9. **Validator Impact.** Schema; none deleted.
10. **Migration Impact.** None.
11. **Testing Requirements.** Render test: `{{ collection.title }}`/`description` bind; `{% for item in collection.products %}` emits product cards; empty collection → empty state; pagination/sort if in scope.
12. **Performance Requirements.** Collection pages can be large — paginate the product loop; ISR cache; render within `renderLimit 250` (cap rendered items per page).
13. **Security Requirements.** Collection/product strings escaped; URLs validated.
14. **Tenancy Requirements.** Collection fetched by store subdomain (tenant-scoped); `collections`/`collection_products` RLS-governed.
15. **Identity Requirements.** N/A (guest browse).
16. **Money Requirements.** Prices display-only; authoritative at cart/checkout.
17. **Rollback Plan.** Remove the `collection` template key → `index` fallback (or React if canary off).
18. **Success Criteria.** Canary collection page renders Liquid with real title + product grid.
19. **Exit Criteria.** Collection render tests green; collection parity cells green.
20. **Evidence Requirements.** Rendered collection page; passing binding tests; the `SectionRenderData.collection` population diff.
