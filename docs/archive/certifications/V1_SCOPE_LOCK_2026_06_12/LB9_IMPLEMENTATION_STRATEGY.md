# LB-9 — Appearance Bridge: Implementation Strategy

**Date:** 2026-06-13 · **Mode:** research/blueprint · all claims cite file:line.

## TL;DR

The merchant Appearance page writes `sites.site_settings`, but the storefront never reads it → dead island. The bridge is **pure data plumbing**: (0) add the `site_settings` column (it is **not in any tracked migration**), (1) add `site_settings` to the storefront SELECT, (2) merge its fields into `themeSettings` at top precedence in `mapSupabaseToStore`, (3) handle `custom_css` (sanitized `<style>`) + `favicon_url` (metadata). No theme-engine/Liquid/section change → preserves React-no-duplication and Liquid-winner.

## ⚠️ Prerequisite finding (Step 0 — do this first)

**`site_settings` exists in ZERO tracked SQL DDL.** Baseline `sites` (`000_baseline.sql:8-78`) has `theme_settings`/`settings`/`payment_settings` but **not** `site_settings`; a repo-wide `grep -rin site_settings --include=*.sql` returns nothing. Yet `appearance/page.tsx:170`, `settings/checkout/page.tsx:212`, `settings/notifications/page.tsx:152` all PATCH `{ site_settings: … }` and `stores.ts:703` allow-lists it. **Implication:** the write likely fails (PGRST204) today, so the island is dead at *both* ends. **Required first step:** new migration `171_appearance_site_settings.sql`:
```sql
BEGIN;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
-- rollback: ALTER TABLE public.sites DROP COLUMN IF EXISTS site_settings;
```
(Verify against the live prod schema first — `000_baseline.sql` may be a stale dump. If the column already exists in prod, the `IF NOT EXISTS` makes this a safe no-op.) **Note:** this is a new migration → in the sandbox it will trip the untracked-migration guard until committed (same seam as mig 170).

## Write path (exact)

`appearance/page.tsx:166-175` PATCHes to `/api/stores/{store}/settings`:
```jsonc
{ "site_settings": {
  "primary_color": "<hex>",   // only ONE color — no secondary/accent (page.tsx:28-35)
  "font_family":   "<string>",// Inter|Roboto|Outfit|Poppins|DM Sans|Space Grotesk|Playfair|Lora|Merriweather
  "border_radius": 8,         // NUMBER 0–24 (page.tsx:172)
  "logo_url":      "<url>",
  "favicon_url":   "<url>",
  "custom_css":    "<string>"
}}
```
Proxy `api/stores/[store]/settings/route.ts:35` → gateway `PATCH /stores/:id` → `stores.ts:703` allow-list → `db.from('sites').update()` (`:723-728`). Schema `tenant-core/src/index.ts:219` (`z.record(z.string(), z.unknown())`).

**Write-path bug to fix in the same PR:** Appearance saves `{...form, border_radius}` **without** merging existing `site_settings` (`page.tsx:170-173`), so it **clobbers** `site_settings.checkout` / notifications keys (which nest under the same column and *do* merge-first — `checkout/page.tsx:167,204`). Fix Appearance to load-then-merge like checkout.

## Read path (exact omission)

`STOREFRONT_SITE_SELECT` (`storefront.ts:344-345`) enumerates columns and **omits `site_settings`**. It feeds both read paths (pooled SQL `:654`, PostgREST `:811`) via `STOREFRONT_SITE_RELEASE_SELECT` (`:346-347`). Chain: `store-service.ts:89,100` → `mapSupabaseToStore`.

`themeSettings` built at `store-service.ts:575-588`, precedence low→high: `DEFAULT_THEME_SETTINGS` < bundle `config.settings_data.current` < `templateConfig.themeSettings`. **No `site_settings` input.**

`ThemeSettings` shape (`packages/theme-engine/src/index.ts:50-78`): `primaryColor, secondaryColor, accentColor, backgroundColor, textColor, fontFamily, headingFontFamily, borderRadius, enableAnimations, enableShadows, isDark?, surfaceColor?`.

## Consumption — the `:root` target (`layout.tsx:106,126-160`)

| themeSettings | CSS var | line |
|---|---|---|
| primaryColor | `--primary` | 128 |
| secondaryColor | `--secondary` | 129 |
| accentColor | `--accent` | 130 |
| backgroundColor | `--background` | 131 |
| textColor | `--text` | 132 |
| borderRadius | `--radius:{n}px` | 133 |
| fontFamily → `FONT_MAP[]` | `--font-main` | 134 |
| headingFontFamily → `FONT_MAP[]` | `--font-heading` | 135 |

**Font hazard:** `FONT_MAP` (`layout.tsx:20-31`) lacks `Roboto`/`Merriweather` (offered by Appearance) → silently falls back to Inter. Reconcile the lists or accept the fallback.

## Merge strategy (exact, merchant-wins)

Insert in `mapSupabaseToStore` before the `themeSettings` build (`store-service.ts:~575`):
```ts
const siteSettings = asRecord(data.site_settings);            // the only new column read
const appearanceOverrides: Partial<ThemeSettings> = {};
if (typeof siteSettings.primary_color === 'string') appearanceOverrides.primaryColor = siteSettings.primary_color;
if (typeof siteSettings.font_family === 'string') { appearanceOverrides.fontFamily = siteSettings.font_family; appearanceOverrides.headingFontFamily = siteSettings.font_family; }
const br = Number(siteSettings.border_radius); if (Number.isFinite(br)) appearanceOverrides.borderRadius = br;
// then spread LAST in the themeSettings object literal:
const themeSettings: ThemeSettings = { ...DEFAULT_THEME_SETTINGS, ...themeSettingsRecord, /* existing coercions */, ...appearanceOverrides };
```
Precedence: `DEFAULT` < bundle < `templateConfig.themeSettings` < **merchant `site_settings`**. Empty/absent `site_settings` ⇒ no-op (bundle stays authoritative — preserves current behavior for untouched stores).

**Fields with no themeSettings home** (carry as new `StoreModel` fields out of `mapSupabaseToStore`):
- `custom_css` → inject as a `<style>` after the `:root` block (`layout.tsx:~207`), **sanitized** (the theme-engine test forbids `onclick` etc. — `theme-engine.test.ts:85`; route through the existing theme CSS sanitizer, never raw `dangerouslySetInnerHTML`). The Appearance page itself notes "Custom CSS is stored but not executed" (`page.tsx:428`).
- `favicon_url` → Next metadata: change `icons.icon` from `store.logoUrl || '/favicon.ico'` to `store.faviconUrl || store.logoUrl || '/favicon.ico'` (`layout.tsx:59-61`). (`sites.favicon_url` is also a real baseline column `000_baseline.sql:9` — decide column vs `site_settings`.)

## Theme-safety argument (no React-authority duplication; Liquid stays winner)

Edits = one SELECT string + one merge block + two scalar consumers. **No section/renderer added** (`no-new-react-sections` untouched), **no Liquid/theme-engine logic** changed. Rendering authority stays with the theme release bundle (`config.settings_data`, `templateConfig.themeSettings`); `site_settings` is a **thin per-store override tier** slotting into the *existing* precedence chain — the same mechanism by which `templateConfig.themeSettings` already overrides defaults. When Liquid becomes the renderer it reads the same `themeSettings`/CSS-var contract, so the override flows through unchanged. No parallel renderer, no second theme store.

## Tests

- **Extend `tests/localization/theme-localization.test.mjs:219`** (already asserts the stores.ts allow-list incl. `site_settings`) → add an assertion that `STOREFRONT_SITE_SELECT` (`storefront.ts:345`) now includes `site_settings`.
- **New `tests/contracts/appearance-bridge.test.ts`**: (1) SELECT includes `site_settings`; (2) a `mapSupabaseToStore` fixture with `site_settings.primary_color` ⇒ `themeSettings.primaryColor === override` (merchant-wins); (3) empty `site_settings` ⇒ bundle values intact (no-op).
- **Extend `packages/theme-engine/test/theme-engine.test.ts`** for the `custom_css` sanitization path (it already asserts the sanitizer `:85`).
- **New migration test** under `tests/migrations/` asserting `171_*` adds `sites.site_settings jsonb`.
- Note: `apps/storefront-runtime` has **zero** `*.test.ts` files — assertions live in `tests/contracts/` + `packages/theme-engine/test/`.

## Rollout / rollback

- **Rollout order:** migration 171 (commit + apply) → SELECT+merge+consumers PR. Validate gate + the new contract test + a manual storefront render with a non-default `primary_color`.
- **Rollback:** revert the merge PR (storefront reverts to bundle-only theming — current behavior); drop the column only if no data written.

**Effort: ~2–3 days (incl. column, custom_css sanitization, favicon, write-path merge fix). Risk: low-med (custom_css sanitization is the sharp edge). Commit: 1–2 (migration separate from code).**
