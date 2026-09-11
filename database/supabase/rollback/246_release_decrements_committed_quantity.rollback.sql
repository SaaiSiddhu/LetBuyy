-- Rollback of 246: restore release_order_inventory without the committed_quantity decrement.
--
-- This deliberately restores the defect: committed_quantity resumes growing without bound on every
-- release. The executable suite applies this rollback on purpose to watch the column fail to come
-- down, then re-applies 246 -- a fence never seen absent is not a fence that has been tested.
--
-- No data is changed; this is a function definition only. Rows already corrected by 246 stay correct.

BEGIN;

-- SIGNATURE PRECONDITION (F-ROLLBACK-1's rule, applied to this file by its own ratchet).
--
-- This rollback replaces release_order_inventory with its pre-246 body. The parameter list is
-- unchanged -- 246 was a single insertion into the live definition, not a signature change -- so
-- CREATE OR REPLACE genuinely replaces here rather than adding an overload. That is exactly the
-- claim worth asserting instead of assuming: if a later migration changes this signature, running
-- this file would silently create a SECOND release_order_inventory and every caller would then fail
-- with "is not unique". Refuse instead.
DO $rollback_precondition$
DECLARE
    v_count integer;
    v_names text[];
    v_expected text[] := ARRAY[
        'p_order_id',
        'p_actor_id',
        'p_request_id',
        'p_release_reason'
    ];
BEGIN
    SELECT count(*) INTO v_count
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'release_order_inventory';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'rollback 246: public.release_order_inventory does not exist, so there is nothing to restore.';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'rollback 246: public.release_order_inventory already has % overloads. Every call is ambiguous already; resolve that before rolling anything back.', v_count;
    END IF;

    -- proargnames[1:pronargs] takes the INPUT parameters only; release_order_inventory returns
    -- boolean so the slice is a no-op for it, but the block gets copied.
    SELECT p.proargnames[1:p.pronargs] INTO v_names
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'release_order_inventory';

    IF v_names IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'rollback 246 refuses to run: public.release_order_inventory currently takes %s parameters (%s), but this rollback restores the 4-parameter signature (%s).',
                coalesce(array_length(v_names, 1), 0),
                array_to_string(v_names, ', '),
                array_to_string(v_expected, ', ')),
            DETAIL = 'CREATE OR REPLACE FUNCTION with a different parameter list does not replace the function, it adds a second overload -- after which every release_order_inventory call fails with "is not unique".',
            HINT = 'Roll back the later migrations that changed this signature first, then re-run this rollback.';
    END IF;
END
$rollback_precondition$;

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

COMMIT;
