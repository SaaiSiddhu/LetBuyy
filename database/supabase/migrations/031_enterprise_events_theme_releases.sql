-- ============================================================================
-- Migration 031: Enterprise Events, Theme Releases, Preview Sessions, Cache Tags
-- Additive production spine for worker-owned commerce mutations.
-- Keeps database ownership on sites while UI and URLs continue using store.
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    actor_id UUID,
    actor_type TEXT NOT NULL DEFAULT 'user'
        CHECK (actor_type IN ('user', 'customer', 'employee', 'system', 'webhook')),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    request_id TEXT,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_activity_events_store_created
    ON audit_activity_events(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_activity_events_actor_created
    ON audit_activity_events(actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_activity_events_action_created
    ON audit_activity_events(action, created_at DESC);

ALTER TABLE audit_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_activity_events_owner_read ON audit_activity_events;
CREATE POLICY audit_activity_events_owner_read
    ON audit_activity_events FOR SELECT
    USING (
        store_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = audit_activity_events.store_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS audit_activity_events_service_all ON audit_activity_events;
CREATE POLICY audit_activity_events_service_all
    ON audit_activity_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'processed', 'failed', 'dead')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    request_id TEXT,
    actor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_available
    ON outbox_events(status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_store_created
    ON outbox_events(store_id, created_at DESC)
    WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_events_type_created
    ON outbox_events(event_type, created_at DESC);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_events_service_all ON outbox_events;
CREATE POLICY outbox_events_service_all
    ON outbox_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS theme_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL,
    release_version INTEGER NOT NULL,
    release_status TEXT NOT NULL DEFAULT 'published'
        CHECK (release_status IN ('published', 'superseded', 'rolled_back')),
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    release_config JSONB NOT NULL DEFAULT '{}',
    source_draft_id UUID REFERENCES theme_editor_drafts(id) ON DELETE SET NULL,
    source_draft_version INTEGER,
    publish_message TEXT,
    published_by UUID,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rollback_of_release_id UUID REFERENCES theme_releases(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(store_id, release_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_releases_one_current
    ON theme_releases(store_id)
    WHERE is_current = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_releases_store_version
    ON theme_releases(store_id, release_version DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_releases_theme
    ON theme_releases(theme_id, published_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE theme_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS theme_releases_owner_read ON theme_releases;
CREATE POLICY theme_releases_owner_read
    ON theme_releases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_releases.store_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_releases_public_current_read ON theme_releases;
CREATE POLICY theme_releases_public_current_read
    ON theme_releases FOR SELECT
    USING (
        is_current = TRUE
        AND release_status = 'published'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_releases.store_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_releases_service_all ON theme_releases;
CREATE POLICY theme_releases_service_all
    ON theme_releases FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS theme_preview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL,
    draft_id UUID REFERENCES theme_editor_drafts(id) ON DELETE SET NULL,
    draft_version INTEGER NOT NULL DEFAULT 1,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_theme_preview_sessions_store
    ON theme_preview_sessions(store_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_preview_sessions_token_active
    ON theme_preview_sessions(token_hash, expires_at)
    WHERE revoked_at IS NULL AND deleted_at IS NULL;

ALTER TABLE theme_preview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS theme_preview_sessions_owner_manage ON theme_preview_sessions;
CREATE POLICY theme_preview_sessions_owner_manage
    ON theme_preview_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_preview_sessions.store_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_preview_sessions.store_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS theme_preview_sessions_service_all ON theme_preview_sessions;
CREATE POLICY theme_preview_sessions_service_all
    ON theme_preview_sessions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS storefront_cache_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    release_id UUID REFERENCES theme_releases(id) ON DELETE SET NULL,
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_storefront_cache_tags_store
    ON storefront_cache_tags(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storefront_cache_tags_invalidated
    ON storefront_cache_tags(invalidated_at DESC)
    WHERE invalidated_at IS NOT NULL;

ALTER TABLE storefront_cache_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_cache_tags_service_all ON storefront_cache_tags;
CREATE POLICY storefront_cache_tags_service_all
    ON storefront_cache_tags FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE sites ADD COLUMN IF NOT EXISTS current_theme_release_id UUID;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS storefront_release_version INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sites_current_theme_release_fk'
    ) THEN
        ALTER TABLE sites
            ADD CONSTRAINT sites_current_theme_release_fk
            FOREIGN KEY (current_theme_release_id)
            REFERENCES theme_releases(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sites_current_theme_release
    ON sites(current_theme_release_id)
    WHERE current_theme_release_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sites_storefront_release_version
    ON sites(id, storefront_release_version);

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
    v_release_id UUID;
    v_published_at TIMESTAMPTZ;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_theme_id IS NULL OR LENGTH(TRIM(p_theme_id)) = 0 THEN
        RAISE EXCEPTION 'theme_id is required';
    END IF;

    SELECT COALESCE(MAX(tr.release_version), 0) + 1
      INTO v_next_version
      FROM theme_releases tr
     WHERE tr.store_id = p_store_id
       AND tr.deleted_at IS NULL;

    UPDATE theme_releases
       SET is_current = FALSE,
           release_status = 'superseded',
           updated_at = NOW()
     WHERE store_id = p_store_id
       AND is_current = TRUE
       AND deleted_at IS NULL;

    INSERT INTO theme_releases (
        store_id,
        theme_id,
        release_version,
        release_status,
        is_current,
        release_config,
        source_draft_id,
        source_draft_version,
        publish_message,
        published_by,
        rollback_of_release_id,
        metadata
    )
    VALUES (
        p_store_id,
        p_theme_id,
        v_next_version,
        'published',
        TRUE,
        COALESCE(p_release_config, '{}'::JSONB),
        p_source_draft_id,
        p_source_draft_version,
        p_publish_message,
        p_published_by,
        p_rollback_of_release_id,
        jsonb_build_object(
            'request_id', p_request_id,
            'source', CASE WHEN p_rollback_of_release_id IS NULL THEN 'publish' ELSE 'rollback' END
        )
    )
    RETURNING id, theme_releases.published_at
      INTO v_release_id, v_published_at;

    UPDATE sites
       SET theme_id = p_theme_id,
           template_config = COALESCE(p_release_config, '{}'::JSONB),
           current_theme_release_id = v_release_id,
           storefront_release_version = v_next_version,
           status = CASE WHEN p_make_store_live THEN 'published' ELSE status END,
           published_at = CASE WHEN p_make_store_live THEN v_published_at ELSE published_at END,
           updated_at = NOW()
     WHERE id = p_store_id;

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
            'release_id', v_release_id,
            'release_version', v_next_version,
            'cache_tags', jsonb_build_array(
                'store:' || p_store_id::TEXT,
                'theme:' || p_theme_id,
                'theme_release:' || v_release_id::TEXT
            )
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

REVOKE ALL ON FUNCTION publish_theme_release(
    UUID,
    TEXT,
    JSONB,
    UUID,
    INTEGER,
    UUID,
    TEXT,
    BOOLEAN,
    TEXT,
    UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION publish_theme_release(
    UUID,
    TEXT,
    JSONB,
    UUID,
    INTEGER,
    UUID,
    TEXT,
    BOOLEAN,
    TEXT,
    UUID
) TO service_role;

INSERT INTO theme_releases (
    store_id,
    theme_id,
    release_version,
    release_status,
    is_current,
    release_config,
    publish_message,
    published_at,
    metadata
)
SELECT
    s.id,
    COALESCE(s.theme_id, s.template_config ->> 'themeId', 'urban-kicks'),
    1,
    'published',
    TRUE,
    COALESCE(s.template_config, '{}'::JSONB),
    'Backfilled from existing sites.template_config',
    COALESCE(s.published_at, s.updated_at, s.created_at, NOW()),
    jsonb_build_object('source', 'migration_031_backfill')
FROM sites s
WHERE s.status = 'published'
  AND s.deleted_at IS NULL
  AND COALESCE(s.template_config, '{}'::JSONB) <> '{}'::JSONB
  AND NOT EXISTS (
      SELECT 1 FROM theme_releases tr
      WHERE tr.store_id = s.id
        AND tr.deleted_at IS NULL
  );

UPDATE sites s
   SET current_theme_release_id = tr.id,
       storefront_release_version = tr.release_version
  FROM theme_releases tr
 WHERE tr.store_id = s.id
   AND tr.is_current = TRUE
   AND tr.deleted_at IS NULL
   AND s.current_theme_release_id IS NULL;

CREATE OR REPLACE VIEW stores AS
SELECT
    id,
    user_id,
    custom_user_id,
    name,
    name as store_name,
    tagline,
    logo_url,
    favicon_url,
    site_type,
    subdomain,
    custom_domain,
    theme_id,
    theme_settings,
    template_config,
    sections,
    status,
    published_at,
    views_count,
    trial_started_at,
    trial_ends_at,
    trial_status,
    frozen_at,
    og_image_url,
    brand_color,
    domain_verified,
    ssl_status,
    currency,
    locale,
    tax_inclusive,
    industry,
    product_count,
    order_count,
    page_count,
    description,
    created_at,
    updated_at,
    deleted_at,
    version,
    created_by,
    updated_by,
    name AS display_name,
    payment_settings,
    online_payment_enabled,
    cod_enabled,
    current_theme_release_id,
    storefront_release_version
FROM sites;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_outbox_events_updated_at'
    ) THEN
        CREATE TRIGGER update_outbox_events_updated_at
            BEFORE UPDATE ON outbox_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_theme_releases_updated_at'
    ) THEN
        CREATE TRIGGER update_theme_releases_updated_at
            BEFORE UPDATE ON theme_releases
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_theme_preview_sessions_updated_at'
    ) THEN
        CREATE TRIGGER update_theme_preview_sessions_updated_at
            BEFORE UPDATE ON theme_preview_sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_storefront_cache_tags_updated_at'
    ) THEN
        CREATE TRIGGER update_storefront_cache_tags_updated_at
            BEFORE UPDATE ON storefront_cache_tags
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;
