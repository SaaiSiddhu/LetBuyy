-- Migration 246: a released commitment stops counting as committed (CAP-C47).
--
-- WHAT IS WRONG
-- `inventory_levels.committed_quantity` is incremented by commit_inventory_reservation and decremented
-- by nothing, anywhere. Verified across every migration, not only the paths the backlog row named:
--   * release_order_inventory (216)                 - zero references to the column
--   * expire_unpaid_committed_reservations (211)    - zero references
--   * release_order_inventory_with_ledger (212)     - one reference, a column NAME in an
--                                                     inventory_events INSERT that records the value
-- A repo-wide search for any subtraction or GREATEST on the column returns nothing. The number
-- therefore grows without bound, and apps/merchant_app/lib/services/inventory_service.dart shows it to
-- the merchant as "committed".
--
-- NOT AN OVERSELL RISK. reserve_inventory gates on `available`, which every release path already
-- restores correctly. This is a reporting column that becomes progressively false.
--
-- WHY ONE FUNCTION FIXES BOTH PATHS
-- release_order_inventory_with_ledger delegates to release_order_inventory, and the expiry sweeper
-- (211) calls the ledger variant. Cancellation, refund and expiry therefore all pass through the one
-- function changed here. The events row the ledger variant writes afterwards now records the
-- post-decrement value, which is the accurate one.
--
-- WHAT THIS MIGRATION IS
-- The definition below is the CURRENT LIVE definition of release_order_inventory, read back with
-- pg_get_functiondef from a database with 000..245 applied, with exactly one block inserted before it
-- marks the reservations released. Nothing is retyped, reordered or removed -- verified line by line:
-- zero lines of the original are absent from the result.

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
    v_new_available integer;
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
             WHERE id = v_level_id
             RETURNING available INTO v_new_available;

            -- T17: order cancellation restores stock -- the shopper-visible cache must move too.
            IF v_item.variant_id IS NULL THEN
                UPDATE products SET stock = v_new_available, updated_at = NOW() WHERE id = v_item.product_id;
            ELSE
                UPDATE product_variants SET inventory_qty = v_new_available, updated_at = NOW() WHERE id = v_item.variant_id;
            END IF;

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

    -- CAP-C47: a released commitment is no longer committed.
    --
    -- commit_inventory_reservation adds v_reservation.quantity to the level's committed_quantity and
    -- NOTHING has ever subtracted it -- not this function, not expire_unpaid_committed_reservations,
    -- not release_order_inventory_with_ledger (whose single mention of the column is a name in an
    -- inventory_events INSERT). So the column only grew, and the figure apps/merchant_app shows the
    -- merchant as "committed" drifted upward without bound. No oversell risk: reserve_inventory gates
    -- on `available`, which this function already restores correctly.
    --
    -- Driven by the order's status='committed' RESERVATIONS, deliberately not by the order_items loop
    -- above. That loop restores `available` per item and knows nothing about whether a commit ever
    -- happened -- an order cancelled while merely reserved never incremented committed_quantity, and
    -- subtracting its item quantities would corrupt the column in the opposite direction. This
    -- subtracts exactly what the commit added, grouped per level in case one level backs several
    -- reservations. GREATEST(0, ...) is a floor for rows committed before the column was maintained.
    UPDATE inventory_levels il
       SET committed_quantity = GREATEST(0, COALESCE(il.committed_quantity, 0) - committed.total_quantity),
           updated_at = NOW()
      FROM (
            SELECT location_id, product_id, variant_id, SUM(quantity) AS total_quantity
              FROM inventory_reservations
             WHERE order_id = p_order_id
               AND status = 'committed'
               AND deleted_at IS NULL
             GROUP BY location_id, product_id, variant_id
      ) AS committed
     WHERE il.location_id = committed.location_id
       AND il.product_id = committed.product_id
       AND (
            (committed.variant_id IS NULL AND il.variant_id IS NULL)
            OR il.variant_id = committed.variant_id
       );

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
