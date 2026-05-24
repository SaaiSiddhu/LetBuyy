-- Align shipping runtime tables with the worker-owned shipping/tax API.
-- Additive only: existing stores keep current zones/rates while the worker can
-- safely manage active flags, order thresholds, descriptions, and audit fields.

ALTER TABLE shipping_zones
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID,
    ADD COLUMN IF NOT EXISTS zip_codes TEXT[] DEFAULT '{}';

ALTER TABLE shipping_rates
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS max_order_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS min_weight_grams INTEGER,
    ADD COLUMN IF NOT EXISTS max_weight_grams INTEGER,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE INDEX IF NOT EXISTS idx_shipping_zones_store_active
    ON shipping_zones(store_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone_active
    ON shipping_rates(zone_id, is_active, deleted_at);

DROP TRIGGER IF EXISTS shipping_zones_updated_at ON shipping_zones;
CREATE TRIGGER shipping_zones_updated_at
    BEFORE UPDATE ON shipping_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS shipping_rates_updated_at ON shipping_rates;
CREATE TRIGGER shipping_rates_updated_at
    BEFORE UPDATE ON shipping_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
