# Phase Q Discovery — Theme Library: Existing Surface and Gaps

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Q — Merchant Theme Library
**Date authored:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Discovery Purpose

Phase Q's discovery mapped every existing theme persistence table, route, and UI surface relevant to merchant theme library management. The goal was to establish exactly what already existed from Phases M–P, what was missing, and what Phase Q needed to add without duplicating or breaking prior work.

---

## 2. Existing Tables Audited

### 2.1 `theme_instances`

**Source:** `database/supabase/migrations/000_baseline.sql`

**Key columns:**
- `id uuid PK`
- `store_id uuid NOT NULL` — tenant key; FK to `sites.id`
- `theme_slug text NOT NULL` — references `themes.slug` (not a uuid FK)
- `instance_status text` — lifecycle state; values used by Phase Q: `'installed'`, `'archived'`, `'deleted'`
- `active_release_id uuid` — FK to `theme_releases.id` (nullable)
- `theme_package_version_id uuid` — nullable; links to the installed package version
- `installed_config jsonb` — nullable; per-instance install-time settings
- `created_by uuid`, `updated_by uuid`, standard audit columns, `deleted_at timestamptz`

**Tenant scope:** All queries must carry `.eq('store_id', storeId)` before any other filter. The `deleted_at IS NULL` soft-delete guard is mandatory on all reads.

**Existing RLS:** `theme_instances` has scoped policies in `000_baseline.sql`. Gateway uses `service_role` via `getSupabaseAdmin`; RLS is a secondary defense.

### 2.2 `themes` (catalog)

**Source:** `database/supabase/migrations/000_baseline.sql`

**Key columns:**
- `slug text PK`
- `name text NOT NULL`
- `is_active boolean NOT NULL DEFAULT false` — `true` = visible in public marketplace catalog
- `description text`
- `schema_version text`
- Standard audit columns

**Public catalog filter:** `GET /themes` already filters by `is_active=true`. Site-private themes created by Phase Q use `is_active=false`, which naturally excludes them from the public catalog.

**Phase Q additions (migration 190):**
- `owned_by_site_id uuid NULL REFERENCES sites(id) ON DELETE SET NULL` — non-null = site-private theme
- `is_site_private boolean NOT NULL DEFAULT false` — explicit discriminator

### 2.3 `theme_releases`

**Source:** `database/supabase/migrations/000_baseline.sql` + `189_theme_persistence_idempotency.sql` (Phase P)

**Key columns:** `id`, `store_id`, `theme_id` (= slug), `is_current boolean`, `published_at`, `release_version`, `theme_package_version_id`, `idempotency_key` (added Phase P).

**Used by Phase Q:** `listSiteThemes` reads the current release per store+theme to derive `last_published_at` and `isCurrentlyPublished`. `deleteUnpublishedSiteTheme` checks for any `is_current=true` release (belt-and-suspenders guard against deleting a published theme).

### 2.4 `theme_editor_drafts`

**Source:** `000_baseline.sql` + `087_theme_template_drafts.sql`

**Used by Phase Q:** `listSiteThemes` checks for any draft per store+theme to derive `hasDraft`. All queries scoped by `store_id` first.

---

## 3. Existing Gateway Routes (Phase P baseline, reused without modification)

| Route | Status in Phase Q |
|---|---|
| `GET /themes` | Reused; not modified |
| `GET /themes/:slug/editor` | Reused; not modified |
| `PUT /themes/:slug/editor/draft` | Reused; not modified |
| `POST /themes/:slug/publish` | Reused; not modified |
| `POST /themes/:slug/releases/:releaseId/rollback` | Reused; not modified |
| `POST /themes/:slug/install` | Reused; not modified |
| `POST /themes/:slug/preview-session` | Reused; not modified |

---

## 4. Existing Merchant UI Routes (Phase P baseline, reused without modification)

| Route file | Status |
|---|---|
| `apps/merchant-control-plane/src/app/api/themes/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/install/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/publish/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/releases/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/releases/[releaseId]/rollback/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/preview-session/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/sections/route.ts` | Reused; not modified |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/sections/reorder/route.ts` | Reused; not modified |

---

## 5. Identified Gaps (Phase Q Scope)

### 5.1 Gateway — Missing Routes

None of the following existed before Phase Q:

| Missing route | Functional need |
|---|---|
| `GET /themes/library?store_id=` | List all themes installed on a site |
| `POST /themes/library/create` | Create a blank site-private theme |
| `POST /themes/:slug/duplicate` | Duplicate any installed theme (marketplace or site-private) |
| `PATCH /themes/:slug/rename` | Rename a site-private theme |
| `POST /themes/:slug/archive` | Archive an unpublished theme instance |
| `DELETE /themes/:slug/unpublished` | Soft-delete an unpublished theme |

### 5.2 Gateway — Missing Adapter Methods

`ThemeExecutionAdapter` had no methods for site-scoped library operations. The following were absent:
- `listSiteThemes`
- `createSiteTheme`
- `duplicateSiteTheme`
- `renameSiteTheme`
- `archiveSiteTheme`
- `deleteUnpublishedSiteTheme`

### 5.3 Gateway — Missing Schemas

`services/api-gateway/src/schemas/theme.schema.ts` had no schemas for Phase Q operations. Six schemas were absent.

### 5.4 Database — Missing Columns

The `themes` table had no `owned_by_site_id` or `is_site_private` column, making it impossible to distinguish site-private themes from marketplace themes at the DB layer.

### 5.5 Billing — Missing Theme Limit

`@letbuyy/billing-core` `STORE_BILLING_TIER_DEFINITIONS` had no `themes` field in the `limits` block for any tier.

### 5.6 API Client — Missing Method Stubs

`packages/typescript/api-client/src/index.ts` had no typed method stubs for the six new operations.

### 5.7 Merchant UI — Library Workspace Gap

`apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx` (623 lines at Phase P close) showed only the marketplace catalog (`GET /themes?store_id=`). No tab or section existed for managing installed site themes. The `Duplicate` button on line 433 was disabled with no handler.

---

## 6. Reuse Decisions

| Decision | Rationale |
|---|---|
| Reuse `verifyStoreOwner` as the first call in every new adapter method | Proven pattern from Phase P; ensures no theme_instances query runs before ownership is confirmed |
| Reuse `resolveOwnedStoreId` in all new merchant proxy routes | Prevents browser-supplied store UUIDs from reaching gateway; server-side resolution only |
| Reuse `makeMockDb` / `makeChain` test helpers from `theme-persistence-p.test.ts` | Logic-level testing without a real DB connection; proven cross-tenant isolation pattern |
| `is_active=false` + `is_site_private=true` on `themes` rows for site-private themes | Public catalog filter (`is_active=true`) already excludes these; no catalog contamination |
| Soft-delete for `deleteUnpublishedSiteTheme` | Preserves audit trail; consistent with `theme_instances.deleted_at` pattern |
| `resolveStoreThemeLimit` patterned after `resolveStoreStaffLimit` in `employee.ts` | Consistent billing lookup: `subscriptions` → `plans` → `applyStorePlanTierDefaults` → `limits.themes` |

---

## 7. What Phase Q Does Not Touch

- `publish_theme_release` SECURITY DEFINER RPC — ARB-gated; unchanged
- `theme-registry.ts` — frozen (ART-17)
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` — stays `false`
- DOMPurify sanitizer — unchanged
- Frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`) — unchanged
- Phase P's draft/publish/rollback surface (`PUT /:slug/editor/draft`, `POST /:slug/publish`, `POST /:slug/releases/:releaseId/rollback`) — unchanged
- `theme-engine` package modules — unchanged
- Foreign WIP (migrations 186/187, `tenant-tables.registry.ts`, identity-platform, marketing-site WIP) — undisturbed
