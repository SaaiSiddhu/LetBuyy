-- ============================================================================
-- Only Urban Kicks storefront theme catalog
-- Migration: 055_only_urban_kicks_theme_catalog.sql
-- Purpose:
--   Keep the theme catalog aligned with the only production-ready storefront
--   template. Unsupported seeded theme rows are retained for historical FK
--   safety but are disabled, uninstalled, and no longer selected by stores.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM themes
        WHERE slug = 'urban-kicks'
    ) THEN
        RAISE EXCEPTION 'Cannot normalize theme catalog: required urban-kicks theme row is missing';
    END IF;
END $$;

UPDATE themes
SET is_active = false,
    updated_at = NOW()
WHERE slug <> 'urban-kicks'
  AND is_active IS DISTINCT FROM false;

UPDATE themes
SET is_active = true,
    site_type = 'store',
    supported_site_types = ARRAY['store'],
    supported_platforms = ARRAY['letbuyy'],
    letbuyy_pricing_type = 'free',
    letbuyy_price_usd = 0,
    letbuyy_price_inr = 0,
    is_premium = false,
    updated_at = NOW()
WHERE slug = 'urban-kicks';

UPDATE theme_packages
SET status = 'disabled',
    updated_at = NOW()
WHERE slug <> 'urban-kicks'
  AND status <> 'disabled';

UPDATE theme_package_versions tpv
SET release_status = 'deprecated',
    updated_at = NOW()
FROM theme_packages tp
WHERE tpv.theme_package_id = tp.id
  AND tp.slug <> 'urban-kicks'
  AND tpv.release_status = 'published';

UPDATE theme_packages
SET status = 'active',
    site_types = ARRAY['store'],
    pricing_type = 'free',
    price = 0,
    currency = 'INR',
    deleted_at = NULL,
    updated_at = NOW()
WHERE slug = 'urban-kicks';

UPDATE theme_package_versions tpv
SET release_status = 'published',
    deleted_at = NULL,
    updated_at = NOW()
FROM theme_packages tp
WHERE tpv.theme_package_id = tp.id
  AND tp.slug = 'urban-kicks'
  AND (tpv.release_status <> 'published' OR tpv.deleted_at IS NOT NULL);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM theme_packages tp
        JOIN theme_package_versions tpv
          ON tpv.theme_package_id = tp.id
        WHERE tp.slug = 'urban-kicks'
          AND tp.status = 'active'
          AND tp.deleted_at IS NULL
          AND tpv.release_status = 'published'
          AND tpv.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot normalize theme engine: required urban-kicks package runtime is missing';
    END IF;
END $$;

UPDATE sites
SET theme_id = 'urban-kicks',
    updated_at = NOW()
WHERE COALESCE(theme_id, '') <> 'urban-kicks';

UPDATE store_themes st
SET is_active = false,
    updated_at = NOW()
FROM themes t
WHERE st.theme_id = t.id
  AND t.slug <> 'urban-kicks'
  AND st.is_active IS DISTINCT FROM false;

UPDATE theme_instances ti
SET instance_status = 'inactive',
    activated_at = NULL,
    updated_at = NOW()
FROM theme_packages tp
WHERE ti.theme_package_id = tp.id
  AND tp.slug <> 'urban-kicks'
  AND ti.deleted_at IS NULL
  AND ti.instance_status <> 'inactive';

WITH urban_theme AS (
    SELECT id
    FROM themes
    WHERE slug = 'urban-kicks'
    LIMIT 1
)
INSERT INTO store_themes (
    store_id,
    theme_id,
    is_active,
    config_overrides,
    installed_at,
    updated_at
)
SELECT
    s.id,
    ut.id,
    true,
    '{}'::jsonb,
    NOW(),
    NOW()
FROM sites s
CROSS JOIN urban_theme ut
ON CONFLICT (store_id, theme_id) DO UPDATE
SET is_active = true,
    updated_at = NOW();

WITH urban_runtime AS (
    SELECT
        tp.id AS theme_package_id,
        tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv
      ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tp.status = 'active'
      AND tp.deleted_at IS NULL
      AND tpv.release_status = 'published'
      AND tpv.deleted_at IS NULL
    ORDER BY tpv.version_number DESC, tpv.created_at DESC
    LIMIT 1
)
INSERT INTO theme_instances (
    store_id,
    theme_package_id,
    theme_package_version_id,
    theme_slug,
    instance_status,
    settings,
    installed_config,
    activated_at,
    created_at,
    updated_at
)
SELECT
    s.id,
    ur.theme_package_id,
    ur.theme_package_version_id,
    'urban-kicks',
    'active',
    COALESCE(s.theme_settings, '{}'::jsonb),
    jsonb_build_object(
        'source', 'migration_055_only_urban_kicks',
        'template_config', COALESCE(s.template_config, '{}'::jsonb),
        'sections', COALESCE(s.sections, '[]'::jsonb)
    ),
    NOW(),
    NOW(),
    NOW()
FROM sites s
CROSS JOIN urban_runtime ur
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM theme_instances ti
      WHERE ti.store_id = s.id
        AND ti.theme_package_id = ur.theme_package_id
        AND ti.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;

WITH urban_runtime AS (
    SELECT
        tp.id AS theme_package_id,
        tpv.id AS theme_package_version_id
    FROM theme_packages tp
    JOIN theme_package_versions tpv
      ON tpv.theme_package_id = tp.id
    WHERE tp.slug = 'urban-kicks'
      AND tp.status = 'active'
      AND tp.deleted_at IS NULL
      AND tpv.release_status = 'published'
      AND tpv.deleted_at IS NULL
    ORDER BY tpv.version_number DESC, tpv.created_at DESC
    LIMIT 1
)
UPDATE theme_instances ti
SET theme_package_version_id = ur.theme_package_version_id,
    theme_slug = 'urban-kicks',
    instance_status = 'active',
    activated_at = COALESCE(ti.activated_at, NOW()),
    updated_at = NOW()
FROM urban_runtime ur
WHERE ti.theme_package_id = ur.theme_package_id
  AND ti.deleted_at IS NULL;
