-- ============================================================================
-- Migration 066: Lock Urban Kicks as the production storefront theme
-- Purpose:
--   Keep Urban Kicks as the only active production theme package while the
--   enterprise theme engine is completed and verified.
-- ============================================================================

WITH urban_theme AS (
    INSERT INTO themes (
        name,
        slug,
        site_type,
        category,
        description,
        long_description,
        preview_url,
        thumbnail_url,
        is_premium,
        price,
        letbuyy_pricing_type,
        letbuyy_price_usd,
        letbuyy_price_inr,
        industry,
        supported_site_types,
        supported_platforms,
        tags,
        features,
        config,
        default_template,
        section_schemas,
        block_schemas,
        settings_schema,
        renderer_manifest,
        schema_version,
        renderer_version,
        author,
        version,
        is_active,
        sort_order,
        updated_at
    )
    VALUES (
        'Urban Kicks',
        'urban-kicks',
        'store',
        'modern',
        'Bold, streetwear-inspired storefront for sneaker shops, fashion labels, and urban lifestyle brands.',
        'Urban Kicks is the active production storefront theme for LetBuyy. It includes release-backed header, hero, trust badges, product grid, category grid, brand marquee, newsletter, and footer sections.',
        '/store/urban-kicks-demo',
        '/images/banners/new-arrivals-1.png',
        FALSE,
        0,
        'free',
        0,
        0,
        ARRAY['streetwear', 'sneakers', 'fashion'],
        ARRAY['store'],
        ARRAY['letbuyy'],
        ARRAY['streetwear', 'sneakers', 'fashion', 'responsive', 'commerce'],
        ARRAY['Responsive Layout', 'Product Grid', 'Cart Header', 'Theme Editor', 'SEO Ready'],
        jsonb_build_object(
            'colors', jsonb_build_object(
                'primary', '#8B5CF6',
                'secondary', '#3B82F6',
                'background', '#FFFFFF',
                'text', '#1F2937',
                'accent', '#F59E0B'
            ),
            'fonts', jsonb_build_object(
                'heading', 'Inter',
                'body', 'Inter'
            ),
            'layout', jsonb_build_object(
                'headerStyle', 'sticky',
                'footerStyle', 'standard',
                'maxWidth', 1280
            ),
            'darkMode', FALSE
        ),
        jsonb_build_object(
            'themeId', 'urban-kicks',
            'version', '1.0.0',
            'sections', jsonb_build_object(
                'header', jsonb_build_object('type', 'header', 'visible', TRUE),
                'footer', jsonb_build_object('type', 'footer', 'visible', TRUE),
                'template', jsonb_build_array(
                    jsonb_build_object('type', 'heroBanner', 'order', 10, 'visible', TRUE),
                    jsonb_build_object('type', 'trustBadges', 'order', 20, 'visible', TRUE),
                    jsonb_build_object('type', 'productGrid', 'order', 30, 'visible', TRUE),
                    jsonb_build_object('type', 'brandMarquee', 'order', 40, 'visible', TRUE),
                    jsonb_build_object('type', 'categoryGrid', 'order', 50, 'visible', TRUE),
                    jsonb_build_object('type', 'newsletter', 'order', 60, 'visible', TRUE)
                )
            )
        ),
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        jsonb_build_object(
            'renderer', 'storefront-runtime',
            'approvedRendererKeys', jsonb_build_array(
                'core.header',
                'core.footer',
                'core.hero',
                'core.product-grid',
                'core.product-detail',
                'core.featured-products',
                'core.testimonials',
                'core.about',
                'core.newsletter',
                'core.portfolio-grid',
                'core.skills',
                'core.experience-timeline',
                'core.contact-form',
                'core.cta',
                'core.services-grid',
                'core.rich-content',
                'commerce.category-grid',
                'commerce.brand-marquee',
                'commerce.trust-badges'
            )
        ),
        '1.0.0',
        '1.0.0',
        'LetBuyy',
        '1.0.0',
        TRUE,
        1,
        NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        site_type = EXCLUDED.site_type,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        long_description = EXCLUDED.long_description,
        preview_url = EXCLUDED.preview_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        is_premium = EXCLUDED.is_premium,
        price = EXCLUDED.price,
        letbuyy_pricing_type = EXCLUDED.letbuyy_pricing_type,
        letbuyy_price_usd = EXCLUDED.letbuyy_price_usd,
        letbuyy_price_inr = EXCLUDED.letbuyy_price_inr,
        industry = EXCLUDED.industry,
        supported_site_types = EXCLUDED.supported_site_types,
        supported_platforms = EXCLUDED.supported_platforms,
        tags = EXCLUDED.tags,
        features = EXCLUDED.features,
        config = EXCLUDED.config,
        default_template = EXCLUDED.default_template,
        renderer_manifest = EXCLUDED.renderer_manifest,
        schema_version = EXCLUDED.schema_version,
        renderer_version = EXCLUDED.renderer_version,
        author = EXCLUDED.author,
        version = EXCLUDED.version,
        is_active = TRUE,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    RETURNING id
)
INSERT INTO theme_packages (
    slug,
    name,
    description,
    author_name,
    site_types,
    status,
    pricing_type,
    price,
    currency,
    marketplace_metadata,
    legacy_theme_id,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    'urban-kicks',
    'Urban Kicks',
    'Production-ready streetwear commerce theme for LetBuyy stores.',
    'LetBuyy',
    ARRAY['store'],
    'active',
    'free',
    0,
    'INR',
    jsonb_build_object(
        'category', 'modern',
        'production_lock_migration', '066_lock_urban_kicks_production',
        'preview_url', '/store/urban-kicks-demo',
        'thumbnail_url', '/images/banners/new-arrivals-1.png',
        'supported_sections', jsonb_build_array(
            'header',
            'heroBanner',
            'trustBadges',
            'productGrid',
            'brandMarquee',
            'categoryGrid',
            'newsletter',
            'footer'
        )
    ),
    urban_theme.id,
    NOW(),
    NOW(),
    NULL
FROM urban_theme
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    author_name = EXCLUDED.author_name,
    site_types = EXCLUDED.site_types,
    status = 'active',
    pricing_type = EXCLUDED.pricing_type,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    marketplace_metadata = EXCLUDED.marketplace_metadata,
    legacy_theme_id = EXCLUDED.legacy_theme_id,
    deleted_at = NULL,
    updated_at = NOW();

WITH urban_package AS (
    SELECT id
    FROM theme_packages
    WHERE slug = 'urban-kicks'
    LIMIT 1
)
INSERT INTO theme_package_versions (
    theme_package_id,
    version,
    version_number,
    release_status,
    renderer_version,
    schema_version,
    compatibility_range,
    package_manifest,
    published_at,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    id,
    '1.0.0',
    10000,
    'published',
    '1.0.0',
    '1.0.0',
    '>=1.0.0 <2.0.0',
    jsonb_build_object(
        'themeId', 'urban-kicks',
        'name', 'Urban Kicks',
        'version', '1.0.0',
        'renderer', 'storefront-runtime',
        'entrypoints', jsonb_build_object(
            'home', 'index',
            'product', 'product',
            'collection', 'collection',
            'cart', 'cart',
            'checkout', 'checkout',
            'orderConfirmation', 'order_confirmation'
        ),
        'migration', '066_lock_urban_kicks_production'
    ),
    NOW(),
    NOW(),
    NOW(),
    NULL
FROM urban_package
ON CONFLICT (theme_package_id, version) DO UPDATE SET
    version_number = EXCLUDED.version_number,
    release_status = 'published',
    renderer_version = EXCLUDED.renderer_version,
    schema_version = EXCLUDED.schema_version,
    compatibility_range = EXCLUDED.compatibility_range,
    package_manifest = EXCLUDED.package_manifest,
    published_at = COALESCE(theme_package_versions.published_at, NOW()),
    deleted_at = NULL,
    updated_at = NOW();

UPDATE themes
SET is_active = FALSE,
    updated_at = NOW()
WHERE slug <> 'urban-kicks'
  AND is_active IS DISTINCT FROM FALSE;

UPDATE themes
SET is_active = TRUE,
    updated_at = NOW()
WHERE slug = 'urban-kicks';

UPDATE theme_packages
SET status = 'draft',
    updated_at = NOW()
WHERE slug <> 'urban-kicks'
  AND status <> 'draft'
  AND deleted_at IS NULL;

UPDATE theme_packages
SET status = 'active',
    deleted_at = NULL,
    updated_at = NOW()
WHERE slug = 'urban-kicks';

UPDATE theme_package_versions tpv
SET release_status = 'draft',
    updated_at = NOW()
FROM theme_packages tp
WHERE tpv.theme_package_id = tp.id
  AND tp.slug <> 'urban-kicks'
  AND tpv.release_status <> 'draft'
  AND tpv.deleted_at IS NULL;

UPDATE theme_package_versions tpv
SET release_status = CASE WHEN tpv.version = '1.0.0' THEN 'published' ELSE 'deprecated' END,
    deleted_at = CASE WHEN tpv.version = '1.0.0' THEN NULL ELSE tpv.deleted_at END,
    updated_at = NOW()
FROM theme_packages tp
WHERE tpv.theme_package_id = tp.id
  AND tp.slug = 'urban-kicks';

UPDATE store_themes st
SET is_active = FALSE,
    updated_at = NOW()
FROM themes t
WHERE st.theme_id = t.id
  AND t.slug <> 'urban-kicks'
  AND st.is_active IS DISTINCT FROM FALSE;

INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    idempotency_key
)
VALUES (
    'theme_catalog',
    'urban-kicks',
    'theme.catalog.urban_kicks_locked_production',
    jsonb_build_object(
        'source_migration', '066_lock_urban_kicks_production',
        'active_theme_slug', 'urban-kicks',
        'active_version', '1.0.0'
    ),
    'theme.catalog:066_lock_urban_kicks_production'
)
ON CONFLICT (idempotency_key) DO NOTHING;
