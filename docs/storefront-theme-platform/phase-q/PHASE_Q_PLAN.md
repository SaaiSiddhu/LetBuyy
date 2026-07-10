# Phase Q Plan — Merchant Theme Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Q — Merchant Theme Library
**Date authored:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase Q delivers the merchant-facing theme library: listing installed themes, creating site-private themes, duplicating marketplace or site-private themes, renaming site-private themes, archiving unpublished themes, and soft-deleting unpublished themes. It also surfaces the library as a "My themes" tab in the `merchant-control-plane` online store UI.

Phase Q is split into two lanes to preserve the two-lane merge rule:

- **Lane A (Gateway):** All backend additions to `services/api-gateway`, `database/supabase/migrations`, `packages/billing-core`, and `packages/typescript/api-client`.
- **Lane B (Merchant UI):** All frontend additions to `apps/merchant-control-plane`.

---

## 2. Gate Entering Phase Q

| Metric | Baseline |
|---|---|
| api-gateway unit tests (theme-library-q.test.ts scoped) | 0 (new file) |
| api-gateway overall tests (Phase P baseline) | 438 passing |
| theme-engine tests | 1034 passing |
| api-gateway typecheck | 32/32 tasks clean |

---

## 3. Lane A — Gateway Design

### 3.1 Route Registration Order

All six new routes are registered at the top of `themes.ts` before any existing `router.use('/:slug/*', authMiddleware)` declarations to prevent route-shadowing by the `GET /:slug` catch-all:

```
router.use('/library', authMiddleware)        // 1st
router.use('/library/*', authMiddleware)
router.use('/:slug/duplicate', authMiddleware)
router.use('/:slug/rename', authMiddleware)
router.use('/:slug/archive', authMiddleware)
router.use('/:slug/unpublished', authMiddleware)
// existing Phase P registrations follow
```

### 3.2 Tenancy Chain (Mandatory for All Six Routes)

Every new route handler and adapter method follows this exact sequence:

1. `authMiddleware` enforces ES256 merchant session.
2. `resolveCustomUser(db, auth.user)` → 403 if null.
3. `adapter.verifyStoreOwner(storeId, userId)` → 403 ForbiddenError if `sites` row not found for `(id=storeId, custom_user_id=userId OR user_id=userId)`.
4. All subsequent DB queries carry `.eq('store_id', storeId)` as the first filter.

For create and duplicate only, step 3a (plan limit check) runs after step 3 (ownership confirmed) to prevent leaking billing information of foreign stores.

### 3.3 Route Details

| Route | Method | Schema | Key tenancy steps |
|---|---|---|---|
| `/themes/library` | GET | `ListSiteThemesQuerySchema` (store_id from query) | verifyStoreOwner → listSiteThemes |
| `/themes/library/create` | POST | `CreateSiteThemeSchema` | verifyStoreOwner → plan-limit check → createSiteTheme |
| `/themes/:slug/duplicate` | POST | `DuplicateSiteThemeSchema` | verifyStoreOwner → plan-limit check → duplicateSiteTheme |
| `/themes/:slug/rename` | PATCH | `RenameSiteThemeSchema` | verifyStoreOwner → renameSiteTheme (owned_by_site_id guard) |
| `/themes/:slug/archive` | POST | `ArchiveSiteThemeSchema` | verifyStoreOwner → archiveSiteTheme (published-theme block) |
| `/themes/:slug/unpublished` | DELETE | `DeleteUnpublishedThemeQuerySchema` (store_id from query) | verifyStoreOwner → deleteUnpublishedSiteTheme (published-theme block) |

### 3.4 Adapter Methods

All six methods in `ThemeExecutionAdapter`:

**`listSiteThemes(storeId, userId)`**
- verifyStoreOwner first.
- Reads `sites.theme_id` to determine `isCurrentlyPublished`.
- Queries `theme_instances WHERE store_id=storeId AND deleted_at IS NULL`.
- For each instance: fetches `themes` metadata (no `is_active` filter — site-private themes have `is_active=false`), `theme_releases` for `last_published_at` (scoped by `store_id`), `theme_editor_drafts` for `hasDraft` (scoped by `store_id`).
- Returns: `{ themes: [{ slug, name, instance_status, installed_at, last_published_at, last_modified_at, hasDraft, isCurrentlyPublished, updateAvailable, theme_package_version_id, active_release_id }] }`.

**`createSiteTheme(storeId, input, userId)`**
- verifyStoreOwner first (also called in route handler before plan-limit check).
- Inserts `themes` row: `is_active=false`, `is_site_private=true`, `owned_by_site_id=storeId`, slug = `site-theme-<uuid>`. Requires migration 190 columns.
- Inserts `theme_instances` row: `store_id=storeId`, `instance_status='installed'`.
- `emitAuditEvent` action `'theme.create'`.

**`duplicateSiteTheme(slug, storeId, input, userId)`**
- verifyStoreOwner first.
- Confirms source `theme_instances` row belongs to this store; if not found → NotFoundError (not 403, to prevent slug enumeration).
- Clones release config from source's `active_release_id` (scoped by `store_id`).
- Inserts new `themes` row: `is_site_private=true`, `owned_by_site_id=storeId`, new uuid slug.
- Inserts new `theme_instances` row.
- `emitAuditEvent` action `'theme.duplicate'`.

**`renameSiteTheme(slug, storeId, input, userId)`**
- verifyStoreOwner first.
- Confirms `theme_instances` row belongs to this store.
- Reads `themes.owned_by_site_id`; if null (marketplace theme) or not equal to `storeId` → ForbiddenError directing the merchant to duplicate first.
- UPDATE `themes` carries `.eq('owned_by_site_id', storeId)` as a belt-and-suspenders DB-level guard.
- `emitAuditEvent` action `'theme.rename'`.

**`archiveSiteTheme(slug, storeId, input, userId)`**
- verifyStoreOwner first.
- Reads `sites.theme_id` (scoped by `store_id`); if `theme_id === slug` → ConflictError `THEME_CURRENTLY_PUBLISHED`.
- Confirms `theme_instances` row belongs to this store.
- UPDATE `theme_instances` sets `instance_status='archived'`, scoped by `store_id AND id`.
- `emitAuditEvent` action `'theme.archive'`.

**`deleteUnpublishedSiteTheme(slug, storeId, userId)`**
- verifyStoreOwner first.
- Reads `sites.theme_id`; if `theme_id === slug` → ConflictError `CANNOT_DELETE_PUBLISHED_THEME`.
- Checks `theme_releases WHERE store_id=storeId AND theme_id=slug AND is_current=true`; if found → ConflictError (belt-and-suspenders guard).
- Confirms `theme_instances` row belongs to this store.
- UPDATE `theme_instances` soft-delete: `deleted_at=now`, `instance_status='deleted'`, scoped by `store_id AND id`.
- `emitAuditEvent` action `'theme.delete'`.

### 3.5 Plan Limit Enforcement

`resolveStoreThemeLimit(db, storeId)` follows the identical pattern as `resolveStoreStaffLimit` in `employee.ts`:
- `subscriptions` → `plans` → `applyStorePlanTierDefaults` → `limits.themes`.
- Returns `{ limit: number | null, plan_name: string }`. `null` = unlimited (Enterprise).

`countInstalledSiteThemes(db, storeId)` counts `theme_instances WHERE store_id=storeId AND instance_status NOT IN ('archived','deleted') AND deleted_at IS NULL`.

Both helpers are called after `verifyStoreOwner` to avoid leaking billing data of foreign stores.

### 3.6 Billing Core

`STORE_BILLING_TIER_DEFINITIONS` in `packages/billing-core/src/index.ts` gains `themes: number|null` in every tier's `limits` block:
- `free`: 1
- `starter`: 3
- `business`: 10
- `enterprise`: null (unlimited)
- `launch`: 3
- `growth`: 5

### 3.7 Migration 190

`database/supabase/migrations/190_theme_library_q.sql` — additive, idempotent:
- `ALTER TABLE themes ADD COLUMN IF NOT EXISTS owned_by_site_id uuid NULL REFERENCES sites(id) ON DELETE SET NULL`
- `ALTER TABLE themes ADD COLUMN IF NOT EXISTS is_site_private boolean NOT NULL DEFAULT false`
- `CREATE INDEX IF NOT EXISTS themes_owned_by_site_id_idx ON themes(owned_by_site_id) WHERE owned_by_site_id IS NOT NULL`
- `CREATE INDEX IF NOT EXISTS themes_is_site_private_idx ON themes(is_site_private) WHERE is_site_private = true`

No DROP / RENAME / TRUNCATE. `migration-safety-validator` must exit 0.

**Apply status:** Migration 190 has NOT been applied to any database. MUST NOT be applied to production without explicit ARB sign-off.

---

## 4. Lane B — Merchant UI Design

### 4.1 Proxy Routes (6 new, all thin — no direct DB access)

| File | Proxy target |
|---|---|
| `src/app/api/themes/library/route.ts` (GET) | `GET /themes/library?store_id=` |
| `src/app/api/themes/library/create/route.ts` (POST) | `POST /themes/library/create` |
| `src/app/api/themes/[themeId]/duplicate/route.ts` (POST) | `POST /themes/:slug/duplicate` |
| `src/app/api/themes/[themeId]/rename/route.ts` (PATCH) | `PATCH /themes/:slug/rename` |
| `src/app/api/themes/[themeId]/archive/route.ts` (POST) | `POST /themes/:slug/archive` |
| `src/app/api/themes/[themeId]/route.ts` (DELETE) | `DELETE /themes/:slug/unpublished` |

All six proxies call `resolveOwnedStoreId(storeName)` server-side before constructing any gateway request. `storeName` comes from the request (query param or JSON body). The resolved `storeId` UUID is never accepted from the browser directly.

All six use `merchantApiFetch(path, { requireSession: true })` and `merchantApiErrorResponse` for error handling.

### 4.2 UI Components

**`ThemeLibraryCard.tsx`** — per-theme card:
- Displays theme name, `instance_status` badge, `last_published_at` (en-IN date format), `hasDraft` indicator, `isCurrentlyPublished` badge.
- Action menu with: Publish (calls `handlePublish`), Duplicate, Rename, Archive (disabled if `isCurrentlyPublished`), Delete (disabled if `isCurrentlyPublished` or `instance_status === 'archived'`).
- All action buttons have `aria-label` attributes. Disabled states use `aria-disabled`.
- Only `--lb-*` design tokens used; no raw pixel values.

**`ThemeLibraryWorkspace.tsx`** — library container:
- Loading: `Skeleton` components.
- Empty: descriptive empty state with "Create theme" CTA.
- Error: `Banner` with Retry button.
- Responsive grid: single column on mobile → `sm:grid-cols-2` → `lg:grid-cols-3`.
- Modals for create (name input, 120-char max) and rename (name input, 120-char max). `ConfirmDialog` with `destructive=true` for archive and delete.
- `handlePublish` sends `store_name` as a URL query param (not JSON body) to match the existing `[themeId]/editor/route.ts` proxy convention.
- Gateway 409 errors (`THEME_CURRENTLY_PUBLISHED`, `CANNOT_DELETE_PUBLISHED_THEME`, `THEME_LIMIT_REACHED`) are surfaced as merchant-friendly toast messages via `friendlyGatewayError`.
- No Supabase imports. No direct gateway client. All data via `/api/*` proxies.

### 4.3 Page Integration

`apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx` gains a tab strip:
- `role="tablist"` with two `role="tab"` elements: "My themes" (default active) and "Discover themes".
- Each tab has `aria-selected`, `aria-controls` pointing to its `role="tabpanel"`.
- "My themes" panel: `<ThemeLibraryWorkspace store={store} storeId={storeId} />`.
- "Discover themes" panel: existing catalog browse section (unchanged).
- No other logic in the page file is modified.

---

## 5. What Phase Q Does Not Touch

- `publish_theme_release` SECURITY DEFINER RPC — ARB-gated
- `theme-registry.ts` — frozen (ART-17)
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` — stays `false`
- DOMPurify sanitizer — unchanged
- Frozen apps — unchanged
- Phase P's draft/publish/rollback adapter methods and routes — unchanged
- `services/api-gateway/src/index.ts` — not modified by Phase Q
- Foreign WIP files — undisturbed

---

## 6. Risk Flags Entering Implementation

| Risk | Mitigation planned |
|---|---|
| Route shadowing: new `/library` and `/:slug/*` routes could be eaten by the existing `GET /:slug` | Register all new routes' `authMiddleware` before existing `/:slug/*` middleware; assert ordering in tests |
| Plan limit leaking foreign store billing data | Call `verifyStoreOwner` before `resolveStoreThemeLimit`; assert call order in source-pattern tests |
| `renameSiteTheme` writing to shared marketplace catalog row | Read `owned_by_site_id` before UPDATE; scope UPDATE by `.eq('owned_by_site_id', storeId)` |
| Plan limit TOCTOU (count before insert, non-atomic) | Documented as residual; ARB-gated for full DB-level enforcement |
| `handlePublish` proxy convention mismatch | Route reads `store_name` from query string; `fetch` call must include it there |
