-- Tenant context and idempotency foundation.
-- This migration adds a durable idempotency table used by checkout/payment/order
-- mutations before the broader event/ledger rebuild.

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    scope TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_hash TEXT,
    response_body JSONB,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'completed', 'failed')),
    status_code INT,
    resource_type TEXT,
    resource_id UUID,
    request_id TEXT,
    locked_until TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (site_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_site_scope
    ON idempotency_keys(site_id, scope)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status_locked
    ON idempotency_keys(status, locked_until)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
    ON idempotency_keys(expires_at)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_idempotency_keys_updated_at ON idempotency_keys;
CREATE TRIGGER update_idempotency_keys_updated_at
    BEFORE UPDATE ON idempotency_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_idempotency_keys" ON idempotency_keys;
CREATE POLICY "service_role_idempotency_keys" ON idempotency_keys
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "site_owner_idempotency_keys_read" ON idempotency_keys;
CREATE POLICY "site_owner_idempotency_keys_read" ON idempotency_keys
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM sites
            WHERE sites.id = idempotency_keys.site_id
              AND (
                  sites.user_id = auth.uid()
                  OR sites.custom_user_id = auth.uid()
              )
        )
    );
