-- ============================================================================
-- Migration 035: Payment Failure/Refund State RPC
-- Centralizes failed/expired/refunded payment state transitions and optional
-- inventory release for abandoned checkout orders.
-- ============================================================================

CREATE OR REPLACE FUNCTION record_order_payment_failure(
    p_order_id UUID,
    p_provider TEXT,
    p_provider_event_id TEXT,
    p_payment_status TEXT,
    p_order_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_release_inventory BOOLEAN DEFAULT FALSE,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_event_id TEXT;
    v_order_json JSONB;
BEGIN
    IF p_order_id IS NULL OR p_provider IS NULL THEN
        RAISE EXCEPTION 'order_id and provider are required';
    END IF;

    IF p_payment_status NOT IN ('failed', 'refunded') THEN
        RAISE EXCEPTION 'unsupported payment status';
    END IF;

    IF p_order_status NOT IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'unsupported order status';
    END IF;

    v_event_id := COALESCE(
        NULLIF(p_provider_event_id, ''),
        p_provider || ':' || p_payment_status || ':' || p_order_id::TEXT
    );

    SELECT id, store_id, payment_status, status
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    INSERT INTO payment_webhook_events (
        provider,
        provider_event_id,
        event_type,
        signature_valid,
        processing_status,
        raw_payload,
        processed_at
    )
    VALUES (
        p_provider,
        v_event_id,
        'checkout.payment.' || p_payment_status,
        TRUE,
        'processed',
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'payment_status', p_payment_status,
            'order_status', p_order_status,
            'reason', p_reason,
            'request_id', p_request_id
        ),
        NOW()
    )
    ON CONFLICT (provider, provider_event_id)
    DO UPDATE SET
        signature_valid = TRUE,
        processing_status = 'processed',
        processed_at = COALESCE(payment_webhook_events.processed_at, NOW()),
        updated_at = NOW();

    UPDATE orders
       SET payment_status = p_payment_status,
           status = p_order_status,
           payment_failure_reason = p_reason,
           last_payment_event_id = v_event_id,
           updated_at = NOW()
     WHERE id = p_order_id
     RETURNING to_jsonb(orders.*) INTO v_order_json;

    IF p_release_inventory THEN
        PERFORM release_order_inventory(p_order_id, NULL, p_request_id, COALESCE(p_reason, 'payment_failed'));
    END IF;

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id
    )
    VALUES (
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'payment.' || p_payment_status,
        jsonb_build_object(
            'store_id', v_order.store_id,
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_event_id', v_event_id,
            'payment_status', p_payment_status,
            'order_status', p_order_status,
            'reason', p_reason
        ),
        'payment.' || p_payment_status || ':' || p_provider || ':' || v_event_id,
        p_request_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO audit_activity_events (
        store_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        after_state
    )
    VALUES (
        v_order.store_id,
        'webhook',
        'payment.' || p_payment_status,
        'order',
        p_order_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_event_id', v_event_id,
            'payment_status', p_payment_status,
            'order_status', p_order_status,
            'reason', p_reason
        )
    );

    RETURN v_order_json;
END;
$$;

REVOKE ALL ON FUNCTION record_order_payment_failure(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION record_order_payment_failure(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT)
TO service_role;
