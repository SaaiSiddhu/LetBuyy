-- The authored portfolio starts with Circuit. Popularity remains real install counts.
-- Preserve the previous rank for an exact, repeatable paired rollback.
DO $catalog_order$
DECLARE theme_row record;
BEGIN
    IF (SELECT count(*) FROM public.themes WHERE slug IN ('letbuyy-forge','letbuyy-sense')
        AND owned_by_site_id IS NULL AND catalog_visible AND is_active AND NOT is_site_private) <> 2 THEN
        RAISE EXCEPTION 'The two canonical public catalog themes must exist before portfolio ordering';
    END IF;
    FOR theme_row IN SELECT id,slug,sort_order,config FROM public.themes
        WHERE slug IN ('letbuyy-forge','letbuyy-sense') AND owned_by_site_id IS NULL
        ORDER BY id FOR UPDATE
    LOOP
        IF theme_row.config IS NOT NULL AND jsonb_typeof(theme_row.config) <> 'object' THEN
            RAISE EXCEPTION 'Canonical theme metadata must be an object';
        END IF;
        UPDATE public.themes SET
            config = CASE WHEN coalesce(theme_row.config,'{}'::jsonb) ? 'circuitPortfolioOrder397'
                THEN theme_row.config
                ELSE coalesce(theme_row.config,'{}'::jsonb) || jsonb_build_object(
                    'circuitPortfolioOrder397',jsonb_build_object('sort_order',theme_row.sort_order,
                    'config_was_null',theme_row.config IS NULL)) END,
            sort_order = CASE theme_row.slug WHEN 'letbuyy-forge' THEN 0 ELSE 1 END
        WHERE id=theme_row.id;
    END LOOP;
END
$catalog_order$;
