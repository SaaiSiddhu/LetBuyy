-- Theme editor drafts and payment webhook idempotency.
-- Keeps database ownership on sites while API/UI continue using store language.

CREATE TABLE IF NOT EXISTS theme_editor_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL,
    draft_config JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    auto_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    UNIQUE(store_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_editor_drafts_store_id
    ON theme_editor_drafts(store_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_editor_drafts_theme_id
    ON theme_editor_drafts(theme_id)
    WHERE deleted_at IS NULL;

ALTER TABLE theme_editor_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS theme_editor_drafts_owner_select ON theme_editor_drafts;
CREATE POLICY theme_editor_drafts_owner_select
    ON theme_editor_drafts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_editor_drafts.store_id
              AND sites.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS theme_editor_drafts_owner_insert ON theme_editor_drafts;
CREATE POLICY theme_editor_drafts_owner_insert
    ON theme_editor_drafts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_editor_drafts.store_id
              AND sites.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS theme_editor_drafts_owner_update ON theme_editor_drafts;
CREATE POLICY theme_editor_drafts_owner_update
    ON theme_editor_drafts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_editor_drafts.store_id
              AND sites.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_editor_drafts.store_id
              AND sites.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS theme_editor_drafts_owner_delete ON theme_editor_drafts;
CREATE POLICY theme_editor_drafts_owner_delete
    ON theme_editor_drafts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = theme_editor_drafts.store_id
              AND sites.user_id = auth.uid()
        )
    );

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    processing_status TEXT NOT NULL DEFAULT 'received'
        CHECK (processing_status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
    raw_payload JSONB,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_status
    ON payment_webhook_events(provider, processing_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_type
    ON payment_webhook_events(event_type, created_at DESC);

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_webhook_events_service_role_all ON payment_webhook_events;
CREATE POLICY payment_webhook_events_service_role_all
    ON payment_webhook_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_settings JSONB NOT NULL DEFAULT '{}';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS online_payment_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_processed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_reserved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_released_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_failure_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_payment_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_payment_id
    ON orders(payment_id)
    WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_last_payment_event_id
    ON orders(last_payment_event_id)
    WHERE last_payment_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id
    ON subscriptions(razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment_id
    ON subscriptions(razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_external_subscription_id
    ON subscriptions(external_subscription_id)
    WHERE external_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_history_payment_id
    ON billing_history(payment_id)
    WHERE payment_id IS NOT NULL;

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
    name AS display_name,
    payment_settings,
    online_payment_enabled,
    cod_enabled
FROM sites;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_theme_editor_drafts_updated_at'
    ) THEN
        CREATE TRIGGER update_theme_editor_drafts_updated_at
            BEFORE UPDATE ON theme_editor_drafts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_webhook_events_updated_at'
    ) THEN
        CREATE TRIGGER update_payment_webhook_events_updated_at
            BEFORE UPDATE ON payment_webhook_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;
