-- Rollback for 192_theme_engine_actor_fk_users_custom.sql
-- Repoints the eleven theme-engine actor FKs back to auth.users.
--
-- Note: after the forward migration these columns hold users_custom ids, which do not exist in auth.users.
-- Rolling back therefore NULLs every actor id that has no auth.users counterpart — the same in-contract
-- treatment the forward migration applies, and the only way the auth.users constraint can be re-added.
-- Authorship attribution on theme rows is lost by this rollback; the rows themselves are preserved.
--
-- Non-destructive: FK constraints and nullable actor columns only. No table, column, index, or policy is
-- dropped. Re-runnable (DROP CONSTRAINT IF EXISTS).

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
        IF to_regclass('public.' || target.table_name) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format(
            'UPDATE public.%I SET %I = NULL
              WHERE %I IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = public.%I.%I)',
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
                 REFERENCES auth.users (id) ON DELETE %s',
            target.table_name,
            target.table_name || '_' || target.column_name || '_fkey',
            target.column_name,
            target.on_delete
        );
    END LOOP;
END $$;
