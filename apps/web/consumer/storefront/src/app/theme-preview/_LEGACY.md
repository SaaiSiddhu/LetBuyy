# ⚠️ LEGACY — Theme Preview Routes

This folder contains the **original** theme preview pages.

These routes are superseded by the new theme-isolated architecture at:
```
consumer-storefront/stores/{theme-slug}/preview/
```

## Migration Status

| Theme | Old Location | New Location | Status |
|---|---|---|---|
| Urban Kicks | `src/app/theme-preview/urban-kicks/` | `consumer-storefront/stores/urban-kicks/preview/` | ✅ Migrated |

## What Changed?

- Preview pages moved from Next.js route folders to isolated theme modules
- Import paths changed from `@/app/theme-preview/...` to relative imports
- Components are now barrel-exported via `preview/index.ts`
- The original route files here still work but point to the new module

## Do NOT Delete (Yet)

These files are kept for backward compatibility. They will be removed once
all references have been verified and the new routing is fully tested.
