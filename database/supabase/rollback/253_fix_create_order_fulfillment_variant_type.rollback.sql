-- Rollback of 253: restore create_order_fulfillment to its 000_baseline definition.
--
-- This deliberately restores the defect: every call that reaches an INSERT INTO fulfillment_order_lines
-- fails again with 'column "variant_id" is of type uuid but expression is of type text'. The executable
-- suite applies this rollback on purpose to watch fulfilment fail, then re-applies 253 -- a fence never
-- seen absent is not a fence that has been tested.
--
-- No data is changed; this is a function definition only. Fulfilment rows written while 253 was in
-- force stay as they are.

BEGIN;

-- SIGNATURE PRECONDITION (F-ROLLBACK-1's rule; tests/governance/rollback-signature-precondition.test.mjs
-- requires it of every rollback after 245 that restores a function).
--
-- 253 kept the parameter list exactly, so CREATE OR REPLACE below genuinely replaces rather than adding
-- an overload. Assert that instead of assuming it: if a later migration changes this signature, running
-- this file would create a SECOND create_order_fulfillment and every fulfilment call would then fail
-- with "is not unique". Refuse instead.
DO $rollback_precondition$
DECLARE
    v_count integer;
    v_names text[];
    v_expected text[] := ARRAY[
        'p_order_id',
        'p_lines',
        'p_location_id',
        'p_carrier',
        'p_tracking_number',
        'p_tracking_url',
        'p_actor_id',
        'p_request_id',
        'p_idempotency_key'
    ];
BEGIN
    SELECT count(*) INTO v_count
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_order_fulfillment';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'rollback 253: public.create_order_fulfillment does not exist, so there is nothing to restore.';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'rollback 253: public.create_order_fulfillment already has % overloads. Every call is ambiguous already; resolve that before rolling anything back.', v_count;
    END IF;

    -- proargnames[1:pronargs] takes the INPUT parameters only.
    SELECT p.proargnames[1:p.pronargs] INTO v_names
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_order_fulfillment';

    IF v_names IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'rollback 253 refuses to run: public.create_order_fulfillment currently takes %s parameters (%s), but this rollback restores the 9-parameter signature (%s).',
                coalesce(array_length(v_names, 1), 0),
                array_to_string(v_names, ', '),
                array_to_string(v_expected, ', ')),
            DETAIL = 'CREATE OR REPLACE FUNCTION with a different parameter list does not replace the function, it adds a second overload -- after which every create_order_fulfillment call fails with "is not unique".',
            HINT = 'Roll back the later migrations that changed this signature first, then re-run this rollback.';
    END IF;
END
$rollback_precondition$;

-- The live pre-253 definition (pg_get_functiondef against 000..251), verbatim. Migration 252 (F-PAY4-1) does not touch this function.
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
$function$;

COMMIT;
