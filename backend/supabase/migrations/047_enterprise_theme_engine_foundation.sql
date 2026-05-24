-- ============================================================================
-- Migration 047: Enterprise Theme Engine Foundation
-- Additive package, instance, release-manifest, CMS, navigation, and media spine.
-- Existing stores continue rendering through legacy tables while release-driven
-- theme instances are backfilled and adopted incrementally.
-- ============================================================================

ALTER TABLE themes
    ADD COLUMN IF NOT EXISTS default_template JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS section_schemas JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS block_schemas JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS settings_schema JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS renderer_manifest JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS schema_version TEXT NOT NULL DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS renderer_version TEXT NOT NULL DEFAULT '1.0.0';

CREATE TABLE IF NOT EXISTS theme_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    author_name TEXT NOT NULL DEFAULT 'LetBuyy',
    site_types TEXT[] NOT NULL DEFAULT ARRAY['store'],
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'disabled', 'archived')),
    pricing_type TEXT NOT NULL DEFAULT 'free'
        CHECK (pricing_type IN ('free', 'paid', 'subscription')),
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    marketplace_metadata JSONB NOT NULL DEFAULT '{}',
    legacy_theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_theme_packages_status
    ON theme_packages(status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_packages_site_types
    ON theme_packages USING GIN(site_types);

CREATE TABLE IF NOT EXISTS theme_package_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_id UUID NOT NULL REFERENCES theme_packages(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    release_status TEXT NOT NULL DEFAULT 'published'
        CHECK (release_status IN ('draft', 'published', 'deprecated', 'revoked')),
    renderer_version TEXT NOT NULL DEFAULT '1.0.0',
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    compatibility_range TEXT,
    package_manifest JSONB NOT NULL DEFAULT '{}',
    checksum TEXT,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_id, version)
);

CREATE INDEX IF NOT EXISTS idx_theme_package_versions_package
    ON theme_package_versions(theme_package_id, version_number DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_package_versions_status
    ON theme_package_versions(release_status, published_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS theme_renderer_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL UNIQUE REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    renderer_manifest JSONB NOT NULL DEFAULT '{}',
    approved_renderer_keys TEXT[] NOT NULL DEFAULT '{}',
    asset_manifest JSONB NOT NULL DEFAULT '{}',
    performance_budget JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theme_schema_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL UNIQUE REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    manifest_version TEXT NOT NULL DEFAULT '1.0.0',
    schema_manifest JSONB NOT NULL DEFAULT '{}',
    section_schemas JSONB NOT NULL DEFAULT '{}',
    block_schemas JSONB NOT NULL DEFAULT '{}',
    settings_schema JSONB NOT NULL DEFAULT '{}',
    template_schema JSONB NOT NULL DEFAULT '{}',
    layout_schema JSONB NOT NULL DEFAULT '{}',
    validation_rules JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theme_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    preset_key TEXT NOT NULL,
    name TEXT NOT NULL,
    preset_config JSONB NOT NULL DEFAULT '{}',
    preview_media JSONB NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_version_id, preset_key)
);

CREATE TABLE IF NOT EXISTS theme_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    asset_key TEXT NOT NULL,
    asset_type TEXT NOT NULL
        CHECK (asset_type IN ('stylesheet', 'script', 'font', 'image', 'media', 'json', 'other')),
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_path TEXT NOT NULL,
    public_url TEXT,
    content_type TEXT,
    checksum TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_version_id, asset_key)
);

CREATE INDEX IF NOT EXISTS idx_theme_assets_package_type
    ON theme_assets(theme_package_version_id, asset_type)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS theme_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_id UUID NOT NULL REFERENCES theme_packages(id) ON DELETE CASCADE,
    from_theme_package_version_id UUID REFERENCES theme_package_versions(id) ON DELETE SET NULL,
    to_theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    migration_key TEXT NOT NULL,
    migration_manifest JSONB NOT NULL DEFAULT '{}',
    rollback_manifest JSONB NOT NULL DEFAULT '{}',
    is_reversible BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(theme_package_id, migration_key)
);

CREATE TABLE IF NOT EXISTS theme_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_package_id UUID NOT NULL REFERENCES theme_packages(id) ON DELETE RESTRICT,
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE RESTRICT,
    active_release_id UUID REFERENCES theme_releases(id) ON DELETE SET NULL,
    theme_slug TEXT NOT NULL,
    instance_status TEXT NOT NULL DEFAULT 'installed'
        CHECK (instance_status IN ('installed', 'active', 'inactive', 'upgrading', 'archived')),
    settings JSONB NOT NULL DEFAULT '{}',
    installed_config JSONB NOT NULL DEFAULT '{}',
    current_draft_id UUID,
    activated_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, theme_package_id, deleted_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_instances_one_active
    ON theme_instances(store_id)
    WHERE instance_status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_instances_store_status
    ON theme_instances(store_id, instance_status)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_instances_store_package_live
    ON theme_instances(store_id, theme_package_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS theme_instance_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_instance_id UUID NOT NULL REFERENCES theme_instances(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    base_release_id UUID REFERENCES theme_releases(id) ON DELETE SET NULL,
    draft_status TEXT NOT NULL DEFAULT 'active'
        CHECK (draft_status IN ('active', 'archived', 'published', 'discarded')),
    draft_version INTEGER NOT NULL DEFAULT 1,
    working_manifest JSONB NOT NULL DEFAULT '{}',
    schema_manifest_version TEXT NOT NULL DEFAULT '1.0.0',
    locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    auto_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_instance_drafts_one_active
    ON theme_instance_drafts(theme_instance_id)
    WHERE draft_status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_instance_drafts_store
    ON theme_instance_drafts(store_id, updated_at DESC)
    WHERE deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'theme_instances_current_draft_fk'
    ) THEN
        ALTER TABLE theme_instances
            ADD CONSTRAINT theme_instances_current_draft_fk
            FOREIGN KEY (current_draft_id) REFERENCES theme_instance_drafts(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS theme_draft_patches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES theme_instance_drafts(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    patch_sequence INTEGER NOT NULL,
    patch_type TEXT NOT NULL
        CHECK (patch_type IN ('set', 'unset', 'insert', 'move', 'duplicate', 'delete', 'visibility', 'schema_migration')),
    operation JSONB NOT NULL DEFAULT '{}',
    path TEXT NOT NULL,
    value JSONB,
    previous_value JSONB,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id TEXT,
    client_revision INTEGER,
    server_revision INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(draft_id, patch_sequence)
);

CREATE INDEX IF NOT EXISTS idx_theme_draft_patches_draft_sequence
    ON theme_draft_patches(draft_id, patch_sequence);

CREATE INDEX IF NOT EXISTS idx_theme_draft_patches_store_created
    ON theme_draft_patches(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS theme_template_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_instance_id UUID NOT NULL REFERENCES theme_instances(id) ON DELETE CASCADE,
    route_type TEXT NOT NULL,
    route_key TEXT NOT NULL,
    template_key TEXT NOT NULL,
    resource_id TEXT,
    market TEXT NOT NULL DEFAULT 'default',
    locale TEXT NOT NULL DEFAULT 'default',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_release_id UUID REFERENCES theme_releases(id) ON DELETE SET NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, route_type, route_key, market, locale, is_active)
);

CREATE INDEX IF NOT EXISTS idx_theme_template_assignments_store_route
    ON theme_template_assignments(store_id, route_type, route_key, priority)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS theme_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    layout_key TEXT NOT NULL,
    name TEXT NOT NULL,
    layout_schema JSONB NOT NULL DEFAULT '{}',
    section_group_keys TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_version_id, layout_key)
);

CREATE TABLE IF NOT EXISTS theme_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    template_key TEXT NOT NULL,
    template_type TEXT NOT NULL,
    layout_key TEXT NOT NULL DEFAULT 'theme',
    template_schema JSONB NOT NULL DEFAULT '{}',
    default_sections JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_version_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_theme_templates_type
    ON theme_templates(theme_package_version_id, template_type)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS theme_section_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    renderer_key TEXT NOT NULL,
    section_schema JSONB NOT NULL DEFAULT '{}',
    block_schema JSONB NOT NULL DEFAULT '{}',
    presets JSONB NOT NULL DEFAULT '[]',
    availability_rules JSONB NOT NULL DEFAULT '{}',
    data_requirements JSONB NOT NULL DEFAULT '{}',
    performance_budget JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'deprecated', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_version_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_theme_section_definitions_renderer
    ON theme_section_definitions(renderer_key)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS theme_block_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_package_version_id UUID NOT NULL REFERENCES theme_package_versions(id) ON DELETE CASCADE,
    block_key TEXT NOT NULL,
    renderer_key TEXT NOT NULL,
    block_schema JSONB NOT NULL DEFAULT '{}',
    availability_rules JSONB NOT NULL DEFAULT '{}',
    data_requirements JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'deprecated', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(theme_package_version_id, block_key)
);

CREATE TABLE IF NOT EXISTS storefront_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    page_type TEXT NOT NULL DEFAULT 'page',
    seo JSONB NOT NULL DEFAULT '{}',
    content JSONB NOT NULL DEFAULT '{}',
    assigned_template_key TEXT,
    published_revision_id UUID,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_storefront_pages_store_status
    ON storefront_pages(store_id, status, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS storefront_page_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES storefront_pages(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    seo JSONB NOT NULL DEFAULT '{}',
    content JSONB NOT NULL DEFAULT '{}',
    template_key TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(page_id, revision_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'storefront_pages_published_revision_fk'
    ) THEN
        ALTER TABLE storefront_pages
            ADD CONSTRAINT storefront_pages_published_revision_fk
            FOREIGN KEY (published_revision_id) REFERENCES storefront_page_revisions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS storefront_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    policy_type TEXT NOT NULL
        CHECK (policy_type IN ('privacy', 'refund', 'shipping', 'terms', 'contact', 'custom')),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    body JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    seo JSONB NOT NULL DEFAULT '{}',
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, policy_type)
);

CREATE TABLE IF NOT EXISTS navigation_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'main',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'draft', 'archived')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_navigation_menus_store_location
    ON navigation_menus(store_id, location)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS navigation_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES navigation_menus(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    parent_item_id UUID REFERENCES navigation_menu_items(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT,
    target_type TEXT NOT NULL DEFAULT 'url',
    target_resource_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    open_in_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_navigation_menu_items_menu_order
    ON navigation_menu_items(menu_id, parent_item_id, sort_order)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL
        CHECK (asset_type IN ('image', 'video', 'file', 'font', 'icon')),
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_path TEXT NOT NULL,
    public_url TEXT,
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes BIGINT,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_media_assets_store_type
    ON media_assets(store_id, asset_type, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS storefront_slug_redirects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    from_path TEXT NOT NULL,
    to_path TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 301
        CHECK (status_code IN (301, 302, 307, 308)),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, from_path)
);

ALTER TABLE theme_releases
    ADD COLUMN IF NOT EXISTS theme_instance_id UUID REFERENCES theme_instances(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS theme_package_version_id UUID REFERENCES theme_package_versions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS release_manifest JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS template_snapshot JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS settings_snapshot JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS asset_manifest JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS cache_manifest JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS data_binding_manifest JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS schema_manifest_version TEXT NOT NULL DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'theme-engine-v1';

CREATE OR REPLACE FUNCTION publish_theme_release(
    p_store_id UUID,
    p_theme_id TEXT,
    p_release_config JSONB,
    p_source_draft_id UUID DEFAULT NULL,
    p_source_draft_version INTEGER DEFAULT NULL,
    p_published_by UUID DEFAULT NULL,
    p_publish_message TEXT DEFAULT NULL,
    p_make_store_live BOOLEAN DEFAULT TRUE,
    p_request_id TEXT DEFAULT NULL,
    p_rollback_of_release_id UUID DEFAULT NULL
)
RETURNS TABLE (
    release_id UUID,
    release_version INTEGER,
    published_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_version INTEGER;
    v_release_id UUID := gen_random_uuid();
    v_published_at TIMESTAMPTZ := NOW();
    v_theme_instance_id UUID;
    v_theme_package_version_id UUID;
    v_schema_manifest_version TEXT := '1.0.0';
    v_cache_manifest JSONB;
    v_release_manifest JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_theme_id IS NULL OR LENGTH(TRIM(p_theme_id)) = 0 THEN
        RAISE EXCEPTION 'theme_id is required';
    END IF;

    SELECT
        ti.id,
        ti.theme_package_version_id,
        COALESCE(tpv.schema_version, '1.0.0')
      INTO v_theme_instance_id, v_theme_package_version_id, v_schema_manifest_version
      FROM theme_instances ti
      LEFT JOIN theme_package_versions tpv ON tpv.id = ti.theme_package_version_id
     WHERE ti.store_id = p_store_id
       AND ti.theme_slug = p_theme_id
       AND ti.deleted_at IS NULL
     ORDER BY
       CASE WHEN ti.instance_status = 'active' THEN 0 ELSE 1 END,
       ti.updated_at DESC
     LIMIT 1;

    SELECT COALESCE(MAX(tr.release_version), 0) + 1
      INTO v_next_version
      FROM theme_releases tr
     WHERE tr.store_id = p_store_id
       AND tr.deleted_at IS NULL;

    v_cache_manifest := jsonb_build_object(
        'tags',
        jsonb_build_array(
            'store:' || p_store_id::TEXT,
            'theme:' || p_theme_id,
            'theme_release:' || v_release_id::TEXT
        )
    );

    v_release_manifest := jsonb_build_object(
        'engine',
        'theme-engine-v1',
        'store_id',
        p_store_id,
        'theme_id',
        p_theme_id,
        'release_id',
        v_release_id,
        'release_version',
        v_next_version,
        'theme_instance_id',
        v_theme_instance_id,
        'theme_package_version_id',
        v_theme_package_version_id,
        'schema_manifest_version',
        v_schema_manifest_version
    );

    UPDATE theme_releases
       SET is_current = FALSE,
           release_status = 'superseded',
           updated_at = NOW()
     WHERE store_id = p_store_id
       AND is_current = TRUE
       AND deleted_at IS NULL;

    INSERT INTO theme_releases (
        id,
        store_id,
        theme_id,
        theme_instance_id,
        theme_package_version_id,
        release_version,
        release_status,
        is_current,
        release_config,
        release_manifest,
        template_snapshot,
        settings_snapshot,
        asset_manifest,
        cache_manifest,
        data_binding_manifest,
        schema_manifest_version,
        engine_version,
        source_draft_id,
        source_draft_version,
        publish_message,
        published_by,
        rollback_of_release_id,
        metadata,
        published_at
    )
    VALUES (
        v_release_id,
        p_store_id,
        p_theme_id,
        v_theme_instance_id,
        v_theme_package_version_id,
        v_next_version,
        'published',
        TRUE,
        COALESCE(p_release_config, '{}'::JSONB),
        v_release_manifest,
        COALESCE(p_release_config, '{}'::JSONB),
        COALESCE(p_release_config->'themeSettings', '{}'::JSONB),
        '{}'::JSONB,
        v_cache_manifest,
        '{}'::JSONB,
        v_schema_manifest_version,
        'theme-engine-v1',
        p_source_draft_id,
        p_source_draft_version,
        p_publish_message,
        p_published_by,
        p_rollback_of_release_id,
        jsonb_build_object(
            'request_id', p_request_id,
            'source', CASE WHEN p_rollback_of_release_id IS NULL THEN 'publish' ELSE 'rollback' END
        ),
        v_published_at
    );

    UPDATE sites
       SET theme_id = p_theme_id,
           template_config = COALESCE(p_release_config, '{}'::JSONB),
           current_theme_release_id = v_release_id,
           storefront_release_version = v_next_version,
           status = CASE WHEN p_make_store_live THEN 'published' ELSE status END,
           published_at = CASE WHEN p_make_store_live THEN v_published_at ELSE published_at END,
           updated_at = NOW()
     WHERE id = p_store_id;

    IF v_theme_instance_id IS NOT NULL THEN
        UPDATE theme_instances
           SET active_release_id = v_release_id,
               current_draft_id = NULL,
               instance_status = CASE WHEN p_make_store_live THEN 'active' ELSE instance_status END,
               activated_at = CASE WHEN p_make_store_live THEN v_published_at ELSE activated_at END,
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE id = v_theme_instance_id;

        UPDATE theme_instance_drafts
           SET draft_status = 'published',
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE theme_instance_id = v_theme_instance_id
           AND draft_status = 'active'
           AND deleted_at IS NULL;
    END IF;

    INSERT INTO storefront_cache_tags (
        store_id,
        tag,
        resource_type,
        resource_id,
        release_id,
        invalidated_at
    )
    VALUES
        (p_store_id, 'store:' || p_store_id::TEXT, 'store', p_store_id::TEXT, v_release_id, NOW()),
        (p_store_id, 'theme:' || p_theme_id, 'theme', p_theme_id, v_release_id, NOW()),
        (p_store_id, 'theme_release:' || v_release_id::TEXT, 'theme_release', v_release_id::TEXT, v_release_id, NOW())
    ON CONFLICT (store_id, tag)
    DO UPDATE SET
        resource_type = EXCLUDED.resource_type,
        resource_id = EXCLUDED.resource_id,
        release_id = EXCLUDED.release_id,
        invalidated_at = NOW(),
        updated_at = NOW();

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        p_store_id,
        'theme_release',
        v_release_id::TEXT,
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.release.published' ELSE 'theme.release.rollback_published' END,
        jsonb_build_object(
            'store_id', p_store_id,
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version,
            'cache_tags', v_cache_manifest->'tags'
        ),
        'theme.release:' || p_store_id::TEXT || ':' || v_next_version::TEXT,
        p_request_id,
        p_published_by
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state,
        metadata
    )
    VALUES (
        p_store_id,
        p_published_by,
        'user',
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.publish' ELSE 'theme.rollback' END,
        'theme_release',
        v_release_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version
        ),
        jsonb_build_object(
            'publish_message', p_publish_message,
            'rollback_of_release_id', p_rollback_of_release_id
        )
    );

    release_id := v_release_id;
    release_version := v_next_version;
    published_at := v_published_at;
    RETURN NEXT;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_theme_releases_instance_version
    ON theme_releases(theme_instance_id, release_version DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_releases_package_version
    ON theme_releases(theme_package_version_id, published_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE theme_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_package_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_renderer_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_schema_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_instance_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_draft_patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_template_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_section_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_block_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_slug_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS theme_packages_public_read ON theme_packages;
CREATE POLICY theme_packages_public_read
    ON theme_packages FOR SELECT
    USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS theme_package_versions_public_read ON theme_package_versions;
CREATE POLICY theme_package_versions_public_read
    ON theme_package_versions FOR SELECT
    USING (release_status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS theme_renderer_manifests_public_read ON theme_renderer_manifests;
CREATE POLICY theme_renderer_manifests_public_read
    ON theme_renderer_manifests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM theme_package_versions
            WHERE theme_package_versions.id = theme_renderer_manifests.theme_package_version_id
              AND theme_package_versions.release_status = 'published'
              AND theme_package_versions.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_schema_manifests_public_read ON theme_schema_manifests;
CREATE POLICY theme_schema_manifests_public_read
    ON theme_schema_manifests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM theme_package_versions
            WHERE theme_package_versions.id = theme_schema_manifests.theme_package_version_id
              AND theme_package_versions.release_status = 'published'
              AND theme_package_versions.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_presets_public_read ON theme_presets;
CREATE POLICY theme_presets_public_read
    ON theme_presets FOR SELECT
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS theme_assets_public_read ON theme_assets;
CREATE POLICY theme_assets_public_read
    ON theme_assets FOR SELECT
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS theme_migrations_service_all ON theme_migrations;
CREATE POLICY theme_migrations_service_all
    ON theme_migrations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS theme_instances_owner_manage ON theme_instances;
CREATE POLICY theme_instances_owner_manage
    ON theme_instances FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_instances.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_instances.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_instances_public_active_read ON theme_instances;
CREATE POLICY theme_instances_public_active_read
    ON theme_instances FOR SELECT
    USING (
        instance_status = 'active'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_instances.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_instance_drafts_owner_manage ON theme_instance_drafts;
CREATE POLICY theme_instance_drafts_owner_manage
    ON theme_instance_drafts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_instance_drafts.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_instance_drafts.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_draft_patches_owner_manage ON theme_draft_patches;
CREATE POLICY theme_draft_patches_owner_manage
    ON theme_draft_patches FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_draft_patches.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_draft_patches.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_template_assignments_owner_manage ON theme_template_assignments;
CREATE POLICY theme_template_assignments_owner_manage
    ON theme_template_assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_template_assignments.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_template_assignments.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_layouts_public_read ON theme_layouts;
CREATE POLICY theme_layouts_public_read ON theme_layouts FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS theme_templates_public_read ON theme_templates;
CREATE POLICY theme_templates_public_read ON theme_templates FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS theme_section_definitions_public_read ON theme_section_definitions;
CREATE POLICY theme_section_definitions_public_read ON theme_section_definitions FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS theme_block_definitions_public_read ON theme_block_definitions;
CREATE POLICY theme_block_definitions_public_read ON theme_block_definitions FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS storefront_pages_owner_manage ON storefront_pages;
CREATE POLICY storefront_pages_owner_manage
    ON storefront_pages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_pages.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_pages.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS storefront_pages_public_read ON storefront_pages;
CREATE POLICY storefront_pages_public_read
    ON storefront_pages FOR SELECT
    USING (
        status = 'published'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_pages.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS storefront_page_revisions_owner_read ON storefront_page_revisions;
CREATE POLICY storefront_page_revisions_owner_read
    ON storefront_page_revisions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_page_revisions.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS storefront_policies_owner_manage ON storefront_policies;
CREATE POLICY storefront_policies_owner_manage
    ON storefront_policies FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_policies.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_policies.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS storefront_policies_public_read ON storefront_policies;
CREATE POLICY storefront_policies_public_read
    ON storefront_policies FOR SELECT
    USING (
        status = 'published'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_policies.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS navigation_menus_owner_manage ON navigation_menus;
CREATE POLICY navigation_menus_owner_manage
    ON navigation_menus FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = navigation_menus.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = navigation_menus.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS navigation_menus_public_read ON navigation_menus;
CREATE POLICY navigation_menus_public_read
    ON navigation_menus FOR SELECT
    USING (
        status = 'active'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = navigation_menus.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS navigation_menu_items_owner_manage ON navigation_menu_items;
CREATE POLICY navigation_menu_items_owner_manage
    ON navigation_menu_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = navigation_menu_items.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = navigation_menu_items.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS navigation_menu_items_public_read ON navigation_menu_items;
CREATE POLICY navigation_menu_items_public_read
    ON navigation_menu_items FOR SELECT
    USING (
        is_visible = TRUE
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = navigation_menu_items.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS media_assets_owner_manage ON media_assets;
CREATE POLICY media_assets_owner_manage
    ON media_assets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = media_assets.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = media_assets.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS media_assets_public_read ON media_assets;
CREATE POLICY media_assets_public_read
    ON media_assets FOR SELECT
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = media_assets.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS storefront_slug_redirects_owner_manage ON storefront_slug_redirects;
CREATE POLICY storefront_slug_redirects_owner_manage
    ON storefront_slug_redirects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_slug_redirects.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = storefront_slug_redirects.store_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'theme_packages',
        'theme_package_versions',
        'theme_renderer_manifests',
        'theme_schema_manifests',
        'theme_presets',
        'theme_assets',
        'theme_instances',
        'theme_instance_drafts',
        'theme_template_assignments',
        'theme_layouts',
        'theme_templates',
        'theme_section_definitions',
        'theme_block_definitions',
        'storefront_pages',
        'storefront_policies',
        'navigation_menus',
        'navigation_menu_items',
        'media_assets',
        'storefront_slug_redirects'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_' || table_name || '_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
                'update_' || table_name || '_updated_at',
                table_name
            );
        END IF;
    END LOOP;
END $$;

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
    updated_at
)
SELECT
    t.slug,
    t.name,
    t.description,
    COALESCE(NULLIF(t.author, ''), 'LetBuyy'),
    COALESCE(t.supported_site_types, ARRAY[t.site_type]),
    CASE WHEN t.is_active THEN 'active' ELSE 'disabled' END,
    CASE WHEN COALESCE(t.is_premium, FALSE) THEN 'paid' ELSE 'free' END,
    COALESCE(t.letbuyy_price_inr, t.price, 0),
    'INR',
    jsonb_build_object(
        'category', t.category,
        'preview_url', t.preview_url,
        'thumbnail_url', t.thumbnail_url,
        'install_count', t.install_count
    ),
    t.id,
    t.created_at,
    NOW()
FROM themes t
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    author_name = EXCLUDED.author_name,
    site_types = EXCLUDED.site_types,
    status = EXCLUDED.status,
    pricing_type = EXCLUDED.pricing_type,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    marketplace_metadata = EXCLUDED.marketplace_metadata,
    legacy_theme_id = EXCLUDED.legacy_theme_id,
    updated_at = NOW();

INSERT INTO theme_package_versions (
    theme_package_id,
    version,
    version_number,
    release_status,
    renderer_version,
    schema_version,
    package_manifest,
    published_at,
    created_at,
    updated_at
)
SELECT
    tp.id,
    COALESCE(NULLIF(t.version, ''), '1.0'),
    1,
    'published',
    COALESCE(NULLIF(t.renderer_version, ''), '1.0.0'),
    COALESCE(NULLIF(t.schema_version, ''), '1.0.0'),
    jsonb_build_object(
        'themeId', t.slug,
        'config', t.config,
        'defaultTemplate', t.default_template,
        'sectionSchemas', t.section_schemas,
        'blockSchemas', t.block_schemas,
        'settingsSchema', t.settings_schema
    ),
    NOW(),
    t.created_at,
    NOW()
FROM themes t
JOIN theme_packages tp ON tp.legacy_theme_id = t.id
ON CONFLICT (theme_package_id, version) DO UPDATE SET
    release_status = EXCLUDED.release_status,
    renderer_version = EXCLUDED.renderer_version,
    schema_version = EXCLUDED.schema_version,
    package_manifest = EXCLUDED.package_manifest,
    updated_at = NOW();

INSERT INTO theme_renderer_manifests (
    theme_package_version_id,
    renderer_manifest,
    approved_renderer_keys,
    asset_manifest
)
SELECT
    tpv.id,
    COALESCE(t.renderer_manifest, '{}'),
    ARRAY[
        'core.hero',
        'core.product-grid',
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
        'commerce.category-grid',
        'commerce.brand-marquee',
        'commerce.trust-badges'
    ],
    jsonb_build_object(
        'thumbnail_url', t.thumbnail_url,
        'preview_url', t.preview_url
    )
FROM themes t
JOIN theme_packages tp ON tp.legacy_theme_id = t.id
JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
ON CONFLICT (theme_package_version_id) DO UPDATE SET
    renderer_manifest = EXCLUDED.renderer_manifest,
    approved_renderer_keys = EXCLUDED.approved_renderer_keys,
    asset_manifest = EXCLUDED.asset_manifest,
    updated_at = NOW();

INSERT INTO theme_schema_manifests (
    theme_package_version_id,
    manifest_version,
    schema_manifest,
    section_schemas,
    block_schemas,
    settings_schema,
    template_schema
)
SELECT
    tpv.id,
    COALESCE(NULLIF(t.schema_version, ''), '1.0.0'),
    jsonb_build_object(
        'themeId', t.slug,
        'schemaVersion', COALESCE(NULLIF(t.schema_version, ''), '1.0.0')
    ),
    COALESCE(t.section_schemas, '{}'),
    COALESCE(t.block_schemas, '{}'),
    COALESCE(t.settings_schema, '{}'),
    jsonb_build_object(
        'layouts', jsonb_build_array('theme'),
        'templates', jsonb_build_array('index', 'product', 'collection', 'page', 'policy', 'cart', 'search', 'customer_account', 'not_found')
    )
FROM themes t
JOIN theme_packages tp ON tp.legacy_theme_id = t.id
JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
ON CONFLICT (theme_package_version_id) DO UPDATE SET
    manifest_version = EXCLUDED.manifest_version,
    schema_manifest = EXCLUDED.schema_manifest,
    section_schemas = EXCLUDED.section_schemas,
    block_schemas = EXCLUDED.block_schemas,
    settings_schema = EXCLUDED.settings_schema,
    template_schema = EXCLUDED.template_schema,
    updated_at = NOW();

INSERT INTO theme_presets (
    theme_package_version_id,
    preset_key,
    name,
    preset_config,
    sort_order
)
SELECT
    tpv.id,
    'default',
    t.name || ' Default',
    jsonb_build_object(
        'themeId', t.slug,
        'config', t.config,
        'defaultTemplate', t.default_template
    ),
    0
FROM themes t
JOIN theme_packages tp ON tp.legacy_theme_id = t.id
JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id
ON CONFLICT (theme_package_version_id, preset_key) DO UPDATE SET
    name = EXCLUDED.name,
    preset_config = EXCLUDED.preset_config,
    updated_at = NOW();

INSERT INTO theme_layouts (
    theme_package_version_id,
    layout_key,
    name,
    layout_schema,
    section_group_keys
)
SELECT
    tpv.id,
    'theme',
    'Theme layout',
    jsonb_build_object('type', 'theme'),
    ARRAY['header', 'footer']
FROM theme_package_versions tpv
ON CONFLICT (theme_package_version_id, layout_key) DO NOTHING;

INSERT INTO theme_templates (
    theme_package_version_id,
    template_key,
    template_type,
    layout_key,
    template_schema,
    default_sections
)
SELECT
    tpv.id,
    template_key,
    template_key,
    'theme',
    jsonb_build_object('type', template_key),
    '[]'::JSONB
FROM theme_package_versions tpv
CROSS JOIN (
    VALUES
        ('index'),
        ('product'),
        ('collection'),
        ('page'),
        ('policy'),
        ('cart'),
        ('search'),
        ('customer_account'),
        ('not_found')
) AS templates(template_key)
ON CONFLICT (theme_package_version_id, template_key) DO NOTHING;

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
    st.store_id,
    tp.id,
    tpv.id,
    t.slug,
    CASE WHEN st.is_active THEN 'active' ELSE 'inactive' END,
    COALESCE(st.config_overrides, '{}'),
    jsonb_build_object(
        'source', 'store_themes',
        'legacy_store_theme_id', st.id,
        'themeConfig', t.config
    ),
    CASE WHEN st.is_active THEN COALESCE(st.installed_at, NOW()) ELSE NULL END,
    COALESCE(st.installed_at, NOW()),
    COALESCE(st.updated_at, NOW())
FROM store_themes st
JOIN themes t ON t.id = st.theme_id
JOIN theme_packages tp ON tp.legacy_theme_id = t.id
JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id AND tpv.release_status = 'published'
ON CONFLICT DO NOTHING;

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
    tp.id,
    tpv.id,
    t.slug,
    'active',
    COALESCE(s.theme_settings, '{}'),
    jsonb_build_object(
        'source', 'sites.theme_id',
        'template_config', s.template_config,
        'sections', s.sections
    ),
    COALESCE(s.published_at, s.updated_at, NOW()),
    COALESCE(s.created_at, NOW()),
    NOW()
FROM sites s
JOIN themes t ON t.slug = s.theme_id
JOIN theme_packages tp ON tp.legacy_theme_id = t.id
JOIN theme_package_versions tpv ON tpv.theme_package_id = tp.id AND tpv.release_status = 'published'
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM theme_instances ti
      WHERE ti.store_id = s.id
        AND ti.theme_package_id = tp.id
        AND ti.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;

UPDATE theme_releases tr
SET
    theme_instance_id = ti.id,
    theme_package_version_id = ti.theme_package_version_id,
    release_manifest = CASE
        WHEN tr.release_manifest = '{}'::JSONB THEN jsonb_build_object(
            'engineVersion', 'theme-engine-v1',
            'themeId', tr.theme_id,
            'templateConfig', tr.release_config
        )
        ELSE tr.release_manifest
    END,
    template_snapshot = CASE
        WHEN tr.template_snapshot = '{}'::JSONB THEN tr.release_config
        ELSE tr.template_snapshot
    END,
    settings_snapshot = CASE
        WHEN tr.settings_snapshot = '{}'::JSONB THEN COALESCE(tr.release_config -> 'themeSettings', '{}'::JSONB)
        ELSE tr.settings_snapshot
    END
FROM theme_instances ti
WHERE ti.store_id = tr.store_id
  AND ti.theme_slug = tr.theme_id
  AND tr.deleted_at IS NULL;

UPDATE theme_instances ti
SET active_release_id = tr.id
FROM theme_releases tr
WHERE tr.theme_instance_id = ti.id
  AND tr.is_current = TRUE
  AND tr.deleted_at IS NULL
  AND ti.active_release_id IS NULL;

INSERT INTO theme_template_assignments (
    store_id,
    theme_instance_id,
    route_type,
    route_key,
    template_key,
    is_active,
    assigned_release_id,
    priority
)
SELECT
    ti.store_id,
    ti.id,
    'index',
    '/',
    'index',
    TRUE,
    ti.active_release_id,
    100
FROM theme_instances ti
WHERE ti.deleted_at IS NULL
ON CONFLICT (store_id, route_type, route_key, market, locale, is_active) DO NOTHING;
