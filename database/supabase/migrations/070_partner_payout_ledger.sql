-- ============================================================================
-- Migration 070: Partner Payout Ledger
-- Records app-charge revenue share entries produced by the event spine.
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_payout_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES app_developers(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    app_id UUID REFERENCES marketplace_apps(id) ON DELETE SET NULL,
    installation_id UUID REFERENCES app_installations(id) ON DELETE SET NULL,
    charge_id UUID NOT NULL,
    source_event_id UUID NOT NULL,
    billing_mode TEXT NOT NULL CHECK (billing_mode IN ('recurring', 'usage')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    revenue_share_bps INTEGER NOT NULL DEFAULT 8000 CHECK (revenue_share_bps BETWEEN 0 AND 10000),
    partner_amount_minor INTEGER NOT NULL CHECK (partner_amount_minor >= 0),
    platform_fee_minor INTEGER NOT NULL CHECK (platform_fee_minor >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'released', 'failed', 'cancelled')),
    rail TEXT NOT NULL DEFAULT 'manual'
        CHECK (rail IN ('razorpay_route', 'razorpayx', 'upi', 'manual')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_payout_ledger_partner_created
    ON partner_payout_ledger_entries(partner_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_payout_ledger_site_created
    ON partner_payout_ledger_entries(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_payout_ledger_status_created
    ON partner_payout_ledger_entries(status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE partner_payout_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_payout_ledger_entries_partner_read ON partner_payout_ledger_entries;
CREATE POLICY partner_payout_ledger_entries_partner_read
    ON partner_payout_ledger_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM app_developers
            WHERE app_developers.id = partner_payout_ledger_entries.partner_id
              AND app_developers.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS partner_payout_ledger_entries_service_all ON partner_payout_ledger_entries;
CREATE POLICY partner_payout_ledger_entries_service_all
    ON partner_payout_ledger_entries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_partner_payout_ledger_entries_updated_at
    ON partner_payout_ledger_entries;
CREATE TRIGGER update_partner_payout_ledger_entries_updated_at
    BEFORE UPDATE ON partner_payout_ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
