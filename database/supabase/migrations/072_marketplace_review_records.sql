-- ============================================================================
-- Migration 072: Marketplace Review Records
-- Shared app/theme submission queue for partner console and ops federation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_review_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_type TEXT NOT NULL CHECK (submission_type IN ('app', 'theme')),
    resource_id UUID NOT NULL,
    resource_slug TEXT,
    resource_name TEXT NOT NULL,
    partner_user_id UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
    app_developer_id UUID REFERENCES app_developers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'changes_requested')),
    automated_checks JSONB NOT NULL DEFAULT '{}',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users_custom(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users_custom(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users_custom(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(submission_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_review_records_status_created
    ON marketplace_review_records(status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_review_records_type_status
    ON marketplace_review_records(submission_type, status, submitted_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_review_records_partner_created
    ON marketplace_review_records(partner_user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_review_records_developer_created
    ON marketplace_review_records(app_developer_id, created_at DESC)
    WHERE app_developer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_review_records_resource
    ON marketplace_review_records(submission_type, resource_id)
    WHERE deleted_at IS NULL;

ALTER TABLE marketplace_review_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_review_records_partner_read ON marketplace_review_records;
CREATE POLICY marketplace_review_records_partner_read
    ON marketplace_review_records FOR SELECT
    USING (
        partner_user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM app_developers
            WHERE app_developers.id = marketplace_review_records.app_developer_id
              AND app_developers.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS marketplace_review_records_service_all ON marketplace_review_records;
CREATE POLICY marketplace_review_records_service_all
    ON marketplace_review_records FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_marketplace_review_records_updated_at
    ON marketplace_review_records;
CREATE TRIGGER update_marketplace_review_records_updated_at
    BEFORE UPDATE ON marketplace_review_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
