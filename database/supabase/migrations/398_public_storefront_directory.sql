-- Owner decision, 2026-10-27: publish discovery of launched PUBLIC stores only.
-- No general tenant exception, grants on tenant tables, or existing design changes.
-- The service-only RPC projects a fixed document; callers cannot choose columns/tables.
CREATE FUNCTION public.public_storefront_directory_v1(
    p_limit integer DEFAULT 12,
    p_after_at timestamptz DEFAULT NULL,
    p_after_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
SET statement_timeout = '5s'
AS $directory$
DECLARE result jsonb;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 24
       OR (p_after_at IS NULL) <> (p_after_id IS NULL) THEN
        RAISE EXCEPTION 'Invalid directory page' USING ERRCODE = '22023';
    END IF;
    WITH eligible AS MATERIALIZED (
        SELECT s.id, COALESCE(s.subdomain, s.store_name) AS handle,
               s.name, s.logo_url, s.theme_id, t.name AS theme_name,
               COALESCE(s.created_at, s.published_at) AS created_at,
               COALESCE(s.published_at, s.created_at) AS launched_at
        FROM public.sites s
        LEFT JOIN public.themes t ON t.slug = s.theme_id
            AND t.is_active AND t.catalog_visible AND NOT t.is_site_private
            AND t.owned_by_site_id IS NULL
        WHERE s.deleted_at IS NULL AND s.site_type = 'store'
          AND s.status = 'published' AND s.published IS TRUE
          AND COALESCE(s.access_mode, 'public') = 'public'
          AND COALESCE(s.published_at, s.created_at) IS NOT NULL
          AND COALESCE(s.subdomain, s.store_name) IS NOT NULL
    ), page AS MATERIALIZED (
        SELECT * FROM eligible e
        WHERE p_after_at IS NULL OR (e.launched_at, e.id) < (p_after_at, p_after_id)
        ORDER BY e.launched_at DESC, e.id DESC LIMIT p_limit + 1
    ), displayed AS MATERIALIZED (
        SELECT * FROM page ORDER BY launched_at DESC, id DESC LIMIT p_limit
    )
    SELECT jsonb_build_object(
        'stores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'store_name', d.handle, 'subdomain', d.handle, 'name', d.name,
            'logo_url', d.logo_url, 'theme_id', d.theme_id, 'theme_name', d.theme_name,
            'status', 'published', 'site_type', 'store',
            'created_at', d.created_at, 'published_at', d.launched_at
        ) ORDER BY d.launched_at DESC, d.id DESC) FROM displayed d), '[]'::jsonb),
        'stats', jsonb_build_object(
            'scope', 'public_stores',
            'totalStores', (SELECT count(*) FROM eligible),
            'totalThemes', (SELECT count(*) FROM public.themes t
                WHERE t.is_active AND t.catalog_visible AND NOT t.is_site_private
                  AND t.owned_by_site_id IS NULL),
            'totalProducts', (SELECT count(*) FROM public.products p
                JOIN eligible e ON e.id = p.store_id
                WHERE p.deleted_at IS NULL AND p.is_active AND p.status = 'active'),
            'totalOrders', (SELECT count(*) FROM public.orders o
                JOIN eligible e ON e.id = o.store_id
                WHERE o.deleted_at IS NULL AND o.status = 'delivered')
        ),
        'pagination', jsonb_build_object(
            'limit', p_limit, 'has_more', (SELECT count(*) > p_limit FROM page),
            'next_cursor', CASE WHEN (SELECT count(*) > p_limit FROM page) THEN (
                SELECT replace(encode(convert_to(jsonb_build_object(
                    'id', d.id, 'value', d.launched_at
                )::text, 'UTF8'), 'base64'), E'\n', '')
                FROM displayed d ORDER BY d.launched_at ASC, d.id ASC LIMIT 1
            ) ELSE NULL END
        )
    ) INTO result;
    RETURN result;
END;
$directory$;
REVOKE ALL ON FUNCTION public.public_storefront_directory_v1(integer,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_storefront_directory_v1(integer,timestamptz,uuid) TO service_role;
COMMENT ON FUNCTION public.public_storefront_directory_v1(integer,timestamptz,uuid) IS
    'Owner-approved public launch directory; fixed fields, public-only eligibility, bounded cursor page, no owner PII.';

-- API creation already defaults to Circuit. Close the remaining SQL-default drift
-- without overwriting any saved Core/modern theme, configuration, draft or release.
ALTER TABLE public.sites ALTER COLUMN theme_id SET DEFAULT 'letbuyy-forge';
NOTIFY pgrst, 'reload schema';
