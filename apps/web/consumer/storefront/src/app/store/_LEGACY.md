# ⚠️ LEGACY — Store Routes

This folder contains the **original** dynamic store routes using the `[subdomain]` pattern.

These routes are being superseded by the new theme-isolated architecture at:
```
consumer-storefront/stores/{theme-slug}/dynamic/
```

## Migration Status

| Component | Old Location | New Location | Status |
|---|---|---|---|
| Theme Config | Inline in `layout.tsx` | `stores/urban-kicks/dynamic/index.ts` | ✅ Migrated |
| Home Page | `page.tsx` | `stores/urban-kicks/dynamic/pages/home-page.tsx` | ✅ Migrated |
| Shop Page | `shop/page.tsx` | `stores/urban-kicks/dynamic/pages/shop-page.tsx` | ✅ Migrated |
| Cart/Checkout/Orders | Individual folders | Re-exported from dynamic module | ✅ Migrated |

## What Changed?

- Theme-specific configuration (CSS variables, font mapping) extracted to theme modules
- Page components moved to isolated theme folders or re-exported
- Shared components (DynamicHeader, DynamicFooter, sections) remain in `@/components/`

## Do NOT Delete

These routes are still the **active** Next.js routing targets. The middleware
rewrites subdomains to `/store/[subdomain]/...` which hits these route files.
The new theme modules are consumed BY these routes, not replacing them.
