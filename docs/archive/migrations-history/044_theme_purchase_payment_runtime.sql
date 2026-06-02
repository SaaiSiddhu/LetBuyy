-- ============================================================================
-- Migration 044: Theme Purchase Payment Runtime
-- Adds durable provider references for paid theme marketplace purchases.
-- ============================================================================

ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS payment_signature TEXT;
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS payment_idempotency_key TEXT;
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS payment_processed_at TIMESTAMPTZ;
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_theme_purchases_provider_order
    ON theme_purchases(payment_provider, provider_order_id)
    WHERE provider_order_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_purchases_provider_payment
    ON theme_purchases(payment_provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_purchases_payment_idempotency
    ON theme_purchases(user_id, theme_id, payment_idempotency_key)
    WHERE payment_idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_theme_purchases_user_status_active
    ON theme_purchases(user_id, status, purchased_at DESC)
    WHERE deleted_at IS NULL;

UPDATE theme_purchases
   SET payment_provider = COALESCE(payment_provider, payment_method)
 WHERE payment_provider IS NULL
   AND payment_method IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_theme_purchases_updated_at'
    ) THEN
        CREATE TRIGGER update_theme_purchases_updated_at
            BEFORE UPDATE ON theme_purchases
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;
