-- ============================================================================
-- Storefront CMS and navigation backfill
-- Migration: 054_storefront_cms_navigation_backfill.sql
-- Purpose:
--   Move legacy published pages into the enterprise storefront CMS spine and
--   derive navigation from persisted content. This is additive and idempotent.
-- ============================================================================

DO $$
DECLARE
    has_body BOOLEAN;
    has_html_content BOOLEAN;
    has_page_type BOOLEAN;
    has_show_in_nav BOOLEAN;
    has_display_order BOOLEAN;
    has_published_at BOOLEAN;
    has_deleted_at BOOLEAN;
    body_expr TEXT;
    html_expr TEXT;
    page_type_expr TEXT;
    published_expr TEXT;
    deleted_filter TEXT;
    nav_filter TEXT;
    display_order_expr TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'body'
    ) INTO has_body;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'html_content'
    ) INTO has_html_content;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'page_type'
    ) INTO has_page_type;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'show_in_nav'
    ) INTO has_show_in_nav;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'display_order'
    ) INTO has_display_order;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'published_at'
    ) INTO has_published_at;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'deleted_at'
    ) INTO has_deleted_at;

    body_expr := CASE WHEN has_body THEN 'p.body' ELSE 'NULL::text' END;
    html_expr := CASE WHEN has_html_content THEN 'p.html_content' ELSE 'NULL::text' END;
    page_type_expr := CASE WHEN has_page_type THEN 'NULLIF(p.page_type, '''')' ELSE 'NULL::text' END;
    published_expr := CASE WHEN has_published_at THEN 'p.published_at' ELSE 'NULL::timestamptz' END;
    deleted_filter := CASE WHEN has_deleted_at THEN 'AND p.deleted_at IS NULL' ELSE '' END;
    nav_filter := CASE WHEN has_show_in_nav THEN 'COALESCE(p.show_in_nav, false)' ELSE 'true' END;
    display_order_expr := CASE WHEN has_display_order THEN 'COALESCE(p.display_order, 0)' ELSE '0' END;

    EXECUTE format($sql$
        INSERT INTO storefront_pages (
            store_id,
            slug,
            title,
            status,
            page_type,
            seo,
            content,
            published_at,
            created_at,
            updated_at
        )
        SELECT
            p.store_id,
            LOWER(REGEXP_REPLACE(COALESCE(NULLIF(p.slug, ''), p.id::text), '[^a-zA-Z0-9_-]+', '-', 'g')) AS slug,
            COALESCE(NULLIF(p.title, ''), 'Untitled page') AS title,
            CASE WHEN p.status = 'published' THEN 'published' ELSE 'draft' END AS status,
            COALESCE(%1$s, 'page') AS page_type,
            '{}'::jsonb AS seo,
            jsonb_strip_nulls(
                COALESCE(p.content, '{}'::jsonb) ||
                jsonb_build_object(
                    'body',
                    NULLIF(COALESCE(%2$s, %3$s, p.content->>'body', p.content->>'html'), '')
                )
            ) AS content,
            COALESCE(%4$s, CASE WHEN p.status = 'published' THEN NOW() ELSE NULL END) AS published_at,
            COALESCE(p.created_at, NOW()) AS created_at,
            COALESCE(p.updated_at, NOW()) AS updated_at
        FROM pages p
        WHERE p.store_id IS NOT NULL
          %5$s
        ON CONFLICT (store_id, slug) DO UPDATE
            SET title = EXCLUDED.title,
                status = EXCLUDED.status,
                page_type = EXCLUDED.page_type,
                content = EXCLUDED.content,
                published_at = COALESCE(storefront_pages.published_at, EXCLUDED.published_at),
                updated_at = NOW()
    $sql$, page_type_expr, body_expr, html_expr, published_expr, deleted_filter);

    INSERT INTO storefront_page_revisions (
        page_id,
        store_id,
        revision_number,
        title,
        slug,
        seo,
        content,
        template_key,
        created_at
    )
    SELECT
        sp.id,
        sp.store_id,
        1,
        sp.title,
        sp.slug,
        sp.seo,
        sp.content,
        sp.assigned_template_key,
        COALESCE(sp.published_at, sp.updated_at, NOW())
    FROM storefront_pages sp
    WHERE sp.deleted_at IS NULL
      AND sp.status = 'published'
    ON CONFLICT (page_id, revision_number) DO NOTHING;

    UPDATE storefront_pages sp
    SET published_revision_id = spr.id,
        updated_at = NOW()
    FROM storefront_page_revisions spr
    WHERE spr.page_id = sp.id
      AND spr.revision_number = 1
      AND sp.published_revision_id IS NULL
      AND sp.status = 'published';

    INSERT INTO navigation_menus (
        store_id,
        handle,
        name,
        location,
        status
    )
    SELECT
        s.id,
        'main',
        'Main menu',
        'main',
        'active'
    FROM sites s
    ON CONFLICT (store_id, handle) DO NOTHING;

    EXECUTE format($sql$
        INSERT INTO navigation_menu_items (
            menu_id,
            store_id,
            label,
            url,
            target_type,
            target_resource_id,
            sort_order,
            is_visible
        )
        SELECT
            nm.id,
            sp.store_id,
            sp.title,
            CASE WHEN sp.slug IN ('home', 'index') THEN '/' ELSE '/' || sp.slug END,
            'page',
            sp.id::text,
            (ROW_NUMBER() OVER (PARTITION BY sp.store_id ORDER BY %1$s, sp.title))::integer,
            true
        FROM pages p
        JOIN storefront_pages sp
          ON sp.store_id = p.store_id
         AND sp.slug = LOWER(REGEXP_REPLACE(COALESCE(NULLIF(p.slug, ''), p.id::text), '[^a-zA-Z0-9_-]+', '-', 'g'))
        JOIN navigation_menus nm
          ON nm.store_id = sp.store_id
         AND nm.handle = 'main'
        WHERE p.store_id IS NOT NULL
          AND p.status = 'published'
          AND %2$s
          %3$s
          AND sp.deleted_at IS NULL
          AND sp.slug NOT IN ('privacy', 'terms', 'shipping', 'refund', 'returns')
          AND NOT EXISTS (
              SELECT 1
              FROM navigation_menu_items existing
              WHERE existing.menu_id = nm.id
                AND existing.target_type = 'page'
                AND existing.target_resource_id = sp.id::text
                AND existing.deleted_at IS NULL
          )
    $sql$, display_order_expr, nav_filter, deleted_filter);
END $$;

INSERT INTO storefront_policies (
    store_id,
    policy_type,
    slug,
    title,
    body,
    status,
    seo,
    published_at,
    created_at,
    updated_at
)
SELECT
    sp.store_id,
    CASE
        WHEN sp.slug = 'returns' THEN 'refund'
        WHEN sp.slug = 'refund' THEN 'refund'
        ELSE sp.slug
    END AS policy_type,
    sp.slug,
    sp.title,
    sp.content,
    sp.status,
    sp.seo,
    sp.published_at,
    sp.created_at,
    sp.updated_at
FROM storefront_pages sp
WHERE sp.deleted_at IS NULL
  AND sp.status = 'published'
  AND sp.slug IN ('privacy', 'terms', 'shipping', 'refund', 'returns')
ON CONFLICT (store_id, policy_type) DO UPDATE
    SET slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        status = EXCLUDED.status,
        seo = EXCLUDED.seo,
        published_at = COALESCE(storefront_policies.published_at, EXCLUDED.published_at),
        updated_at = NOW();

INSERT INTO navigation_menus (
    store_id,
    handle,
    name,
    location,
    status
)
SELECT
    s.id,
    'policies',
    'Policies',
    'policies',
    'active'
FROM sites s
ON CONFLICT (store_id, handle) DO NOTHING;

INSERT INTO navigation_menu_items (
    menu_id,
    store_id,
    label,
    url,
    target_type,
    target_resource_id,
    sort_order,
    is_visible
)
SELECT
    nm.id,
    sp.store_id,
    sp.title,
    '/' || sp.slug,
    'policy',
    sp.id::text,
    (ROW_NUMBER() OVER (PARTITION BY sp.store_id ORDER BY sp.slug))::integer,
    true
FROM storefront_policies sp
JOIN navigation_menus nm
  ON nm.store_id = sp.store_id
 AND nm.handle = 'policies'
WHERE sp.deleted_at IS NULL
  AND sp.status = 'published'
  AND NOT EXISTS (
      SELECT 1
      FROM navigation_menu_items existing
      WHERE existing.menu_id = nm.id
        AND existing.target_type = 'policy'
        AND existing.target_resource_id = sp.id::text
        AND existing.deleted_at IS NULL
  );
