-- 190 — Theme Library (Phase Q): site-private theme columns on `themes` table.
--
-- Phase Q adds support for merchants creating and duplicating their own site-private
-- themes (not visible in the public marketplace catalog). Two new discriminator
-- columns are needed on the `themes` table:
--
--   1. owned_by_site_id uuid NULL  — FK to sites.id; non-null = site-private theme.
--      The public catalog query (GET /themes) already filters by is_active=true;
--      site-private themes are inserted with is_active=false, so they never appear
--      in the public listing without this column.
--
--   2. is_site_private boolean NOT NULL DEFAULT false — explicit discriminator for
--      fast filtering. Avoids ambiguity with marketplace themes that may have
--      is_active=false temporarily (e.g. pending review).
--
-- Additive + idempotent:
--   * ADD COLUMN IF NOT EXISTS — safe to re-run on a DB that already has columns.
--   * CREATE INDEX IF NOT EXISTS — safe to re-run; no-op if index already exists.
--   * No DROP / RENAME / TRUNCATE — passes migration-safety-validator.
--
-- RLS: no new policy needed.
--   * themes_service_all (ALL for auth.role()='service_role') covers writes to the
--     new columns; gateway uses getSupabaseAdmin (service_role).
--   * themes_public_active_read (SELECT WHERE is_active=true) already excludes
--     site-private rows (is_active=false) from public reads.
--   * No public USING(true) — cross-tenant reads are blocked by is_active=false
--     on site-private rows.
--
-- Tenant registry: owned_by_site_id references sites.id (the tenant root).
--   * Joins from theme_instances → themes on theme_slug maintain the tenant scope
--     as the gateway always filters by store_id first.

ALTER TABLE public.themes
    ADD COLUMN IF NOT EXISTS owned_by_site_id uuid NULL
        REFERENCES public.sites (id) ON DELETE SET NULL;

ALTER TABLE public.themes
    ADD COLUMN IF NOT EXISTS is_site_private boolean NOT NULL DEFAULT false;

-- Index: fast lookup of themes owned by a specific site (for library listing)
CREATE INDEX IF NOT EXISTS themes_owned_by_site_id_idx
    ON public.themes (owned_by_site_id)
    WHERE owned_by_site_id IS NOT NULL;

-- Index: fast filtering of site-private vs. public catalog themes
CREATE INDEX IF NOT EXISTS themes_is_site_private_idx
    ON public.themes (is_site_private)
    WHERE is_site_private = true;
