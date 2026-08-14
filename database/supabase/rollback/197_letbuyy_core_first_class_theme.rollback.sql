-- Rollback for 197_letbuyy_core_first_class_theme.sql
--
-- 197 does exactly one of two things, and records which in
-- themes.renderer_manifest -> 'provenance' -> 'mode':
--   * 'insert' — it created the canonical letbuyy-core catalog row on a database that did not have one
--                (every fresh database, because migration 188's INSERT..SELECT finds no urban-kicks source
--                row before the seeds run). This rollback removes that row.
--   * 'repair' — the row already existed as migration 188's urban-kicks clone and 197 only corrected its
--                branding and filled the columns 188 skipped. 197 did NOT create that row, so this rollback
--                leaves it alone and says so loudly. Reverting the repair would restore Urban Kicks branding
--                into the canonical theme, which is strictly worse than the repaired state; the correct
--                undo for a 188-created row is 188's own rollback,
--                database/supabase/rollback/188_letbuyy_core_theme_row.rollback.sql.
-- Any other provenance (absent, or a later marketplace upload that replaced the manifest) means the row is
-- not 197's to remove, and it is left untouched.
--
-- GUARDED DELETE — six child tables reference themes.id with ON DELETE CASCADE (store_themes,
-- theme_purchases, theme_reviews, theme_collection_items, theme_download_artifacts, theme_reports), and two
-- more tables bind the theme by slug (theme_instances.theme_slug, sites.theme_id). Deleting the row while any
-- merchant install, purchase, review or live store points at it would silently destroy merchant data, so this
-- rollback ABORTS with the count instead. Move those stores onto another theme first, then re-run.
--
-- Safe when the row does not exist (197 never applied, or 188's rollback already removed it): it returns
-- without touching anything. Re-runnable. No money, identity, auth or RLS surface is involved, no schema
-- object is dropped, and nothing outside the single public.themes catalog row is deleted.

DO $$
DECLARE
    core_id uuid;
    core_mode text;
    dependents bigint;
BEGIN
    SELECT id, renderer_manifest #>> '{provenance,mode}'
      INTO core_id, core_mode
      FROM public.themes
     WHERE slug = 'letbuyy-core';

    IF core_id IS NULL THEN
        RETURN;
    END IF;

    IF core_mode IS DISTINCT FROM 'insert' THEN
        RAISE NOTICE
            'Leaving the letbuyy-core theme row in place: migration 197 did not create it (provenance mode = %). Use the 188 rollback to remove a row that migration 188 created.',
            COALESCE(core_mode, 'none');
        RETURN;
    END IF;

    SELECT (SELECT count(*) FROM public.store_themes WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_purchases WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_reviews WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_collection_items WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_download_artifacts WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_reports WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_instances WHERE theme_slug = 'letbuyy-core' AND deleted_at IS NULL)
         + (SELECT count(*) FROM public.sites WHERE theme_id = 'letbuyy-core' AND deleted_at IS NULL)
      INTO dependents;

    IF dependents > 0 THEN
        RAISE EXCEPTION
            'Refusing to roll back 197: % row(s) depend on the letbuyy-core theme. Deleting it would cascade into merchant installs, purchases and reviews, or orphan a live store. Move those stores to another theme first.',
            dependents;
    END IF;

    DELETE FROM public.themes WHERE id = core_id;
END $$;
