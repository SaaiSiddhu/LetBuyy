-- Verification harness for migration 055_only_urban_kicks_theme_catalog.sql.

DO $$
DECLARE
    unsupported_active_theme_count INTEGER;
    unsupported_active_install_count INTEGER;
    unsupported_active_instance_count INTEGER;
    unsupported_active_package_count INTEGER;
    unsupported_published_version_count INTEGER;
    unsupported_store_theme_count INTEGER;
    stores_without_urban_instance_count INTEGER;
    urban_theme_count INTEGER;
BEGIN
    SELECT COUNT(*)
      INTO urban_theme_count
      FROM themes
     WHERE slug = 'urban-kicks'
       AND is_active = true;

    IF urban_theme_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one active urban-kicks theme, found %', urban_theme_count;
    END IF;

    SELECT COUNT(*)
      INTO unsupported_active_theme_count
      FROM themes
     WHERE slug <> 'urban-kicks'
       AND is_active = true;

    IF unsupported_active_theme_count <> 0 THEN
        RAISE EXCEPTION 'Unsupported active themes remain: %', unsupported_active_theme_count;
    END IF;

    SELECT COUNT(*)
      INTO unsupported_store_theme_count
      FROM sites
     WHERE COALESCE(theme_id, '') <> 'urban-kicks';

    IF unsupported_store_theme_count <> 0 THEN
        RAISE EXCEPTION 'Stores with unsupported theme_id remain: %', unsupported_store_theme_count;
    END IF;

    SELECT COUNT(*)
      INTO unsupported_active_install_count
      FROM store_themes st
      JOIN themes t ON t.id = st.theme_id
     WHERE t.slug <> 'urban-kicks'
       AND st.is_active = true;

    IF unsupported_active_install_count <> 0 THEN
        RAISE EXCEPTION 'Unsupported active store theme installs remain: %', unsupported_active_install_count;
    END IF;

    SELECT COUNT(*)
      INTO unsupported_active_package_count
      FROM theme_packages
     WHERE slug <> 'urban-kicks'
       AND status = 'active'
       AND deleted_at IS NULL;

    IF unsupported_active_package_count <> 0 THEN
        RAISE EXCEPTION 'Unsupported active theme packages remain: %', unsupported_active_package_count;
    END IF;

    SELECT COUNT(*)
      INTO unsupported_published_version_count
      FROM theme_package_versions tpv
      JOIN theme_packages tp ON tp.id = tpv.theme_package_id
     WHERE tp.slug <> 'urban-kicks'
       AND tpv.release_status = 'published'
       AND tpv.deleted_at IS NULL;

    IF unsupported_published_version_count <> 0 THEN
        RAISE EXCEPTION 'Unsupported published theme package versions remain: %', unsupported_published_version_count;
    END IF;

    SELECT COUNT(*)
      INTO unsupported_active_instance_count
      FROM theme_instances ti
      JOIN theme_packages tp ON tp.id = ti.theme_package_id
     WHERE tp.slug <> 'urban-kicks'
       AND ti.instance_status = 'active'
       AND ti.deleted_at IS NULL;

    IF unsupported_active_instance_count <> 0 THEN
        RAISE EXCEPTION 'Unsupported active theme instances remain: %', unsupported_active_instance_count;
    END IF;

    SELECT COUNT(*)
      INTO stores_without_urban_instance_count
      FROM sites s
     WHERE s.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1
           FROM theme_instances ti
           JOIN theme_packages tp ON tp.id = ti.theme_package_id
           WHERE ti.store_id = s.id
             AND tp.slug = 'urban-kicks'
             AND ti.instance_status = 'active'
             AND ti.deleted_at IS NULL
       );

    IF stores_without_urban_instance_count <> 0 THEN
        RAISE EXCEPTION 'Stores without active urban-kicks theme instance remain: %', stores_without_urban_instance_count;
    END IF;
END $$;
