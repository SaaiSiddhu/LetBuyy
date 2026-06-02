-- ============================================================================
-- Migration 067: Re-enable dynamic theme catalog
-- Purpose:
--   Undo the Urban Kicks-only catalog locks from migrations 055, 058, and 066
--   for local/development rollout of portable JSON-contract themes.
--
--   This does not switch any store away from its current live theme. Catalog
--   availability is restored from active theme_packages with published package
--   versions, and a minimal Starter Store JSON-contract theme is seeded so a
--   fresh local database exposes at least two installable storefront themes.
-- ============================================================================

WITH starter_theme AS (
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
        'Starter Store',
        'starter-store',
        'store',
        'general',
        'Minimal portable JSON-contract theme for validating dynamic theme installs.',
        'Starter Store is a compact JSON-contract theme package used to prove that storefront themes are portable data and not hardcoded storefront code.',
        '/store/starter-store-demo',
        '/previews/store.png',
        FALSE,
        0,
        'free',
        0,
        0,
        ARRAY['commerce', 'starter', 'json-contract'],
        ARRAY['store'],
        ARRAY['letbuyy'],
        ARRAY['starter', 'portable', 'json-contract', 'commerce'],
        ARRAY['Portable JSON bundle', 'Schema-driven settings', 'Theme-package install'],
        jsonb_build_object(
            'theme_bundle', TRUE,
            'colors', jsonb_build_object(
                'primary', '#00B3B3',
                'secondary', '#008080',
                'background', '#FFFFFF',
                'text', '#1A1A2E',
                'accent', '#A4E500'
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
            'darkMode', FALSE,
            'settings_schema', jsonb_build_object(
                'schema_version', '2026-05-json-contract',
                'settings', jsonb_build_object(
                    'colors', jsonb_build_object(
                        'label', 'Colors',
                        'description', 'Primary storefront color settings.',
                        'fields', jsonb_build_object(
                            'primaryColor', jsonb_build_object(
                                'type', 'color',
                                'label', 'Primary color',
                                'default', '#00B3B3'
                            )
                        )
                    )
                )
            ),
            'settings_data', jsonb_build_object(
                'current', jsonb_build_object('primaryColor', '#00B3B3'),
                'presets', jsonb_build_object()
            ),
            'section_schemas', jsonb_build_object(
                'hero-banner', jsonb_build_object(
                    'type', 'hero-banner',
                    'name', 'Hero Banner',
                    'description', 'Introductory storefront hero.',
                    'renderer_key', 'heroBanner',
                    'settings_schema', jsonb_build_object(
                        'heading', jsonb_build_object(
                            'type', 'text',
                            'label', 'Heading',
                            'default', 'Starter Store'
                        )
                    ),
                    'blocks_schema', jsonb_build_object()
                )
            ),
            'block_schemas', jsonb_build_object(),
            'template_schema', jsonb_build_object(
                'index', jsonb_build_object(
                    'name', 'Home page',
                    'sections', jsonb_build_object(
                        'hero', jsonb_build_object(
                            'type', 'hero-banner',
                            'settings', jsonb_build_object('heading', 'Starter Store')
                        )
                    ),
                    'order', jsonb_build_array('hero')
                )
            ),
            'default_template', jsonb_build_object(
                'themeId', 'starter-store',
                'schema_version', '2026-05-json-contract',
                'engineVersion', '1.0.0',
                'settings_data', jsonb_build_object(
                    'current', jsonb_build_object('primaryColor', '#00B3B3'),
                    'presets', jsonb_build_object()
                ),
                'themeSettings', jsonb_build_object('primaryColor', '#00B3B3'),
                'sections', jsonb_build_object(
                    'hero-banner', jsonb_build_object(
                        'type', 'hero-banner',
                        'name', 'Hero Banner',
                        'description', 'Introductory storefront hero.',
                        'renderer_key', 'heroBanner',
                        'settings_schema', jsonb_build_object(
                            'heading', jsonb_build_object(
                                'type', 'text',
                                'label', 'Heading',
                                'default', 'Starter Store'
                            )
                        )
                    )
                ),
                'blocks', jsonb_build_object(),
                'templates', jsonb_build_object(
                    'index', jsonb_build_object(
                        'name', 'Home page',
                        'sections', jsonb_build_object(
                            'hero', jsonb_build_object(
                                'type', 'hero-banner',
                                'settings', jsonb_build_object('heading', 'Starter Store')
                            )
                        ),
                        'order', jsonb_build_array('hero')
                    )
                ),
                'locales', jsonb_build_object(
                    'en', jsonb_build_object(
                        'general', jsonb_build_object('cart', 'Cart')
                    )
                ),
                'renderer', jsonb_build_object(
                    'engine', 'json-contract',
                    'renderer_version', '1.0.0',
                    'liquid_ready', FALSE,
                    'assets', jsonb_build_object()
                )
            ),
            'renderer_manifest', jsonb_build_object(
                'engine', 'json-contract',
                'renderer_version', '1.0.0',
                'liquid_ready', FALSE,
                'assets', jsonb_build_object()
            ),
            'locales', jsonb_build_object(
                'en', jsonb_build_object(
                    'general', jsonb_build_object('cart', 'Cart')
                )
            )
        ),
        jsonb_build_object(
            'themeId', 'starter-store',
            'schema_version', '2026-05-json-contract',
            'engineVersion', '1.0.0',
            'settings_data', jsonb_build_object(
                'current', jsonb_build_object('primaryColor', '#00B3B3'),
                'presets', jsonb_build_object()
            ),
            'themeSettings', jsonb_build_object('primaryColor', '#00B3B3'),
            'sections', jsonb_build_object(
                'hero-banner', jsonb_build_object(
                    'type', 'hero-banner',
                    'name', 'Hero Banner',
                    'description', 'Introductory storefront hero.',
                    'renderer_key', 'heroBanner',
                    'settings_schema', jsonb_build_object(
                        'heading', jsonb_build_object(
                            'type', 'text',
                            'label', 'Heading',
                            'default', 'Starter Store'
                        )
                    )
                )
            ),
            'blocks', jsonb_build_object(),
            'templates', jsonb_build_object(
                'index', jsonb_build_object(
                    'name', 'Home page',
                    'sections', jsonb_build_object(
                        'hero', jsonb_build_object(
                            'type', 'hero-banner',
                            'settings', jsonb_build_object('heading', 'Starter Store')
                        )
                    ),
                    'order', jsonb_build_array('hero')
                )
            ),
            'locales', jsonb_build_object(
                'en', jsonb_build_object(
                    'general', jsonb_build_object('cart', 'Cart')
                )
            ),
            'renderer', jsonb_build_object(
                'engine', 'json-contract',
                'renderer_version', '1.0.0',
                'liquid_ready', FALSE,
                'assets', jsonb_build_object()
            )
        ),
        jsonb_build_object(
            'hero-banner', jsonb_build_object(
                'type', 'hero-banner',
                'name', 'Hero Banner',
                'description', 'Introductory storefront hero.',
                'renderer_key', 'heroBanner',
                'settings_schema', jsonb_build_object(
                    'heading', jsonb_build_object(
                        'type', 'text',
                        'label', 'Heading',
                        'default', 'Starter Store'
                    )
                ),
                'blocks_schema', jsonb_build_object()
            )
        ),
        '{}'::jsonb,
        jsonb_build_object(
            'schema_version', '2026-05-json-contract',
            'settings', jsonb_build_object(
                'colors', jsonb_build_object(
                    'label', 'Colors',
                    'description', 'Primary storefront color settings.',
                    'fields', jsonb_build_object(
                        'primaryColor', jsonb_build_object(
                            'type', 'color',
                            'label', 'Primary color',
                            'default', '#00B3B3'
                        )
                    )
                )
            )
        ),
        jsonb_build_object(
            'engine', 'json-contract',
            'renderer_version', '1.0.0',
            'liquid_ready', FALSE,
            'assets', jsonb_build_object()
        ),
        '2026-05-json-contract',
        '1.0.0',
        'LetBuyy',
        '1.0.0',
        TRUE,
        2,
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
        section_schemas = EXCLUDED.section_schemas,
        block_schemas = EXCLUDED.block_schemas,
        settings_schema = EXCLUDED.settings_schema,
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
    'starter-store',
    'Starter Store',
    'Minimal portable JSON-contract theme for validating dynamic theme installs.',
    'LetBuyy',
    ARRAY['store'],
    'active',
    'free',
    0,
    'INR',
    jsonb_build_object(
        'category', 'general',
        'source_migration', '067_reenable_dynamic_theme_catalog',
        'preview_url', '/store/starter-store-demo',
        'thumbnail_url', '/previews/store.png'
    ),
    starter_theme.id,
    NOW(),
    NOW(),
    NULL
FROM starter_theme
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

WITH starter_package AS (
    SELECT id
    FROM theme_packages
    WHERE slug = 'starter-store'
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
    '2026-05-json-contract',
    '>=2026-05-json-contract',
    jsonb_build_object(
        'themeId', 'starter-store',
        'name', 'Starter Store',
        'version', '1.0.0',
        'renderer', 'json-contract',
        'migration', '067_reenable_dynamic_theme_catalog'
    ),
    NOW(),
    NOW(),
    NOW(),
    NULL
FROM starter_package
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

WITH starter_version AS (
    SELECT tpv.id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'starter-store'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_schema_manifests (
    theme_package_version_id,
    manifest_version,
    schema_manifest,
    section_schemas,
    block_schemas,
    settings_schema,
    template_schema,
    layout_schema,
    validation_rules,
    created_at,
    updated_at
)
SELECT
    id,
    '2026-05-json-contract',
    jsonb_build_object(
        'themeId', 'starter-store',
        'schemaVersion', '2026-05-json-contract',
        'source_migration', '067_reenable_dynamic_theme_catalog'
    ),
    jsonb_build_object(
        'hero-banner', jsonb_build_object(
            'type', 'hero-banner',
            'name', 'Hero Banner',
            'description', 'Introductory storefront hero.',
            'renderer_key', 'heroBanner',
            'settings_schema', jsonb_build_object(
                'heading', jsonb_build_object(
                    'type', 'text',
                    'label', 'Heading',
                    'default', 'Starter Store'
                )
            ),
            'blocks_schema', jsonb_build_object()
        )
    ),
    '{}'::jsonb,
    jsonb_build_object(
        'schema_version', '2026-05-json-contract',
        'settings', jsonb_build_object(
            'colors', jsonb_build_object(
                'label', 'Colors',
                'description', 'Primary storefront color settings.',
                'fields', jsonb_build_object(
                    'primaryColor', jsonb_build_object(
                        'type', 'color',
                        'label', 'Primary color',
                        'default', '#00B3B3'
                    )
                )
            )
        )
    ),
    jsonb_build_object(
        'index', jsonb_build_object(
            'name', 'Home page',
            'sections', jsonb_build_object(
                'hero', jsonb_build_object(
                    'type', 'hero-banner',
                    'settings', jsonb_build_object('heading', 'Starter Store')
                )
            ),
            'order', jsonb_build_array('hero')
        )
    ),
    jsonb_build_object('theme', jsonb_build_object('type', 'theme')),
    '{}'::jsonb,
    NOW(),
    NOW()
FROM starter_version
ON CONFLICT (theme_package_version_id) DO UPDATE SET
    manifest_version = EXCLUDED.manifest_version,
    schema_manifest = EXCLUDED.schema_manifest,
    section_schemas = EXCLUDED.section_schemas,
    block_schemas = EXCLUDED.block_schemas,
    settings_schema = EXCLUDED.settings_schema,
    template_schema = EXCLUDED.template_schema,
    layout_schema = EXCLUDED.layout_schema,
    validation_rules = EXCLUDED.validation_rules,
    updated_at = NOW();

WITH starter_version AS (
    SELECT tpv.id
    FROM theme_packages tp
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'starter-store'
      AND tpv.version = '1.0.0'
    LIMIT 1
)
INSERT INTO theme_renderer_manifests (
    theme_package_version_id,
    renderer_manifest,
    approved_renderer_keys,
    asset_manifest,
    performance_budget,
    created_at,
    updated_at
)
SELECT
    id,
    jsonb_build_object(
        'engine', 'json-contract',
        'renderer_version', '1.0.0',
        'liquid_ready', FALSE,
        'assets', jsonb_build_object()
    ),
    ARRAY['heroBanner'],
    jsonb_build_object(
        'preview_url', '/store/starter-store-demo',
        'thumbnail_url', '/previews/store.png'
    ),
    '{}'::jsonb,
    NOW(),
    NOW()
FROM starter_version
ON CONFLICT (theme_package_version_id) DO UPDATE SET
    renderer_manifest = EXCLUDED.renderer_manifest,
    approved_renderer_keys = EXCLUDED.approved_renderer_keys,
    asset_manifest = EXCLUDED.asset_manifest,
    performance_budget = EXCLUDED.performance_budget,
    updated_at = NOW();

WITH packages_with_versions AS (
    SELECT DISTINCT
        tp.id,
        tp.slug
    FROM theme_packages tp
    JOIN theme_package_versions tpv
      ON tpv.theme_package_id = tp.id
    WHERE tp.deleted_at IS NULL
      AND tp.status <> 'archived'
      AND tpv.deleted_at IS NULL
      AND tpv.release_status <> 'revoked'
)
UPDATE theme_packages tp
SET status = 'active',
    updated_at = NOW()
FROM packages_with_versions pwv
WHERE tp.id = pwv.id
  AND tp.status IN ('draft', 'disabled');

WITH latest_package_versions AS (
    SELECT DISTINCT ON (tpv.theme_package_id)
        tpv.id,
        tpv.theme_package_id
    FROM theme_package_versions tpv
    JOIN theme_packages tp
      ON tp.id = tpv.theme_package_id
    WHERE tp.deleted_at IS NULL
      AND tp.status = 'active'
      AND tpv.deleted_at IS NULL
      AND tpv.release_status <> 'revoked'
    ORDER BY tpv.theme_package_id, tpv.version_number DESC, tpv.created_at DESC
)
UPDATE theme_package_versions tpv
SET release_status = 'published',
    published_at = COALESCE(tpv.published_at, NOW()),
    updated_at = NOW()
FROM latest_package_versions latest
WHERE tpv.id = latest.id
  AND tpv.release_status IN ('draft', 'deprecated');

WITH active_theme_packages AS (
    SELECT DISTINCT
        tp.slug,
        tp.site_types
    FROM theme_packages tp
    JOIN theme_package_versions tpv
      ON tpv.theme_package_id = tp.id
    WHERE tp.status = 'active'
      AND tp.deleted_at IS NULL
      AND tpv.release_status = 'published'
      AND tpv.deleted_at IS NULL
)
UPDATE themes t
SET is_active = TRUE,
    supported_site_types = CASE
        WHEN COALESCE(array_length(t.supported_site_types, 1), 0) > 0 THEN t.supported_site_types
        WHEN COALESCE(array_length(atp.site_types, 1), 0) > 0 THEN atp.site_types
        ELSE ARRAY[COALESCE(NULLIF(t.site_type, ''), 'store')]
    END,
    preview_url = CASE
        WHEN t.preview_url LIKE '/theme-preview/%' THEN NULL
        ELSE t.preview_url
    END,
    demo_url = CASE
        WHEN t.demo_url LIKE '/theme-preview/%' THEN NULL
        ELSE t.demo_url
    END,
    updated_at = NOW()
FROM active_theme_packages atp
WHERE t.slug = atp.slug;

UPDATE themes
SET preview_url = NULL,
    demo_url = NULL,
    updated_at = NOW()
WHERE preview_url LIKE '/theme-preview/%'
   OR demo_url LIKE '/theme-preview/%';

INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    idempotency_key
)
VALUES (
    'theme_catalog',
    'global',
    'theme.catalog.dynamic_availability_reenabled',
    jsonb_build_object(
        'source_migration', '067_reenable_dynamic_theme_catalog',
        'availability_source', 'theme_packages + theme_package_versions',
        'seeded_theme_slug', 'starter-store'
    ),
    'theme.catalog:067_reenable_dynamic_theme_catalog'
)
ON CONFLICT (idempotency_key) DO NOTHING;

DO $$
DECLARE
    active_catalog_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT t.slug)
    INTO active_catalog_count
    FROM themes t
    JOIN theme_packages tp ON tp.slug = t.slug
    JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
    WHERE t.is_active = TRUE
      AND tp.status = 'active'
      AND tp.deleted_at IS NULL
      AND tpv.release_status = 'published'
      AND tpv.deleted_at IS NULL;

    IF active_catalog_count < 2 THEN
        RAISE EXCEPTION 'Dynamic theme catalog re-enable expected at least 2 active themes, found %', active_catalog_count;
    END IF;
END $$;
