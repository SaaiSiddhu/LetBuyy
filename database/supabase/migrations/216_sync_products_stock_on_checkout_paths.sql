-- T17: the shopper-visible `products.stock` and the checkout-enforced `inventory_levels.available`
-- are two independent numbers with no writer keeping them in sync outside the merchant's manual
-- "adjust stock" flow. W0 measured the drift live: 63 products, 58 carrying a real inventory_levels
-- row, only 1 in agreement; the real, merchant-created products at risk in the dangerous direction
-- (products.stock shown HIGHER than the real reservable amount) are Snaz Canvas Tote (25 shown vs
-- 4 real) and Snaz Everyday Cap (40 vs 38). Read live: `adjust_inventory_level` and
-- `set_inventory_level_available` (both merchant-initiated manual stock edits) already correctly
-- write `products.stock`/`product_variants.inventory_qty` in the same transaction as their
-- inventory_levels.available change -- that pattern is the proven, working contract this migration
-- extends. Executed live: `reserve_inventory` never touches `available` (only `reserved` -- a hold,
-- not a decrement), so it needs no sync. `commit_inventory_reservation` (the real sale, called from
-- create_checkout_order's chain) DOES decrement `available` and had ZERO sync -- proven live via the
-- browser: a shopper on Product with products.stock=70/inventory_levels.available=45 was shown "In
-- Stock" with no cap, added 50 to cart, filled the entire checkout form, and only at the final COD
-- confirmation received a generic "Order creation failed. Please try again." (the real, hidden
-- reason: INSUFFICIENT_INVENTORY). A full database-wide sweep for every function that mutates
-- inventory_levels.available found five more gaps beyond commit_inventory_reservation:
-- release_order_inventory (order cancellation restock), create_order_return_and_refund (return
-- restock, two call sites), create_inventory_transfer_with_lines (outbound transfer decrement),
-- receive_inventory_transfer_line (inbound transfer receipt) and receive_purchase_order_line (PO
-- receipt). Authority decision: inventory_levels.available is the source of truth for sellable
-- stock -- it is what reserve_inventory locks and checks, and it is what the already-correct
-- adjust_inventory_level/set_inventory_level_available RPCs treat as primary, deriving
-- products.stock FROM it. products.stock stays as a denormalised read cache for the storefront/
-- GraphQL/merchant-list surfaces that read it directly without a join; this migration closes every
-- remaining writer gap so that cache can no longer drift, without touching the reservation check
-- itself (no fail-closed control weakened) and without retiring the column (a schema decision this
-- phase explicitly does not make unilaterally -- see CAP-C57).
--
-- Bounds: no signature changed on any of the six functions below -- every change is a body-only
-- addition of a sync step immediately after the existing available-mutating UPDATE, using that
-- UPDATE's own RETURNING clause so the synced value is exactly what was just committed, never a
-- second read. adjust_inventory_level and set_inventory_level_available are NOT touched here --
-- they already sync correctly for the single-location case, which is the only case any real
-- merchant or test fixture in this database currently has.

CREATE OR REPLACE FUNCTION public.commit_inventory_reservation(p_store_id uuid, p_reservation_id uuid, p_idempotency_key text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_new_available integer;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  SELECT * INTO v_reservation
    FROM public.inventory_reservations
   WHERE id = p_reservation_id
     AND store_id = p_store_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory reservation not found';
  END IF;

  IF v_reservation.status = 'committed' THEN
    RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', 'committed', 'idempotent', true);
  END IF;

  IF v_reservation.status NOT IN ('active', 'hold') THEN
    RAISE EXCEPTION 'inventory reservation cannot be committed from status %', v_reservation.status;
  END IF;

  UPDATE public.inventory_levels
     SET available = GREATEST(available - v_reservation.quantity, 0),
         reserved = GREATEST(reserved - v_reservation.quantity, 0),
         available_quantity = GREATEST(COALESCE(available_quantity, available) - v_reservation.quantity, 0),
         reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
         committed_quantity = COALESCE(committed_quantity, 0) + v_reservation.quantity,
         updated_at = now()
   WHERE store_id = p_store_id
     AND product_id = v_reservation.product_id
     AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
     AND location_id = v_reservation.location_id
   RETURNING available INTO v_new_available;

  -- T17: keep the shopper-visible cache in sync with the sale this reservation just finalized.
  IF v_reservation.variant_id IS NULL THEN
    UPDATE public.products SET stock = v_new_available, updated_at = now() WHERE id = v_reservation.product_id;
  ELSE
    UPDATE public.product_variants SET inventory_qty = v_new_available, updated_at = now() WHERE id = v_reservation.variant_id;
  END IF;

  UPDATE public.inventory_reservations
     SET status = 'committed',
         committed_at = now(),
         commit_idempotency_key = p_idempotency_key,
         updated_at = now()
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'request_id', p_request_id
  );
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.create_order_return_and_refund(p_order_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_reason text DEFAULT NULL::text, p_refund_method text DEFAULT 'original_payment'::text, p_restock boolean DEFAULT false, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_new_available integer;
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
                     WHERE id = v_level_id
                     RETURNING available INTO v_new_available;

                    -- T17: a restocked return must move the shopper-visible cache too.
                    IF v_item.variant_id IS NULL THEN
                        UPDATE products SET stock = v_new_available, updated_at = NOW() WHERE id = v_item.product_id;
                    ELSE
                        UPDATE product_variants SET inventory_qty = v_new_available, updated_at = NOW() WHERE id = v_item.variant_id;
                    END IF;

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
                     WHERE id = v_level_id
                     RETURNING available INTO v_new_available;

                    -- T17: a restocked return must move the shopper-visible cache too.
                    IF v_item.variant_id IS NULL THEN
                        UPDATE products SET stock = v_new_available, updated_at = NOW() WHERE id = v_item.product_id;
                    ELSE
                        UPDATE product_variants SET inventory_qty = v_new_available, updated_at = NOW() WHERE id = v_item.variant_id;
                    END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.create_inventory_transfer_with_lines(p_site_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_lines jsonb, p_notes text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_transfer_id UUID;
    v_existing_id UUID;
    v_line RECORD;
    v_product RECORD;
    v_source_level_id UUID;
    v_transfer_number TEXT;
    v_new_available integer;
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
         WHERE id = v_source_level_id
         RETURNING available INTO v_new_available;

        -- T17: an outbound transfer decrements this location's stock -- sync the cache.
        IF v_line.variant_id IS NULL THEN
            UPDATE products SET stock = v_new_available, updated_at = NOW() WHERE id = v_line.product_id;
        ELSE
            UPDATE product_variants SET inventory_qty = v_new_available, updated_at = NOW() WHERE id = v_line.variant_id;
        END IF;

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
            p_request_id, jsonb_build_object('source_location_id', p_source_location_id, 'destination_location_id', p_destination_location_id), p_actor_id
        FROM inventory_levels il WHERE il.id = v_source_level_id
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object(
        'transfer', (SELECT to_jsonb(t) FROM inventory_transfers t WHERE t.id = v_transfer_id),
        'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(tl)), '[]'::JSONB) FROM inventory_transfer_lines tl WHERE tl.transfer_id = v_transfer_id)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.receive_inventory_transfer_line(p_transfer inventory_transfers, p_line inventory_transfer_lines, p_quantity integer, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_source_level_id UUID;
    v_dest_level_id UUID;
    v_new_available integer;
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
     WHERE id = v_dest_level_id
     RETURNING available INTO v_new_available;

    -- T17: the destination location just received stock -- sync the cache to its new total.
    IF p_line.variant_id IS NULL THEN
        UPDATE products SET stock = v_new_available, updated_at = NOW() WHERE id = p_line.product_id;
    ELSE
        UPDATE product_variants SET inventory_qty = v_new_available, updated_at = NOW() WHERE id = p_line.variant_id;
    END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(p_po purchase_orders, p_line purchase_order_lines, p_quantity integer, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_level_id UUID;
    v_new_available integer;
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
     WHERE id = v_level_id
     RETURNING available INTO v_new_available;

    -- T17: a PO receipt increases on-hand stock -- sync the cache to its new total.
    IF p_line.variant_id IS NULL THEN
        UPDATE products SET stock = v_new_available, updated_at = NOW() WHERE id = p_line.product_id;
    ELSE
        UPDATE product_variants SET inventory_qty = v_new_available, updated_at = NOW() WHERE id = p_line.variant_id;
    END IF;

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
$function$;
