# Theme Platform Data Model

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-10 (post Phase P)
**Branch:** `stepup/main`

This document maps the theme persistence surface: tables, columns, constraints, indexes, RLS policies, and their relationships. It covers only tables relevant to the theme platform program. Update when a new phase changes the schema.

---

## 1. Table Relationships

```
themes (global catalog)
  │
  ├─ slug ──────────────────────────────────────────────────┐
  │                                                          │
  │                                            theme_id (text, slug)
  │                                                          │
theme_editor_drafts           theme_instance_drafts    theme_releases
  store_id (FK→sites.id)        store_id (FK→sites.id)   store_id (FK→sites.id)
  theme_id (text slug)          theme_instance_id ──┐     rollback_of_release_id (self-FK)
  template_key                                       │     source_draft_id (→theme_editor_drafts.id)
  draft_config (jsonb)      theme_instances ─────────┘     release_config (jsonb)
  version (OCC counter)         store_id                    idempotency_key (text, nullable)
                                current_draft_id
                                current_release_id ────────→ theme_releases.id

sites
  current_theme_release_id ─────────────────────────────→ theme_releases.id
  theme_id (text, legacy)
  template_config (jsonb, legacy)
```

---

## 2. Table Definitions

### 2.1 `themes` — Global Catalog

**Source:** `000_baseline.sql:13007`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | UNIQUE — this is what `theme_id` in other tables references |
| `name` | text | |
| `site_type` | text | |
| `category` | text | |
| `description` | text | |
| `config` | jsonb | |
| `default_template` | jsonb | |
| `section_schemas` | jsonb | |
| `block_schemas` | jsonb | |
| `settings_schema` | jsonb | |
| `renderer_manifest` | jsonb | |
| `schema_version` | text | |
| `renderer_version` | text | |
| `is_active` | boolean | |
| `is_premium` | boolean | |
| `letbuyy_pricing_type` | text | |
| `letbuyy_price_inr` | numeric | |
| `industry` | text[] | |
| `install_count` | integer | |
| `updated_at`, `created_at` | timestamptz | |

**Not tenant-scoped.** RLS: `USING(true)` — public catalog read.

**Critical:** `themes.id` is uuid. `theme_releases.theme_id` and `theme_editor_drafts.theme_id` store `themes.slug` (text), NOT `themes.id`.

---

### 2.2 `theme_editor_drafts` — Per-Template Draft Storage

**Source:** `000_baseline.sql:12618` + `087_theme_template_drafts.sql`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `store_id` | uuid | NOT NULL | Tenant key → `sites.id` |
| `theme_id` | text | NOT NULL | Slug reference → `themes.slug` |
| `draft_config` | jsonb | NOT NULL | Serialised `ThemeDocument` V2 |
| `version` | integer | DEFAULT 1 NOT NULL | OCC counter for CAS |
| `template_key` | text | NOT NULL DEFAULT 'index' CHECK(`~^[a-z0-9][a-z0-9_-]{0,79}$`) | Per-template key; added by 087 |
| `auto_saved_at` | timestamptz | | |
| `created_by`, `updated_by` | uuid | | |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | | Soft-delete via `deleted_at` |

**Unique constraint (after 087):** `(store_id, theme_id, template_key)` — one draft per template per theme per store.

**RLS:** 4 policies (SELECT / INSERT / UPDATE / DELETE). Scope: `EXISTS(SELECT 1 FROM sites WHERE sites.id = theme_editor_drafts.store_id AND sites.user_id = auth.uid())`. Note: `user_id` only — not `custom_user_id` (RISK-SEC-P01).

**Tenant registry:** `tenant-tables.registry.ts:2774` — `tenantColumn=store_id`.

---

### 2.3 `theme_instance_drafts` — Instance-Level Draft Bridge

**Source:** `000_baseline.sql:12637`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `theme_instance_id` | uuid | NOT NULL | |
| `store_id` | uuid | NOT NULL | Tenant key |
| `base_release_id` | uuid | | |
| `draft_status` | text | DEFAULT 'active' CHECK(active\|archived\|published\|discarded) | |
| `draft_version` | integer | DEFAULT 1 | |
| `working_manifest` | jsonb | | |
| `schema_manifest_version` | text | DEFAULT '1.0.0' | |
| `locked_by` | uuid | | |
| `locked_at`, `auto_saved_at` | timestamptz | | |
| `created_by`, `updated_by` | uuid | | |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | | |

**Unique partial index:** `idx_theme_instance_drafts_one_active ON theme_instance_id WHERE draft_status='active' AND deleted_at IS NULL` — at-most-one active draft per instance.

**RLS:** 1 policy `theme_instance_drafts_owner_manage` (USING + WITH CHECK): `EXISTS(SELECT 1 FROM sites WHERE sites.id = store_id AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid()) AND sites.deleted_at IS NULL)`. Correctly checks both `user_id` and `custom_user_id`.

**Tenant registry:** `tenant-tables.registry.ts:2786`.

---

### 2.4 `theme_releases` — Immutable Release Records

**Source:** `000_baseline.sql:12849`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `store_id` | uuid | NOT NULL | Tenant key |
| `theme_id` | text | NOT NULL | Slug reference → `themes.slug` |
| `release_version` | integer | NOT NULL | |
| `release_status` | text | DEFAULT 'published' CHECK(published\|superseded\|rolled_back) | State machine |
| `is_current` | boolean | DEFAULT false | At-most-one `true` per store (enforced by partial index) |
| `release_config` | jsonb | | Full template config at publish time |
| `source_draft_id` | uuid | | → `theme_editor_drafts.id` |
| `source_draft_version` | integer | | OCC version at publish time |
| `publish_message` | text | | |
| `published_by` | uuid | | |
| `published_at` | timestamptz | | |
| `rollback_of_release_id` | uuid | FK → `theme_releases.id` ON DELETE SET NULL | Self-FK for rollback chain |
| `metadata` | jsonb | | |
| `theme_instance_id` | uuid | | |
| `theme_package_version_id` | uuid | | |
| `release_manifest` | jsonb | | |
| `template_snapshot` | jsonb | | Snapshot of templates at publish |
| `settings_snapshot` | jsonb | | Snapshot of settings at publish |
| `asset_manifest` | jsonb | | |
| `cache_manifest` | jsonb | | |
| `data_binding_manifest` | jsonb | | |
| `schema_manifest_version` | text | | |
| `engine_version` | text | | |
| `idempotency_key` | text | Nullable | **Added by migration 189 (Phase P)** |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | | |

**Unique constraint:** `(store_id, release_version)`.

**Unique partial indexes:**
- `idx_theme_releases_one_current ON store_id WHERE is_current=true AND deleted_at IS NULL` — at-most-one current release per site.
- `idx_theme_releases_idempotency ON (store_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL` — **added by migration 189 (Phase P)** — prevents sequential-retry ghost releases; cross-tenant safe.

**RLS:** 3 policies — `theme_releases_owner_read` (SELECT, owner via sites JOIN with both `user_id`/`custom_user_id`); `theme_releases_public_current_read` (SELECT WHERE `is_current=true AND release_status='published'`); `theme_releases_service_all` (ALL for service_role).

**Tenant registry:** `tenant-tables.registry.ts:2819`.

---

### 2.5 `sites` — Relevant Theme Columns

| Column | Type | Notes |
|---|---|---|
| `current_theme_release_id` | uuid | Live pointer → `theme_releases.id` — updated by `publish_theme_release` RPC |
| `storefront_release_version` | integer | |
| `theme_id` | text | Legacy slug pointer |
| `template_config` | jsonb | Legacy per-site config |

---

## 3. Key Business Rules

### 3.1 Status State Machine (`theme_releases.release_status`)

```
published ──(new publish)──→ superseded
    └──────(rollback)──────→ superseded  (the rolled-back release becomes superseded)
                              ↑
                     new release created: status='published', is_current=true
```

The `publish_theme_release` SECURITY DEFINER RPC atomically:
1. Sets all existing `is_current=true` releases to `is_current=false, release_status='superseded'`.
2. Inserts the new release with `is_current=true, release_status='published'`.
3. Updates `sites.current_theme_release_id`.

### 3.2 Draft Version OCC

`theme_editor_drafts.version` is an optimistic concurrency control counter. On save:
- Client supplies `base_version` (the version it last read).
- Adapter checks `existingRecord.version !== base_version` → `ConflictError` (stale).
- If no conflict: new version = `existingRecord.version + 1`.

`base_version` is optional in `SaveThemeDraftSchema`. If omitted, the CAS check is bypassed and last-writer-wins applies. (Known draft CAS bypass — see RISK_REGISTER.md.)

### 3.3 idempotency_key Lifecycle

1. Client generates a key (min 8, max 200 chars) before calling publish.
2. Gateway pre-check: `SELECT FROM theme_releases WHERE store_id=? AND idempotency_key=?` — if found, return existing release (no RPC call).
3. Gateway calls `publish_theme_release` RPC (which does not know the key).
4. Gateway post-enrich: `UPDATE theme_releases SET idempotency_key=? WHERE id=? AND store_id=?`.
5. The partial unique index prevents a second keyed release from being written.

The key is null for releases published before migration 189 and for releases created by the RPC when the TS post-enrich step fails.

### 3.4 Rollback Chain

`rollback_of_release_id` is a self-FK pointing to the release that was in effect before this rollback. It is set when a rollback creates a new `published` release. `ON DELETE SET NULL` means deleting a release record (soft-delete via `deleted_at` is preferred) does not break the FK.

---

## 4. Migrations Tracked by Theme Platform Program

| Migration | File | Status | Content |
|---|---|---|---|
| 087 | `087_theme_template_drafts.sql` | COMMITTED + APPLIED (baseline) | Adds `template_key` column + new unique constraint to `theme_editor_drafts` |
| 188 | `188_letbuyy_core_theme_row.sql` | COMMITTED, unapplied | Idempotent INSERT of `letbuyy-core` row into `themes` |
| 189 | `189_theme_persistence_idempotency.sql` | COMMITTED, unapplied | Adds `idempotency_key` column + partial unique index to `theme_releases` — ARB/HUMAN-GATED |

Migrations 186 / 187 are foreign WIP (untracked); not owned by the theme platform program.
