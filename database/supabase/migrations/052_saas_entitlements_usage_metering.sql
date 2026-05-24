-- ============================================================================
-- Migration 052: SaaS Memberships, RBAC, Entitlements, Quotas, Usage Metering
-- Adds tenant-scoped platform controls without introducing a `stores` table.
-- `sites` remains the tenant root; store remains a UI/URL term.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tenant memberships and role catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS site_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_roles_system_slug
    ON site_roles(slug)
    WHERE site_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_site_roles_site
    ON site_roles(site_id, slug)
    WHERE deleted_at IS NULL;

ALTER TABLE site_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_roles_service_all ON site_roles;
CREATE POLICY site_roles_service_all
    ON site_roles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS site_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES site_roles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    effect TEXT NOT NULL DEFAULT 'allow'
        CHECK (effect IN ('allow', 'deny')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_site_role_permissions_role
    ON site_role_permissions(role_id)
    WHERE deleted_at IS NULL;

ALTER TABLE site_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_role_permissions_service_all ON site_role_permissions;
CREATE POLICY site_role_permissions_service_all
    ON site_role_permissions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS site_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    custom_user_id UUID REFERENCES users_custom(id) ON DELETE CASCADE,
    legacy_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
    role_slugs TEXT[] NOT NULL DEFAULT ARRAY['owner']::TEXT[],
    permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (custom_user_id IS NOT NULL OR legacy_user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_memberships_custom_user
    ON site_memberships(site_id, custom_user_id)
    WHERE custom_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_memberships_legacy_user
    ON site_memberships(site_id, legacy_user_id)
    WHERE legacy_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_memberships_email
    ON site_memberships(site_id, lower(email))
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_site_memberships_site_status
    ON site_memberships(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE site_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_memberships_owner_read ON site_memberships;
CREATE POLICY site_memberships_owner_read
    ON site_memberships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = site_memberships.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS site_memberships_self_read ON site_memberships;
CREATE POLICY site_memberships_self_read
    ON site_memberships FOR SELECT
    USING (
        custom_user_id = auth.uid()
        OR legacy_user_id = auth.uid()
    );

DROP POLICY IF EXISTS site_memberships_service_all ON site_memberships;
CREATE POLICY site_memberships_service_all
    ON site_memberships FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Plan entitlements, site overrides, API clients
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plan_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_type TEXT NOT NULL DEFAULT 'store',
    plan_slug TEXT NOT NULL,
    features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    limits JSONB NOT NULL DEFAULT '{}',
    entitlements JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_type, plan_slug)
);

CREATE INDEX IF NOT EXISTS idx_plan_entitlements_active
    ON plan_entitlements(site_type, plan_slug)
    WHERE is_active = TRUE AND deleted_at IS NULL;

ALTER TABLE plan_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_entitlements_public_read ON plan_entitlements;
CREATE POLICY plan_entitlements_public_read
    ON plan_entitlements FOR SELECT
    USING (is_active = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS plan_entitlements_service_all ON plan_entitlements;
CREATE POLICY plan_entitlements_service_all
    ON plan_entitlements FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS site_entitlement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    features_add TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    features_remove TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    limits JSONB NOT NULL DEFAULT '{}',
    entitlements JSONB NOT NULL DEFAULT '{}',
    reason TEXT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_site_entitlement_overrides_active
    ON site_entitlement_overrides(site_id, starts_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE site_entitlement_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_entitlement_overrides_service_all ON site_entitlement_overrides;
CREATE POLICY site_entitlement_overrides_service_all
    ON site_entitlement_overrides FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS site_api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'revoked')),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_site_api_clients_site_status
    ON site_api_clients(site_id, status)
    WHERE deleted_at IS NULL;

ALTER TABLE site_api_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_api_clients_service_all ON site_api_clients;
CREATE POLICY site_api_clients_service_all
    ON site_api_clients FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Usage meters and append-only usage entries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS site_usage_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    meter_name TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    quantity NUMERIC(16,4) NOT NULL DEFAULT 0,
    limit_quantity NUMERIC(16,4),
    status TEXT NOT NULL DEFAULT 'within_limit'
        CHECK (status IN ('within_limit', 'over_limit', 'blocked')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, meter_name, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_site_usage_meters_site_period
    ON site_usage_meters(site_id, meter_name, period_start DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE site_usage_meters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_usage_meters_owner_read ON site_usage_meters;
CREATE POLICY site_usage_meters_owner_read
    ON site_usage_meters FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = site_usage_meters.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS site_usage_meters_service_all ON site_usage_meters;
CREATE POLICY site_usage_meters_service_all
    ON site_usage_meters FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS usage_meter_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    meter_id UUID NOT NULL REFERENCES site_usage_meters(id) ON DELETE CASCADE,
    meter_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    amount NUMERIC(16,4) NOT NULL CHECK (amount <> 0),
    source TEXT NOT NULL DEFAULT 'api',
    resource_type TEXT,
    resource_id TEXT,
    request_id TEXT,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(meter_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_meter_entries_site_created
    ON usage_meter_entries(site_id, meter_name, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE usage_meter_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_meter_entries_owner_read ON usage_meter_entries;
CREATE POLICY usage_meter_entries_owner_read
    ON usage_meter_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = usage_meter_entries.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS usage_meter_entries_service_all ON usage_meter_entries;
CREATE POLICY usage_meter_entries_service_all
    ON usage_meter_entries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Seed system roles and plan entitlements
-- ---------------------------------------------------------------------------

INSERT INTO site_roles (site_id, slug, name, description, is_system)
VALUES
    (NULL, 'owner', 'Owner', 'Tenant owner with billing and destructive permissions', TRUE),
    (NULL, 'admin', 'Admin', 'Full operational admin except tenant deletion and billing owner transfer', TRUE),
    (NULL, 'manager', 'Manager', 'Catalog, orders, customers, analytics, and fulfillment manager', TRUE),
    (NULL, 'fulfillment', 'Fulfillment', 'Inventory, fulfillment, transfer, and return operator', TRUE),
    (NULL, 'support', 'Support', 'Customer, order, review, and support visibility', TRUE),
    (NULL, 'viewer', 'Viewer', 'Read-only operational access', TRUE)
ON CONFLICT (slug) WHERE site_id IS NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO site_role_permissions (role_id, permission)
SELECT role.id, permission
FROM site_roles AS role
CROSS JOIN LATERAL unnest(
    CASE role.slug
        WHEN 'owner' THEN ARRAY[
            'tenant:*', 'billing:*', 'settings:*', 'products:*', 'orders:*', 'customers:*',
            'inventory:*', 'fulfillment:*', 'returns:*', 'promotions:*', 'gift_cards:*',
            'analytics:*', 'themes:*', 'apps:*', 'webhooks:*', 'api_clients:*'
        ]
        WHEN 'admin' THEN ARRAY[
            'settings:read', 'settings:write', 'products:*', 'orders:*', 'customers:*',
            'inventory:*', 'fulfillment:*', 'returns:*', 'promotions:*', 'gift_cards:*',
            'analytics:*', 'themes:*', 'apps:*', 'webhooks:*'
        ]
        WHEN 'manager' THEN ARRAY[
            'products:*', 'orders:*', 'customers:*', 'inventory:read', 'fulfillment:*',
            'returns:*', 'promotions:read', 'gift_cards:read', 'analytics:read'
        ]
        WHEN 'fulfillment' THEN ARRAY[
            'orders:read', 'inventory:*', 'fulfillment:*', 'returns:read', 'customers:read'
        ]
        WHEN 'support' THEN ARRAY[
            'orders:read', 'customers:read', 'reviews:read', 'returns:read'
        ]
        ELSE ARRAY[
            'products:read', 'orders:read', 'customers:read', 'analytics:read'
        ]
    END
) AS permission
WHERE role.site_id IS NULL
ON CONFLICT (role_id, permission) DO NOTHING;

INSERT INTO plan_entitlements (site_type, plan_slug, features, limits, entitlements)
VALUES
    ('store', 'free',
        ARRAY['storefront', 'products', 'orders'],
        '{"products": 25, "orders_monthly": 50, "storage_mb": 100, "staff": 1, "ai_credits_monthly": 5, "api_requests_monthly": 1000, "webhook_subscriptions": 0}'::JSONB,
        '{"custom_domain": false, "remove_branding": false, "multi_location_inventory": false, "advanced_promotions": false, "api_access": false}'::JSONB
    ),
    ('store', 'starter',
        ARRAY['storefront', 'products', 'orders', 'custom_domain', 'basic_analytics', 'webhooks'],
        '{"products": 100, "orders_monthly": 250, "storage_mb": 2048, "staff": 1, "ai_credits_monthly": 30, "api_requests_monthly": 10000, "webhook_subscriptions": 3}'::JSONB,
        '{"custom_domain": true, "remove_branding": false, "multi_location_inventory": false, "advanced_promotions": false, "api_access": true}'::JSONB
    ),
    ('store', 'business',
        ARRAY['storefront', 'products', 'orders', 'custom_domain', 'advanced_analytics', 'webhooks', 'multi_location_inventory', 'advanced_promotions'],
        '{"products": 1000, "orders_monthly": 2500, "storage_mb": 10240, "staff": 3, "ai_credits_monthly": 100, "api_requests_monthly": 100000, "webhook_subscriptions": 25}'::JSONB,
        '{"custom_domain": true, "remove_branding": true, "multi_location_inventory": true, "advanced_promotions": true, "api_access": true}'::JSONB
    ),
    ('store', 'enterprise',
        ARRAY['storefront', 'products', 'orders', 'custom_domain', 'enterprise_analytics', 'webhooks', 'multi_location_inventory', 'advanced_promotions', 'dedicated_support'],
        '{"products": null, "orders_monthly": null, "storage_mb": 51200, "staff": null, "ai_credits_monthly": 500, "api_requests_monthly": null, "webhook_subscriptions": null}'::JSONB,
        '{"custom_domain": true, "remove_branding": true, "multi_location_inventory": true, "advanced_promotions": true, "api_access": true, "dedicated_support": true}'::JSONB
    )
ON CONFLICT (site_type, plan_slug)
DO UPDATE SET
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    entitlements = EXCLUDED.entitlements,
    is_active = TRUE,
    updated_at = NOW(),
    deleted_at = NULL;

-- Backfill owner memberships from the tenant root.
INSERT INTO site_memberships (
    site_id, custom_user_id, legacy_user_id, email, status, role_slugs,
    permissions, accepted_at, metadata
)
SELECT
    sites.id,
    sites.custom_user_id,
    sites.user_id,
    COALESCE(users_custom.email, users.email),
    'active',
    ARRAY['owner']::TEXT[],
    ARRAY['tenant:*']::TEXT[],
    NOW(),
    '{"source": "migration_052_owner_backfill"}'::JSONB
FROM sites
LEFT JOIN users_custom ON users_custom.id = sites.custom_user_id
LEFT JOIN users ON users.id = sites.user_id
WHERE sites.deleted_at IS NULL
  AND (sites.custom_user_id IS NOT NULL OR sites.user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Updated-at triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_roles_updated_at') THEN
        CREATE TRIGGER update_site_roles_updated_at
            BEFORE UPDATE ON site_roles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_role_permissions_updated_at') THEN
        CREATE TRIGGER update_site_role_permissions_updated_at
            BEFORE UPDATE ON site_role_permissions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_memberships_updated_at') THEN
        CREATE TRIGGER update_site_memberships_updated_at
            BEFORE UPDATE ON site_memberships
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_plan_entitlements_updated_at') THEN
        CREATE TRIGGER update_plan_entitlements_updated_at
            BEFORE UPDATE ON plan_entitlements
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_entitlement_overrides_updated_at') THEN
        CREATE TRIGGER update_site_entitlement_overrides_updated_at
            BEFORE UPDATE ON site_entitlement_overrides
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_api_clients_updated_at') THEN
        CREATE TRIGGER update_site_api_clients_updated_at
            BEFORE UPDATE ON site_api_clients
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_site_usage_meters_updated_at') THEN
        CREATE TRIGGER update_site_usage_meters_updated_at
            BEFORE UPDATE ON site_usage_meters
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_usage_meter_entries_updated_at') THEN
        CREATE TRIGGER update_usage_meter_entries_updated_at
            BEFORE UPDATE ON usage_meter_entries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. RPC: resolve entitlements and record usage
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_site_entitlements(p_site_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_site sites;
    v_site_type TEXT;
    v_plan_slug TEXT;
    v_plan plan_entitlements;
    v_override RECORD;
    v_features TEXT[];
    v_limits JSONB;
    v_entitlements JSONB;
BEGIN
    SELECT *
      INTO v_site
      FROM sites
     WHERE id = p_site_id
       AND deleted_at IS NULL;

    IF v_site.id IS NULL THEN
        RAISE EXCEPTION 'site % not found', p_site_id;
    END IF;

    v_site_type := CASE
        WHEN v_site.site_type IN ('ecommerce', 'store') THEN 'store'
        WHEN v_site.site_type = 'landing_page' THEN 'landing'
        ELSE COALESCE(v_site.site_type, 'store')
    END;

    SELECT COALESCE(subscriptions.plan, plans.slug, 'free')
      INTO v_plan_slug
      FROM subscriptions
      LEFT JOIN plans ON plans.id = subscriptions.plan_id
     WHERE subscriptions.store_id = p_site_id
       AND subscriptions.status IN ('active', 'trialing')
     ORDER BY subscriptions.created_at DESC
     LIMIT 1;

    v_plan_slug := COALESCE(v_plan_slug, 'free');

    SELECT *
      INTO v_plan
      FROM plan_entitlements
     WHERE site_type = v_site_type
       AND plan_slug = v_plan_slug
       AND is_active = TRUE
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_plan.id IS NULL AND v_site_type <> 'store' THEN
        SELECT *
          INTO v_plan
          FROM plan_entitlements
         WHERE site_type = 'store'
           AND plan_slug = v_plan_slug
           AND is_active = TRUE
           AND deleted_at IS NULL
         LIMIT 1;
    END IF;

    v_features := COALESCE(v_plan.features, ARRAY[]::TEXT[]);
    v_limits := COALESCE(v_plan.limits, '{}'::JSONB);
    v_entitlements := COALESCE(v_plan.entitlements, '{}'::JSONB);

    FOR v_override IN
        SELECT *
          FROM site_entitlement_overrides
         WHERE site_id = p_site_id
           AND deleted_at IS NULL
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY created_at ASC
    LOOP
        v_features := ARRAY(
            SELECT DISTINCT feature
            FROM unnest(v_features || COALESCE(v_override.features_add, ARRAY[]::TEXT[])) AS feature
            WHERE feature <> ALL(COALESCE(v_override.features_remove, ARRAY[]::TEXT[]))
        );
        v_limits := v_limits || COALESCE(v_override.limits, '{}'::JSONB);
        v_entitlements := v_entitlements || COALESCE(v_override.entitlements, '{}'::JSONB);
    END LOOP;

    RETURN jsonb_build_object(
        'site_id', p_site_id,
        'site_type', v_site_type,
        'plan', v_plan_slug,
        'features', COALESCE(to_jsonb(v_features), '[]'::JSONB),
        'limits', v_limits,
        'entitlements', v_entitlements
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_usage_limit_from_entitlements(
    p_entitlements JSONB,
    p_meter_name TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_limits JSONB;
    v_key TEXT;
    v_raw TEXT;
BEGIN
    v_limits := COALESCE(p_entitlements->'limits', '{}'::JSONB);
    v_key := CASE p_meter_name
        WHEN 'products' THEN 'products'
        WHEN 'orders' THEN 'orders_monthly'
        WHEN 'storage_mb' THEN 'storage_mb'
        WHEN 'staff' THEN 'staff'
        WHEN 'ai_credits' THEN 'ai_credits_monthly'
        WHEN 'api_requests' THEN 'api_requests_monthly'
        WHEN 'webhook_subscriptions' THEN 'webhook_subscriptions'
        ELSE p_meter_name
    END;

    v_raw := v_limits->>v_key;
    IF v_raw IS NULL OR v_raw = '' OR lower(v_raw) = 'null' THEN
        RETURN NULL;
    END IF;

    RETURN v_raw::NUMERIC;
END;
$$;

CREATE OR REPLACE FUNCTION record_site_usage(
    p_site_id UUID,
    p_meter_name TEXT,
    p_amount NUMERIC,
    p_idempotency_key TEXT,
    p_source TEXT DEFAULT 'api',
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_trace_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS site_usage_meters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_entitlements JSONB;
    v_limit NUMERIC;
    v_meter site_usage_meters;
BEGIN
    IF p_site_id IS NULL THEN
        RAISE EXCEPTION 'site id is required';
    END IF;

    IF p_meter_name IS NULL OR length(trim(p_meter_name)) = 0 THEN
        RAISE EXCEPTION 'meter name is required';
    END IF;

    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'idempotency key is required';
    END IF;

    IF COALESCE(p_amount, 0) = 0 THEN
        RAISE EXCEPTION 'usage amount must be non-zero';
    END IF;

    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';
    v_entitlements := resolve_site_entitlements(p_site_id);
    v_limit := get_usage_limit_from_entitlements(v_entitlements, p_meter_name);

    INSERT INTO site_usage_meters (
        site_id, meter_name, period_start, period_end, limit_quantity, metadata
    )
    VALUES (
        p_site_id, p_meter_name, v_period_start, v_period_end, v_limit,
        jsonb_build_object('entitlements_snapshot', v_entitlements)
    )
    ON CONFLICT (site_id, meter_name, period_start, period_end)
    DO UPDATE SET
        limit_quantity = EXCLUDED.limit_quantity,
        updated_at = NOW()
    RETURNING * INTO v_meter;

    INSERT INTO usage_meter_entries (
        site_id, meter_id, meter_name, idempotency_key, amount, source,
        resource_type, resource_id, request_id, trace_id, metadata
    )
    VALUES (
        p_site_id, v_meter.id, p_meter_name, p_idempotency_key, p_amount,
        COALESCE(p_source, 'api'), p_resource_type, p_resource_id,
        p_request_id, p_trace_id, COALESCE(p_metadata, '{}'::JSONB)
    )
    ON CONFLICT (meter_id, idempotency_key) DO NOTHING;

    UPDATE site_usage_meters
       SET quantity = COALESCE((
               SELECT SUM(amount)
               FROM usage_meter_entries
               WHERE meter_id = v_meter.id
                 AND deleted_at IS NULL
           ), 0),
           status = CASE
               WHEN v_limit IS NULL THEN 'within_limit'
               WHEN COALESCE((
                   SELECT SUM(amount)
                   FROM usage_meter_entries
                   WHERE meter_id = v_meter.id
                     AND deleted_at IS NULL
               ), 0) > v_limit THEN 'over_limit'
               ELSE 'within_limit'
           END,
           updated_at = NOW()
     WHERE id = v_meter.id
     RETURNING * INTO v_meter;

    RETURN v_meter;
END;
$$;
