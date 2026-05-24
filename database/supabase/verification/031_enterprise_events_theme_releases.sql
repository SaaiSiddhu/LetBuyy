-- Verification harness for migration 031_enterprise_events_theme_releases.sql.
-- Run after applying migration 031. It raises exceptions on missing infrastructure.

DO $$
DECLARE
    required_table TEXT;
    required_tables TEXT[] := ARRAY[
        'audit_activity_events',
        'outbox_events',
        'theme_releases',
        'theme_preview_sessions',
        'storefront_cache_tags'
    ];
    duplicate_current_count INTEGER;
    orphan_site_count INTEGER;
BEGIN
    FOREACH required_table IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = required_table
        ) THEN
            RAISE EXCEPTION 'Required migration 031 table missing: %', required_table;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.routines
         WHERE routine_schema = 'public'
           AND routine_name = 'publish_theme_release'
    ) THEN
        RAISE EXCEPTION 'publish_theme_release function is missing';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated role must not be able to execute publish_theme_release directly';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'sites'
           AND column_name = 'current_theme_release_id'
    ) THEN
        RAISE EXCEPTION 'sites.current_theme_release_id is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'sites'
           AND column_name = 'storefront_release_version'
    ) THEN
        RAISE EXCEPTION 'sites.storefront_release_version is missing';
    END IF;

    SELECT COUNT(*)
      INTO duplicate_current_count
      FROM (
          SELECT store_id
            FROM theme_releases
           WHERE is_current = TRUE
             AND deleted_at IS NULL
           GROUP BY store_id
          HAVING COUNT(*) > 1
      ) duplicates;

    IF duplicate_current_count > 0 THEN
        RAISE EXCEPTION 'Multiple current theme releases detected for % stores', duplicate_current_count;
    END IF;

    SELECT COUNT(*)
      INTO orphan_site_count
      FROM sites s
     WHERE s.current_theme_release_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM theme_releases tr
            WHERE tr.id = s.current_theme_release_id
              AND tr.store_id = s.id
              AND tr.is_current = TRUE
              AND tr.deleted_at IS NULL
       );

    IF orphan_site_count > 0 THEN
        RAISE EXCEPTION 'sites.current_theme_release_id points at invalid release for % sites', orphan_site_count;
    END IF;
END $$;
