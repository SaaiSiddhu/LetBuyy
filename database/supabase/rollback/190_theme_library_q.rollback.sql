-- Rollback for 190_theme_library_q.sql
-- Drops the two Phase Q library indexes and the two site-private discriminator columns
-- (owned_by_site_id, is_site_private) 190 added to the themes table.
--
-- GUARDED DROP — owned_by_site_id is the ONLY record of which merchant owns a site-private theme
-- (the rows themselves live in the same themes table with is_active = false). Dropping it while any
-- site-private theme exists would orphan merchant-authored themes into the catalog with no owner and
-- no way to re-derive one, so this rollback ABORTS instead. Delete or export those themes first.
--
-- Note: reverting also removes the site-private/public discriminator, so Phase Q theme-library routes
-- (GET /themes/library, create, duplicate, rename, archive, delete) stop working entirely.
--
-- Re-runnable: the guard returns early once the columns are gone, and both drops use IF EXISTS.

DO $$
DECLARE
    site_private_count bigint;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'themes'
          AND column_name = 'owned_by_site_id'
    ) THEN
        RETURN;
    END IF;

    SELECT count(*) INTO site_private_count
    FROM public.themes
    WHERE owned_by_site_id IS NOT NULL
       OR is_site_private;

    IF site_private_count > 0 THEN
        RAISE EXCEPTION
            'Refusing to roll back 190: % site-private theme(s) exist. Dropping owned_by_site_id would orphan merchant-authored themes with no recoverable owner. Delete or export them first.',
            site_private_count;
    END IF;
END $$;

DROP INDEX IF EXISTS public.themes_owned_by_site_id_idx;
DROP INDEX IF EXISTS public.themes_is_site_private_idx;

ALTER TABLE public.themes
    DROP COLUMN IF EXISTS owned_by_site_id;

ALTER TABLE public.themes
    DROP COLUMN IF EXISTS is_site_private;
