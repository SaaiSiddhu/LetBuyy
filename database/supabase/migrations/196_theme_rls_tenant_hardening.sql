-- Migration 196: Theme RLS tenant hardening — scope the themes catalog read and
-- complete FORCE ROW LEVEL SECURITY coverage across the theme tables.
--
-- WHAT THIS DOES
--   1. Replaces the baseline policy "Themes are viewable by everyone"
--      (000_baseline.sql:24152 — FOR SELECT USING (true), no role qualifier, so it
--      applies to PUBLIC) with two scoped SELECT policies on public.themes:
--        • themes_public_catalog_read — genuinely public marketplace rows only.
--        • themes_site_owner_read     — rows owned by a site, visible to that
--                                       site's owner.
--   2. Adds FORCE ROW LEVEL SECURITY to the 24 theme tables that had RLS ENABLE
--      but not FORCE (the other 8 were already forced by 164_d4_tenant_role_guc).
--
-- WHY
--   ART-09 / R-3: a USING (true) policy reaching PUBLIC/anon/authenticated is
--   forbidden. Migration 190 added themes.owned_by_site_id + themes.is_site_private,
--   which turned `themes` into a table that stores merchant-private rows alongside
--   the marketplace catalog. 190's header assumed themes_public_active_read and
--   themes_service_all already existed; they never did — the only policy on the
--   table was the baseline USING (true). Every site-private theme's name, config,
--   settings_schema and default_template was therefore readable by any role holding
--   SELECT on the table (today app_tenant, which is NOBYPASSRLS and has blanket
--   DML grants, plus anything granted SELECT in future).
--   ART-08 / R-1: tenant tables must ENABLE **and** FORCE row level security.
--   SEC-R1: with the new policies an anonymous session (auth.uid() IS NULL) and an
--   unset tenant context both resolve to zero rows — the table fails closed.
--
-- OWNER SAFETY (verified before this migration was written)
--   FORCE ROW LEVEL SECURITY subjects the table owner to RLS, so it can break
--   migration replay and owner-role maintenance. All 24 tables are owned by
--   `postgres`, and both `postgres` and `service_role` carry BYPASSRLS
--   (pg_roles.rolbypassrls = t), which takes precedence over FORCE. Proven on the
--   local database with a throwaway forced table carrying zero policies: the owner
--   still wrote and read its own row. The gateway (service_role via
--   getSupabaseAdmin) and migration/seed replay as `postgres` are therefore
--   unaffected, and no table had to be skipped.
--
-- ADDITIVE + IDEMPOTENT
--   DROP POLICY IF EXISTS precedes every CREATE POLICY; FORCE ROW LEVEL SECURITY is
--   a no-op when already set and every ALTER TABLE uses IF EXISTS. Safe to replay.
--
-- SCOPE: access control only. No money, ledger, payment, invoice, identity or
--   session table is touched, no RPC is redefined, and no row is deleted.

BEGIN;

-- ---------------------------------------------------------
-- public.themes — replace the wide-open catalog read
-- ---------------------------------------------------------

DROP POLICY IF EXISTS "Themes are viewable by everyone" ON public.themes;

-- Marketplace catalog: only rows that are live AND not a merchant's private theme.
-- COALESCE guards the discriminator in case is_site_private is ever relaxed to NULL.
DROP POLICY IF EXISTS themes_public_catalog_read ON public.themes;
CREATE POLICY themes_public_catalog_read
    ON public.themes
    FOR SELECT
    USING (is_active = true AND COALESCE(is_site_private, false) = false);

-- Site-private themes: readable by the owning site's merchant. Matches the
-- ownership predicate used by theme_instances_owner_manage / theme_draft_patches —
-- user_id OR custom_user_id, so custom-auth merchants are not locked out.
DROP POLICY IF EXISTS themes_site_owner_read ON public.themes;
CREATE POLICY themes_site_owner_read
    ON public.themes
    FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM public.sites
        WHERE sites.id = themes.owned_by_site_id
          AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
          AND sites.deleted_at IS NULL
    ));

-- ---------------------------------------------------------
-- FORCE ROW LEVEL SECURITY — the 24 theme tables that were
-- ENABLE-only. store_themes, theme_draft_patches,
-- theme_editor_drafts, theme_instance_drafts, theme_instances,
-- theme_preview_sessions, theme_releases and
-- theme_template_assignments are already forced.
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS public.themes FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_block_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_collection_items FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_collections FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_developer_listings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_developer_payout_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_download_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_layouts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_marketplace_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_migrations FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_package_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_presets FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_purchase_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_purchases FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_refund_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_renderer_manifests FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_saved_searches FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_schema_manifests FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_section_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_templates FORCE ROW LEVEL SECURITY;

COMMIT;
