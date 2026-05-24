-- ============================================================================
-- Migration 033: Payment State Machine RPCs
-- Centralizes payment reference attachment and paid-state confirmation.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

CREATE OR REPLACE FUNCTION attach_order_payment_reference(
    p_order_id UUID,
    p_provider TEXT,
    p_provider_order_id TEXT,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_order_json JSONB;
BEGIN
    IF p_order_id IS NULL OR p_provider IS NULL OR p_provider_order_id IS NULL THEN
        RAISE EXCEPTION 'order_id, provider, and provider_order_id are required';
    END IF;

    SELECT id, store_id, payment_id, payment_status, status, inventory_reserved_at
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.payment_status = 'paid' THEN
        RAISE EXCEPTION 'order is already paid';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order is not payable';
    END IF;

    IF v_order.inventory_reserved_at IS NULL THEN
        RAISE EXCEPTION 'order inventory is not reserved';
    END IF;

    IF v_order.payment_id IS NOT NULL AND v_order.payment_id <> p_provider_order_id THEN
        RAISE EXCEPTION 'order already has a different payment reference';
    END IF;

    UPDATE orders
       SET payment_id = p_provider_order_id,
           payment_method = p_provider,
           payment_gateway = p_provider,
           updated_at = NOW()
     WHERE id = p_order_id
     RETURNING to_jsonb(orders.*) INTO v_order_json;

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
        'payment.reference.attached',
        jsonb_build_object(
            'store_id', v_order.store_id,
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_order_id', p_provider_order_id
        ),
        'payment.reference.attached:' || p_provider || ':' || p_provider_order_id,
        p_request_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN v_order_json;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_order_payment(
    p_order_id UUID,
    p_provider TEXT,
    p_provider_payment_id TEXT,
    p_provider_order_id TEXT DEFAULT NULL,
    p_provider_event_id TEXT DEFAULT NULL,
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
    IF p_order_id IS NULL OR p_provider IS NULL OR p_provider_payment_id IS NULL THEN
        RAISE EXCEPTION 'order_id, provider, and provider_payment_id are required';
    END IF;

    v_event_id := COALESCE(
        NULLIF(p_provider_event_id, ''),
        p_provider || ':payment:' || p_provider_payment_id
    );

    SELECT id, store_id, payment_id, payment_status, status
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order is not payable';
    END IF;

    IF p_provider_order_id IS NOT NULL
       AND v_order.payment_id IS NOT NULL
       AND v_order.payment_id <> p_provider_order_id
       AND v_order.payment_id <> p_provider_payment_id THEN
        RAISE EXCEPTION 'payment reference mismatch';
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
        'checkout.payment.confirmed',
        TRUE,
        'processed',
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_order_id', p_provider_order_id,
            'provider_payment_id', p_provider_payment_id,
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

    IF v_order.payment_status = 'paid' THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = p_order_id;
        RETURN v_order_json;
    END IF;

    UPDATE orders
       SET payment_status = 'paid',
           payment_id = p_provider_payment_id,
           payment_method = p_provider,
           payment_gateway = p_provider,
           status = 'confirmed',
           payment_processed_at = NOW(),
           last_payment_event_id = v_event_id,
           payment_failure_reason = NULL,
           updated_at = NOW()
     WHERE id = p_order_id
     RETURNING to_jsonb(orders.*) INTO v_order_json;

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
        'payment.confirmed',
        jsonb_build_object(
            'store_id', v_order.store_id,
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_payment_id', p_provider_payment_id,
            'provider_event_id', v_event_id
        ),
        'payment.confirmed:' || p_provider || ':' || p_provider_payment_id,
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
        'payment.confirm',
        'order',
        p_order_id::TEXT,
        p_request_id,
        jsonb_build_object(
            'order_id', p_order_id,
            'provider', p_provider,
            'provider_payment_id', p_provider_payment_id,
            'provider_event_id', v_event_id
        )
    );

    RETURN v_order_json;
END;
$$;

REVOKE ALL ON FUNCTION attach_order_payment_reference(UUID, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION attach_order_payment_reference(UUID, TEXT, TEXT, TEXT)
TO service_role;

REVOKE ALL ON FUNCTION confirm_order_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION confirm_order_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
TO service_role;
