-- Rollback for 188_letbuyy_core_theme_row.sql
-- Removes the canonical `letbuyy-core` catalog row 188 cloned from urban-kicks. The code alias in
-- packages/theme-engine/src/theme-bundle-core.ts remains, so slug resolution falls back to
-- urban-kicks exactly as it did before 188 — only the DB-of-record row goes away.
--
-- GUARDED DELETE — six child tables reference themes.id with ON DELETE CASCADE
-- (store_themes, theme_purchases, theme_reviews, theme_collection_items, theme_download_artifacts,
-- theme_reports). Deleting this row while any merchant install, purchase, or review points at it
-- would silently destroy that merchant and money data, so this rollback ABORTS instead. Move those
-- stores onto another theme first, then re-run.
--
-- Safe when the row does not exist: 188 is a knowing no-op on a fresh database (its INSERT..SELECT
-- finds no urban-kicks row because seeds run after migrations), so this file simply returns.
-- 188 used ON CONFLICT (slug) DO NOTHING, so a letbuyy-core row that predated it was left untouched;
-- this rollback cannot tell the two apart and will remove either — the guard above keeps the blast
-- radius to an unreferenced catalog row.
--
-- Non-destructive beyond that single row. Re-runnable.

DO $$
DECLARE
    core_id uuid;
    dependents bigint;
BEGIN
    SELECT id INTO core_id FROM public.themes WHERE slug = 'letbuyy-core';

    IF core_id IS NULL THEN
        RETURN;
    END IF;

    SELECT (SELECT count(*) FROM public.store_themes WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_purchases WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_reviews WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_collection_items WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_download_artifacts WHERE theme_id = core_id)
         + (SELECT count(*) FROM public.theme_reports WHERE theme_id = core_id)
      INTO dependents;

    IF dependents > 0 THEN
        RAISE EXCEPTION
            'Refusing to roll back 188: % row(s) reference the letbuyy-core theme. ON DELETE CASCADE would destroy merchant installs, purchases, and reviews. Move those stores to another theme first.',
            dependents;
    END IF;

    DELETE FROM public.themes WHERE id = core_id;
END $$;
