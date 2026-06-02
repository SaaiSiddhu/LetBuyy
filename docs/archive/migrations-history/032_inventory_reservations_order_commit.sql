-- ============================================================================
-- Migration 032: Inventory Reservations and Atomic Order Commit
-- Additive replacement for unsafe sequential products.stock decrements.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'committed', 'released', 'expired')),
    idempotency_key TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '20 minutes',
    committed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    release_reason TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_status
    ON inventory_reservations(store_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order
    ON inventory_reservations(order_id)
    WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product_status
    ON inventory_reservations(product_id, variant_id, status);

CREATE TABLE IF NOT EXISTS inventory_level_duplicate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_level_id UUID,
    product_id UUID NOT NULL,
    variant_id UUID,
    location_id UUID NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_level_duplicate_snapshots_product
    ON inventory_level_duplicate_snapshots(product_id, location_id, created_at DESC);

ALTER TABLE inventory_level_duplicate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_level_duplicate_snapshots_service_all
    ON inventory_level_duplicate_snapshots;
CREATE POLICY inventory_level_duplicate_snapshots_service_all
    ON inventory_level_duplicate_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

INSERT INTO inventory_level_duplicate_snapshots (
    inventory_level_id,
    product_id,
    variant_id,
    location_id,
    snapshot
)
SELECT
    ranked.id,
    ranked.product_id,
    ranked.variant_id,
    ranked.location_id,
    to_jsonb(ranked)
FROM (
    SELECT
        il.*,
        ROW_NUMBER() OVER (
            PARTITION BY il.product_id, il.variant_id, il.location_id
            ORDER BY il.updated_at DESC NULLS LAST, il.id ASC
        ) AS inventory_level_rank
    FROM inventory_levels il
) ranked
WHERE ranked.inventory_level_rank > 1
  AND NOT EXISTS (
      SELECT 1
      FROM inventory_level_duplicate_snapshots existing
      WHERE existing.inventory_level_id = ranked.id
  );

WITH ranked AS (
    SELECT
        il.*,
        FIRST_VALUE(il.id) OVER (
            PARTITION BY il.product_id, il.variant_id, il.location_id
            ORDER BY il.updated_at DESC NULLS LAST, il.id ASC
        ) AS keeper_id,
        ROW_NUMBER() OVER (
            PARTITION BY il.product_id, il.variant_id, il.location_id
            ORDER BY il.updated_at DESC NULLS LAST, il.id ASC
        ) AS inventory_level_rank
    FROM inventory_levels il
),
merged AS (
    SELECT
        keeper_id,
        SUM(available) FILTER (WHERE inventory_level_rank > 1) AS available_delta,
        SUM(reserved) FILTER (WHERE inventory_level_rank > 1) AS reserved_delta,
        SUM(incoming) FILTER (WHERE inventory_level_rank > 1) AS incoming_delta
    FROM ranked
    GROUP BY keeper_id
)
UPDATE inventory_levels target
   SET available = target.available + COALESCE(merged.available_delta, 0),
       reserved = target.reserved + COALESCE(merged.reserved_delta, 0),
       incoming = target.incoming + COALESCE(merged.incoming_delta, 0),
       updated_at = NOW()
  FROM merged
 WHERE target.id = merged.keeper_id
   AND (
       COALESCE(merged.available_delta, 0) <> 0
       OR COALESCE(merged.reserved_delta, 0) <> 0
       OR COALESCE(merged.incoming_delta, 0) <> 0
   );

WITH ranked AS (
    SELECT
        il.id,
        ROW_NUMBER() OVER (
            PARTITION BY il.product_id, il.variant_id, il.location_id
            ORDER BY il.updated_at DESC NULLS LAST, il.id ASC
        ) AS inventory_level_rank
    FROM inventory_levels il
)
DELETE FROM inventory_levels target
USING ranked
WHERE target.id = ranked.id
  AND ranked.inventory_level_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_levels_default_variant_unique
    ON inventory_levels(product_id, location_id)
    WHERE variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_levels_variant_unique
    ON inventory_levels(product_id, variant_id, location_id)
    WHERE variant_id IS NOT NULL;

ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_reservations_owner_read ON inventory_reservations;
CREATE POLICY inventory_reservations_owner_read
    ON inventory_reservations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = inventory_reservations.store_id
              AND sites.user_id = auth.uid()
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS inventory_reservations_service_all ON inventory_reservations;
CREATE POLICY inventory_reservations_service_all
    ON inventory_reservations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

INSERT INTO inventory_locations (store_id, name, is_default, status)
SELECT s.id, 'Default Location', TRUE, 'active'
FROM sites s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM inventory_locations il
      WHERE il.store_id = s.id
        AND il.is_default = TRUE
        AND il.status = 'active'
        AND il.deleted_at IS NULL
  );

INSERT INTO inventory_levels (
    product_id,
    variant_id,
    location_id,
    available,
    reserved,
    incoming
)
SELECT
    p.id,
    NULL,
    loc.id,
    GREATEST(COALESCE(p.stock, 0), 0),
    0,
    0
FROM products p
JOIN LATERAL (
    SELECT il.id
    FROM inventory_locations il
    WHERE il.store_id = p.store_id
      AND il.status = 'active'
      AND il.deleted_at IS NULL
    ORDER BY il.is_default DESC, il.created_at ASC
    LIMIT 1
) loc ON TRUE
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM inventory_levels existing
      WHERE existing.product_id = p.id
        AND existing.variant_id IS NULL
  );

CREATE OR REPLACE FUNCTION create_order_with_inventory_reservations(
    p_store_id UUID,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT DEFAULT NULL,
    p_shipping_address JSONB DEFAULT '{}'::JSONB,
    p_items JSONB DEFAULT '[]'::JSONB,
    p_payment_method TEXT DEFAULT 'cod',
    p_notes TEXT DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_quantity INTEGER;
    v_product RECORD;
    v_variant RECORD;
    v_level_id UUID;
    v_location_id UUID;
    v_available INTEGER;
    v_reserved INTEGER;
    v_order_id UUID;
    v_order_number TEXT;
    v_subtotal NUMERIC(10,2) := 0;
    v_line_total NUMERIC(10,2);
    v_unit_price NUMERIC(10,2);
    v_variant_title TEXT;
    v_sku TEXT;
    v_order_items JSONB := '[]'::JSONB;
    v_order_json JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items must be a non-empty array';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sites
        WHERE id = p_store_id
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'store not found';
    END IF;

    v_order_number := 'LB-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
        upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
        v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'invalid quantity for product %', v_product_id;
        END IF;

        SELECT id, name, price, sku, is_active, store_id
          INTO v_product
          FROM products
         WHERE id = v_product_id
           AND store_id = p_store_id
           AND deleted_at IS NULL
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product not found: %', v_product_id;
        END IF;

        IF COALESCE(v_product.is_active, FALSE) = FALSE THEN
            RAISE EXCEPTION 'product is not active: %', v_product.name;
        END IF;

        v_unit_price := v_product.price;
        v_variant_title := NULL;
        v_sku := v_product.sku;

        IF v_variant_id IS NOT NULL THEN
            SELECT id, title, price, sku
              INTO v_variant
              FROM product_variants
             WHERE id = v_variant_id
               AND product_id = v_product_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'variant not found for product %', v_product_id;
            END IF;

            v_unit_price := COALESCE(NULLIF(v_variant.price, 0), v_product.price);
            v_variant_title := v_variant.title;
            v_sku := COALESCE(v_variant.sku, v_product.sku);
        END IF;

        SELECT il.id, il.location_id, il.available, il.reserved
          INTO v_level_id, v_location_id, v_available, v_reserved
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_product_id
           AND (
                (v_variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_variant_id
           )
           AND loc.store_id = p_store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1
         FOR UPDATE OF il;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'inventory level not found for product %', v_product_id;
        END IF;

        IF (v_available - v_reserved) < v_quantity THEN
            RAISE EXCEPTION 'insufficient stock for product %, available %, requested %',
                v_product.name,
                (v_available - v_reserved),
                v_quantity;
        END IF;

        UPDATE inventory_levels
           SET available = available - v_quantity,
               updated_at = NOW()
         WHERE id = v_level_id;

        v_line_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_line_total;

        v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
            'product_id', v_product_id,
            'variant_id', v_variant_id,
            'name', v_product.name,
            'variant_title', v_variant_title,
            'sku', v_sku,
            'quantity', v_quantity,
            'price', v_unit_price,
            'total', v_line_total
        ));
    END LOOP;

    INSERT INTO orders (
        store_id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        items,
        subtotal,
        shipping_cost,
        discount,
        total,
        coupon_code,
        payment_method,
        status,
        payment_status,
        notes,
        inventory_reserved_at,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_number,
        p_customer_name,
        p_customer_email,
        COALESCE(p_customer_phone, ''),
        COALESCE(p_shipping_address, '{}'::JSONB),
        v_order_items,
        v_subtotal,
        0,
        0,
        v_subtotal,
        p_coupon_code,
        p_payment_method,
        CASE WHEN p_payment_method = 'cod' THEN 'confirmed' ELSE 'pending' END,
        'pending',
        COALESCE(p_notes, ''),
        NOW(),
        p_actor_id
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order_items)
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_variant_id := NULLIF(v_item ->> 'variant_id', '')::UUID;
        v_quantity := (v_item ->> 'quantity')::INTEGER;

        SELECT il.id, il.location_id
          INTO v_level_id, v_location_id
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_product_id
           AND (
                (v_variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_variant_id
           )
           AND loc.store_id = p_store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1;

        INSERT INTO inventory_reservations (
            store_id,
            product_id,
            variant_id,
            location_id,
            order_id,
            quantity,
            status,
            idempotency_key,
            committed_at,
            created_by
        )
        VALUES (
            p_store_id,
            v_product_id,
            v_variant_id,
            v_location_id,
            v_order_id,
            v_quantity,
            'committed',
            'order:' || v_order_id::TEXT || ':' || v_product_id::TEXT || ':' || COALESCE(v_variant_id::TEXT, 'default'),
            NOW(),
            p_actor_id
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        INSERT INTO inventory_adjustments (
            product_id,
            variant_id,
            location_id,
            quantity_change,
            reason,
            reference_id,
            note,
            created_by
        )
        VALUES (
            v_product_id,
            v_variant_id,
            v_location_id,
            -v_quantity,
            'sale',
            v_order_id,
            'Committed by create_order_with_inventory_reservations',
            p_actor_id
        );

        INSERT INTO order_items (
            order_id,
            product_id,
            variant_id,
            sku,
            title,
            variant_title,
            quantity,
            unit_price,
            total,
            product_snapshot
        )
        VALUES (
            v_order_id,
            v_product_id,
            v_variant_id,
            v_item ->> 'sku',
            v_item ->> 'name',
            v_item ->> 'variant_title',
            v_quantity,
            (v_item ->> 'price')::NUMERIC,
            (v_item ->> 'total')::NUMERIC,
            v_item
        );
    END LOOP;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        p_store_id,
        'order',
        v_order_id::TEXT,
        'order.created',
        jsonb_build_object(
            'store_id', p_store_id,
            'order_id', v_order_id,
            'order_number', v_order_number,
            'total', v_subtotal,
            'payment_method', p_payment_method
        ),
        'order.created:' || v_order_id::TEXT,
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state
    )
    VALUES (
        p_store_id,
        p_actor_id,
        'user',
        'order.create',
        'order',
        v_order_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'order_id', v_order_id,
            'order_number', v_order_number,
            'total', v_subtotal
        )
    );

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$$;

CREATE OR REPLACE FUNCTION release_order_inventory(
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
    v_order RECORD;
    v_item RECORD;
    v_level_id UUID;
BEGIN
    SELECT id, store_id
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM inventory_reservations
        WHERE order_id = p_order_id
          AND status = 'released'
          AND deleted_at IS NULL
    ) THEN
        RETURN TRUE;
    END IF;

    FOR v_item IN
        SELECT product_id, variant_id, quantity
          FROM order_items
         WHERE order_id = p_order_id
           AND deleted_at IS NULL
    LOOP
        SELECT il.id
          INTO v_level_id
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_item.product_id
           AND (
                (v_item.variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_item.variant_id
           )
           AND loc.store_id = v_order.store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1
         FOR UPDATE OF il;

        IF FOUND THEN
            UPDATE inventory_levels
               SET available = available + v_item.quantity,
                   updated_at = NOW()
             WHERE id = v_level_id;

            INSERT INTO inventory_adjustments (
                product_id,
                variant_id,
                location_id,
                quantity_change,
                reason,
                reference_id,
                note,
                created_by
            )
            SELECT
                v_item.product_id,
                v_item.variant_id,
                location_id,
                v_item.quantity,
                'return',
                p_order_id,
                p_release_reason,
                p_actor_id
            FROM inventory_levels
            WHERE id = v_level_id;
        END IF;
    END LOOP;

    UPDATE inventory_reservations
       SET status = 'released',
           released_at = NOW(),
           release_reason = p_release_reason,
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND deleted_at IS NULL;

    UPDATE orders
       SET inventory_released_at = NOW(),
           updated_at = NOW()
     WHERE id = p_order_id;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'inventory.released',
        jsonb_build_object('store_id', v_order.store_id, 'order_id', p_order_id),
        'inventory.released:' || p_order_id::TEXT,
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION create_order_with_inventory_reservations(
    UUID,
    TEXT,
    TEXT,
    TEXT,
    JSONB,
    JSONB,
    TEXT,
    TEXT,
    TEXT,
    UUID,
    TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_order_with_inventory_reservations(
    UUID,
    TEXT,
    TEXT,
    TEXT,
    JSONB,
    JSONB,
    TEXT,
    TEXT,
    TEXT,
    UUID,
    TEXT
) TO service_role;

REVOKE ALL ON FUNCTION release_order_inventory(UUID, UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION release_order_inventory(UUID, UUID, TEXT, TEXT)
TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventory_reservations_updated_at'
    ) THEN
        CREATE TRIGGER update_inventory_reservations_updated_at
            BEFORE UPDATE ON inventory_reservations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;
