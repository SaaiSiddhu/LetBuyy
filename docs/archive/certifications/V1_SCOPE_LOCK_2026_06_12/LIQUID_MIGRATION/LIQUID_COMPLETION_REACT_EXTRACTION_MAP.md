# LIQUID_COMPLETION_REACT_EXTRACTION_MAP.md

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · code-cited. KEEP / MIGRATE / DELETE per React artifact, with proof. Deletion is governed (ART-17: not before the hardening-wave data decision; archive + lockstep validator edit).

## DELETE (render layer — only at L17, after parity proof)

| Artifact | Files (lines) | Replaced by | Proof required before delete |
|---|---|---|---|
| 20 sections | `components/sections/*.tsx` (2,604) | Liquid sections (L5-L13) | per-section parity green; edit `no-new-react-sections:9-30` + `theme-governance-validator:69-72,98-101` |
| Registry + React branch | `renderer-registry.tsx` (276), `composition-engine.tsx` `RenderSectionList`, `editor-preview-section-frame.tsx` (93) | Liquid render | all 20 gone; remove `theme-governance-validator:82-83` fallback req |
| Cart page | `cart/page.tsx` (199) | L8 Liquid cart | cart parity green |
| Product body | `product-details-client.tsx` (555) | L5 Liquid product | **remove `typescript-dead-source-validator:141` `exists()` lock** |
| Account pages | `account/{orders,addresses,settings,wishlist}/page.tsx` (980) | L10/L11 templates | account/order parity green |
| Order lookup | `orders/orders-client.tsx`+`orders/page.tsx` (466) | L11/L12 templates | order parity green |
| Policies | `privacy/terms/returns/shipping` (231) | CMS/Liquid `page` | content render |
| Contexts | `cart-context.tsx` (265), `customer-auth-context.tsx` (221), `wishlist-context.tsx` (92) | islands + `/api/customer/session` | last consumer gone |
| Dormant pkg | `runtime-composition` | — | ART-18: unwire then delete |

## MIGRATE (reimplement as Liquid, then the React version becomes DELETE)

The 20 sections, the chrome (`layout.tsx:214,224` header/footer → Liquid), and all bespoke pages above. Each migrates in its phase (L4-L13) before deletion (L17).

## KEEP-PERMANENT (engine-agnostic — Liquid reuses; never delete)

- Render backbone: `composition-engine.tsx` (Liquid branch), `template-resolver.ts`, `data-binding-engine.ts`, `product-route.ts`, `content-route.ts`, `types.ts`, `liquid-hydration-islands.tsx`.
- `layout.tsx` provider + `:root` CSS shell (`:123-212`).
- Services: `store-service.ts`, `product-service.ts`, `order-service.ts`, `customer-service.ts`, `content-service.ts`, `seo.ts`, `session.ts`, `lib/api/*`.
- All 22 `app/api/*/route.ts` proxies (Liquid + React call them) — `domain-boundary-validator:209` count==127.
- Composition page wrappers (home/shop/product/collection/CMS/blog `page.tsx`) — render Liquid when a bundle is present.

## KEEP-PERMANENT (constitutional)

- **Checkout** (`checkout-client.tsx` 1,160 + `checkout/page.tsx`) — the hosted `checkout.letbuyy.com` React origin (Constitution §234). "Full Liquid storefront" does **not** mean a Liquid checkout (Shopify deprecated `checkout.liquid` too). **Never delete.**

## Deletion gate (ART-17)

No artifact moves from KEEP-TEMP to DELETE until: (1) parity green for its surface, (2) production soak clean, (3) the hardening-wave data decision, (4) gate green at the lockstep-edited validator counts, (5) the archive copy under `docs/archive/dead-code/`. See `REACT_DELETION_EXECUTION_PLAN.md`.
