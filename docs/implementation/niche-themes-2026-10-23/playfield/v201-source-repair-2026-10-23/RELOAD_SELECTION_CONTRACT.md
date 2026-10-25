# Exact-edition reload: separate unimplemented obligation

Read-only inspection found no selected-edition URL restoration contract in the inspected canonical Liquid path:

- `apps/commerce/web/src/app/store/[subdomain]/product/[productId]/page.tsx:52` accepts product route params, loads the owned product and supplies it to composition. It accepts no selected-variant query argument.
- `apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx:938–1040` parses actual variants, tracks option input/pressed state, resolves availability and updates the existing facts controller. It neither writes a selected-variant URL nor restores selection from one.
- `apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts` builds the product URL from the product identity and supplies the existing picker carriers. It does not create an edition-specific link.
- `product-details-client.tsx:116` initializes the separate React fallback with first option values. That is not a canonical Liquid URL restoration contract and is not borrowed for this repair.

The inspected hydration file remains exactly SHA-256 `9e87ff6b8b18a8e2208ca770fc44c282a03632d575973e26f1cd34f1656088b4`. No route, URL handling, cart or domain source was edited. This bounded inspection does not claim an exhaustive repository-wide absence.

The 2.0.1 facts change resolves visible facts for a selection within the current page. It does **not** satisfy PF-I05's exact-selected-edition reload step. The old bare-URL reload still does not identify an edition; no universal bare-URL persistence behavior is inferred.

A later root allocation should first confirm the canonical URL convention, then use a durable product-owned variant ID and derive its actual options from that same row. Unknown/foreign IDs, missing/multiple values and option mismatches need explicit tests. Preserve unrelated query state and safe unselected behavior, and keep server cart/stock/fact acceptance authoritative. Do not use SKU, private metadata, stale local storage or submitted display facts as authority. No URL contract or implementation is introduced here.
