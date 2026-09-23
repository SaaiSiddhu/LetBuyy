-- Migration 252: create_order_fulfillment carries order_items.variant_id into a uuid column (F-FUL-1).
--
-- WHAT IS WRONG (reproduced, not inferred)
-- public.create_order_fulfillment is defined once, in 000_baseline.sql, and has never been redefined.
-- Both of its INSERT INTO fulfillment_order_lines statements -- the explicit-lines branch and the
-- all-lines branch -- pass v_item.variant_id straight through. order_items.variant_id is TEXT;
-- fulfillment_order_lines.variant_id is UUID (FK product_variants(id)). Postgres rejects that INSERT when
-- it plans it, for every row, NULL or not:
--     column "variant_id" is of type uuid but expression is of type text
-- so every call that reaches either INSERT fails, and order fulfilment has never worked at the database
-- for any order: measured 2026-09-23 on an ordinary COD order with no variant against 000..252
-- (LB-FUL-001), and by tests/executable/order-fulfillment-variant-type-postgres.test.mjs against 000..251.
--
-- WHY THIS SHAPE
-- It is the class migration 212 fixed for release_order_inventory, and it takes the same cast:
-- NULLIF(v_item.variant_id, '')::uuid. NULLIF keeps an empty-string variant a NULL line instead of an
-- invalid-uuid error. A non-empty value that is not a uuid still raises -- the right outcome, since the
-- column's FK to product_variants would refuse it anyway. Checkout cannot store one: it already applies
-- this exact cast to the incoming value and refuses a variant that does not exist
-- (create_order_with_inventory_reservations, 166). Other writers of order_items were not audited here.
--
-- WHAT THIS MIGRATION IS
-- The definition below is the CURRENT LIVE definition of create_order_fulfillment, read back with
-- pg_get_functiondef from a database with 000..251 applied, with exactly two lines changed -- the two
-- variant_id values -- and nothing retyped, reordered or removed. The executable suite re-derives that
-- diff from the live function on every run. No signature change, so CREATE OR REPLACE replaces.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_order_fulfillment(p_order_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_location_id uuid DEFAULT NULL::uuid, p_carrier text DEFAULT NULL::text, p_tracking_number text DEFAULT NULL::text, p_tracking_url text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                NULLIF(v_item.variant_id, '')::uuid,
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
                NULLIF(v_item.variant_id, '')::uuid,
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
$function$;

COMMIT;
