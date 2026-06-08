-- Verification harness for the theme catalog baseline.
-- The old single-theme invariant has been retired: Urban Kicks must remain active, but the catalog may contain N active themes.

DO $$
DECLARE
    active_theme_count integer;
    invalid_active_theme_count integer;
    urban_theme_count integer;
BEGIN
    SELECT COUNT(*)
      INTO urban_theme_count
      FROM public.themes
     WHERE slug = 'urban-kicks'
       AND is_active = true;

    IF urban_theme_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one active urban-kicks theme, found %', urban_theme_count;
    END IF;

    SELECT COUNT(*)
      INTO active_theme_count
      FROM public.themes
     WHERE is_active = true;

    IF active_theme_count < 1 THEN
        RAISE EXCEPTION 'Expected at least one active theme in the catalog';
    END IF;

    SELECT COUNT(*)
      INTO invalid_active_theme_count
      FROM public.themes
     WHERE is_active = true
       AND (
           COALESCE(slug, '') = ''
        OR COALESCE(name, '') = ''
        OR COALESCE(category, '') = ''
        OR COALESCE(theme_preset_id, '') = ''
        OR COALESCE(array_length(supported_site_types, 1), 0) = 0
        OR COALESCE(array_length(supported_platforms, 1), 0) = 0
        OR default_template = '{}'::jsonb
        OR settings_schema = '{}'::jsonb
        OR renderer_manifest = '{}'::jsonb
       );

    IF invalid_active_theme_count <> 0 THEN
        RAISE EXCEPTION 'Active themes missing required catalog/runtime metadata: %', invalid_active_theme_count;
    END IF;

    SELECT COUNT(*)
      INTO invalid_active_theme_count
      FROM public.themes
     WHERE is_active = true
       AND (
           COALESCE(install_count, 0) < 0
        OR COALESCE(review_count, 0) < 0
        OR COALESCE(rating_avg, 0) < 0
        OR COALESCE(rating_avg, 0) > 5
       );

    IF invalid_active_theme_count <> 0 THEN
        RAISE EXCEPTION 'Active themes have invalid honest metric fields: %', invalid_active_theme_count;
    END IF;
END $$;
