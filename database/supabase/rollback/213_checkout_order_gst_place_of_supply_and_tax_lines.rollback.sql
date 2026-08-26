-- Rollback for 213_checkout_order_gst_place_of_supply_and_tax_lines.sql
-- Restores create_checkout_order to its pre-T13 signature and body (no
-- p_place_of_supply_state, no p_tax_lines, no order_tax_lines writes).
--
-- Must DROP the 18-parameter overload first: CREATE OR REPLACE only replaces a function with
-- the identical parameter type signature, so without this the 16-param version below would
-- sit ALONGSIDE the 18-param one rather than replacing it -- the exact ambiguous-overload
-- regression the forward migration itself introduced and then fixed the same way.
DROP FUNCTION IF EXISTS public.create_checkout_order(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text, text, uuid, text, uuid, numeric, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_store_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text, p_shipping_address jsonb, p_items jsonb, p_payment_method text, p_notes text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_gift_card_code text DEFAULT NULL::text, p_shipping_method text DEFAULT 'standard'::text, p_idempotency_key text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_shipping_rate_id uuid DEFAULT NULL::uuid, p_tax_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_existing_order_id UUID;
    v_order_json JSONB;
    v_order_id UUID;
    v_order RECORD;
    v_shipping_method TEXT := COALESCE(NULLIF(BTRIM(p_shipping_method), ''), 'standard');
    v_shipping_amount NUMERIC(12,2) := 0;
    v_tax_amount NUMERIC(12,2) := 0;
    v_discount_amount NUMERIC(12,2) := 0;
    v_gift_card_amount NUMERIC(12,2) := 0;
    v_gift_card_balance NUMERIC(12,2) := 0;
    v_grand_total NUMERIC(12,2) := 0;
    v_payment_due NUMERIC(12,2) := 0;
    v_promotion JSONB := jsonb_build_object('valid', false, 'discount', 0);
    v_gift_card RECORD;
    v_payment_transaction_id UUID;
    v_rate_row RECORD;
    v_store_has_rates BOOLEAN := false;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_payment_method NOT IN ('razorpay', 'cod') THEN
        RAISE EXCEPTION 'unsupported payment method: %', p_payment_method;
    END IF;

    SELECT order_id
      INTO v_existing_order_id
      FROM checkout_sessions
     WHERE site_id = p_store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_order_id IS NOT NULL THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = v_existing_order_id
           AND o.deleted_at IS NULL;

        IF v_order_json IS NOT NULL THEN
            RETURN v_order_json;
        END IF;
    END IF;

    SELECT COUNT(*) > 0
      INTO v_store_has_rates
      FROM public.shipping_rates sr
      JOIN public.shipping_zones sz ON sz.id = sr.zone_id
     WHERE sz.site_id = p_store_id
       AND sr.is_active = true
       AND sr.deleted_at IS NULL;

    IF v_store_has_rates AND p_shipping_rate_id IS NOT NULL THEN
        SELECT sr.type, sr.price,
               sr.min_order_amount, sr.max_order_amount,
               sr.min_weight_grams, sr.max_weight_grams
          INTO v_rate_row
          FROM public.shipping_rates sr
          JOIN public.shipping_zones sz ON sz.id = sr.zone_id
         WHERE sr.id = p_shipping_rate_id
           AND sz.site_id = p_store_id
           AND sr.is_active = true
           AND sr.deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'shipping rate not found or does not belong to this store: %', p_shipping_rate_id;
        END IF;

        IF v_rate_row.type = 'free' THEN
            v_shipping_amount := 0;
        ELSE
            v_shipping_amount := COALESCE(v_rate_row.price, 0);
        END IF;

    ELSIF v_store_has_rates AND p_shipping_rate_id IS NULL THEN
        IF v_shipping_method = 'express' THEN
            v_shipping_amount := 99;
        ELSE
            v_shipping_amount := 0;
        END IF;

    ELSE
        IF v_shipping_method = 'express' THEN
            v_shipping_amount := 99;
        ELSIF v_shipping_method = 'standard' THEN
            v_shipping_amount := 0;
        ELSE
            RAISE EXCEPTION 'unsupported shipping method: %', v_shipping_method;
        END IF;
    END IF;

    v_tax_amount := COALESCE(p_tax_amount, 0);

    v_order_json := create_order_with_inventory_reservations(
        p_store_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        COALESCE(p_shipping_address, '{}'::JSONB),
        p_items,
        p_payment_method,
        p_notes,
        NULL,
        p_actor_id,
        p_request_id
    );

    v_order_id := (v_order_json ->> 'id')::UUID;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'created order not found';
    END IF;

    IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        v_promotion := evaluate_checkout_promotion(
            p_store_id,
            p_coupon_code,
            COALESCE(v_order.subtotal, 0),
            v_shipping_amount,
            p_customer_email
        );
        v_discount_amount := COALESCE((v_promotion ->> 'discount')::NUMERIC, 0);
    END IF;

    v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);

    IF NULLIF(BTRIM(COALESCE(p_gift_card_code, '')), '') IS NOT NULL THEN
        SELECT *
          INTO v_gift_card
          FROM gift_card_accounts gca
         WHERE gca.site_id = p_store_id
           AND gca.code_hash = encode(digest(p_gift_card_code, 'sha256'), 'hex')
           AND gca.status = 'active'
           AND gca.deleted_at IS NULL
           AND (gca.expires_at IS NULL OR gca.expires_at >= NOW())
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'gift card is invalid or unavailable';
        END IF;

        SELECT COALESCE(
            SUM(
                CASE
                    WHEN entry_type IN ('issued', 'credit', 'refund_credit', 'release') THEN amount
                    WHEN entry_type IN ('debit', 'hold', 'expire', 'fraud_hold') THEN -amount
                    ELSE 0
                END
            ),
            COALESCE(v_gift_card.initial_value, v_gift_card.balance, 0)
        )
          INTO v_gift_card_balance
          FROM gift_card_ledger_entries
         WHERE gift_card_account_id = v_gift_card.id
           AND site_id = p_store_id
           AND deleted_at IS NULL;

        v_gift_card_amount := LEAST(COALESCE(v_gift_card_balance, 0), v_grand_total);

        IF v_gift_card_amount <= 0 THEN
            RAISE EXCEPTION 'gift card has no redeemable balance';
        END IF;

        INSERT INTO gift_card_redemptions (
            site_id, gift_card_account_id, order_id, amount, status,
            idempotency_key, request_id, metadata, created_by
        )
        VALUES (
            p_store_id, v_gift_card.id, v_order_id, v_gift_card_amount, 'committed',
            'gift_card.redemption:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id, jsonb_build_object('code_last4', v_gift_card.code_last4), p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        INSERT INTO gift_card_ledger_entries (
            site_id, gift_card_account_id, order_id, entry_type, amount, balance_after,
            idempotency_key, request_id, metadata, created_by
        )
        VALUES (
            p_store_id, v_gift_card.id, v_order_id, 'debit', v_gift_card_amount,
            COALESCE(v_gift_card_balance, 0) - v_gift_card_amount,
            'gift_card.debit:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id, jsonb_build_object('code_last4', v_gift_card.code_last4), p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END IF;

    v_payment_due := GREATEST(v_grand_total - v_gift_card_amount, 0);

    UPDATE orders
       SET shipping_cost = v_shipping_amount,
           shipping_method = v_shipping_method,
           tax = v_tax_amount,
           discount = v_discount_amount,
           total = v_payment_due,
           coupon_code = NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), ''),
           coupon_discount = v_discount_amount,
           currency = COALESCE(currency, 'INR'),
           payment_status = CASE WHEN v_payment_due = 0 THEN 'paid' ELSE payment_status END,
           status = CASE WHEN v_payment_due = 0 THEN 'confirmed' ELSE status END,
           updated_at = NOW()
     WHERE id = v_order_id;

    INSERT INTO checkout_sessions (
        site_id, order_id, customer_email, status, idempotency_key, subtotal,
        shipping_total, tax_total, discount_total, gift_card_total, grand_total,
        currency, shipping_method, payment_method, request_id, metadata, created_by
    )
    VALUES (
        p_store_id, v_order_id, p_customer_email, 'completed', p_idempotency_key,
        COALESCE(v_order.subtotal, 0), v_shipping_amount, v_tax_amount, v_discount_amount,
        v_gift_card_amount, v_grand_total, COALESCE(v_order.currency, 'INR'),
        v_shipping_method, p_payment_method, p_request_id,
        jsonb_build_object('source', 'create_checkout_order', 'payment_due', v_payment_due, 'promotion', v_promotion),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO order_shipping_lines (
        site_id, order_id, title, method, amount, metadata, created_by
    )
    VALUES (
        p_store_id, v_order_id,
        CASE WHEN v_shipping_method = 'express' THEN 'Express Shipping' ELSE 'Standard Shipping' END,
        v_shipping_method, v_shipping_amount,
        jsonb_build_object('computed_by', 'create_checkout_order', 'shipping_rate_id', p_shipping_rate_id),
        p_actor_id
    );

    IF v_discount_amount > 0 THEN
        INSERT INTO order_line_adjustments (
            site_id, order_id, adjustment_type, source_type, source_id, title, amount, metadata, created_by
        )
        VALUES (
            p_store_id, v_order_id, 'promotion',
            CASE WHEN (v_promotion ->> 'promotion_id') IS NOT NULL THEN 'promotion' ELSE 'coupon' END,
            COALESCE(NULLIF(v_promotion ->> 'promotion_id', '')::UUID, NULLIF(v_promotion ->> 'coupon_id', '')::UUID),
            COALESCE(v_promotion ->> 'title', 'Promotion'), v_discount_amount, v_promotion, p_actor_id
        );

        INSERT INTO promotion_redemptions (
            site_id, promotion_id, promotion_code_id, coupon_id, order_id, customer_email,
            code, amount, status, idempotency_key, request_id, metadata, created_by
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            v_order_id, p_customer_email, v_promotion ->> 'code', v_discount_amount, 'committed',
            'promotion.redemption:' || v_order_id::TEXT || ':' || COALESCE(v_promotion ->> 'code', 'unknown'),
            p_request_id, v_promotion, p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        UPDATE promotion_codes
           SET usage_count = usage_count + 1, updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID;

        UPDATE coupons
           SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'coupon_id', '')::UUID;

        INSERT INTO promotion_usage_counters (
            site_id, promotion_id, promotion_code_id, coupon_id, customer_email, usage_count
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            LOWER(p_customer_email), 1
        )
        ON CONFLICT (site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
        DO UPDATE SET usage_count = promotion_usage_counters.usage_count + 1, updated_at = NOW();
    END IF;

    INSERT INTO payment_transactions (
        order_id, store_id, site_id, gateway, amount, currency, status, payment_method,
        metadata, request_id, idempotency_key, created_by, captured_at
    )
    VALUES (
        v_order_id, p_store_id, p_store_id, p_payment_method, v_payment_due,
        COALESCE(v_order.currency, 'INR'),
        CASE WHEN v_payment_due = 0 THEN 'captured' ELSE 'pending' END,
        p_payment_method,
        jsonb_build_object('source', 'checkout', 'gift_card_total', v_gift_card_amount),
        p_request_id, p_idempotency_key || ':payment', p_actor_id,
        CASE WHEN v_payment_due = 0 THEN NOW() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_transaction_id;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id, order_id,
        reservation_id, event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_store_id, il.id, r.location_id, oi.product_id, NULLIF(oi.variant_id, '')::UUID,
        v_order_id, r.id, 'sale_committed', -oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        oi.quantity,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order', v_order_id,
        'checkout.sale_committed:' || v_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('checkout_session_idempotency_key', p_idempotency_key),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND (
            (r.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
            OR r.variant_id = NULLIF(oi.variant_id, '')::UUID
       )
       AND r.deleted_at IS NULL
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
            (il.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
            OR il.variant_id = NULLIF(oi.variant_id, '')::UUID
       )
     WHERE oi.order_id = v_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO outbox_events (
        site_id, store_id, aggregate_type, aggregate_id, event_type, payload,
        idempotency_key, request_id, trace_id, schema_version, actor_id
    )
    VALUES (
        p_store_id, p_store_id, 'checkout', v_order_id::TEXT, 'checkout.completed',
        jsonb_build_object(
            'site_id', p_store_id, 'order_id', v_order_id,
            'payment_transaction_id', v_payment_transaction_id,
            'subtotal', COALESCE(v_order.subtotal, 0),
            'shipping_total', v_shipping_amount,
            'tax_total', v_tax_amount,
            'discount_total', v_discount_amount,
            'gift_card_total', v_gift_card_amount,
            'grand_total', v_grand_total,
            'payment_due', v_payment_due,
            'schema_version', 1
        ),
        'checkout.completed:' || v_order_id::TEXT, p_request_id, p_request_id, 1, p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$function$;
