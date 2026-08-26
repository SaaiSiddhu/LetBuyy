-- T12: release_order_inventory (000_baseline.sql) has never worked for ANY
-- order, on ANY release path -- order cancellation, refund-triggered
-- release, and (as of migration 211) the new unpaid-committed-reservation
-- sweep all call it, and all would fail with a hard SQL error.
--
-- order_items.variant_id is `text`; inventory_levels.variant_id and
-- inventory_adjustments.variant_id are `uuid`. release_order_inventory reads
-- order_items into a RECORD loop variable and both compares
-- (il.variant_id = v_item.variant_id) and inserts v_item.variant_id into
-- inventory_adjustments.variant_id (uuid) with no cast. Postgres resolves
-- operators and assignment casts at plan time against declared types, not
-- runtime values, so this fails even for the common case where variant_id is
-- NULL on both sides -- it is not a null-handling bug, it is a type
-- mismatch that made the function fail on its very first invocation,
-- regardless of the order's contents.
--
-- Discovered empirically in T12 while proving migration 211's new sweep
-- actually works end-to-end against a real reservation -- the first attempt
-- to release a real committed reservation via
-- release_order_inventory_with_ledger -> release_order_inventory threw
-- "operator does not exist: uuid = text" (see W0/W3 of the T12 report for
-- the full reproduction). Since this function is the ONE mechanism T12
-- deliberately reuses (rather than inventing a new release path) for both
-- order cancellation and the new TTL-driven release, its brokenness had to
-- be fixed here for T12's own design to work at all -- not out of scope,
-- squarely in the blast radius of the change this phase already commits to.
CREATE OR REPLACE FUNCTION public.release_order_inventory(p_order_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_release_reason text DEFAULT 'order_cancelled'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        SELECT product_id, NULLIF(variant_id, '')::uuid AS variant_id, quantity
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
$function$;

-- The same uuid/text mismatch exists in the sibling wrapper's own
-- inventory_events insert (oi.variant_id is text; r.variant_id and
-- il.variant_id are uuid), surfaced by the SAME investigation the moment
-- release_order_inventory itself started working. Same fix: cast at the
-- comparison and at the inserted value.
CREATE OR REPLACE FUNCTION public.release_order_inventory_with_ledger(p_order_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_release_reason text DEFAULT 'order_cancelled'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        NULLIF(oi.variant_id, '')::uuid,
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
           (r.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
           OR r.variant_id = NULLIF(oi.variant_id, '')::uuid
       )
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
           (il.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
           OR il.variant_id = NULLIF(oi.variant_id, '')::uuid
       )
     WHERE oi.order_id = p_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    RETURN v_released;
END;
$function$;
