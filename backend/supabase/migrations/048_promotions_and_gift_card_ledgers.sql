-- ============================================================================
-- Migration 048: Promotion Engine and Gift Card Stored-Value Ledgers
-- Replaces client-priced coupon validation with transactional backend evaluation.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Legacy coupon compatibility hardening
-- ---------------------------------------------------------------------------

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('percentage', 'fixed', 'free_shipping', 'bogo'));
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS value NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minimum_order_amount NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS maximum_discount NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_products UUID[] DEFAULT '{}';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_categories TEXT[] DEFAULT '{}';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updated_by UUID;

UPDATE coupons
   SET store_id = COALESCE(store_id, site_id),
       type = COALESCE(type, discount_type),
       value = COALESCE(value, discount_value),
       minimum_order_amount = COALESCE(minimum_order_amount, min_order_amount),
       maximum_discount = COALESCE(maximum_discount, max_discount),
       per_customer_limit = COALESCE(per_customer_limit, per_user_limit, 1)
 WHERE store_id IS NULL
    OR type IS NULL
    OR value IS NULL
    OR minimum_order_amount IS NULL
    OR maximum_discount IS NULL
    OR per_customer_limit IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_store_code_active
    ON coupons(store_id, UPPER(code))
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Promotion engine tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived')),
    priority INTEGER NOT NULL DEFAULT 100,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    stack_group TEXT NOT NULL DEFAULT 'default',
    can_stack BOOLEAN NOT NULL DEFAULT FALSE,
    usage_limit INTEGER,
    per_customer_limit INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promotions_site_status_priority
    ON promotions(site_id, status, priority, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS promotion_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    code_normalized TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'expired', 'archived')),
    usage_count INTEGER NOT NULL DEFAULT 0,
    usage_limit INTEGER,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, code_normalized)
);

CREATE INDEX IF NOT EXISTS idx_promotion_codes_promotion
    ON promotion_codes(promotion_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS promotion_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL
        CHECK (rule_type IN ('min_order_amount', 'customer_email', 'product_ids', 'collection_ids')),
    operator TEXT NOT NULL DEFAULT 'gte'
        CHECK (operator IN ('eq', 'in', 'gte', 'lte')),
    value JSONB NOT NULL,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promotion_rules_promotion
    ON promotion_rules(promotion_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS promotion_effects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    effect_type TEXT NOT NULL
        CHECK (effect_type IN ('percentage', 'fixed', 'free_shipping')),
    value NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(12,2),
    applies_to TEXT NOT NULL DEFAULT 'order'
        CHECK (applies_to IN ('order', 'line', 'shipping')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promotion_effects_promotion
    ON promotion_effects(promotion_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS promotion_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
    promotion_code_id UUID REFERENCES promotion_codes(id) ON DELETE SET NULL,
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_email TEXT,
    code TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'committed'
        CHECK (status IN ('reserved', 'committed', 'released', 'voided')),
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_order
    ON promotion_redemptions(order_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_customer
    ON promotion_redemptions(site_id, customer_email, created_at DESC)
    WHERE customer_email IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS promotion_usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
    promotion_code_id UUID REFERENCES promotion_codes(id) ON DELETE CASCADE,
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    customer_email TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_site
    ON promotion_usage_counters(site_id, updated_at DESC);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage_counters ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'promotions',
        'promotion_codes',
        'promotion_rules',
        'promotion_effects',
        'promotion_redemptions',
        'promotion_usage_counters'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_owner_read', table_name);
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (EXISTS (SELECT 1 FROM sites WHERE sites.id = %I.site_id AND sites.user_id = auth.uid() AND sites.deleted_at IS NULL))',
            table_name || '_owner_read',
            table_name,
            table_name
        );
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_service_all', table_name);
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
            table_name || '_service_all',
            table_name
        );
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON promotions;
CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_promotion_codes_updated_at ON promotion_codes;
CREATE TRIGGER trg_promotion_codes_updated_at
    BEFORE UPDATE ON promotion_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_promotion_rules_updated_at ON promotion_rules;
CREATE TRIGGER trg_promotion_rules_updated_at
    BEFORE UPDATE ON promotion_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_promotion_effects_updated_at ON promotion_effects;
CREATE TRIGGER trg_promotion_effects_updated_at
    BEFORE UPDATE ON promotion_effects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_promotion_redemptions_updated_at ON promotion_redemptions;
CREATE TRIGGER trg_promotion_redemptions_updated_at
    BEFORE UPDATE ON promotion_redemptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_promotion_usage_counters_updated_at ON promotion_usage_counters;
CREATE TRIGGER trg_promotion_usage_counters_updated_at
    BEFORE UPDATE ON promotion_usage_counters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill a first-class promotion record for each active legacy coupon.
WITH coupon_source AS (
    SELECT
        c.id,
        c.store_id,
        UPPER(c.code) AS code_normalized,
        COALESCE(c.description, 'Legacy coupon ' || c.code) AS title,
        c.starts_at,
        c.expires_at,
        c.usage_limit,
        COALESCE(c.per_customer_limit, c.per_user_limit, 1) AS per_customer_limit,
        COALESCE(c.type, c.discount_type) AS effect_type,
        COALESCE(c.value, c.discount_value, 0) AS effect_value,
        COALESCE(c.maximum_discount, c.max_discount) AS max_discount,
        COALESCE(c.minimum_order_amount, c.min_order_amount) AS min_order_amount
    FROM coupons c
    WHERE c.store_id IS NOT NULL
      AND c.deleted_at IS NULL
),
inserted_promotions AS (
    INSERT INTO promotions (
        site_id,
        title,
        status,
        starts_at,
        ends_at,
        usage_limit,
        per_customer_limit,
        metadata
    )
    SELECT
        cs.store_id,
        cs.title,
        CASE WHEN COALESCE(c.is_active, true) THEN 'active' ELSE 'paused' END,
        cs.starts_at,
        cs.expires_at,
        cs.usage_limit,
        cs.per_customer_limit,
        jsonb_build_object('legacy_coupon_id', cs.id)
    FROM coupon_source cs
    JOIN coupons c ON c.id = cs.id
    WHERE NOT EXISTS (
        SELECT 1 FROM promotions p
        WHERE p.site_id = cs.store_id
          AND p.metadata ->> 'legacy_coupon_id' = cs.id::TEXT
          AND p.deleted_at IS NULL
    )
    RETURNING id, site_id, metadata
),
promotion_map AS (
    SELECT
        COALESCE(ip.id, p.id) AS promotion_id,
        cs.*
    FROM coupon_source cs
    LEFT JOIN inserted_promotions ip
      ON ip.site_id = cs.store_id
     AND ip.metadata ->> 'legacy_coupon_id' = cs.id::TEXT
    LEFT JOIN promotions p
      ON p.site_id = cs.store_id
     AND p.metadata ->> 'legacy_coupon_id' = cs.id::TEXT
     AND p.deleted_at IS NULL
)
INSERT INTO promotion_codes (
    site_id,
    promotion_id,
    code,
    code_normalized,
    status,
    usage_count,
    usage_limit,
    starts_at,
    ends_at,
    metadata
)
SELECT
    pm.store_id,
    pm.promotion_id,
    pm.code_normalized,
    pm.code_normalized,
    'active',
    COALESCE(c.usage_count, 0),
    pm.usage_limit,
    pm.starts_at,
    pm.expires_at,
    jsonb_build_object('legacy_coupon_id', pm.id)
FROM promotion_map pm
JOIN coupons c ON c.id = pm.id
WHERE pm.promotion_id IS NOT NULL
ON CONFLICT (site_id, code_normalized) DO NOTHING;

INSERT INTO promotion_effects (
    site_id,
    promotion_id,
    effect_type,
    value,
    max_discount,
    applies_to,
    metadata
)
SELECT
    c.store_id,
    p.id,
    CASE WHEN COALESCE(c.type, c.discount_type) = 'free_shipping' THEN 'free_shipping'
         WHEN COALESCE(c.type, c.discount_type) = 'percentage' THEN 'percentage'
         ELSE 'fixed'
    END,
    COALESCE(c.value, c.discount_value, 0),
    COALESCE(c.maximum_discount, c.max_discount),
    CASE WHEN COALESCE(c.type, c.discount_type) = 'free_shipping' THEN 'shipping' ELSE 'order' END,
    jsonb_build_object('legacy_coupon_id', c.id)
FROM coupons c
JOIN promotions p
  ON p.site_id = c.store_id
 AND p.metadata ->> 'legacy_coupon_id' = c.id::TEXT
WHERE c.store_id IS NOT NULL
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM promotion_effects pe
      WHERE pe.promotion_id = p.id
        AND pe.metadata ->> 'legacy_coupon_id' = c.id::TEXT
        AND pe.deleted_at IS NULL
  );

INSERT INTO promotion_rules (
    site_id,
    promotion_id,
    rule_type,
    operator,
    value,
    metadata
)
SELECT
    c.store_id,
    p.id,
    'min_order_amount',
    'gte',
    jsonb_build_object('amount', COALESCE(c.minimum_order_amount, c.min_order_amount)),
    jsonb_build_object('legacy_coupon_id', c.id)
FROM coupons c
JOIN promotions p
  ON p.site_id = c.store_id
 AND p.metadata ->> 'legacy_coupon_id' = c.id::TEXT
WHERE c.store_id IS NOT NULL
  AND c.deleted_at IS NULL
  AND COALESCE(c.minimum_order_amount, c.min_order_amount) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM promotion_rules pr
      WHERE pr.promotion_id = p.id
        AND pr.rule_type = 'min_order_amount'
        AND pr.metadata ->> 'legacy_coupon_id' = c.id::TEXT
        AND pr.deleted_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- 3. Gift card stored-value ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gift_card_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    code_last4 TEXT NOT NULL,
    initial_value NUMERIC(12,2) NOT NULL CHECK (initial_value >= 0),
    balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'held', 'disabled', 'expired')),
    expires_at TIMESTAMPTZ,
    customer_id UUID,
    fraud_hold_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_gift_card_accounts_site_status
    ON gift_card_accounts(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gift_card_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    gift_card_account_id UUID NOT NULL REFERENCES gift_card_accounts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL
        CHECK (entry_type IN ('issued', 'debit', 'credit', 'refund_credit', 'hold', 'release', 'expire', 'fraud_hold')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    balance_after NUMERIC(12,2) NOT NULL CHECK (balance_after >= 0),
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_gift_card_ledger_account_created
    ON gift_card_ledger_entries(gift_card_account_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    gift_card_account_id UUID NOT NULL REFERENCES gift_card_accounts(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'committed'
        CHECK (status IN ('reserved', 'committed', 'released', 'voided')),
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_order
    ON gift_card_redemptions(order_id)
    WHERE deleted_at IS NULL;

ALTER TABLE gift_card_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_card_accounts_owner_read ON gift_card_accounts;
CREATE POLICY gift_card_accounts_owner_read
    ON gift_card_accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = gift_card_accounts.site_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS gift_card_accounts_service_all ON gift_card_accounts;
CREATE POLICY gift_card_accounts_service_all
    ON gift_card_accounts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS gift_card_ledger_entries_service_all ON gift_card_ledger_entries;
CREATE POLICY gift_card_ledger_entries_service_all
    ON gift_card_ledger_entries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS gift_card_redemptions_service_all ON gift_card_redemptions;
CREATE POLICY gift_card_redemptions_service_all
    ON gift_card_redemptions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_gift_card_accounts_updated_at ON gift_card_accounts;
CREATE TRIGGER trg_gift_card_accounts_updated_at
    BEFORE UPDATE ON gift_card_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_gift_card_ledger_entries_updated_at ON gift_card_ledger_entries;
CREATE TRIGGER trg_gift_card_ledger_entries_updated_at
    BEFORE UPDATE ON gift_card_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_gift_card_redemptions_updated_at ON gift_card_redemptions;
CREATE TRIGGER trg_gift_card_redemptions_updated_at
    BEFORE UPDATE ON gift_card_redemptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO gift_card_accounts (
    site_id,
    code_hash,
    code_last4,
    initial_value,
    balance,
    currency,
    status,
    expires_at,
    customer_id,
    metadata
)
SELECT
    gc.store_id,
    encode(digest(gc.code, 'sha256'), 'hex'),
    RIGHT(gc.code, 4),
    gc.initial_value,
    gc.balance,
    'INR',
    CASE WHEN gc.status IN ('active', 'held', 'disabled', 'expired') THEN gc.status ELSE 'active' END,
    gc.expires_at,
    gc.customer_id,
    jsonb_build_object('legacy_gift_card_id', gc.id)
FROM gift_cards gc
WHERE NOT EXISTS (
    SELECT 1 FROM gift_card_accounts gca
    WHERE gca.site_id = gc.store_id
      AND gca.code_hash = encode(digest(gc.code, 'sha256'), 'hex')
      AND gca.deleted_at IS NULL
)
ON CONFLICT (site_id, code_hash) DO NOTHING;

INSERT INTO gift_card_ledger_entries (
    site_id,
    gift_card_account_id,
    entry_type,
    amount,
    balance_after,
    idempotency_key,
    metadata
)
SELECT
    gca.site_id,
    gca.id,
    'issued',
    gca.initial_value,
    gca.balance,
    'gift_card.issued:legacy:' || gca.id::TEXT,
    gca.metadata
FROM gift_card_accounts gca
WHERE NOT EXISTS (
    SELECT 1 FROM gift_card_ledger_entries gle
    WHERE gle.gift_card_account_id = gca.id
      AND gle.entry_type = 'issued'
      AND gle.deleted_at IS NULL
)
ON CONFLICT (site_id, idempotency_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Transactional checkout helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION evaluate_checkout_promotion(
    p_store_id UUID,
    p_code TEXT,
    p_subtotal NUMERIC,
    p_shipping_amount NUMERIC,
    p_customer_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT := UPPER(BTRIM(COALESCE(p_code, '')));
    v_promo RECORD;
    v_min_order NUMERIC(12,2);
    v_customer_count INTEGER;
    v_global_count INTEGER;
    v_discount NUMERIC(12,2) := 0;
BEGIN
    IF v_code = '' THEN
        RETURN jsonb_build_object('valid', false, 'discount', 0);
    END IF;

    SELECT
        p.id AS promotion_id,
        pc.id AS promotion_code_id,
        NULL::UUID AS coupon_id,
        pc.code_normalized AS code,
        p.usage_limit AS promotion_usage_limit,
        p.per_customer_limit,
        pc.usage_limit AS code_usage_limit,
        pc.usage_count AS code_usage_count,
        pe.effect_type,
        pe.value,
        pe.max_discount,
        p.title
      INTO v_promo
      FROM promotion_codes pc
      JOIN promotions p ON p.id = pc.promotion_id
      JOIN promotion_effects pe ON pe.promotion_id = p.id AND pe.deleted_at IS NULL
     WHERE pc.site_id = p_store_id
       AND pc.code_normalized = v_code
       AND pc.status = 'active'
       AND p.status = 'active'
       AND pc.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND (pc.starts_at IS NULL OR pc.starts_at <= NOW())
       AND (pc.ends_at IS NULL OR pc.ends_at >= NOW())
       AND (p.starts_at IS NULL OR p.starts_at <= NOW())
       AND (p.ends_at IS NULL OR p.ends_at >= NOW())
     ORDER BY p.priority ASC, pe.created_at ASC
     LIMIT 1
     FOR UPDATE OF pc;

    IF NOT FOUND THEN
        SELECT
            NULL::UUID AS promotion_id,
            NULL::UUID AS promotion_code_id,
            c.id AS coupon_id,
            UPPER(c.code) AS code,
            c.usage_limit AS promotion_usage_limit,
            COALESCE(c.per_customer_limit, c.per_user_limit, 1) AS per_customer_limit,
            c.usage_limit AS code_usage_limit,
            COALESCE(c.usage_count, 0) AS code_usage_count,
            COALESCE(c.type, c.discount_type) AS effect_type,
            COALESCE(c.value, c.discount_value, 0) AS value,
            COALESCE(c.maximum_discount, c.max_discount) AS max_discount,
            COALESCE(c.description, c.code) AS title
          INTO v_promo
          FROM coupons c
         WHERE c.store_id = p_store_id
           AND UPPER(c.code) = v_code
           AND COALESCE(c.is_active, true) = true
           AND c.deleted_at IS NULL
           AND (c.starts_at IS NULL OR c.starts_at <= NOW())
           AND (c.expires_at IS NULL OR c.expires_at >= NOW())
         LIMIT 1
         FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'promotion code is invalid or inactive';
    END IF;

    SELECT COALESCE((pr.value ->> 'amount')::NUMERIC, 0)
      INTO v_min_order
      FROM promotion_rules pr
     WHERE pr.promotion_id = v_promo.promotion_id
       AND pr.rule_type = 'min_order_amount'
       AND pr.deleted_at IS NULL
     ORDER BY pr.created_at ASC
     LIMIT 1;

    IF v_min_order IS NULL AND v_promo.coupon_id IS NOT NULL THEN
        SELECT COALESCE(c.minimum_order_amount, c.min_order_amount)
          INTO v_min_order
          FROM coupons c
         WHERE c.id = v_promo.coupon_id;
    END IF;

    IF v_min_order IS NOT NULL AND p_subtotal < v_min_order THEN
        RAISE EXCEPTION 'minimum order amount % required for promotion', v_min_order;
    END IF;

    SELECT COUNT(*)
      INTO v_global_count
      FROM promotion_redemptions pr
     WHERE pr.site_id = p_store_id
       AND pr.status IN ('reserved', 'committed')
       AND pr.deleted_at IS NULL
       AND (
           (v_promo.promotion_id IS NOT NULL AND pr.promotion_id = v_promo.promotion_id)
           OR (v_promo.coupon_id IS NOT NULL AND pr.coupon_id = v_promo.coupon_id)
       );

    IF v_promo.promotion_usage_limit IS NOT NULL AND v_global_count >= v_promo.promotion_usage_limit THEN
        RAISE EXCEPTION 'promotion usage limit reached';
    END IF;

    IF v_promo.code_usage_limit IS NOT NULL AND v_promo.code_usage_count >= v_promo.code_usage_limit THEN
        RAISE EXCEPTION 'promotion code usage limit reached';
    END IF;

    IF p_customer_email IS NOT NULL AND v_promo.per_customer_limit IS NOT NULL THEN
        SELECT COUNT(*)
          INTO v_customer_count
          FROM promotion_redemptions pr
         WHERE pr.site_id = p_store_id
           AND LOWER(pr.customer_email) = LOWER(p_customer_email)
           AND pr.status IN ('reserved', 'committed')
           AND pr.deleted_at IS NULL
           AND (
               (v_promo.promotion_id IS NOT NULL AND pr.promotion_id = v_promo.promotion_id)
               OR (v_promo.coupon_id IS NOT NULL AND pr.coupon_id = v_promo.coupon_id)
           );

        IF v_customer_count >= v_promo.per_customer_limit THEN
            RAISE EXCEPTION 'promotion customer usage limit reached';
        END IF;
    END IF;

    IF v_promo.effect_type = 'percentage' THEN
        v_discount := ROUND((p_subtotal * v_promo.value / 100.0), 2);
        IF v_promo.max_discount IS NOT NULL THEN
            v_discount := LEAST(v_discount, v_promo.max_discount);
        END IF;
    ELSIF v_promo.effect_type = 'fixed' THEN
        v_discount := v_promo.value;
    ELSIF v_promo.effect_type = 'free_shipping' THEN
        v_discount := p_shipping_amount;
    ELSE
        RAISE EXCEPTION 'unsupported promotion effect: %', v_promo.effect_type;
    END IF;

    v_discount := LEAST(GREATEST(v_discount, 0), p_subtotal + p_shipping_amount);

    RETURN jsonb_build_object(
        'valid', true,
        'discount', v_discount,
        'code', v_promo.code,
        'promotion_id', v_promo.promotion_id,
        'promotion_code_id', v_promo.promotion_code_id,
        'coupon_id', v_promo.coupon_id,
        'effect_type', v_promo.effect_type,
        'title', v_promo.title
    );
END;
$$;

REVOKE ALL ON FUNCTION evaluate_checkout_promotion(UUID, TEXT, NUMERIC, NUMERIC, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_checkout_promotion(UUID, TEXT, NUMERIC, NUMERIC, TEXT)
    TO service_role;

-- Replace migration 046's checkout function with promotion/gift-card support.
DROP FUNCTION IF EXISTS create_checkout_order(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION create_checkout_order(
    p_store_id UUID,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_shipping_address JSONB,
    p_items JSONB,
    p_payment_method TEXT,
    p_notes TEXT DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_gift_card_code TEXT DEFAULT NULL,
    p_shipping_method TEXT DEFAULT 'standard',
    p_idempotency_key TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_order_id UUID;
    v_order_json JSONB;
    v_order_id UUID;
    v_order RECORD;
    v_shipping_method TEXT := COALESCE(NULLIF(BTRIM(p_shipping_method), ''), 'standard');
    v_shipping_amount NUMERIC(12,2) := 0;
    v_tax_amount NUMERIC(12,2) := 0;
    v_discount_amount NUMERIC(12,2) := 0;
    v_gift_card_amount NUMERIC(12,2) := 0;
    v_grand_total NUMERIC(12,2) := 0;
    v_payment_due NUMERIC(12,2) := 0;
    v_promotion JSONB := jsonb_build_object('valid', false, 'discount', 0);
    v_gift_card RECORD;
    v_payment_transaction_id UUID;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_payment_method NOT IN ('razorpay', 'stripe', 'paypal', 'cod') THEN
        RAISE EXCEPTION 'unsupported payment method: %', p_payment_method;
    END IF;

    SELECT order_id
      INTO v_existing_order_id
      FROM checkout_sessions
     WHERE site_id = p_store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_order_id IS NOT NULL THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = v_existing_order_id
           AND o.deleted_at IS NULL;

        IF v_order_json IS NOT NULL THEN
            RETURN v_order_json;
        END IF;
    END IF;

    IF v_shipping_method = 'express' THEN
        v_shipping_amount := 99;
    ELSIF v_shipping_method = 'standard' THEN
        v_shipping_amount := 0;
    ELSE
        RAISE EXCEPTION 'unsupported shipping method: %', v_shipping_method;
    END IF;

    v_order_json := create_order_with_inventory_reservations(
        p_store_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        COALESCE(p_shipping_address, '{}'::JSONB),
        p_items,
        p_payment_method,
        p_notes,
        NULL,
        p_actor_id,
        p_request_id
    );

    v_order_id := (v_order_json ->> 'id')::UUID;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'created order not found';
    END IF;

    IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        v_promotion := evaluate_checkout_promotion(
            p_store_id,
            p_coupon_code,
            COALESCE(v_order.subtotal, 0),
            v_shipping_amount,
            p_customer_email
        );
        v_discount_amount := COALESCE((v_promotion ->> 'discount')::NUMERIC, 0);
    END IF;

    v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);

    IF NULLIF(BTRIM(COALESCE(p_gift_card_code, '')), '') IS NOT NULL THEN
        SELECT *
          INTO v_gift_card
          FROM gift_card_accounts gca
         WHERE gca.site_id = p_store_id
           AND gca.code_hash = encode(digest(p_gift_card_code, 'sha256'), 'hex')
           AND gca.status = 'active'
           AND gca.deleted_at IS NULL
           AND (gca.expires_at IS NULL OR gca.expires_at >= NOW())
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'gift card is invalid or unavailable';
        END IF;

        v_gift_card_amount := LEAST(COALESCE(v_gift_card.balance, 0), v_grand_total);

        IF v_gift_card_amount <= 0 THEN
            RAISE EXCEPTION 'gift card has no redeemable balance';
        END IF;

        UPDATE gift_card_accounts
           SET balance = balance - v_gift_card_amount,
               updated_at = NOW(),
               updated_by = p_actor_id
         WHERE id = v_gift_card.id;

        INSERT INTO gift_card_redemptions (
            site_id,
            gift_card_account_id,
            order_id,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            v_gift_card_amount,
            'committed',
            'gift_card.redemption:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        INSERT INTO gift_card_ledger_entries (
            site_id,
            gift_card_account_id,
            order_id,
            entry_type,
            amount,
            balance_after,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            'debit',
            v_gift_card_amount,
            COALESCE(v_gift_card.balance, 0) - v_gift_card_amount,
            'gift_card.debit:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END IF;

    v_payment_due := GREATEST(v_grand_total - v_gift_card_amount, 0);

    UPDATE orders
       SET shipping_cost = v_shipping_amount,
           shipping_method = v_shipping_method,
           tax = v_tax_amount,
           discount = v_discount_amount,
           total = v_payment_due,
           coupon_code = NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), ''),
           coupon_discount = v_discount_amount,
           currency = COALESCE(currency, 'INR'),
           payment_status = CASE WHEN v_payment_due = 0 THEN 'paid' ELSE payment_status END,
           status = CASE WHEN v_payment_due = 0 THEN 'confirmed' ELSE status END,
           updated_at = NOW()
     WHERE id = v_order_id;

    INSERT INTO checkout_sessions (
        site_id,
        order_id,
        customer_email,
        status,
        idempotency_key,
        subtotal,
        shipping_total,
        tax_total,
        discount_total,
        gift_card_total,
        grand_total,
        currency,
        shipping_method,
        payment_method,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        p_customer_email,
        'completed',
        p_idempotency_key,
        COALESCE(v_order.subtotal, 0),
        v_shipping_amount,
        v_tax_amount,
        v_discount_amount,
        v_gift_card_amount,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        v_shipping_method,
        p_payment_method,
        p_request_id,
        jsonb_build_object('source', 'create_checkout_order', 'payment_due', v_payment_due, 'promotion', v_promotion),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO order_shipping_lines (
        site_id,
        order_id,
        title,
        method,
        amount,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        CASE WHEN v_shipping_method = 'express' THEN 'Express Shipping' ELSE 'Standard Shipping' END,
        v_shipping_method,
        v_shipping_amount,
        jsonb_build_object('computed_by', 'create_checkout_order'),
        p_actor_id
    );

    IF v_discount_amount > 0 THEN
        INSERT INTO order_line_adjustments (
            site_id,
            order_id,
            adjustment_type,
            source_type,
            source_id,
            title,
            amount,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_order_id,
            'promotion',
            CASE WHEN (v_promotion ->> 'promotion_id') IS NOT NULL THEN 'promotion' ELSE 'coupon' END,
            COALESCE(NULLIF(v_promotion ->> 'promotion_id', '')::UUID, NULLIF(v_promotion ->> 'coupon_id', '')::UUID),
            COALESCE(v_promotion ->> 'title', 'Promotion'),
            v_discount_amount,
            v_promotion,
            p_actor_id
        );

        INSERT INTO promotion_redemptions (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            order_id,
            customer_email,
            code,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            v_order_id,
            p_customer_email,
            v_promotion ->> 'code',
            v_discount_amount,
            'committed',
            'promotion.redemption:' || v_order_id::TEXT || ':' || COALESCE(v_promotion ->> 'code', 'unknown'),
            p_request_id,
            v_promotion,
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        UPDATE promotion_codes
           SET usage_count = usage_count + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID;

        UPDATE coupons
           SET usage_count = COALESCE(usage_count, 0) + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'coupon_id', '')::UUID;

        INSERT INTO promotion_usage_counters (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            customer_email,
            usage_count
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            LOWER(p_customer_email),
            1
        )
        ON CONFLICT (site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
        DO UPDATE SET usage_count = promotion_usage_counters.usage_count + 1,
                      updated_at = NOW();
    END IF;

    INSERT INTO payment_transactions (
        order_id,
        store_id,
        site_id,
        gateway,
        amount,
        currency,
        status,
        payment_method,
        metadata,
        request_id,
        idempotency_key,
        created_by,
        captured_at
    )
    VALUES (
        v_order_id,
        p_store_id,
        p_store_id,
        p_payment_method,
        v_payment_due,
        COALESCE(v_order.currency, 'INR'),
        CASE WHEN v_payment_due = 0 THEN 'captured' ELSE 'pending' END,
        p_payment_method,
        jsonb_build_object('source', 'checkout', 'gift_card_total', v_gift_card_amount),
        p_request_id,
        p_idempotency_key || ':payment',
        p_actor_id,
        CASE WHEN v_payment_due = 0 THEN NOW() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_transaction_id;

    INSERT INTO inventory_events (
        site_id,
        inventory_level_id,
        location_id,
        product_id,
        variant_id,
        order_id,
        reservation_id,
        event_type,
        quantity_delta,
        on_hand_quantity,
        available_quantity,
        committed_quantity,
        unavailable_quantity,
        incoming_quantity,
        reserved_quantity,
        safety_stock_quantity,
        source_type,
        source_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        p_store_id,
        il.id,
        r.location_id,
        oi.product_id,
        oi.variant_id,
        v_order_id,
        r.id,
        'sale_committed',
        -oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        oi.quantity,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        v_order_id,
        'checkout.sale_committed:' || v_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('checkout_session_idempotency_key', p_idempotency_key),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND ((r.variant_id IS NULL AND oi.variant_id IS NULL) OR r.variant_id = oi.variant_id)
       AND r.deleted_at IS NULL
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND ((il.variant_id IS NULL AND oi.variant_id IS NULL) OR il.variant_id = oi.variant_id)
     WHERE oi.order_id = v_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        p_store_id,
        p_store_id,
        'checkout',
        v_order_id::TEXT,
        'checkout.completed',
        jsonb_build_object(
            'site_id', p_store_id,
            'order_id', v_order_id,
            'payment_transaction_id', v_payment_transaction_id,
            'subtotal', COALESCE(v_order.subtotal, 0),
            'shipping_total', v_shipping_amount,
            'tax_total', v_tax_amount,
            'discount_total', v_discount_amount,
            'gift_card_total', v_gift_card_amount,
            'grand_total', v_grand_total,
            'payment_due', v_payment_due,
            'schema_version', 1
        ),
        'checkout.completed:' || v_order_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$$;

REVOKE ALL ON FUNCTION create_checkout_order(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_checkout_order(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
    TO service_role;
