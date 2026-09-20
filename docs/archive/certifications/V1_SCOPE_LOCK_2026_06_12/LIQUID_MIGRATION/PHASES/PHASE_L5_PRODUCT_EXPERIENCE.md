# PHASE L5 — PRODUCT EXPERIENCE

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only.

1. **Purpose.** Render `/product/:id` through a Liquid `product` template with real data and a working add-to-cart/variant experience.
2. **Repository Reality.** The product route delegates to `StorefrontCompositionEngine` (`product/[productId]/page.tsx:75`) and feeds a real `product` drop (`productToLiquidDrop` `composition-engine.tsx:229`); a `product-detail.liquid` section exists but is orphaned (no `product` template references it, so the route falls back to `index` `template-resolver.ts:127-137`); the body today is React `product-details-client.tsx` (555 lines). The `lb-variant-picker` island toggles selection but does **not** recompute price.
3. **Current State.** Product data binds in principle; no `product` template; variant picker cosmetic; unstyled.
4. **Target State.** A `product` Liquid template composing product-detail + related sections; variant→price recompute; add-to-cart via `lb-add-to-cart` → real cart.
5. **Files To Modify.** `packages/theme-engine/src/theme-bundle.ts` (adopt `product-detail` into a `product` template; deepen); `apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx` (variant→price); `composition-engine.tsx` (product drop completeness incl. variants/price/compare).
6. **Files To Create.** None (sections exist).
7. **Files To Delete.** None — `product-details-client.tsx` is KEEP-TEMP (and `exists()`-locked by `typescript-dead-source-validator.mjs:141`) until L17.
8. **Dependencies.** L1, L2, L4.
9. **Validator Impact.** `LiquidThemePackageBundleSchema`; none deleted; the product-details lock stays until L17.
10. **Migration Impact.** None (product data via gateway).
11. **Testing Requirements.** Render test binding `{{ product.title }}`, `{% for image in product.images %}`, `{{ product.price | money_with_currency }}`; variant-select updates price + add-to-cart payload; out-of-stock disables add. **Replaces grep-only coverage.**
12. **Performance Requirements.** Product page is high-traffic — ISR `revalidate=60`; cache the product fetch (`ProductService`); render within limits; images via existing CDN.
13. **Security Requirements.** Product strings escaped (`outputEscape`); the add-to-cart island posts to the server cart which re-prices server-side (client price not trusted, `cart-routes.ts hydrateCartLines`).
14. **Tenancy Requirements.** Product fetched by store subdomain (tenant-scoped); product tables RLS-governed.
15. **Identity Requirements.** N/A (guest browse); wishlist add (if shown) uses the customer session.
16. **Money Requirements.** Price is display-only in Liquid; authoritative pricing is server-side at cart/checkout (`cart-routes.ts`, `create_checkout_order`); no money mutation in render.
17. **Rollback Plan.** Remove the `product` template key → route falls back to `index` (or React if canary off). No data.
18. **Success Criteria.** Canary product page renders Liquid with live data, working variant repricing, and a server-backed add-to-cart.
19. **Exit Criteria.** Product render + island tests green; product parity cells green (L14 feeds from here).
20. **Evidence Requirements.** Rendered product page; passing data-binding + island tests; a cart line created from a Liquid PDP.
