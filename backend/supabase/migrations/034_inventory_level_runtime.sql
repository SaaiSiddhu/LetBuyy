-- ============================================================================
-- Migration 034: Inventory Level Runtime RPCs
-- Provides service-role-only functions for product create/update and admin
-- inventory adjustments. products.stock is maintained as a compatibility mirror;
-- inventory_levels remains the source of truth.
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_default_inventory_location(p_store_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_location_id UUID;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    SELECT id
      INTO v_location_id
      FROM inventory_locations
     WHERE store_id = p_store_id
       AND is_default = TRUE
       AND status = 'active'
       AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_location_id IS NULL THEN
        INSERT INTO inventory_locations (store_id, name, is_default, status)
        VALUES (p_store_id, 'Default Location', TRUE, 'active')
        RETURNING id INTO v_location_id;
    END IF;

    RETURN v_location_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_inventory_level_available(
    p_product_id UUID,
    p_variant_id UUID DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_available INTEGER DEFAULT 0,
    p_actor_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'adjustment',
    p_notes TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product RECORD;
    v_location_id UUID;
    v_level RECORD;
    v_previous_available INTEGER := 0;
    v_delta INTEGER := 0;
    v_level_json JSONB;
BEGIN
    IF p_available < 0 THEN
        RAISE EXCEPTION 'available inventory cannot be negative';
    END IF;

    SELECT id, store_id
      INTO v_product
      FROM products
     WHERE id = p_product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found';
    END IF;

    IF p_variant_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM product_variants
            WHERE id = p_variant_id
              AND product_id = p_product_id
       ) THEN
        RAISE EXCEPTION 'variant not found for product';
    END IF;

    IF p_location_id IS NULL THEN
        v_location_id := ensure_default_inventory_location(v_product.store_id);
    ELSE
        SELECT id
          INTO v_location_id
          FROM inventory_locations
         WHERE id = p_location_id
           AND store_id = v_product.store_id
           AND deleted_at IS NULL;

        IF v_location_id IS NULL THEN
            RAISE EXCEPTION 'inventory location not found for product store';
        END IF;
    END IF;

    SELECT *
      INTO v_level
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND location_id = v_location_id
       AND (
            (p_variant_id IS NULL AND variant_id IS NULL)
            OR variant_id = p_variant_id
       )
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            updated_at
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            p_available,
            0,
            0,
            NOW()
        )
        RETURNING * INTO v_level;
        v_delta := p_available;
    ELSE
        v_previous_available := COALESCE(v_level.available, 0);
        v_delta := p_available - v_previous_available;

        IF p_available < COALESCE(v_level.reserved, 0) THEN
            RAISE EXCEPTION 'available inventory cannot be below reserved quantity';
        END IF;

        UPDATE inventory_levels
           SET available = p_available,
               updated_at = NOW()
         WHERE id = v_level.id
         RETURNING * INTO v_level;
    END IF;

    IF v_delta <> 0 THEN
        INSERT INTO inventory_adjustments (
            product_id,
            variant_id,
            location_id,
            quantity_change,
            reason,
            note,
            created_by
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            v_delta,
            CASE
                WHEN p_reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')
                THEN p_reason
                ELSE 'adjustment'
            END,
            p_notes,
            p_actor_id
        );
    END IF;

    IF p_variant_id IS NULL THEN
        UPDATE products
           SET stock = p_available,
               updated_at = NOW()
         WHERE id = p_product_id;
    ELSE
        UPDATE product_variants
           SET inventory_qty = p_available,
               updated_at = NOW()
         WHERE id = p_variant_id;
    END IF;

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
        v_product.store_id,
        'inventory',
        p_product_id::TEXT,
        'inventory.level.set',
        jsonb_build_object(
            'store_id', v_product.store_id,
            'product_id', p_product_id,
            'variant_id', p_variant_id,
            'location_id', v_location_id,
            'available', p_available,
            'delta', v_delta
        ),
        'inventory.level.set:' || p_product_id::TEXT || ':' || COALESCE(p_variant_id::TEXT, 'default') || ':' || v_location_id::TEXT || ':' || COALESCE(p_request_id, gen_random_uuid()::TEXT),
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(v_level) INTO v_level_json;
    RETURN v_level_json;
END;
$$;

CREATE OR REPLACE FUNCTION adjust_inventory_level(
    p_product_id UUID,
    p_variant_id UUID DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_adjustment INTEGER DEFAULT 0,
    p_actor_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'adjustment',
    p_notes TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product RECORD;
    v_location_id UUID;
    v_level RECORD;
    v_next_available INTEGER;
    v_level_json JSONB;
BEGIN
    SELECT id, store_id
      INTO v_product
      FROM products
     WHERE id = p_product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found';
    END IF;

    IF p_location_id IS NULL THEN
        v_location_id := ensure_default_inventory_location(v_product.store_id);
    ELSE
        SELECT id
          INTO v_location_id
          FROM inventory_locations
         WHERE id = p_location_id
           AND store_id = v_product.store_id
           AND deleted_at IS NULL;

        IF v_location_id IS NULL THEN
            RAISE EXCEPTION 'inventory location not found for product store';
        END IF;
    END IF;

    SELECT *
      INTO v_level
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND location_id = v_location_id
       AND (
            (p_variant_id IS NULL AND variant_id IS NULL)
            OR variant_id = p_variant_id
       )
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        v_next_available := p_adjustment;
        IF v_next_available < 0 THEN
            RAISE EXCEPTION 'cannot reduce inventory below zero';
        END IF;

        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            updated_at
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            v_next_available,
            0,
            0,
            NOW()
        )
        RETURNING * INTO v_level;
    ELSE
        v_next_available := COALESCE(v_level.available, 0) + p_adjustment;

        IF v_next_available < 0 THEN
            RAISE EXCEPTION 'cannot reduce inventory below zero';
        END IF;

        IF v_next_available < COALESCE(v_level.reserved, 0) THEN
            RAISE EXCEPTION 'available inventory cannot be below reserved quantity';
        END IF;

        UPDATE inventory_levels
           SET available = v_next_available,
               updated_at = NOW()
         WHERE id = v_level.id
         RETURNING * INTO v_level;
    END IF;

    INSERT INTO inventory_adjustments (
        product_id,
        variant_id,
        location_id,
        quantity_change,
        reason,
        note,
        created_by
    )
    VALUES (
        p_product_id,
        p_variant_id,
        v_location_id,
        p_adjustment,
        CASE
            WHEN p_reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')
            THEN p_reason
            ELSE 'adjustment'
        END,
        p_notes,
        p_actor_id
    );

    IF p_variant_id IS NULL THEN
        UPDATE products
           SET stock = v_next_available,
               updated_at = NOW()
         WHERE id = p_product_id;
    ELSE
        UPDATE product_variants
           SET inventory_qty = v_next_available,
               updated_at = NOW()
         WHERE id = p_variant_id;
    END IF;

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
        v_product.store_id,
        'inventory',
        p_product_id::TEXT,
        'inventory.level.adjusted',
        jsonb_build_object(
            'store_id', v_product.store_id,
            'product_id', p_product_id,
            'variant_id', p_variant_id,
            'location_id', v_location_id,
            'adjustment', p_adjustment,
            'available', v_next_available
        ),
        'inventory.level.adjusted:' || p_product_id::TEXT || ':' || COALESCE(p_variant_id::TEXT, 'default') || ':' || v_location_id::TEXT || ':' || COALESCE(p_request_id, gen_random_uuid()::TEXT),
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(v_level) INTO v_level_json;
    RETURN v_level_json;
END;
$$;

REVOKE ALL ON FUNCTION ensure_default_inventory_location(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION ensure_default_inventory_location(UUID)
TO service_role;

REVOKE ALL ON FUNCTION set_inventory_level_available(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION set_inventory_level_available(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT)
TO service_role;

REVOKE ALL ON FUNCTION adjust_inventory_level(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION adjust_inventory_level(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT)
TO service_role;
