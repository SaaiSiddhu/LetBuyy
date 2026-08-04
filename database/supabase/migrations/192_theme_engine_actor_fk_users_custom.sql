-- 192 — Repoint theme-engine actor FKs from auth.users to public.users_custom.
--
-- The gateway resolves the acting merchant with resolveCustomUser() (services/api-gateway/src/lib/auth-user.ts),
-- which reads public.users_custom, and then writes that id into created_by / updated_by / locked_by / actor_id.
-- Eleven FKs on the theme-engine baseline tables still reference auth.users, and the two id spaces do not
-- overlap, so EVERY theme write fails at the FK:
--
--     ERROR: insert or update on table "theme_instances" violates foreign key constraint
--            "theme_instances_created_by_fkey"
--     DETAIL: Key (created_by)=(...) is not present in table "users".
--
-- That blocks the whole theme flow — install (ensureThemeInstance), library create/duplicate
-- (createSiteTheme / duplicateSiteTheme), editor drafts, and publish — which is why a store can have an
-- active theme catalog and still show "No themes installed yet".
--
-- The marketplace-era theme tables (theme_reviews, theme_purchases, theme_collections, theme_reports,
-- theme_developer_listings, theme_refund_requests, theme_saved_searches, theme_marketplace_settings,
-- theme_download_artifacts, theme_purchase_receipts) already reference users_custom. This migration brings
-- the remaining baseline tables onto that same convention; it does not invent a new one.
--
-- Additive + idempotent + non-destructive:
--   * Only FK constraints are dropped and recreated (never a table, column, index, or policy).
--     DROP CONSTRAINT IF EXISTS makes re-runs safe.
--   * ON DELETE behaviour is preserved per constraint (SET NULL, except theme_editor_drafts = NO ACTION).
--   * Orphan actor ids (present in auth.users but absent from users_custom) are set to NULL before the new
--     constraint is added, so the migration cannot fail on legacy rows. All four columns are nullable and
--     already carry ON DELETE SET NULL semantics, so NULL is an in-contract value — no row is deleted and
--     no non-actor column is touched.
--   * No money, identity, RLS, or checkout surface is modified.

DO $$
DECLARE
    target record;
BEGIN
    FOR target IN
        SELECT * FROM (VALUES
            ('theme_draft_patches',    'actor_id',   'SET NULL'),
            ('theme_editor_drafts',    'created_by', 'NO ACTION'),
            ('theme_editor_drafts',    'updated_by', 'NO ACTION'),
            ('theme_instance_drafts',  'created_by', 'SET NULL'),
            ('theme_instance_drafts',  'locked_by',  'SET NULL'),
            ('theme_instance_drafts',  'updated_by', 'SET NULL'),
            ('theme_instances',        'created_by', 'SET NULL'),
            ('theme_instances',        'updated_by', 'SET NULL'),
            ('theme_migrations',       'created_by', 'SET NULL'),
            ('theme_package_versions', 'created_by', 'SET NULL'),
            ('theme_packages',         'created_by', 'SET NULL')
        ) AS t(table_name, column_name, on_delete)
    LOOP
        -- Skip cleanly if the table is not present in this database.
        IF to_regclass('public.' || target.table_name) IS NULL THEN
            CONTINUE;
        END IF;

        -- Null out actor ids that have no users_custom counterpart so the new FK can be added.
        EXECUTE format(
            'UPDATE public.%I SET %I = NULL
              WHERE %I IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM public.users_custom uc WHERE uc.id = public.%I.%I)',
            target.table_name, target.column_name,
            target.column_name, target.table_name, target.column_name
        );

        EXECUTE format(
            'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
            target.table_name, target.table_name || '_' || target.column_name || '_fkey'
        );

        EXECUTE format(
            'ALTER TABLE public.%I
                 ADD CONSTRAINT %I FOREIGN KEY (%I)
                 REFERENCES public.users_custom (id) ON DELETE %s',
            target.table_name,
            target.table_name || '_' || target.column_name || '_fkey',
            target.column_name,
            target.on_delete
        );
    END LOOP;
END $$;
