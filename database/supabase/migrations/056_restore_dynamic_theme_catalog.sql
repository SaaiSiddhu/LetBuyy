-- ============================================================================
-- Migration 056: Restore Dynamic Theme Catalog
-- Reverses the single-theme catalog lockdown from migration 055 for future
-- installs while preserving whatever theme each store currently has live.
-- Theme availability is derived from database package/version records, not from
-- hardcoded storefront code.
-- ============================================================================

WITH packages_with_versions AS (
    SELECT DISTINCT
        tp.id,
        tp.slug
    FROM theme_packages tp
    JOIN theme_package_versions tpv
      ON tpv.theme_package_id = tp.id
    WHERE tp.deleted_at IS NULL
      AND tpv.deleted_at IS NULL
      AND tp.status <> 'archived'
      AND tpv.release_status <> 'revoked'
)
UPDATE theme_packages tp
SET status = 'active',
    updated_at = NOW()
FROM packages_with_versions pwv
WHERE tp.id = pwv.id
  AND tp.status = 'disabled';

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
  AND tpv.release_status <> 'published';

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
WHERE t.slug = atp.slug
  AND t.is_active IS DISTINCT FROM TRUE;

UPDATE themes
SET preview_url = NULL,
    demo_url = NULL,
    updated_at = NOW()
WHERE (preview_url LIKE '/theme-preview/%' OR demo_url LIKE '/theme-preview/%');

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
    'theme.catalog.restored_dynamic_availability',
    jsonb_build_object(
        'source_migration', '056_restore_dynamic_theme_catalog',
        'availability_source', 'theme_packages + theme_package_versions'
    ),
    'theme.catalog:056_restore_dynamic_theme_catalog'
)
ON CONFLICT (idempotency_key) DO NOTHING;
