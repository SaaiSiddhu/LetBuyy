-- Continues the stale-FK cleanup started in 208/employees and 209(prior branch)/
-- notification_preferences. Five more attribution columns still carry their pre-cutover
-- baseline FK -- REFERENCES auth.users(id) -- from when LetBuyy authenticated merchants
-- through Supabase Auth. Unlike 208/209/210, none of these five have live write traffic
-- today (verified against services/api-gateway/src, the only runtime that writes them),
-- so the stale FK is not an active production bug -- but it is the same defect, latent
-- rather than triggered, batched here per the same convention rather than left for a
-- future incident:
--
--   * employee_invites.invited_by  -- POST /employees/invite and POST /admin/employees/invite
--     (services/api-gateway/src/routes/employee.ts, routes/admin.ts) both fail closed with a
--     503 before any DB write (Phase N3 retired the only completion path). No live INSERT
--     path exists. ON DELETE upgraded from the baseline's implicit NO ACTION to SET NULL,
--     matching the sibling convention 208 already established for this exact column shape
--     (attribution, not ownership).
--   * media_assets.created_by -- both insert paths in services/api-gateway/src/routes/media.ts
--     (recordProcessedMediaAsset, POST /signed-upload) are live but never include
--     created_by in the insert payload -- it is always implicitly NULL today.
--   * navigation_menus.created_by / .updated_by -- ensureNavigationMenu() in
--     services/api-gateway/src/routes/pages.ts inserts live rows but never sets either
--     column.
--   * storefront_page_revisions.created_by -- ensurePageRevision() in
--     services/api-gateway/src/routes/pages.ts inserts a live row on every page save but
--     never sets created_by.
--   * storefront_slug_redirects.created_by -- referenced only as tenant-table metadata
--     (services/api-gateway/src/tenant/tenant-tables.registry.ts); no read or write code
--     path exists anywhere in the repo.
--
-- Repoints all to public.users_custom(id), matching the FK convention established in
-- 208/209. ON DELETE SET NULL is used throughout (attribution, not ownership).
--
-- Verified against the live local database before writing this: all five columns are
-- either all-NULL or on zero-row tables today, so there is no orphaned data and no backfill
-- is needed -- a straight DROP + ADD is safe for each. Zero production merchants overall,
-- per the Constitution.

BEGIN;

ALTER TABLE public.employee_invites
    DROP CONSTRAINT IF EXISTS employee_invites_invited_by_fkey;
ALTER TABLE public.employee_invites
    ADD CONSTRAINT employee_invites_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE public.media_assets
    DROP CONSTRAINT IF EXISTS media_assets_created_by_fkey;
ALTER TABLE public.media_assets
    ADD CONSTRAINT media_assets_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE public.navigation_menus
    DROP CONSTRAINT IF EXISTS navigation_menus_created_by_fkey,
    DROP CONSTRAINT IF EXISTS navigation_menus_updated_by_fkey;
ALTER TABLE public.navigation_menus
    ADD CONSTRAINT navigation_menus_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    ADD CONSTRAINT navigation_menus_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE public.storefront_page_revisions
    DROP CONSTRAINT IF EXISTS storefront_page_revisions_created_by_fkey;
ALTER TABLE public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE public.storefront_slug_redirects
    DROP CONSTRAINT IF EXISTS storefront_slug_redirects_created_by_fkey;
ALTER TABLE public.storefront_slug_redirects
    ADD CONSTRAINT storefront_slug_redirects_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

COMMIT;
