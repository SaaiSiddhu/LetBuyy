-- Forward migration after the verified baseline.
-- Keeps checkout RPC callers that populate title/unit_price compatible with the
-- historical order_items.name and order_items.price NOT NULL contract.

CREATE OR REPLACE FUNCTION public.fill_order_item_required_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_snapshot_price NUMERIC;
BEGIN
    IF NEW.product_snapshot IS NULL THEN
        NEW.product_snapshot := '{}'::jsonb;
    END IF;

    IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
        NEW.name := COALESCE(
            NULLIF(BTRIM(NEW.title), ''),
            NULLIF(BTRIM(NEW.product_snapshot ->> 'name'), ''),
            'Order item'
        );
    END IF;

    IF NEW.price IS NULL THEN
        BEGIN
            v_snapshot_price := NULLIF(NEW.product_snapshot ->> 'price', '')::NUMERIC;
        EXCEPTION
            WHEN invalid_text_representation OR numeric_value_out_of_range THEN
                v_snapshot_price := NULL;
        END;

        NEW.price := COALESCE(NEW.unit_price, v_snapshot_price, 0);
    END IF;

    IF NEW.title IS NULL OR BTRIM(NEW.title) = '' THEN
        NEW.title := NEW.name;
    END IF;

    IF NEW.unit_price IS NULL THEN
        NEW.unit_price := NEW.price;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_required_fields ON public.order_items;

CREATE TRIGGER trg_order_items_required_fields
BEFORE INSERT OR UPDATE OF name, title, price, unit_price, product_snapshot
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.fill_order_item_required_fields();

CREATE OR REPLACE FUNCTION public.create_checkout_order(
    p_store_id uuid,
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_shipping_address jsonb,
    p_items jsonb,
    p_payment_method text,
    p_notes text DEFAULT NULL::text,
    p_coupon_code text DEFAULT NULL::text,
    p_gift_card_code text DEFAULT NULL::text,
    p_shipping_method text DEFAULT 'standard'::text,
    p_idempotency_key text DEFAULT NULL::text,
    p_actor_id uuid DEFAULT NULL::uuid,
    p_request_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_payment_method NOT IN ('razorpay', 'stripe', 'paypal', 'cod') THEN
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

    IF v_shipping_method = 'express' THEN
        v_shipping_amount := 99;
    ELSIF v_shipping_method = 'standard' THEN
        v_shipping_amount := 0;
    ELSE
        RAISE EXCEPTION 'unsupported shipping method: %', v_shipping_method;
    END IF;

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
            site_id,
            gift_card_account_id,
            order_id,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            v_gift_card_amount,
            'committed',
            'gift_card.redemption:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        INSERT INTO gift_card_ledger_entries (
            site_id,
            gift_card_account_id,
            order_id,
            entry_type,
            amount,
            balance_after,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            'debit',
            v_gift_card_amount,
            COALESCE(v_gift_card_balance, 0) - v_gift_card_amount,
            'gift_card.debit:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
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
        site_id,
        order_id,
        customer_email,
        status,
        idempotency_key,
        subtotal,
        shipping_total,
        tax_total,
        discount_total,
        gift_card_total,
        grand_total,
        currency,
        shipping_method,
        payment_method,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        p_customer_email,
        'completed',
        p_idempotency_key,
        COALESCE(v_order.subtotal, 0),
        v_shipping_amount,
        v_tax_amount,
        v_discount_amount,
        v_gift_card_amount,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        v_shipping_method,
        p_payment_method,
        p_request_id,
        jsonb_build_object('source', 'create_checkout_order', 'payment_due', v_payment_due, 'promotion', v_promotion),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO order_shipping_lines (
        site_id,
        order_id,
        title,
        method,
        amount,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        CASE WHEN v_shipping_method = 'express' THEN 'Express Shipping' ELSE 'Standard Shipping' END,
        v_shipping_method,
        v_shipping_amount,
        jsonb_build_object('computed_by', 'create_checkout_order'),
        p_actor_id
    );

    IF v_discount_amount > 0 THEN
        INSERT INTO order_line_adjustments (
            site_id,
            order_id,
            adjustment_type,
            source_type,
            source_id,
            title,
            amount,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_order_id,
            'promotion',
            CASE WHEN (v_promotion ->> 'promotion_id') IS NOT NULL THEN 'promotion' ELSE 'coupon' END,
            COALESCE(NULLIF(v_promotion ->> 'promotion_id', '')::UUID, NULLIF(v_promotion ->> 'coupon_id', '')::UUID),
            COALESCE(v_promotion ->> 'title', 'Promotion'),
            v_discount_amount,
            v_promotion,
            p_actor_id
        );

        INSERT INTO promotion_redemptions (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            order_id,
            customer_email,
            code,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            v_order_id,
            p_customer_email,
            v_promotion ->> 'code',
            v_discount_amount,
            'committed',
            'promotion.redemption:' || v_order_id::TEXT || ':' || COALESCE(v_promotion ->> 'code', 'unknown'),
            p_request_id,
            v_promotion,
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        UPDATE promotion_codes
           SET usage_count = usage_count + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID;

        UPDATE coupons
           SET usage_count = COALESCE(usage_count, 0) + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'coupon_id', '')::UUID;

        INSERT INTO promotion_usage_counters (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            customer_email,
            usage_count
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            LOWER(p_customer_email),
            1
        )
        ON CONFLICT (site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
        DO UPDATE SET usage_count = promotion_usage_counters.usage_count + 1,
                      updated_at = NOW();
    END IF;

    INSERT INTO payment_transactions (
        order_id,
        store_id,
        site_id,
        gateway,
        amount,
        currency,
        status,
        payment_method,
        metadata,
        request_id,
        idempotency_key,
        created_by,
        captured_at
    )
    VALUES (
        v_order_id,
        p_store_id,
        p_store_id,
        p_payment_method,
        v_payment_due,
        COALESCE(v_order.currency, 'INR'),
        CASE WHEN v_payment_due = 0 THEN 'captured' ELSE 'pending' END,
        p_payment_method,
        jsonb_build_object('source', 'checkout', 'gift_card_total', v_gift_card_amount),
        p_request_id,
        p_idempotency_key || ':payment',
        p_actor_id,
        CASE WHEN v_payment_due = 0 THEN NOW() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_transaction_id;

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
        p_store_id,
        il.id,
        r.location_id,
        oi.product_id,
        NULLIF(oi.variant_id, '')::UUID,
        v_order_id,
        r.id,
        'sale_committed',
        -oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        oi.quantity,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        v_order_id,
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
        p_store_id,
        p_store_id,
        'checkout',
        v_order_id::TEXT,
        'checkout.completed',
        jsonb_build_object(
            'site_id', p_store_id,
            'order_id', v_order_id,
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
        'checkout.completed:' || v_order_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.fill_theme_release_required_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.release_config IS NULL THEN
        NEW.release_config := '{}'::jsonb;
    END IF;

    IF NEW.release_manifest IS NULL THEN
        NEW.release_manifest := '{}'::jsonb;
    END IF;

    IF NEW.template_snapshot IS NULL THEN
        NEW.template_snapshot := NEW.release_config;
    END IF;

    IF NEW.settings_snapshot IS NULL THEN
        NEW.settings_snapshot := COALESCE(NEW.release_config -> 'themeSettings', '{}'::jsonb);
    END IF;

    IF NEW.asset_manifest IS NULL THEN
        NEW.asset_manifest := '{}'::jsonb;
    END IF;

    IF NEW.cache_manifest IS NULL THEN
        NEW.cache_manifest := '{}'::jsonb;
    END IF;

    IF NEW.data_binding_manifest IS NULL THEN
        NEW.data_binding_manifest := '{}'::jsonb;
    END IF;

    IF NEW.schema_manifest_version IS NULL OR BTRIM(NEW.schema_manifest_version) = '' THEN
        NEW.schema_manifest_version := '1.0.0';
    END IF;

    IF NEW.engine_version IS NULL OR BTRIM(NEW.engine_version) = '' THEN
        NEW.engine_version := 'theme-engine-v1';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_theme_releases_required_fields ON public.theme_releases;

CREATE TRIGGER trg_theme_releases_required_fields
BEFORE INSERT OR UPDATE OF release_config, release_manifest, template_snapshot,
    settings_snapshot, asset_manifest, cache_manifest, data_binding_manifest,
    schema_manifest_version, engine_version
ON public.theme_releases
FOR EACH ROW
EXECUTE FUNCTION public.fill_theme_release_required_fields();

CREATE OR REPLACE FUNCTION public.publish_theme_release(
    p_store_id uuid,
    p_theme_id text,
    p_release_config jsonb,
    p_source_draft_id uuid DEFAULT NULL::uuid,
    p_source_draft_version integer DEFAULT NULL::integer,
    p_published_by uuid DEFAULT NULL::uuid,
    p_publish_message text DEFAULT NULL::text,
    p_make_store_live boolean DEFAULT true,
    p_request_id text DEFAULT NULL::text,
    p_rollback_of_release_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(release_id uuid, release_version integer, published_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_next_version INTEGER;
    v_release_id UUID := gen_random_uuid();
    v_published_at TIMESTAMPTZ := NOW();
    v_theme_instance_id UUID;
    v_theme_package_version_id UUID;
    v_schema_manifest_version TEXT := '1.0.0';
    v_cache_manifest JSONB;
    v_release_manifest JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_theme_id IS NULL OR LENGTH(TRIM(p_theme_id)) = 0 THEN
        RAISE EXCEPTION 'theme_id is required';
    END IF;

    SELECT
        ti.id,
        ti.theme_package_version_id,
        COALESCE(tpv.schema_version, '1.0.0')
      INTO v_theme_instance_id, v_theme_package_version_id, v_schema_manifest_version
      FROM theme_instances ti
      LEFT JOIN theme_package_versions tpv ON tpv.id = ti.theme_package_version_id
     WHERE ti.store_id = p_store_id
       AND ti.theme_slug = p_theme_id
       AND ti.deleted_at IS NULL
     ORDER BY
       CASE WHEN ti.instance_status = 'active' THEN 0 ELSE 1 END,
       ti.updated_at DESC
     LIMIT 1;

    v_schema_manifest_version := COALESCE(v_schema_manifest_version, '1.0.0');

    SELECT COALESCE(MAX(tr.release_version), 0) + 1
      INTO v_next_version
      FROM theme_releases tr
     WHERE tr.store_id = p_store_id
       AND tr.deleted_at IS NULL;

    v_cache_manifest := jsonb_build_object(
        'tags',
        jsonb_build_array(
            'store:' || p_store_id::TEXT,
            'theme:' || p_theme_id,
            'theme_release:' || v_release_id::TEXT
        )
    );

    v_release_manifest := jsonb_build_object(
        'engine',
        'theme-engine-v1',
        'store_id',
        p_store_id,
        'theme_id',
        p_theme_id,
        'release_id',
        v_release_id,
        'release_version',
        v_next_version,
        'theme_instance_id',
        v_theme_instance_id,
        'theme_package_version_id',
        v_theme_package_version_id,
        'schema_manifest_version',
        v_schema_manifest_version
    );

    UPDATE theme_releases
       SET is_current = FALSE,
           release_status = 'superseded',
           updated_at = NOW()
     WHERE store_id = p_store_id
       AND is_current = TRUE
       AND deleted_at IS NULL;

    INSERT INTO theme_releases (
        id,
        store_id,
        theme_id,
        theme_instance_id,
        theme_package_version_id,
        release_version,
        release_status,
        is_current,
        release_config,
        release_manifest,
        template_snapshot,
        settings_snapshot,
        asset_manifest,
        cache_manifest,
        data_binding_manifest,
        schema_manifest_version,
        engine_version,
        source_draft_id,
        source_draft_version,
        publish_message,
        published_by,
        rollback_of_release_id,
        metadata,
        published_at
    )
    VALUES (
        v_release_id,
        p_store_id,
        p_theme_id,
        v_theme_instance_id,
        v_theme_package_version_id,
        v_next_version,
        'published',
        TRUE,
        COALESCE(p_release_config, '{}'::JSONB),
        v_release_manifest,
        COALESCE(p_release_config, '{}'::JSONB),
        COALESCE(p_release_config->'themeSettings', '{}'::JSONB),
        '{}'::JSONB,
        v_cache_manifest,
        '{}'::JSONB,
        v_schema_manifest_version,
        'theme-engine-v1',
        p_source_draft_id,
        p_source_draft_version,
        p_publish_message,
        p_published_by,
        p_rollback_of_release_id,
        jsonb_build_object(
            'request_id', p_request_id,
            'source', CASE WHEN p_rollback_of_release_id IS NULL THEN 'publish' ELSE 'rollback' END
        ),
        v_published_at
    );

    UPDATE sites
       SET theme_id = p_theme_id,
           template_config = COALESCE(p_release_config, '{}'::JSONB),
           current_theme_release_id = v_release_id,
           storefront_release_version = v_next_version,
           status = CASE WHEN p_make_store_live THEN 'published' ELSE status END,
           published_at = CASE WHEN p_make_store_live THEN v_published_at ELSE sites.published_at END,
           updated_at = NOW()
     WHERE id = p_store_id;

    IF v_theme_instance_id IS NOT NULL THEN
        UPDATE theme_instances
           SET active_release_id = v_release_id,
               current_draft_id = NULL,
               instance_status = CASE WHEN p_make_store_live THEN 'active' ELSE instance_status END,
               activated_at = CASE WHEN p_make_store_live THEN v_published_at ELSE activated_at END,
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE id = v_theme_instance_id;

        UPDATE theme_instance_drafts
           SET draft_status = 'published',
               updated_at = NOW(),
               updated_by = p_published_by
         WHERE theme_instance_id = v_theme_instance_id
           AND draft_status = 'active'
           AND deleted_at IS NULL;
    END IF;

    INSERT INTO storefront_cache_tags (
        store_id,
        tag,
        resource_type,
        resource_id,
        release_id,
        invalidated_at
    )
    VALUES
        (p_store_id, 'store:' || p_store_id::TEXT, 'store', p_store_id::TEXT, v_release_id, NOW()),
        (p_store_id, 'theme:' || p_theme_id, 'theme', p_theme_id, v_release_id, NOW()),
        (p_store_id, 'theme_release:' || v_release_id::TEXT, 'theme_release', v_release_id::TEXT, v_release_id, NOW())
    ON CONFLICT (store_id, tag)
    DO UPDATE SET
        resource_type = EXCLUDED.resource_type,
        resource_id = EXCLUDED.resource_id,
        release_id = EXCLUDED.release_id,
        invalidated_at = NOW(),
        updated_at = NOW();

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
        'theme_release',
        v_release_id::TEXT,
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.release.published' ELSE 'theme.release.rollback_published' END,
        jsonb_build_object(
            'store_id', p_store_id,
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version,
            'cache_tags', v_cache_manifest->'tags'
        ),
        'theme.release:' || p_store_id::TEXT || ':' || v_next_version::TEXT,
        p_request_id,
        p_published_by
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
        after_state,
        metadata
    )
    VALUES (
        p_store_id,
        p_published_by,
        'user',
        CASE WHEN p_rollback_of_release_id IS NULL THEN 'theme.publish' ELSE 'theme.rollback' END,
        'theme_release',
        v_release_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'theme_id', p_theme_id,
            'theme_instance_id', v_theme_instance_id,
            'theme_package_version_id', v_theme_package_version_id,
            'release_id', v_release_id,
            'release_version', v_next_version
        ),
        jsonb_build_object(
            'publish_message', p_publish_message,
            'rollback_of_release_id', p_rollback_of_release_id
        )
    );

    release_id := v_release_id;
    release_version := v_next_version;
    published_at := v_published_at;
    RETURN NEXT;
END;
$$;
