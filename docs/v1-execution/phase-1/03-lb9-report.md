# LB-9 — Appearance Bridge (Dead Island) — Report

**Stream:** C · **Severity:** 🔴 Critical · **Status:** ✅ CLOSED (code complete + tested)

## Root cause
The merchant Appearance page writes brand settings to `sites.site_settings` (snake_case: `primary_color`, `font_family`, `border_radius`, `logo_url`, `favicon_url`, `custom_css`), and the storefront's `mapSupabaseToStore` (`store-service.ts`) **already contained the bridge** that maps those snake_case keys into the camelCase `themeSettings` → `:root` CSS vars (`layout.tsx`). But the bridge was a **silent no-op**: the gateway `STOREFRONT_SITE_SELECT` constants omitted `site_settings`, so `data.site_settings` was always `undefined`.

Additionally, `site_settings` is defined in **no migration and not in the baseline** (verified: `grep site_settings database/supabase/migrations/` → empty; max migration = 186) — so adding the column to the SELECT without a migration would break the storefront query on a freshly-migrated local DB.

## Fix
1. **`services/api-gateway/src/routes/storefront.ts`** — added `site_settings` immediately after `template_config` in `STOREFRONT_SITE_SELECT` and `STOREFRONT_SITE_COMPAT_SELECT`. The `*_RELEASE_*` variants extend these via template literals and the pooled-SQL fast path interpolates `STOREFRONT_SITE_RELEASE_SELECT`, so all read paths (preview + published) inherit `site_settings`.
2. **NEW `database/supabase/migrations/187_v1_sites_site_settings.sql`** — `ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_settings jsonb NOT NULL DEFAULT '{}'::jsonb;` (additive, idempotent, replayable; passes migration-safety). Documents writer/readers + rollback in the header.

The bridge mapping in `store-service.ts` (precedence: theme-bundle defaults < saved template config < **merchant appearance wins**; logo override) was already present and correct — no change needed (lb9 tests 2 & 3 passed at baseline).

## Flow (now)
`Merchant → Save Appearance → sites.site_settings → STOREFRONT_SITE_SELECT (now includes it) → mapSupabaseToStore merges into themeSettings → layout.tsx :root CSS vars → storefront reflects brand`

## Files changed
- `services/api-gateway/src/routes/storefront.ts` (2 SELECT constants)
- **NEW** `database/supabase/migrations/187_v1_sites_site_settings.sql`

## Tests & validation
- `tests/launch/lb9-appearance-bridge.test.mjs`: **3/3 pass** (was 2/3 — test 1 `site_settings in STOREFRONT_SITE_SELECT` now passes; `grep -c template_config,site_settings storefront.ts` = 2).
- `migration-safety-validator`: **pass** (187 is additive, no destructive patterns).
- `pnpm --filter @letbuyy/api-gateway typecheck`: **clean (exit 0)**.

## Evidence
```
PASS  lb9-appearance-bridge  (3 ok)
migration-safety=0 :: Supabase migration history checked for destructive replay hazards
api-gateway typecheck EXIT=0
```

## Notes / follow-ups
- `favicon_url` and `custom_css` are persisted in `site_settings` but not yet consumed by `layout.tsx` (out of LB-9 scope — colors/typography/logo are the appearance bridge). `custom_css` would need sanitization (style-tag injection) before wiring. Recommended as a separate task.
- Migration 187 must be applied to existing local/staging DBs (`pnpm db:reset` or apply 187) before the SELECT change is exercised, else the column is absent. Prod already accepts `site_settings` writes (the PATCH allows it), implying the column exists there; 187 makes the column source-of-truth in the migration chain.
