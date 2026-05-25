-- ============================================================================
-- Migration 049: Fulfillment, Shipment, Return, and Refund Engine
-- Adds operational state machines around shipped goods and post-purchase flows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Order item and order compatibility columns
-- ---------------------------------------------------------------------------

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS refunded_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON order_items;
CREATE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'none'
    CHECK (return_status IN ('none', 'requested', 'authorized', 'received', 'refunded', 'closed', 'cancelled'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none'
    CHECK (refund_status IN ('none', 'pending', 'processing', 'partially_refunded', 'refunded', 'failed'));

-- ---------------------------------------------------------------------------
-- 2. Fulfillment state machine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fulfillment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'partially_fulfilled', 'fulfilled', 'cancelled')),
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    assigned_at TIMESTAMPTZ,
    picked_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_site_status
    ON fulfillment_orders(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_order
    ON fulfillment_orders(order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS fulfillment_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    fulfillment_order_id UUID NOT NULL REFERENCES fulfillment_orders(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    fulfilled_quantity INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_quantity >= 0),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'picked', 'packed', 'shipped', 'fulfilled', 'cancelled')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_order_lines_fulfillment
    ON fulfillment_order_lines(fulfillment_order_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fulfillment_order_lines_order_item
    ON fulfillment_order_lines(order_item_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    fulfillment_order_id UUID REFERENCES fulfillment_orders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'label_created'
        CHECK (status IN ('label_created', 'ready_to_ship', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled')),
    carrier TEXT,
    tracking_number TEXT,
    tracking_url TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
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

CREATE INDEX IF NOT EXISTS idx_shipments_order
    ON shipments(order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_tracking
    ON shipments(site_id, carrier, tracking_number)
    WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS shipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('label_created', 'picked', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled', 'tracking_updated')),
    status TEXT NOT NULL,
    description TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment
    ON shipment_events(shipment_id, occurred_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Return and refund state machine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'authorized', 'rejected', 'received', 'inspected', 'approved', 'refunded', 'closed', 'cancelled')),
    customer_email TEXT,
    reason TEXT,
    refund_method TEXT NOT NULL DEFAULT 'original_payment'
        CHECK (refund_method IN ('original_payment', 'gift_card', 'manual')),
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    authorized_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    inspected_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_returns_order
    ON returns(order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_returns_site_status
    ON returns(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS return_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    restock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (restock_quantity >= 0),
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    reason TEXT,
    condition TEXT DEFAULT 'sellable'
        CHECK (condition IN ('sellable', 'opened', 'damaged', 'missing', 'unknown')),
    disposition TEXT DEFAULT 'restock'
        CHECK (disposition IN ('restock', 'scrap', 'return_to_vendor', 'no_restock')),
    status TEXT NOT NULL DEFAULT 'authorized'
        CHECK (status IN ('requested', 'authorized', 'received', 'inspected', 'restocked', 'refunded', 'rejected')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_return_lines_return
    ON return_lines(return_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
    refund_method TEXT NOT NULL DEFAULT 'original_payment'
        CHECK (refund_method IN ('original_payment', 'gift_card', 'manual')),
    provider TEXT,
    provider_refund_id TEXT,
    provider_event_id TEXT,
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order
    ON refunds(order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_site_status
    ON refunds(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refund_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    return_line_id UUID REFERENCES return_lines(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refund_lines_refund
    ON refund_lines(refund_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS restock_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
    return_line_id UUID REFERENCES return_lines(id) ON DELETE SET NULL,
    inventory_level_id UUID REFERENCES inventory_levels(id) ON DELETE SET NULL,
    location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'committed'
        CHECK (status IN ('pending', 'committed', 'voided')),
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

CREATE INDEX IF NOT EXISTS idx_restock_events_return
    ON restock_events(return_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. RLS and triggers
-- ---------------------------------------------------------------------------

ALTER TABLE fulfillment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'fulfillment_orders',
        'fulfillment_order_lines',
        'shipments',
        'shipment_events',
        'returns',
        'return_lines',
        'refunds',
        'refund_lines',
        'restock_events'
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

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'fulfillment_orders',
        'fulfillment_order_lines',
        'shipments',
        'shipment_events',
        'returns',
        'return_lines',
        'refunds',
        'refund_lines',
        'restock_events'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || table_name || '_updated_at', table_name);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
            'trg_' || table_name || '_updated_at',
            table_name
        );
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Fulfillment RPC: pick/pack/ship in one idempotent admin operation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_order_fulfillment(
    p_order_id UUID,
    p_lines JSONB DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_carrier TEXT DEFAULT NULL,
    p_tracking_number TEXT DEFAULT NULL,
    p_tracking_url TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_existing_id UUID;
    v_fulfillment_id UUID;
    v_shipment_id UUID;
    v_line RECORD;
    v_item RECORD;
    v_quantity INTEGER;
    v_remaining INTEGER;
    v_line_count INTEGER := 0;
    v_all_fulfilled BOOLEAN := FALSE;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order cannot be fulfilled from status %', v_order.status;
    END IF;

    SELECT id
      INTO v_existing_id
      FROM fulfillment_orders
     WHERE site_id = v_order.store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
            'fulfillment_order_id', v_existing_id,
            'idempotent_replay', true
        );
    END IF;

    INSERT INTO fulfillment_orders (
        site_id,
        order_id,
        location_id,
        status,
        idempotency_key,
        request_id,
        assigned_at,
        picked_at,
        packed_at,
        shipped_at,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        p_location_id,
        'in_progress',
        p_idempotency_key,
        p_request_id,
        NOW(),
        NOW(),
        NOW(),
        CASE WHEN p_tracking_number IS NOT NULL THEN NOW() ELSE NULL END,
        jsonb_build_object('source', 'create_order_fulfillment'),
        p_actor_id
    )
    RETURNING id INTO v_fulfillment_id;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN
            SELECT *
            FROM jsonb_to_recordset(p_lines) AS x(order_item_id UUID, quantity INTEGER)
        LOOP
            SELECT *
              INTO v_item
              FROM order_items
             WHERE id = v_line.order_item_id
               AND order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'order item % not found', v_line.order_item_id;
            END IF;

            v_quantity := COALESCE(v_line.quantity, 0);
            v_remaining := v_item.quantity - COALESCE(v_item.fulfilled_quantity, 0);

            IF v_quantity <= 0 OR v_quantity > v_remaining THEN
                RAISE EXCEPTION 'invalid fulfillment quantity for order item %', v_item.id;
            END IF;

            INSERT INTO fulfillment_order_lines (
                site_id,
                fulfillment_order_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                fulfilled_quantity,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_fulfillment_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_quantity,
                CASE WHEN p_tracking_number IS NOT NULL THEN 'shipped' ELSE 'packed' END,
                p_actor_id
            );

            UPDATE order_items
               SET fulfilled_quantity = COALESCE(fulfilled_quantity, 0) + v_quantity,
                   fulfillment_status = CASE
                       WHEN COALESCE(fulfilled_quantity, 0) + v_quantity >= quantity THEN 'fulfilled'
                       ELSE 'partial'
                   END,
                   updated_at = NOW()
             WHERE id = v_item.id;

            v_line_count := v_line_count + 1;
        END LOOP;
    ELSE
        FOR v_item IN
            SELECT *
              FROM order_items
             WHERE order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE
        LOOP
            v_quantity := v_item.quantity - COALESCE(v_item.fulfilled_quantity, 0);
            IF v_quantity <= 0 THEN
                CONTINUE;
            END IF;

            INSERT INTO fulfillment_order_lines (
                site_id,
                fulfillment_order_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                fulfilled_quantity,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_fulfillment_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_quantity,
                CASE WHEN p_tracking_number IS NOT NULL THEN 'shipped' ELSE 'packed' END,
                p_actor_id
            );

            UPDATE order_items
               SET fulfilled_quantity = COALESCE(fulfilled_quantity, 0) + v_quantity,
                   fulfillment_status = 'fulfilled',
                   updated_at = NOW()
             WHERE id = v_item.id;

            v_line_count := v_line_count + 1;
        END LOOP;
    END IF;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no fulfillable order lines remain';
    END IF;

    SELECT COALESCE(bool_and(COALESCE(fulfilled_quantity, 0) >= quantity), FALSE)
      INTO v_all_fulfilled
      FROM order_items
     WHERE order_id = p_order_id
       AND deleted_at IS NULL;

    UPDATE fulfillment_orders
       SET status = CASE WHEN v_all_fulfilled THEN 'fulfilled' ELSE 'partially_fulfilled' END,
           shipped_at = CASE WHEN p_tracking_number IS NOT NULL THEN COALESCE(shipped_at, NOW()) ELSE shipped_at END,
           updated_by = p_actor_id,
           updated_at = NOW()
     WHERE id = v_fulfillment_id;

    IF p_tracking_number IS NOT NULL OR p_carrier IS NOT NULL THEN
        INSERT INTO shipments (
            site_id,
            order_id,
            fulfillment_order_id,
            status,
            carrier,
            tracking_number,
            tracking_url,
            shipped_at,
            idempotency_key,
            request_id,
            created_by
        )
        VALUES (
            v_order.store_id,
            p_order_id,
            v_fulfillment_id,
            'shipped',
            p_carrier,
            p_tracking_number,
            p_tracking_url,
            NOW(),
            p_idempotency_key || ':shipment',
            p_request_id,
            p_actor_id
        )
        RETURNING id INTO v_shipment_id;

        INSERT INTO shipment_events (
            site_id,
            shipment_id,
            order_id,
            event_type,
            status,
            description,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            v_order.store_id,
            v_shipment_id,
            p_order_id,
            'shipped',
            'shipped',
            'Shipment marked as shipped',
            p_request_id,
            jsonb_build_object('carrier', p_carrier, 'tracking_number', p_tracking_number),
            p_actor_id
        );
    END IF;

    UPDATE orders
       SET status = CASE WHEN p_tracking_number IS NOT NULL OR p_carrier IS NOT NULL THEN 'shipped' ELSE 'processing' END,
           fulfillment_status = CASE WHEN v_all_fulfilled THEN 'fulfilled' ELSE 'partial' END,
           tracking_number = COALESCE(p_tracking_number, tracking_number),
           carrier = COALESCE(p_carrier, carrier),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_order_id;

    IF v_all_fulfilled THEN
        UPDATE inventory_reservations
           SET status = 'fulfilled',
               updated_at = NOW()
         WHERE order_id = p_order_id
           AND status = 'committed'
           AND deleted_at IS NULL;
    END IF;

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
        v_order.store_id,
        v_order.store_id,
        'fulfillment_order',
        v_fulfillment_id::TEXT,
        'fulfillment.shipped',
        jsonb_build_object(
            'site_id', v_order.store_id,
            'order_id', p_order_id,
            'fulfillment_order_id', v_fulfillment_id,
            'shipment_id', v_shipment_id,
            'all_fulfilled', v_all_fulfilled
        ),
        'fulfillment.shipped:' || v_fulfillment_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
        'fulfillment_order_id', v_fulfillment_id,
        'shipment_id', v_shipment_id,
        'all_fulfilled', v_all_fulfilled
    );
END;
$$;

REVOKE ALL ON FUNCTION create_order_fulfillment(UUID, JSONB, UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order_fulfillment(UUID, JSONB, UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT)
    TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Return + refund-intent RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_order_return_and_refund(
    p_order_id UUID,
    p_lines JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_refund_method TEXT DEFAULT 'original_payment',
    p_restock BOOLEAN DEFAULT FALSE,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_existing_return_id UUID;
    v_return_id UUID;
    v_refund_id UUID;
    v_refund_transaction_id UUID;
    v_payment_transaction_id UUID;
    v_line RECORD;
    v_item RECORD;
    v_quantity INTEGER;
    v_restock_quantity INTEGER;
    v_returnable INTEGER;
    v_refund_amount NUMERIC(12,2);
    v_total_refund NUMERIC(12,2) := 0;
    v_return_line_id UUID;
    v_level_id UUID;
    v_location_id UUID;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_refund_method NOT IN ('original_payment', 'gift_card', 'manual') THEN
        RAISE EXCEPTION 'unsupported refund method: %', p_refund_method;
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order cannot be returned from status %', v_order.status;
    END IF;

    SELECT id
      INTO v_existing_return_id
      FROM returns
     WHERE site_id = v_order.store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_return_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
            'return_id', v_existing_return_id,
            'idempotent_replay', true
        );
    END IF;

    SELECT id
      INTO v_payment_transaction_id
      FROM payment_transactions
     WHERE order_id = p_order_id
       AND site_id = v_order.store_id
       AND status IN ('captured', 'completed', 'partially_refunded')
       AND deleted_at IS NULL
     ORDER BY captured_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    INSERT INTO returns (
        site_id,
        order_id,
        status,
        customer_email,
        reason,
        refund_method,
        idempotency_key,
        request_id,
        authorized_at,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        'approved',
        v_order.customer_email,
        p_reason,
        p_refund_method,
        p_idempotency_key,
        p_request_id,
        NOW(),
        jsonb_build_object('restock_requested', p_restock),
        p_actor_id
    )
    RETURNING id INTO v_return_id;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN
            SELECT *
            FROM jsonb_to_recordset(p_lines) AS x(order_item_id UUID, quantity INTEGER, restock_quantity INTEGER)
        LOOP
            SELECT *
              INTO v_item
              FROM order_items
             WHERE id = v_line.order_item_id
               AND order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'order item % not found', v_line.order_item_id;
            END IF;

            v_quantity := COALESCE(v_line.quantity, 0);
            v_returnable := GREATEST(COALESCE(v_item.fulfilled_quantity, 0), v_item.quantity) - COALESCE(v_item.returned_quantity, 0);

            IF v_quantity <= 0 OR v_quantity > v_returnable THEN
                RAISE EXCEPTION 'invalid return quantity for order item %', v_item.id;
            END IF;

            v_refund_amount := ROUND(COALESCE(v_item.unit_price, 0) * v_quantity, 2);
            v_total_refund := v_total_refund + v_refund_amount;
            v_restock_quantity := CASE
                WHEN p_restock THEN LEAST(COALESCE(v_line.restock_quantity, v_quantity), v_quantity)
                ELSE 0
            END;

            INSERT INTO return_lines (
                site_id,
                return_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                received_quantity,
                restock_quantity,
                refund_amount,
                reason,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_return_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_restock_quantity,
                v_restock_quantity,
                v_refund_amount,
                p_reason,
                CASE WHEN p_restock THEN 'restocked' ELSE 'authorized' END,
                p_actor_id
            )
            RETURNING id INTO v_return_line_id;

            UPDATE order_items
               SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity,
                   refunded_quantity = COALESCE(refunded_quantity, 0) + v_quantity,
                   fulfillment_status = CASE
                       WHEN COALESCE(returned_quantity, 0) + v_quantity >= quantity THEN 'returned'
                       ELSE fulfillment_status
                   END,
                   updated_at = NOW()
             WHERE id = v_item.id;

            IF v_restock_quantity > 0 THEN
                SELECT il.id, il.location_id
                  INTO v_level_id, v_location_id
                  FROM inventory_levels il
                  JOIN inventory_locations loc ON loc.id = il.location_id
                 WHERE il.product_id = v_item.product_id
                   AND ((v_item.variant_id IS NULL AND il.variant_id IS NULL) OR il.variant_id = v_item.variant_id)
                   AND loc.store_id = v_order.store_id
                   AND loc.status = 'active'
                   AND loc.deleted_at IS NULL
                 ORDER BY loc.is_default DESC, il.updated_at ASC
                 LIMIT 1
                 FOR UPDATE OF il;

                IF v_level_id IS NOT NULL THEN
                    UPDATE inventory_levels
                       SET available = available + v_restock_quantity,
                           available_quantity = COALESCE(available_quantity, available) + v_restock_quantity,
                           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + v_restock_quantity,
                           updated_at = NOW()
                     WHERE id = v_level_id;

                    INSERT INTO restock_events (
                        site_id,
                        return_id,
                        return_line_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    VALUES (
                        v_order.store_id,
                        v_return_id,
                        v_return_line_id,
                        v_level_id,
                        v_location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        v_restock_quantity,
                        'committed',
                        'restock.return:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('reason', p_reason),
                        p_actor_id
                    )
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

                    INSERT INTO inventory_events (
                        site_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
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
                        v_order.store_id,
                        il.id,
                        il.location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        'return_restocked',
                        v_restock_quantity,
                        COALESCE(il.on_hand_quantity, il.available + il.reserved),
                        COALESCE(il.available_quantity, il.available),
                        COALESCE(il.committed_quantity, 0),
                        COALESCE(il.unavailable_quantity, 0),
                        COALESCE(il.incoming_quantity, il.incoming),
                        COALESCE(il.reserved_quantity, il.reserved),
                        COALESCE(il.safety_stock_quantity, 0),
                        'return',
                        v_return_id,
                        'inventory.return_restocked:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('return_id', v_return_id, 'return_line_id', v_return_line_id),
                        p_actor_id
                    FROM inventory_levels il
                    WHERE il.id = v_level_id
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    ELSE
        FOR v_item IN
            SELECT *
              FROM order_items
             WHERE order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE
        LOOP
            v_quantity := GREATEST(COALESCE(v_item.fulfilled_quantity, 0), v_item.quantity) - COALESCE(v_item.returned_quantity, 0);
            IF v_quantity <= 0 THEN
                CONTINUE;
            END IF;

            v_refund_amount := ROUND(COALESCE(v_item.unit_price, 0) * v_quantity, 2);
            v_total_refund := v_total_refund + v_refund_amount;
            v_restock_quantity := CASE WHEN p_restock THEN v_quantity ELSE 0 END;

            INSERT INTO return_lines (
                site_id,
                return_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                received_quantity,
                restock_quantity,
                refund_amount,
                reason,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_return_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_restock_quantity,
                v_restock_quantity,
                v_refund_amount,
                p_reason,
                CASE WHEN p_restock THEN 'restocked' ELSE 'authorized' END,
                p_actor_id
            )
            RETURNING id INTO v_return_line_id;

            UPDATE order_items
               SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity,
                   refunded_quantity = COALESCE(refunded_quantity, 0) + v_quantity,
                   fulfillment_status = 'returned',
                   updated_at = NOW()
             WHERE id = v_item.id;

            IF v_restock_quantity > 0 THEN
                SELECT il.id, il.location_id
                  INTO v_level_id, v_location_id
                  FROM inventory_levels il
                  JOIN inventory_locations loc ON loc.id = il.location_id
                 WHERE il.product_id = v_item.product_id
                   AND ((v_item.variant_id IS NULL AND il.variant_id IS NULL) OR il.variant_id = v_item.variant_id)
                   AND loc.store_id = v_order.store_id
                   AND loc.status = 'active'
                   AND loc.deleted_at IS NULL
                 ORDER BY loc.is_default DESC, il.updated_at ASC
                 LIMIT 1
                 FOR UPDATE OF il;

                IF v_level_id IS NOT NULL THEN
                    UPDATE inventory_levels
                       SET available = available + v_restock_quantity,
                           available_quantity = COALESCE(available_quantity, available) + v_restock_quantity,
                           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + v_restock_quantity,
                           updated_at = NOW()
                     WHERE id = v_level_id;

                    INSERT INTO restock_events (
                        site_id,
                        return_id,
                        return_line_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    VALUES (
                        v_order.store_id,
                        v_return_id,
                        v_return_line_id,
                        v_level_id,
                        v_location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        v_restock_quantity,
                        'committed',
                        'restock.return:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('reason', p_reason),
                        p_actor_id
                    )
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

                    INSERT INTO inventory_events (
                        site_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
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
                        v_order.store_id,
                        il.id,
                        il.location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        'return_restocked',
                        v_restock_quantity,
                        COALESCE(il.on_hand_quantity, il.available + il.reserved),
                        COALESCE(il.available_quantity, il.available),
                        COALESCE(il.committed_quantity, 0),
                        COALESCE(il.unavailable_quantity, 0),
                        COALESCE(il.incoming_quantity, il.incoming),
                        COALESCE(il.reserved_quantity, il.reserved),
                        COALESCE(il.safety_stock_quantity, 0),
                        'return',
                        v_return_id,
                        'inventory.return_restocked:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('return_id', v_return_id, 'return_line_id', v_return_line_id),
                        p_actor_id
                    FROM inventory_levels il
                    WHERE il.id = v_level_id
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END IF;

    IF v_total_refund <= 0 THEN
        RAISE EXCEPTION 'no refundable amount remains';
    END IF;

    INSERT INTO refunds (
        site_id,
        order_id,
        return_id,
        payment_transaction_id,
        amount,
        currency,
        status,
        refund_method,
        provider,
        idempotency_key,
        request_id,
        reason,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_return_id,
        v_payment_transaction_id,
        v_total_refund,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_refund_method,
        COALESCE(v_order.payment_gateway, v_order.payment_method),
        p_idempotency_key || ':refund',
        p_request_id,
        p_reason,
        jsonb_build_object('restock_requested', p_restock),
        p_actor_id
    )
    RETURNING id INTO v_refund_id;

    INSERT INTO refund_lines (
        site_id,
        refund_id,
        return_line_id,
        order_item_id,
        amount,
        quantity,
        created_by
    )
    SELECT
        v_order.store_id,
        v_refund_id,
        rl.id,
        rl.order_item_id,
        rl.refund_amount,
        rl.quantity,
        p_actor_id
    FROM return_lines rl
    WHERE rl.return_id = v_return_id
      AND rl.deleted_at IS NULL;

    INSERT INTO refund_transactions (
        site_id,
        order_id,
        payment_transaction_id,
        amount,
        currency,
        status,
        refund_method,
        reason,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        v_total_refund,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_refund_method,
        p_reason,
        p_idempotency_key || ':refund_transaction',
        p_request_id,
        jsonb_build_object('return_id', v_return_id, 'refund_id', v_refund_id),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_refund_transaction_id;

    UPDATE returns
       SET metadata = metadata || jsonb_build_object('refund_id', v_refund_id, 'refund_transaction_id', v_refund_transaction_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_return_id;

    UPDATE orders
       SET return_status = 'authorized',
           refund_status = 'pending',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_order_id;

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
        v_order.store_id,
        v_order.store_id,
        'refund',
        v_refund_id::TEXT,
        'refund.requested',
        jsonb_build_object(
            'site_id', v_order.store_id,
            'order_id', p_order_id,
            'return_id', v_return_id,
            'refund_id', v_refund_id,
            'amount', v_total_refund,
            'refund_method', p_refund_method
        ),
        'refund.requested:' || v_refund_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
        'return_id', v_return_id,
        'refund_id', v_refund_id,
        'refund_transaction_id', v_refund_transaction_id,
        'amount', v_total_refund,
        'status', 'pending'
    );
END;
$$;

REVOKE ALL ON FUNCTION create_order_return_and_refund(UUID, JSONB, TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order_return_and_refund(UUID, JSONB, TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT)
    TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Refund completion RPC for manual/provider callbacks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION complete_order_refund(
    p_refund_id UUID,
    p_provider_refund_id TEXT DEFAULT NULL,
    p_provider_event_id TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund RECORD;
    v_order RECORD;
    v_total_succeeded NUMERIC(12,2);
    v_order_total NUMERIC(12,2);
    v_payment_status TEXT;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT *
      INTO v_refund
      FROM refunds
     WHERE id = p_refund_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'refund not found';
    END IF;

    IF v_refund.status = 'succeeded' THEN
        RETURN jsonb_build_object('refund', to_jsonb(v_refund), 'idempotent_replay', true);
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_refund.order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    UPDATE refunds
       SET status = 'succeeded',
           provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_refund_id;

    UPDATE refund_transactions
       SET status = 'succeeded',
           provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND metadata ->> 'refund_id' = p_refund_id::TEXT
       AND deleted_at IS NULL;

    INSERT INTO refund_attempts (
        site_id,
        refund_transaction_id,
        provider,
        status,
        provider_refund_id,
        provider_event_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        rt.site_id,
        rt.id,
        CASE
            WHEN v_refund.provider IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer', 'gift_card') THEN v_refund.provider
            WHEN v_refund.refund_method = 'gift_card' THEN 'gift_card'
            WHEN v_refund.refund_method = 'manual' THEN 'bank_transfer'
            WHEN v_order.payment_gateway IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer') THEN v_order.payment_gateway
            WHEN v_order.payment_method IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer') THEN v_order.payment_method
            ELSE 'bank_transfer'
        END,
        'succeeded',
        p_provider_refund_id,
        p_provider_event_id,
        p_idempotency_key,
        p_request_id,
        jsonb_build_object('refund_id', p_refund_id),
        p_actor_id
    FROM refund_transactions rt
    WHERE rt.order_id = v_refund.order_id
      AND rt.site_id = v_refund.site_id
      AND rt.metadata ->> 'refund_id' = p_refund_id::TEXT
      AND rt.deleted_at IS NULL
    ON CONFLICT DO NOTHING;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_succeeded
      FROM refunds
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND status = 'succeeded'
       AND deleted_at IS NULL;

    v_order_total := COALESCE(v_order.total, 0);
    v_payment_status := CASE WHEN v_total_succeeded >= v_order_total THEN 'refunded' ELSE 'partially_refunded' END;

    UPDATE payment_transactions
       SET status = v_payment_status,
           refunded_at = CASE WHEN v_payment_status = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_refund.payment_transaction_id
       AND deleted_at IS NULL;

    UPDATE returns
       SET status = 'refunded',
           refunded_at = NOW(),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_refund.return_id
       AND deleted_at IS NULL;

    UPDATE orders
       SET refund_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE 'partially_refunded' END,
           payment_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE payment_status END,
           status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE status END,
           return_status = 'refunded',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_refund.order_id;

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
        v_refund.site_id,
        v_refund.site_id,
        'refund',
        p_refund_id::TEXT,
        'refund.succeeded',
        jsonb_build_object(
            'site_id', v_refund.site_id,
            'order_id', v_refund.order_id,
            'refund_id', p_refund_id,
            'amount', v_refund.amount,
            'provider_refund_id', p_provider_refund_id
        ),
        'refund.succeeded:' || p_refund_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_refund.order_id),
        'refund', (SELECT to_jsonb(r) FROM refunds r WHERE r.id = p_refund_id),
        'total_refunded', v_total_succeeded
    );
END;
$$;

REVOKE ALL ON FUNCTION complete_order_refund(UUID, TEXT, TEXT, UUID, TEXT, TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_order_refund(UUID, TEXT, TEXT, UUID, TEXT, TEXT)
    TO service_role;
