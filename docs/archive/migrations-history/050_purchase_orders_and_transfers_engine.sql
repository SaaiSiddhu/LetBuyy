-- ============================================================================
-- Migration 050: Purchase Orders and Inventory Transfers Engine
-- Warehouse-side inventory lifecycle: suppliers, purchasing, receiving, transfer.
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suppliers_site_status
    ON suppliers(site_id, status, name)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    po_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled', 'closed')),
    ordered_at TIMESTAMPTZ,
    expected_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    currency TEXT NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, po_number),
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_site_status
    ON purchase_orders(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
    quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ordered'
        CHECK (status IN ('ordered', 'partially_received', 'received', 'cancelled')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po
    ON purchase_order_lines(purchase_order_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS purchase_order_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    purchase_order_line_id UUID REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
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

CREATE INDEX IF NOT EXISTS idx_purchase_order_receipts_po
    ON purchase_order_receipts(purchase_order_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    transfer_number TEXT NOT NULL,
    source_location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'shipped', 'partially_received', 'received', 'cancelled')),
    shipped_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, transfer_number),
    UNIQUE(site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_site_status
    ON inventory_transfers(site_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_shipped INTEGER NOT NULL DEFAULT 0 CHECK (quantity_shipped >= 0),
    quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    status TEXT NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'shipped', 'partially_received', 'received', 'cancelled')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfer_lines_transfer
    ON inventory_transfer_lines(transfer_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS inventory_transfer_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    transfer_line_id UUID REFERENCES inventory_transfer_lines(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    source_location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    destination_location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
    quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
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

CREATE INDEX IF NOT EXISTS idx_inventory_transfer_receipts_transfer
    ON inventory_transfer_receipts(transfer_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_receipts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'suppliers',
        'purchase_orders',
        'purchase_order_lines',
        'purchase_order_receipts',
        'inventory_transfers',
        'inventory_transfer_lines',
        'inventory_transfer_receipts'
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
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || table_name || '_updated_at', table_name);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
            'trg_' || table_name || '_updated_at',
            table_name
        );
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION ensure_inventory_level_for_location(
    p_product_id UUID,
    p_variant_id UUID,
    p_location_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_level_id UUID;
BEGIN
    SELECT id
      INTO v_level_id
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND ((p_variant_id IS NULL AND variant_id IS NULL) OR variant_id = p_variant_id)
       AND location_id = p_location_id
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1
     FOR UPDATE;

    IF v_level_id IS NULL THEN
        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            on_hand_quantity,
            available_quantity,
            incoming_quantity,
            reserved_quantity
        )
        VALUES (
            p_product_id,
            p_variant_id,
            p_location_id,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        )
        RETURNING id INTO v_level_id;
    END IF;

    RETURN v_level_id;
END;
$$;

REVOKE ALL ON FUNCTION ensure_inventory_level_for_location(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_inventory_level_for_location(UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION create_purchase_order_with_lines(
    p_site_id UUID,
    p_supplier_id UUID,
    p_location_id UUID,
    p_lines JSONB,
    p_expected_at TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
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
    v_po_id UUID;
    v_existing_id UUID;
    v_line RECORD;
    v_product RECORD;
    v_level_id UUID;
    v_po_number TEXT;
    v_subtotal NUMERIC(12,2) := 0;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'purchase order lines are required';
    END IF;

    SELECT id INTO v_existing_id
    FROM purchase_orders
    WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('purchase_order_id', v_existing_id, 'idempotent_replay', true);
    END IF;

    IF p_supplier_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM suppliers WHERE id = p_supplier_id AND site_id = p_site_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'supplier not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM inventory_locations WHERE id = p_location_id AND store_id = p_site_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'inventory location not found';
    END IF;

    v_po_number := 'PO-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

    INSERT INTO purchase_orders (
        site_id, supplier_id, location_id, po_number, status, ordered_at, expected_at,
        notes, idempotency_key, request_id, created_by
    )
    VALUES (
        p_site_id, p_supplier_id, p_location_id, v_po_number, 'ordered', NOW(), p_expected_at,
        p_notes, p_idempotency_key, p_request_id, p_actor_id
    )
    RETURNING id INTO v_po_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(product_id UUID, variant_id UUID, quantity INTEGER, unit_cost NUMERIC)
    LOOP
        IF COALESCE(v_line.quantity, 0) <= 0 THEN
            RAISE EXCEPTION 'purchase order quantity must be positive';
        END IF;

        SELECT id, store_id INTO v_product
        FROM products
        WHERE id = v_line.product_id AND store_id = p_site_id AND deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product % not found for site', v_line.product_id;
        END IF;

        v_level_id := ensure_inventory_level_for_location(v_line.product_id, v_line.variant_id, p_location_id);

        INSERT INTO purchase_order_lines (
            site_id, purchase_order_id, product_id, variant_id, location_id,
            quantity_ordered, unit_cost, total_cost, status, created_by
        )
        VALUES (
            p_site_id, v_po_id, v_line.product_id, v_line.variant_id, p_location_id,
            v_line.quantity, COALESCE(v_line.unit_cost, 0), COALESCE(v_line.unit_cost, 0) * v_line.quantity,
            'ordered', p_actor_id
        );

        UPDATE inventory_levels
           SET incoming = incoming + v_line.quantity,
               incoming_quantity = COALESCE(incoming_quantity, incoming) + v_line.quantity,
               updated_at = NOW()
         WHERE id = v_level_id;

        INSERT INTO inventory_events (
            site_id, inventory_level_id, location_id, product_id, variant_id,
            event_type, quantity_delta, on_hand_quantity, available_quantity,
            committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
            safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
        )
        SELECT
            p_site_id, il.id, p_location_id, v_line.product_id, v_line.variant_id,
            'po_ordered', v_line.quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
            COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
            COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
            COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
            'purchase_order', v_po_id, 'inventory.po_ordered:' || v_po_id::TEXT || ':' || v_line.product_id::TEXT || ':' || COALESCE(v_line.variant_id::TEXT, 'default'),
            p_request_id, jsonb_build_object('quantity_ordered', v_line.quantity), p_actor_id
        FROM inventory_levels il WHERE il.id = v_level_id
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        v_subtotal := v_subtotal + (COALESCE(v_line.unit_cost, 0) * v_line.quantity);
    END LOOP;

    UPDATE purchase_orders
       SET subtotal = v_subtotal, total = v_subtotal, updated_at = NOW()
     WHERE id = v_po_id;

    INSERT INTO outbox_events (
        site_id, store_id, aggregate_type, aggregate_id, event_type, payload,
        idempotency_key, request_id, trace_id, schema_version, actor_id
    )
    VALUES (
        p_site_id, p_site_id, 'purchase_order', v_po_id::TEXT, 'purchase_order.ordered',
        jsonb_build_object('site_id', p_site_id, 'purchase_order_id', v_po_id, 'total', v_subtotal),
        'purchase_order.ordered:' || v_po_id::TEXT, p_request_id, p_request_id, 1, p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'purchase_order', (SELECT to_jsonb(po) FROM purchase_orders po WHERE po.id = v_po_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(pol)), '[]'::JSONB) FROM purchase_order_lines pol WHERE pol.purchase_order_id = v_po_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION create_purchase_order_with_lines(UUID, UUID, UUID, JSONB, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_purchase_order_with_lines(UUID, UUID, UUID, JSONB, TIMESTAMPTZ, TEXT, UUID, TEXT, TEXT) TO service_role;

-- Forward declaration replaced by the full implementation below. This keeps
-- check_function_bodies enabled when receive_purchase_order is created.
CREATE OR REPLACE FUNCTION receive_purchase_order_line(
    p_po purchase_orders,
    p_line purchase_order_lines,
    p_quantity INTEGER,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'receive_purchase_order_line forward declaration was not replaced';
END;
$$;

CREATE OR REPLACE FUNCTION receive_purchase_order(
    p_purchase_order_id UUID,
    p_lines JSONB DEFAULT NULL,
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
    v_po purchase_orders%ROWTYPE;
    v_line_input RECORD;
    v_line purchase_order_lines%ROWTYPE;
    v_receive_qty INTEGER;
    v_level_id UUID;
    v_all_received BOOLEAN;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT * INTO v_po
    FROM purchase_orders
    WHERE id = p_purchase_order_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.status IN ('received', 'cancelled', 'closed') THEN
        RAISE EXCEPTION 'purchase order cannot be received from status %', v_po.status;
    END IF;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line_input IN
            SELECT * FROM jsonb_to_recordset(p_lines) AS x(purchase_order_line_id UUID, quantity INTEGER)
        LOOP
            SELECT * INTO v_line
            FROM purchase_order_lines
            WHERE id = v_line_input.purchase_order_line_id
              AND purchase_order_id = p_purchase_order_id
              AND deleted_at IS NULL
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'purchase order line not found';
            END IF;

            v_receive_qty := COALESCE(v_line_input.quantity, 0);
            IF v_receive_qty <= 0 OR v_receive_qty > (v_line.quantity_ordered - v_line.quantity_received) THEN
                RAISE EXCEPTION 'invalid receive quantity for purchase order line %', v_line.id;
            END IF;

            PERFORM receive_purchase_order_line(v_po, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
        END LOOP;
    ELSE
        FOR v_line IN
            SELECT * FROM purchase_order_lines
            WHERE purchase_order_id = p_purchase_order_id AND deleted_at IS NULL
            FOR UPDATE
        LOOP
            v_receive_qty := v_line.quantity_ordered - v_line.quantity_received;
            IF v_receive_qty > 0 THEN
                PERFORM receive_purchase_order_line(v_po, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
            END IF;
        END LOOP;
    END IF;

    SELECT COALESCE(bool_and(quantity_received >= quantity_ordered), FALSE)
      INTO v_all_received
      FROM purchase_order_lines
     WHERE purchase_order_id = p_purchase_order_id AND deleted_at IS NULL;

    UPDATE purchase_orders
       SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END,
           received_at = CASE WHEN v_all_received THEN COALESCE(received_at, NOW()) ELSE received_at END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_purchase_order_id;

    RETURN jsonb_build_object(
        'purchase_order', (SELECT to_jsonb(po) FROM purchase_orders po WHERE po.id = p_purchase_order_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(pol)), '[]'::JSONB) FROM purchase_order_lines pol WHERE pol.purchase_order_id = p_purchase_order_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION receive_purchase_order_line(
    p_po purchase_orders,
    p_line purchase_order_lines,
    p_quantity INTEGER,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_level_id UUID;
BEGIN
    v_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_line.location_id);

    UPDATE purchase_order_lines
       SET quantity_received = quantity_received + p_quantity,
           status = CASE WHEN quantity_received + p_quantity >= quantity_ordered THEN 'received' ELSE 'partially_received' END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_line.id;

    UPDATE inventory_levels
       SET available = available + p_quantity,
           incoming = GREATEST(incoming - p_quantity, 0),
           available_quantity = COALESCE(available_quantity, available) + p_quantity,
           incoming_quantity = GREATEST(COALESCE(incoming_quantity, incoming) - p_quantity, 0),
           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + p_quantity,
           updated_at = NOW()
     WHERE id = v_level_id;

    INSERT INTO purchase_order_receipts (
        site_id, purchase_order_id, purchase_order_line_id, product_id, variant_id, location_id,
        quantity_received, idempotency_key, request_id, created_by
    )
    VALUES (
        p_po.site_id, p_po.id, p_line.id, p_line.product_id, p_line.variant_id, p_line.location_id,
        p_quantity, p_idempotency_key || ':line:' || p_line.id::TEXT, p_request_id, p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id,
        event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_po.site_id, il.id, p_line.location_id, p_line.product_id, p_line.variant_id,
        'po_received', p_quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
        COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
        'purchase_order', p_po.id, 'inventory.po_received:' || p_line.id::TEXT || ':' || p_idempotency_key,
        p_request_id, jsonb_build_object('quantity_received', p_quantity), p_actor_id
    FROM inventory_levels il WHERE il.id = v_level_id
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION receive_purchase_order(UUID, JSONB, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_purchase_order(UUID, JSONB, UUID, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION receive_purchase_order_line(purchase_orders, purchase_order_lines, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_purchase_order_line(purchase_orders, purchase_order_lines, INTEGER, UUID, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION create_inventory_transfer_with_lines(
    p_site_id UUID,
    p_source_location_id UUID,
    p_destination_location_id UUID,
    p_lines JSONB,
    p_notes TEXT DEFAULT NULL,
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
    v_transfer_id UUID;
    v_existing_id UUID;
    v_line RECORD;
    v_product RECORD;
    v_source_level_id UUID;
    v_transfer_number TEXT;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_source_location_id = p_destination_location_id THEN
        RAISE EXCEPTION 'source and destination locations must be different';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'transfer lines are required';
    END IF;

    SELECT id INTO v_existing_id
    FROM inventory_transfers
    WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('transfer_id', v_existing_id, 'idempotent_replay', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM inventory_locations WHERE id = p_source_location_id AND store_id = p_site_id AND deleted_at IS NULL)
       OR NOT EXISTS (SELECT 1 FROM inventory_locations WHERE id = p_destination_location_id AND store_id = p_site_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'transfer locations must belong to site';
    END IF;

    v_transfer_number := 'TR-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

    INSERT INTO inventory_transfers (
        site_id, transfer_number, source_location_id, destination_location_id, status,
        notes, idempotency_key, request_id, created_by
    )
    VALUES (
        p_site_id, v_transfer_number, p_source_location_id, p_destination_location_id, 'reserved',
        p_notes, p_idempotency_key, p_request_id, p_actor_id
    )
    RETURNING id INTO v_transfer_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF COALESCE(v_line.quantity, 0) <= 0 THEN
            RAISE EXCEPTION 'transfer quantity must be positive';
        END IF;

        SELECT id INTO v_product
        FROM products
        WHERE id = v_line.product_id AND store_id = p_site_id AND deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product % not found for site', v_line.product_id;
        END IF;

        v_source_level_id := ensure_inventory_level_for_location(v_line.product_id, v_line.variant_id, p_source_location_id);

        IF NOT EXISTS (
            SELECT 1 FROM inventory_levels
            WHERE id = v_source_level_id AND available >= v_line.quantity
            FOR UPDATE
        ) THEN
            RAISE EXCEPTION 'insufficient source inventory for product %', v_line.product_id;
        END IF;

        UPDATE inventory_levels
           SET available = available - v_line.quantity,
               reserved = reserved + v_line.quantity,
               available_quantity = GREATEST(COALESCE(available_quantity, available) - v_line.quantity, 0),
               reserved_quantity = COALESCE(reserved_quantity, reserved) + v_line.quantity,
               updated_at = NOW()
         WHERE id = v_source_level_id;

        INSERT INTO inventory_transfer_lines (
            site_id, transfer_id, product_id, variant_id, quantity_requested, quantity_shipped, status, created_by
        )
        VALUES (
            p_site_id, v_transfer_id, v_line.product_id, v_line.variant_id, v_line.quantity, 0, 'reserved', p_actor_id
        );

        INSERT INTO inventory_events (
            site_id, inventory_level_id, location_id, product_id, variant_id,
            event_type, quantity_delta, on_hand_quantity, available_quantity,
            committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
            safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
        )
        SELECT
            p_site_id, il.id, p_source_location_id, v_line.product_id, v_line.variant_id,
            'transfer_reserved', -v_line.quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
            COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
            COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
            COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
            'inventory_transfer', v_transfer_id, 'inventory.transfer_reserved:' || v_transfer_id::TEXT || ':' || v_line.product_id::TEXT || ':' || COALESCE(v_line.variant_id::TEXT, 'default'),
            p_request_id, jsonb_build_object('source_location_id', p_source_location_id, 'destination_location_id', p_destination_location_id),
            p_actor_id
        FROM inventory_levels il WHERE il.id = v_source_level_id
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object(
        'transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = v_transfer_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(tl)), '[]'::JSONB) FROM inventory_transfer_lines tl WHERE tl.transfer_id = v_transfer_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION create_inventory_transfer_with_lines(UUID, UUID, UUID, JSONB, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_inventory_transfer_with_lines(UUID, UUID, UUID, JSONB, TEXT, UUID, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION ship_inventory_transfer(
    p_transfer_id UUID,
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
    v_transfer RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM inventory_transfers
    WHERE id = p_transfer_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_transfer.status NOT IN ('reserved', 'shipped') THEN
        RAISE EXCEPTION 'transfer cannot be shipped from status %', v_transfer.status;
    END IF;

    UPDATE inventory_transfer_lines
       SET quantity_shipped = quantity_requested,
           status = 'shipped',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE transfer_id = p_transfer_id
       AND deleted_at IS NULL;

    UPDATE inventory_transfers
       SET status = 'shipped',
           shipped_at = COALESCE(shipped_at, NOW()),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_transfer_id;

    RETURN jsonb_build_object('transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = p_transfer_id));
END;
$$;

REVOKE ALL ON FUNCTION ship_inventory_transfer(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ship_inventory_transfer(UUID, UUID, TEXT, TEXT) TO service_role;

-- Forward declaration replaced by the full implementation below. This keeps
-- check_function_bodies enabled when receive_inventory_transfer is created.
CREATE OR REPLACE FUNCTION receive_inventory_transfer_line(
    p_transfer inventory_transfers,
    p_line inventory_transfer_lines,
    p_quantity INTEGER,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'receive_inventory_transfer_line forward declaration was not replaced';
END;
$$;

CREATE OR REPLACE FUNCTION receive_inventory_transfer(
    p_transfer_id UUID,
    p_lines JSONB DEFAULT NULL,
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
    v_transfer inventory_transfers%ROWTYPE;
    v_line inventory_transfer_lines%ROWTYPE;
    v_input RECORD;
    v_receive_qty INTEGER;
    v_source_level_id UUID;
    v_dest_level_id UUID;
    v_all_received BOOLEAN;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    SELECT * INTO v_transfer
    FROM inventory_transfers
    WHERE id = p_transfer_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transfer not found';
    END IF;

    IF v_transfer.status NOT IN ('reserved', 'shipped', 'partially_received') THEN
        RAISE EXCEPTION 'transfer cannot be received from status %', v_transfer.status;
    END IF;

    IF v_transfer.status = 'reserved' THEN
        PERFORM ship_inventory_transfer(p_transfer_id, p_actor_id, p_request_id, p_idempotency_key || ':auto_ship');
    END IF;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_input IN
            SELECT * FROM jsonb_to_recordset(p_lines) AS x(transfer_line_id UUID, quantity INTEGER)
        LOOP
            SELECT * INTO v_line
            FROM inventory_transfer_lines
            WHERE id = v_input.transfer_line_id AND transfer_id = p_transfer_id AND deleted_at IS NULL
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'transfer line not found';
            END IF;

            v_receive_qty := COALESCE(v_input.quantity, 0);
            IF v_receive_qty <= 0 OR v_receive_qty > (v_line.quantity_shipped - v_line.quantity_received) THEN
                RAISE EXCEPTION 'invalid receive quantity for transfer line %', v_line.id;
            END IF;

            PERFORM receive_inventory_transfer_line(v_transfer, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
        END LOOP;
    ELSE
        FOR v_line IN
            SELECT * FROM inventory_transfer_lines
            WHERE transfer_id = p_transfer_id AND deleted_at IS NULL
            FOR UPDATE
        LOOP
            v_receive_qty := v_line.quantity_shipped - v_line.quantity_received;
            IF v_receive_qty > 0 THEN
                PERFORM receive_inventory_transfer_line(v_transfer, v_line, v_receive_qty, p_actor_id, p_request_id, p_idempotency_key);
            END IF;
        END LOOP;
    END IF;

    SELECT COALESCE(bool_and(quantity_received >= quantity_requested), FALSE)
      INTO v_all_received
      FROM inventory_transfer_lines
     WHERE transfer_id = p_transfer_id AND deleted_at IS NULL;

    UPDATE inventory_transfers
       SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partially_received' END,
           received_at = CASE WHEN v_all_received THEN COALESCE(received_at, NOW()) ELSE received_at END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
        'transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = p_transfer_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(tl)), '[]'::JSONB) FROM inventory_transfer_lines tl WHERE tl.transfer_id = p_transfer_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION receive_inventory_transfer_line(
    p_transfer inventory_transfers,
    p_line inventory_transfer_lines,
    p_quantity INTEGER,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source_level_id UUID;
    v_dest_level_id UUID;
BEGIN
    v_source_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_transfer.source_location_id);
    v_dest_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_transfer.destination_location_id);

    UPDATE inventory_transfer_lines
       SET quantity_received = quantity_received + p_quantity,
           status = CASE WHEN quantity_received + p_quantity >= quantity_requested THEN 'received' ELSE 'partially_received' END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_line.id;

    UPDATE inventory_levels
       SET reserved = GREATEST(reserved - p_quantity, 0),
           reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - p_quantity, 0),
           updated_at = NOW()
     WHERE id = v_source_level_id;

    UPDATE inventory_levels
       SET available = available + p_quantity,
           available_quantity = COALESCE(available_quantity, available) + p_quantity,
           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + p_quantity,
           updated_at = NOW()
     WHERE id = v_dest_level_id;

    INSERT INTO inventory_transfer_receipts (
        site_id, transfer_id, transfer_line_id, product_id, variant_id,
        source_location_id, destination_location_id, quantity_received,
        idempotency_key, request_id, created_by
    )
    VALUES (
        p_transfer.site_id, p_transfer.id, p_line.id, p_line.product_id, p_line.variant_id,
        p_transfer.source_location_id, p_transfer.destination_location_id, p_quantity,
        p_idempotency_key || ':line:' || p_line.id::TEXT, p_request_id, p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id,
        event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_transfer.site_id, il.id, p_transfer.destination_location_id, p_line.product_id, p_line.variant_id,
        'transfer_received', p_quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
        COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
        'inventory_transfer', p_transfer.id, 'inventory.transfer_received:' || p_line.id::TEXT || ':' || p_idempotency_key,
        p_request_id, jsonb_build_object('quantity_received', p_quantity), p_actor_id
    FROM inventory_levels il WHERE il.id = v_dest_level_id
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION receive_inventory_transfer(UUID, JSONB, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_inventory_transfer(UUID, JSONB, UUID, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION receive_inventory_transfer_line(inventory_transfers, inventory_transfer_lines, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_inventory_transfer_line(inventory_transfers, inventory_transfer_lines, INTEGER, UUID, TEXT, TEXT) TO service_role;
