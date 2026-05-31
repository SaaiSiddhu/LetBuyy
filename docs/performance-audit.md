# Urban Kicks Performance Audit

Date: 2026-05-31

## Status

PASS WITH PREVIEW LIMITATION

The storefront production build passes, image rendering for the active Urban Kicks shopping path uses `next/image`, and public storefront reads now use explicit revalidation hints. Full route-level static output is still blocked by the shared storefront layout reading the theme-preview cookie so merchant editor previews can override header and footer state.

## Verification

- `pnpm turbo typecheck --filter=@letbuyy/storefront-runtime`: passed.
- `ANALYZE=true pnpm --filter @letbuyy/storefront-runtime build`: passed.
- Bundle analyzer artifacts: not generated because no analyzer plugin is wired in `apps/storefront-runtime/next.config.ts`.

## Build Result

The Next.js build completed successfully and generated 35 static pages. Tenant storefront routes are still marked dynamic (`ƒ`) because the store layout resolves a preview token through cookies. Public data fetches under those routes now use cache revalidation even though the route shell remains dynamic.

## Implemented Optimizations

- Converted the Urban Kicks hero background image path to `next/image` with `priority` and `sizes="100vw"`.
- Kept above-the-fold product detail media on `next/image` with `priority` and stable responsive sizes.
- Converted product cards, featured products, category cards, portfolio cards, about images, cart item thumbnails, cart drawer thumbnails, and search-result thumbnails to `next/image` with stable dimensions or `fill` plus `sizes`.
- Added public storefront fetch cache hints:
  - Store, navigation, content, and page data: 60 second revalidation.
  - Product listing reads: 60 second revalidation.
  - Product detail reads: 30 second revalidation.
- Added route `revalidate` exports:
  - Home, shop, products, content pages, and layout: 60 seconds.
  - Product detail pages: 30 seconds.
- Removed avoidable client re-render work in touched files by deriving header search results with `useMemo` and initializing product variant state lazily.

## Remaining Constraints

- Route-level static classification remains dynamic while `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` reads preview cookies. Removing that would improve route classification but would regress merchant live preview for header and footer settings.
- `framer-motion` is still used across several client components. There is no GSAP or equivalent heavy animation dependency. Further code splitting would require changing the section renderer registry to lazy-load section renderers.
- Some non-critical account/order history pages still use raw `<img>` tags. They are outside the active Urban Kicks browse, cart, product-detail, and checkout path audited in this phase.

## Recommendation

Keep the current preview-compatible cache design for Phase 3. For a later production hardening pass, split published storefront rendering from editor-preview rendering so published tenant routes can avoid preview cookies entirely and become fully ISR/static where Next.js can prove it.
