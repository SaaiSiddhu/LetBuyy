-- ============================================================================
-- Migration 046: Canonical Checkout, Payment, and Inventory Ledgers
-- Additive hardening for checkout/payment paths.
--
-- Design intent:
-- - keep `sites` as the tenant root while compatibility columns still use store_id
-- - preserve migration 032's atomic inventory reservation RPC as the stock-lock core
-- - add canonical checkout/payment/inventory ledger records around irreversible flows
-- - make payment providers update a provider-neutral payment transaction ledger
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Outbox envelope compatibility for event dispatcher/runtime work
-- ---------------------------------------------------------------------------

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT gen_random_uuid();
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1;

UPDATE outbox_events
   SET site_id = store_id
 WHERE site_id IS NULL
   AND store_id IS NOT NULL;

UPDATE outbox_events
   SET event_id = gen_random_uuid()
 WHERE event_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_events_event_id
    ON outbox_events(event_id);

CREATE INDEX IF NOT EXISTS idx_outbox_events_site_status_available
    ON outbox_events(site_id, status, available_at, created_at);

-- ---------------------------------------------------------------------------
-- 2. Checkout canonical totals and order total component tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_email TEXT,
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('processing', 'completed', 'failed', 'cancelled', 'expired')),
    idempotency_key TEXT NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    gift_card_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    shipping_method TEXT,
    payment_method TEXT,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_site_created
    ON checkout_sessions(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order
    ON checkout_sessions(order_id)
    WHERE order_id IS NOT NULL;

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_owner_read ON checkout_sessions;
CREATE POLICY checkout_sessions_owner_read
    ON checkout_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = checkout_sessions.site_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS checkout_sessions_service_all ON checkout_sessions;
CREATE POLICY checkout_sessions_service_all
    ON checkout_sessions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS order_line_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    adjustment_type TEXT NOT NULL
        CHECK (adjustment_type IN ('promotion', 'manual', 'gift_card', 'rounding')),
    source_type TEXT,
    source_id UUID,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_line_adjustments_order
    ON order_line_adjustments(order_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS order_tax_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    rate NUMERIC(8,6) NOT NULL DEFAULT 0,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    jurisdiction JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_tax_lines_order
    ON order_tax_lines(order_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS order_shipping_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    method TEXT NOT NULL,
    carrier TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_shipping_lines_order
    ON order_shipping_lines(order_id)
    WHERE deleted_at IS NULL;

ALTER TABLE order_line_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tax_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_shipping_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_line_adjustments_service_all ON order_line_adjustments;
CREATE POLICY order_line_adjustments_service_all
    ON order_line_adjustments FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS order_tax_lines_service_all ON order_tax_lines;
CREATE POLICY order_tax_lines_service_all
    ON order_tax_lines FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS order_shipping_lines_service_all ON order_shipping_lines;
CREATE POLICY order_shipping_lines_service_all
    ON order_shipping_lines FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Provider-neutral payment transaction ledger hardening
-- ---------------------------------------------------------------------------

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE payment_transactions
   SET site_id = store_id
 WHERE site_id IS NULL
   AND store_id IS NOT NULL;

ALTER TABLE payment_transactions ALTER COLUMN site_id SET NOT NULL;

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE payment_transactions
    ADD CONSTRAINT payment_transactions_status_check
    CHECK (status IN (
        'pending',
        'processing',
        'authorized',
        'captured',
        'completed',
        'failed',
        'partially_refunded',
        'refunded',
        'voided'
    ));

CREATE INDEX IF NOT EXISTS idx_payment_transactions_site_status
    ON payment_transactions(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_order
    ON payment_transactions(gateway, provider_order_id)
    WHERE provider_order_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency
    ON payment_transactions(site_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

DROP POLICY IF EXISTS "Store owners view payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Service role manages payment transactions" ON payment_transactions;

DROP POLICY IF EXISTS payment_transactions_owner_read ON payment_transactions;
CREATE POLICY payment_transactions_owner_read
    ON payment_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = payment_transactions.site_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS payment_transactions_service_all ON payment_transactions;
CREATE POLICY payment_transactions_service_all
    ON payment_transactions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer')),
    attempt_type TEXT NOT NULL CHECK (attempt_type IN ('reference', 'authorize', 'capture', 'failure', 'void')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    provider_order_id TEXT,
    provider_payment_id TEXT,
    provider_event_id TEXT,
    idempotency_key TEXT,
    request_id TEXT,
    failure_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_created
    ON payment_attempts(order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_site_status
    ON payment_attempts(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_provider_event
    ON payment_attempts(site_id, provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_attempts_owner_read ON payment_attempts;
CREATE POLICY payment_attempts_owner_read
    ON payment_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = payment_attempts.site_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS payment_attempts_service_all ON payment_attempts;
CREATE POLICY payment_attempts_service_all
    ON payment_attempts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS refund_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
    refund_method TEXT NOT NULL DEFAULT 'original_payment'
        CHECK (refund_method IN ('original_payment', 'gift_card', 'manual')),
    provider_refund_id TEXT,
    provider_event_id TEXT,
    reason TEXT,
    idempotency_key TEXT,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refund_transactions_order_created
    ON refund_transactions(order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_transactions_idempotency
    ON refund_transactions(site_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refund_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    refund_transaction_id UUID NOT NULL REFERENCES refund_transactions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer', 'gift_card')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
    provider_refund_id TEXT,
    provider_event_id TEXT,
    idempotency_key TEXT,
    request_id TEXT,
    failure_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refund_attempts_refund_created
    ON refund_attempts(refund_transaction_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE refund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refund_transactions_service_all ON refund_transactions;
CREATE POLICY refund_transactions_service_all
    ON refund_transactions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS refund_attempts_service_all ON refund_attempts;
CREATE POLICY refund_attempts_service_all
    ON refund_attempts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Inventory event ledger and reservation state expansion
-- ---------------------------------------------------------------------------

ALTER TABLE inventory_reservations DROP CONSTRAINT IF EXISTS inventory_reservations_status_check;
ALTER TABLE inventory_reservations
    ADD CONSTRAINT inventory_reservations_status_check
    CHECK (status IN ('active', 'hold', 'committed', 'released', 'expired', 'fulfilled', 'cancelled'));

ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS on_hand_quantity INTEGER;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS available_quantity INTEGER;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS committed_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS unavailable_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS incoming_quantity INTEGER;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER;
ALTER TABLE inventory_levels ADD COLUMN IF NOT EXISTS safety_stock_quantity INTEGER NOT NULL DEFAULT 0;

UPDATE inventory_levels
   SET on_hand_quantity = COALESCE(on_hand_quantity, available + reserved),
       available_quantity = COALESCE(available_quantity, available),
       incoming_quantity = COALESCE(incoming_quantity, incoming),
       reserved_quantity = COALESCE(reserved_quantity, reserved)
 WHERE on_hand_quantity IS NULL
    OR available_quantity IS NULL
    OR incoming_quantity IS NULL
    OR reserved_quantity IS NULL;

CREATE TABLE IF NOT EXISTS inventory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    inventory_level_id UUID REFERENCES inventory_levels(id) ON DELETE SET NULL,
    location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES inventory_reservations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'sale_committed',
        'sale_released',
        'po_ordered',
        'po_received',
        'transfer_reserved',
        'transfer_shipped',
        'transfer_received',
        'return_restocked',
        'manual_adjusted',
        'damaged',
        'reconciliation_corrected'
    )),
    quantity_delta INTEGER NOT NULL,
    on_hand_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    committed_quantity INTEGER NOT NULL DEFAULT 0,
    unavailable_quantity INTEGER NOT NULL DEFAULT 0,
    incoming_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    safety_stock_quantity INTEGER NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL,
    source_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_inventory_events_site_created
    ON inventory_events(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_events_product_created
    ON inventory_events(product_id, variant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_events_order
    ON inventory_events(order_id)
    WHERE order_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_events_owner_read ON inventory_events;
CREATE POLICY inventory_events_owner_read
    ON inventory_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = inventory_events.site_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS inventory_events_service_all ON inventory_events;
CREATE POLICY inventory_events_service_all
    ON inventory_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. Updated-at triggers for new mutable projections
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_checkout_sessions_updated_at ON checkout_sessions;
CREATE TRIGGER trg_checkout_sessions_updated_at
    BEFORE UPDATE ON checkout_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_order_line_adjustments_updated_at ON order_line_adjustments;
CREATE TRIGGER trg_order_line_adjustments_updated_at
    BEFORE UPDATE ON order_line_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_order_tax_lines_updated_at ON order_tax_lines;
CREATE TRIGGER trg_order_tax_lines_updated_at
    BEFORE UPDATE ON order_tax_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_order_shipping_lines_updated_at ON order_shipping_lines;
CREATE TRIGGER trg_order_shipping_lines_updated_at
    BEFORE UPDATE ON order_shipping_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_payment_attempts_updated_at ON payment_attempts;
CREATE TRIGGER trg_payment_attempts_updated_at
    BEFORE UPDATE ON payment_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_refund_transactions_updated_at ON refund_transactions;
CREATE TRIGGER trg_refund_transactions_updated_at
    BEFORE UPDATE ON refund_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_refund_attempts_updated_at ON refund_attempts;
CREATE TRIGGER trg_refund_attempts_updated_at
    BEFORE UPDATE ON refund_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_events_updated_at ON inventory_events;
CREATE TRIGGER trg_inventory_events_updated_at
    BEFORE UPDATE ON inventory_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Canonical checkout RPC
-- ---------------------------------------------------------------------------

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
    v_grand_total NUMERIC(12,2) := 0;
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

    IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        RAISE EXCEPTION 'promotion engine is not enabled for coupon checkout yet';
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

    v_grand_total := COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount;

    UPDATE orders
       SET shipping_cost = v_shipping_amount,
           shipping_method = v_shipping_method,
           tax = v_tax_amount,
           discount = v_discount_amount,
           total = v_grand_total,
           currency = COALESCE(currency, 'INR'),
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
        0,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        v_shipping_method,
        p_payment_method,
        p_request_id,
        jsonb_build_object('source', 'create_checkout_order'),
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
        created_by
    )
    VALUES (
        v_order_id,
        p_store_id,
        p_store_id,
        p_payment_method,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_payment_method,
        jsonb_build_object('source', 'checkout'),
        p_request_id,
        p_idempotency_key || ':payment',
        p_actor_id
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
       AND (
           (r.variant_id IS NULL AND oi.variant_id IS NULL)
           OR r.variant_id = oi.variant_id
       )
       AND r.deleted_at IS NULL
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
           (il.variant_id IS NULL AND oi.variant_id IS NULL)
           OR il.variant_id = oi.variant_id
       )
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
            'grand_total', v_grand_total,
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

REVOKE ALL ON FUNCTION create_checkout_order(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_checkout_order(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
    TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Payment state wrappers that update the payment ledger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION attach_order_payment_reference_with_ledger(
    p_order_id UUID,
    p_provider TEXT,
    p_provider_order_id TEXT,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_json JSONB;
    v_order RECORD;
    v_payment_transaction_id UUID;
BEGIN
    v_order_json := attach_order_payment_reference(
        p_order_id,
        p_provider,
        p_provider_order_id,
        p_request_id
    );

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    UPDATE payment_transactions
       SET gateway_txn_id = p_provider_order_id,
           provider_order_id = p_provider_order_id,
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND gateway = p_provider
       AND deleted_at IS NULL
     RETURNING id INTO v_payment_transaction_id;

    IF v_payment_transaction_id IS NULL THEN
        INSERT INTO payment_transactions (
            order_id,
            store_id,
            site_id,
            gateway,
            gateway_txn_id,
            provider_order_id,
            amount,
            currency,
            status,
            payment_method,
            metadata,
            request_id,
            idempotency_key
        )
        VALUES (
            p_order_id,
            v_order.store_id,
            v_order.store_id,
            p_provider,
            p_provider_order_id,
            p_provider_order_id,
            COALESCE(v_order.total, 0),
            COALESCE(v_order.currency, 'INR'),
            'pending',
            p_provider,
            jsonb_build_object('source', 'payment_reference_attach'),
            p_request_id,
            p_idempotency_key
        )
        RETURNING id INTO v_payment_transaction_id;
    END IF;

    INSERT INTO payment_attempts (
        site_id,
        order_id,
        payment_transaction_id,
        provider,
        attempt_type,
        status,
        amount,
        currency,
        provider_order_id,
        provider_event_id,
        idempotency_key,
        request_id,
        metadata
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        p_provider,
        'reference',
        'succeeded',
        COALESCE(v_order.total, 0),
        COALESCE(v_order.currency, 'INR'),
        p_provider_order_id,
        'reference:' || p_provider || ':' || p_provider_order_id,
        p_idempotency_key,
        p_request_id,
        jsonb_build_object('provider_order_id', p_provider_order_id)
    )
    ON CONFLICT DO NOTHING;

    RETURN v_order_json;
END;
$$;

REVOKE ALL ON FUNCTION attach_order_payment_reference_with_ledger(UUID, TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION attach_order_payment_reference_with_ledger(UUID, TEXT, TEXT, TEXT, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION confirm_order_payment_with_ledger(
    p_order_id UUID,
    p_provider TEXT,
    p_provider_payment_id TEXT,
    p_provider_order_id TEXT DEFAULT NULL,
    p_provider_event_id TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_json JSONB;
    v_order RECORD;
    v_payment_transaction_id UUID;
BEGIN
    v_order_json := confirm_order_payment(
        p_order_id,
        p_provider,
        p_provider_payment_id,
        p_provider_order_id,
        p_provider_event_id,
        p_request_id
    );

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    UPDATE payment_transactions
       SET gateway_txn_id = COALESCE(p_provider_payment_id, gateway_txn_id),
           provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
           provider_payment_id = p_provider_payment_id,
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           status = 'captured',
           captured_at = COALESCE(captured_at, NOW()),
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND gateway = p_provider
       AND deleted_at IS NULL
     RETURNING id INTO v_payment_transaction_id;

    IF v_payment_transaction_id IS NULL THEN
        INSERT INTO payment_transactions (
            order_id,
            store_id,
            site_id,
            gateway,
            gateway_txn_id,
            provider_order_id,
            provider_payment_id,
            provider_event_id,
            amount,
            currency,
            status,
            payment_method,
            metadata,
            request_id,
            idempotency_key,
            captured_at
        )
        VALUES (
            p_order_id,
            v_order.store_id,
            v_order.store_id,
            p_provider,
            p_provider_payment_id,
            p_provider_order_id,
            p_provider_payment_id,
            p_provider_event_id,
            COALESCE(v_order.total, 0),
            COALESCE(v_order.currency, 'INR'),
            'captured',
            p_provider,
            jsonb_build_object('source', 'payment_confirmation'),
            p_request_id,
            p_idempotency_key,
            NOW()
        )
        RETURNING id INTO v_payment_transaction_id;
    END IF;

    INSERT INTO payment_attempts (
        site_id,
        order_id,
        payment_transaction_id,
        provider,
        attempt_type,
        status,
        amount,
        currency,
        provider_order_id,
        provider_payment_id,
        provider_event_id,
        idempotency_key,
        request_id,
        metadata
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        p_provider,
        'capture',
        'succeeded',
        COALESCE(v_order.total, 0),
        COALESCE(v_order.currency, 'INR'),
        p_provider_order_id,
        p_provider_payment_id,
        COALESCE(p_provider_event_id, 'capture:' || p_provider || ':' || p_provider_payment_id),
        p_idempotency_key,
        p_request_id,
        jsonb_build_object('provider_payment_id', p_provider_payment_id)
    )
    ON CONFLICT DO NOTHING;

    RETURN v_order_json;
END;
$$;

REVOKE ALL ON FUNCTION confirm_order_payment_with_ledger(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_order_payment_with_ledger(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION record_order_payment_failure_with_ledger(
    p_order_id UUID,
    p_provider TEXT,
    p_provider_event_id TEXT,
    p_payment_status TEXT,
    p_order_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_release_inventory BOOLEAN DEFAULT FALSE,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_json JSONB;
    v_order RECORD;
    v_payment_transaction_id UUID;
    v_attempt_status TEXT := CASE WHEN p_payment_status = 'refunded' THEN 'succeeded' ELSE 'failed' END;
BEGIN
    v_order_json := record_order_payment_failure(
        p_order_id,
        p_provider,
        p_provider_event_id,
        p_payment_status,
        p_order_status,
        p_reason,
        p_release_inventory,
        p_request_id
    );

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    UPDATE payment_transactions
       SET status = CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
           provider_event_id = p_provider_event_id,
           failure_reason = p_reason,
           refunded_at = CASE WHEN p_payment_status = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND gateway = p_provider
       AND deleted_at IS NULL
     RETURNING id INTO v_payment_transaction_id;

    IF v_payment_transaction_id IS NULL THEN
        INSERT INTO payment_transactions (
            order_id,
            store_id,
            site_id,
            gateway,
            amount,
            currency,
            status,
            failure_reason,
            provider_event_id,
            payment_method,
            metadata,
            request_id,
            idempotency_key,
            refunded_at
        )
        VALUES (
            p_order_id,
            v_order.store_id,
            v_order.store_id,
            p_provider,
            COALESCE(v_order.total, 0),
            COALESCE(v_order.currency, 'INR'),
            CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
            p_reason,
            p_provider_event_id,
            p_provider,
            jsonb_build_object('source', 'payment_failure'),
            p_request_id,
            p_idempotency_key,
            CASE WHEN p_payment_status = 'refunded' THEN NOW() ELSE NULL END
        )
        RETURNING id INTO v_payment_transaction_id;
    END IF;

    INSERT INTO payment_attempts (
        site_id,
        order_id,
        payment_transaction_id,
        provider,
        attempt_type,
        status,
        amount,
        currency,
        provider_event_id,
        idempotency_key,
        request_id,
        failure_reason,
        metadata
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        p_provider,
        'failure',
        v_attempt_status,
        COALESCE(v_order.total, 0),
        COALESCE(v_order.currency, 'INR'),
        p_provider_event_id,
        p_idempotency_key,
        p_request_id,
        p_reason,
        jsonb_build_object('payment_status', p_payment_status, 'order_status', p_order_status)
    )
    ON CONFLICT DO NOTHING;

    RETURN v_order_json;
END;
$$;

REVOKE ALL ON FUNCTION record_order_payment_failure_with_ledger(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_order_payment_failure_with_ledger(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT)
    TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Inventory release wrapper that records release ledger events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_order_inventory_with_ledger(
    p_order_id UUID,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_release_reason TEXT DEFAULT 'order_cancelled'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_released BOOLEAN;
    v_site_id UUID;
BEGIN
    SELECT store_id
      INTO v_site_id
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL;

    IF v_site_id IS NULL THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    v_released := release_order_inventory(
        p_order_id,
        p_actor_id,
        p_request_id,
        p_release_reason
    );

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
        v_site_id,
        il.id,
        r.location_id,
        oi.product_id,
        oi.variant_id,
        p_order_id,
        r.id,
        'sale_released',
        oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        0,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        p_order_id,
        'inventory.sale_released:' || p_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('release_reason', p_release_reason),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND (
           (r.variant_id IS NULL AND oi.variant_id IS NULL)
           OR r.variant_id = oi.variant_id
       )
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
           (il.variant_id IS NULL AND oi.variant_id IS NULL)
           OR il.variant_id = oi.variant_id
       )
     WHERE oi.order_id = p_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION release_order_inventory_with_ledger(UUID, UUID, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_order_inventory_with_ledger(UUID, UUID, TEXT, TEXT)
    TO service_role;
