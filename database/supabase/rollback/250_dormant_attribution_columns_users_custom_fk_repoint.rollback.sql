-- Rollback for 250_dormant_attribution_columns_users_custom_fk_repoint.sql. Restores each
-- baseline auth.users(id) reference exactly, including employee_invites.invited_by's
-- original implicit NO ACTION delete behaviour. Only use this if the users_custom repoint
-- is found to be wrong for one or more of these five columns.

BEGIN;

ALTER TABLE public.employee_invites
    DROP CONSTRAINT IF EXISTS employee_invites_invited_by_fkey;
ALTER TABLE public.employee_invites
    ADD CONSTRAINT employee_invites_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES auth.users(id);

ALTER TABLE public.media_assets
    DROP CONSTRAINT IF EXISTS media_assets_created_by_fkey;
ALTER TABLE public.media_assets
    ADD CONSTRAINT media_assets_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.navigation_menus
    DROP CONSTRAINT IF EXISTS navigation_menus_created_by_fkey,
    DROP CONSTRAINT IF EXISTS navigation_menus_updated_by_fkey;
ALTER TABLE public.navigation_menus
    ADD CONSTRAINT navigation_menus_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT navigation_menus_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.storefront_page_revisions
    DROP CONSTRAINT IF EXISTS storefront_page_revisions_created_by_fkey;
ALTER TABLE public.storefront_page_revisions
    ADD CONSTRAINT storefront_page_revisions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.storefront_slug_redirects
    DROP CONSTRAINT IF EXISTS storefront_slug_redirects_created_by_fkey;
ALTER TABLE public.storefront_slug_redirects
    ADD CONSTRAINT storefront_slug_redirects_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
