# Phase P Discovery — Existing Persistence + Reuse Decisions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** P — Drafts, Revisions, Publish, and Rollback
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Discovery Purpose

Phase P began with a ground-truth audit of the existing DB schema, migration history, gateway adapter, and RPC layer to determine exactly what must be built vs what can be reused. The reuse plan maximises existing infrastructure and avoids inventing new tables or RPCs that replicate patterns already present.

---

## 2. Tables Audited

### 2.1 `theme_editor_drafts`

**Sources:** `database/supabase/migrations/000_baseline.sql:12618` + `087_theme_template_drafts.sql`

**Key columns:**
- `id uuid PK`
- `store_id uuid NOT NULL` — tenant key
- `theme_id text NOT NULL` — slug (not uuid; references `themes.slug`)
- `draft_config jsonb NOT NULL` — the serialised `ThemeDocument` V2
- `version integer DEFAULT 1 NOT NULL` — OCC counter for CAS
- `template_key text NOT NULL DEFAULT 'index' CHECK(~^[a-z0-9][a-z0-9_-]{0,79}$)` — added by migration 087
- `auto_saved_at timestamptz`, `created_by uuid`, `updated_by uuid`, standard audit columns, `deleted_at`
- **Unique constraint (after 087):** `(store_id, theme_id, template_key)` — upgraded from `(store_id, theme_id)` by migration 087

**RLS:** Enabled. 4 policies (SELECT / INSERT / UPDATE / DELETE) all scoped to:
```sql
EXISTS (SELECT 1 FROM sites WHERE sites.id = theme_editor_drafts.store_id AND sites.user_id = auth.uid())
```
Note: policies use `user_id` only — not `custom_user_id`. This is pre-existing RLS debt. The gateway bypasses it via `service_role`.

**Tenant registry:** `tenant-tables.registry.ts:2774` — `tenantColumn=store_id`.

**Phase P reuse:** Draft persistence with per-`template_key` scope. Optimistic CAS on `version`/`base_version`. UPSERT on `(store_id, theme_id, template_key)` conflict. `ThemeExecutionAdapter.saveDraft()` at `theme-execution.adapter.ts:1174` already implements the full flow, including `isStaleThemeEditorBaseVersion()` at line 228.

---

### 2.2 `theme_instance_drafts`

**Source:** `database/supabase/migrations/000_baseline.sql:12637`

**Key columns:**
- `id uuid PK`
- `theme_instance_id uuid NOT NULL`
- `store_id uuid NOT NULL` — tenant key
- `base_release_id uuid`
- `draft_status text DEFAULT 'active' CHECK(active|archived|published|discarded)`
- `draft_version integer DEFAULT 1`
- `working_manifest jsonb`
- `schema_manifest_version text DEFAULT '1.0.0'`
- `locked_by uuid`, `locked_at timestamptz`, `auto_saved_at timestamptz`, audit columns, `deleted_at`
- **Unique partial index:** `idx_theme_instance_drafts_one_active ON theme_instance_id WHERE draft_status='active' AND deleted_at IS NULL`

**RLS:** Enabled. 1 policy `theme_instance_drafts_owner_manage` (USING + WITH CHECK):
```sql
EXISTS (SELECT 1 FROM sites WHERE sites.id = store_id AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid()) AND sites.deleted_at IS NULL)
```
This policy correctly checks both `user_id` and `custom_user_id`.

**Tenant registry:** `tenant-tables.registry.ts:2786`

**Phase P reuse:** Compat bridge for instance-level draft snapshots. Already wired in `saveInstanceDraftSnapshot()` at adapter line 414. No changes needed.

---

### 2.3 `theme_releases`

**Source:** `database/supabase/migrations/000_baseline.sql:12849`

**Key columns:**
- `id uuid PK`
- `store_id uuid NOT NULL` — tenant key
- `theme_id text NOT NULL` — slug (same slug convention as `theme_editor_drafts`)
- `release_version integer NOT NULL`
- `release_status text DEFAULT 'published' CHECK(published|superseded|rolled_back)`
- `is_current boolean DEFAULT false`
- `release_config jsonb` — full template config
- `source_draft_id uuid`, `source_draft_version integer`
- `publish_message text`, `published_by uuid`, `published_at timestamptz`
- `rollback_of_release_id uuid FK(theme_releases.id ON DELETE SET NULL)` — self-FK for rollback chain
- `metadata jsonb`, `theme_instance_id uuid`, `theme_package_version_id uuid`
- `release_manifest jsonb`, `template_snapshot jsonb`, `settings_snapshot jsonb`
- `asset_manifest jsonb`, `cache_manifest jsonb`, `data_binding_manifest jsonb`
- `schema_manifest_version text`, `engine_version text`
- **No `idempotency_key` column today** — added by Phase P migration 189
- **Unique:** `(store_id, release_version)`
- **Unique partial index:** `idx_theme_releases_one_current ON store_id WHERE is_current=true AND deleted_at IS NULL` — enforces at-most-one current release per site

**RLS:** Enabled. 3 policies:
- `theme_releases_owner_read` — SELECT for owner (sites JOIN: `sites.id=store_id AND (sites.user_id=auth.uid() OR sites.custom_user_id=auth.uid())`)
- `theme_releases_public_current_read` — SELECT WHERE `is_current=true AND release_status='published'`
- `theme_releases_service_all` — ALL for `auth.role()='service_role'`

No policy uses unconditional `USING(true)`.

**Tenant registry:** `tenant-tables.registry.ts:2819`

**Phase P reuse:** Immutable release records. The `rollback_of_release_id` self-FK already exists. The `published → superseded` status state machine is enforced by the `publish_theme_release` SECURITY DEFINER RPC. Phase P does not add a new releases table.

---

### 2.4 `themes`

**Source:** `database/supabase/migrations/000_baseline.sql:13007`

**Key columns:** `id uuid PK`, `slug text UNIQUE`, `name`, `site_type`, `category`, `description`, `config jsonb`, `default_template jsonb`, `section_schemas jsonb`, `block_schemas jsonb`, `settings_schema jsonb`, `renderer_manifest jsonb`, `schema_version text`, `renderer_version text`, `is_active boolean`, `is_premium boolean`, `letbuyy_pricing_type`, `letbuyy_price_inr`, `industry text[]`, `install_count`, `updated_at`, `created_at`

**Critical note:** `id` is uuid. `theme_id` in `theme_releases` and `theme_editor_drafts` stores `themes.SLUG` (text), not `themes.id`.

**RLS:** Policy `'Themes are viewable by everyone'` — `USING(true)`. This is a global catalog table (not tenant-scoped), so the public read is correct. Write access requires service_role.

---

### 2.5 `sites` (relevant columns)

**Source:** `database/supabase/migrations/000_baseline.sql:12014`

- `current_theme_release_id uuid` — live pointer to `theme_releases.id`
- `storefront_release_version integer`
- `theme_id text` — legacy slug pointer
- `template_config jsonb` — legacy per-site config

Updated atomically by `publish_theme_release` RPC and by `ThemeExecutionAdapter.publishReleaseSnapshotFallback`.

---

## 3. SECURITY DEFINER RPC — `publish_theme_release`

**Source:** `database/supabase/migrations/000_baseline.sql:4542`

The RPC atomically:
1. Supersedes the old `is_current` release (`is_current=false`, `release_status='superseded'`)
2. Inserts a new release record (`is_current=true`, `release_status='published'`)
3. Optionally updates `sites.current_theme_release_id`

**Known gap:** No `p_idempotency_key` parameter. Concurrent network retries can create ghost releases. Full closure is ARB-gated (requires adding `p_idempotency_key` with `ON CONFLICT`). Phase P implements a TS-layer pre-check + post-enrich pattern as the near-term mitigation.

**Constraint:** Phase P cannot modify this RPC without ARB approval.

---

## 4. Reuse Plan

| Component | Reuse decision |
|---|---|
| `theme_editor_drafts` | REUSE — draft persistence with per-`template_key` scope, optimistic CAS on `version`, UPSERT on `(store_id, theme_id, template_key)` conflict |
| `theme_instance_drafts` | REUSE — compat bridge for instance-level snapshots; `saveInstanceDraftSnapshot()` already wired; no changes needed |
| `theme_releases` | REUSE — immutable release records; `rollback_of_release_id` self-FK already exists; status state machine enforced by RPC |
| `publish_theme_release` SECURITY DEFINER RPC | REUSE — atomic publish path; Phase P adds TS-layer idempotency pre-check + post-enrich only; RPC body NOT modified |
| `ThemeExecutionAdapter.publish()` | REUSE — add idempotency pre-check and audit event only |
| `ThemeExecutionAdapter.rollbackRelease()` | REUSE — add `expected_current_release_id` CAS pre-check and audit event only |
| `ThemeExecutionAdapter.listReleases()` | REUSE — unchanged |
| `verifySiteOwnership()` at `lib/auth-user.ts:40` | REUSE — all three new/modified routes; checks `sites WHERE id=siteId AND (user_id=uid OR custom_user_id=uid)` |
| `ThemeExecutionAdapter.verifyStoreOwner()` | REUSE — adapter-internal site ownership confirmation before any operation |
| `EventExecutionAdapter.emitAuditEvent()` | REUSE — add calls for publish and rollback (currently missing); validate route gets a best-effort non-blocking emit |

---

## 5. New Additions (not existing)

| Addition | Justification |
|---|---|
| `theme_releases.idempotency_key` column (migration 189) | `publish_theme_release` RPC has no dedup mechanism; concurrent retries create ghost releases; all other money-path write tables carry `idempotency_key`; index scoped to `(store_id, idempotency_key)` prevents cross-tenant collision |
| `POST /themes/:slug/validate` route | No existing validation-only endpoint; editors need pre-flight of `ThemeDocument` V2 + G4 bundle gate before committing a publish; calls `parseThemeDocument` + `parseLiquidThemePackageBundle` without any DB write |
| `expected_current_release_id` field on `RollbackThemeReleaseSchema` | TS-level CAS guard; without it, a stale editor can silently rollback an unintended current release |

---

## 6. Explicit Out-of-Scope

The following are explicitly NOT built in Phase P:

- New themes persistence table or new releases table
- `create-theme` / `duplicate-draft` / `archive-release` routes
- Modifying the `publish_theme_release` SECURITY DEFINER RPC (ARB gate)
- `apply_preset` route with experience engine integration (re-evaluated: existing stores route handles this path)
- Editor UI for publish/rollback controls (Phase R)
- Draft conflict resolution UI (Phase R)
