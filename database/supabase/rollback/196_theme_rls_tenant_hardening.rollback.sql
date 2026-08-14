-- Rollback for 196_theme_rls_tenant_hardening.sql
--
-- Restores the pre-196 state exactly:
--   (1) drops themes_public_catalog_read and themes_site_owner_read;
--   (2) recreates the baseline policy "Themes are viewable by everyone"
--       (FOR SELECT USING (true) to PUBLIC, as shipped in 000_baseline.sql);
--   (3) returns the 24 theme tables forced by 196 to ENABLE-without-FORCE. The 8
--       tables forced by 164_d4_tenant_role_guc are deliberately left forced.
--
-- WARNING: step (2) reinstates the ART-09 / R-3 violation that 196 closed — every
-- site-private theme (themes.is_site_private / themes.owned_by_site_id, added by
-- migration 190) becomes readable again by any role holding SELECT on the table.
-- Only run this to unblock an incident, and re-apply 196 immediately afterwards.
--
-- Non-destructive: policy and RLS-flag changes only. No table, column, index or row
-- is dropped, and no money, ledger, payment or identity object is touched.
-- Re-runnable: every statement uses IF EXISTS, and NO FORCE is a no-op when unset.

BEGIN;

DROP POLICY IF EXISTS themes_public_catalog_read ON public.themes;
DROP POLICY IF EXISTS themes_site_owner_read ON public.themes;

DROP POLICY IF EXISTS "Themes are viewable by everyone" ON public.themes;
CREATE POLICY "Themes are viewable by everyone"
    ON public.themes
    FOR SELECT
    USING (true);

ALTER TABLE IF EXISTS public.themes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_assets NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_block_definitions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_collection_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_collections NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_developer_listings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_developer_payout_accounts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_download_artifacts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_layouts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_marketplace_settings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_migrations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_package_versions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_packages NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_presets NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_purchase_receipts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_purchases NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_refund_requests NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_renderer_manifests NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_reports NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_reviews NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_saved_searches NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_schema_manifests NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_section_definitions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_templates NO FORCE ROW LEVEL SECURITY;

COMMIT;
