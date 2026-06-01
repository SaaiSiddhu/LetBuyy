-- ============================================================================
-- Migration 071: App Billing Charges
-- Records merchant-approved app charges that activate partner payout ledger rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_billing_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES marketplace_apps(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES app_developers(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
    billing_mode TEXT NOT NULL CHECK (billing_mode IN ('recurring', 'usage')),
    status TEXT NOT NULL DEFAULT 'pending_merchant_approval'
        CHECK (status IN ('pending_merchant_approval', 'approved', 'active', 'cancelled', 'failed')),
    name TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    revenue_share_bps INTEGER NOT NULL DEFAULT 8000 CHECK (revenue_share_bps BETWEEN 0 AND 10000),
    partner_amount_minor INTEGER NOT NULL CHECK (partner_amount_minor >= 0),
    platform_fee_minor INTEGER NOT NULL CHECK (platform_fee_minor >= 0),
    partner_gst_bps INTEGER NOT NULL DEFAULT 1800 CHECK (partner_gst_bps BETWEEN 0 AND 10000),
    partner_gst_minor INTEGER NOT NULL DEFAULT 0 CHECK (partner_gst_minor >= 0),
    payout_rail TEXT NOT NULL DEFAULT 'razorpay_route'
        CHECK (payout_rail IN ('razorpay_route', 'razorpayx', 'upi', 'manual')),
    provider TEXT NOT NULL DEFAULT 'razorpay_route'
        CHECK (provider IN ('razorpay_route', 'razorpayx', 'upi', 'manual')),
    provider_mode TEXT NOT NULL DEFAULT 'test' CHECK (provider_mode IN ('test', 'live')),
    provider_reference TEXT,
    approval_url TEXT,
    approved_by UUID REFERENCES users_custom(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    idempotency_key TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users_custom(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users_custom(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_app_billing_charges_site_created
    ON app_billing_charges(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_billing_charges_partner_created
    ON app_billing_charges(partner_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_billing_charges_installation_created
    ON app_billing_charges(installation_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_billing_charges_status_created
    ON app_billing_charges(status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE app_billing_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_billing_charges_partner_read ON app_billing_charges;
CREATE POLICY app_billing_charges_partner_read
    ON app_billing_charges FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM app_developers
            WHERE app_developers.id = app_billing_charges.partner_id
              AND app_developers.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS app_billing_charges_store_owner_read ON app_billing_charges;
CREATE POLICY app_billing_charges_store_owner_read
    ON app_billing_charges FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM sites
            WHERE sites.id = app_billing_charges.site_id
              AND sites.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS app_billing_charges_service_all ON app_billing_charges;
CREATE POLICY app_billing_charges_service_all
    ON app_billing_charges FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_app_billing_charges_updated_at
    ON app_billing_charges;
CREATE TRIGGER update_app_billing_charges_updated_at
    BEFORE UPDATE ON app_billing_charges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
