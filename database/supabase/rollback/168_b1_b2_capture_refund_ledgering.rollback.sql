-- Rollback Phase B1/B2 capture/refund ledgering.
-- Restores the prior callable surface before migration 168.

CREATE OR REPLACE FUNCTION public.resolve_money_ledger_source_site_id(
  p_source_type text,
  p_source_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_uuid uuid;
  v_payment_uuid uuid;
  v_refund_uuid uuid;
  v_compat_table text;
  v_site_id uuid;
BEGIN
  v_source_uuid := public.money_ledger_source_uuid(p_source_id, p_metadata);
  v_payment_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_id', ''), '{}'::jsonb);
  v_refund_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'refund_id', ''), '{}'::jsonb);
  v_compat_table := NULLIF(p_metadata ->> 'compatibility_table', '');

  IF p_source_type = 'payment_capture' THEN
    IF v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE id = v_payment_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE provider_payment_id = p_source_id
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

  ELSIF p_source_type = 'refund' THEN
    IF v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE id = v_payment_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_refund_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.refunds
       WHERE id = v_refund_uuid
         AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'settlement' THEN
    IF v_compat_table = 'payout_statements' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    ELSIF v_compat_table = 'commission_reconciliation_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.commission_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    ELSIF v_compat_table = 'wallet_ledger_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.settlements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.commission_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'cod_remittance' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.cod_reconciliation_entries
       WHERE id = v_source_uuid
         AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'payout' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payouts WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'reversal' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.ledger_transactions
       WHERE id = v_source_uuid
         AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN v_site_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment_with_ledger(
  p_order_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_provider_order_id text DEFAULT NULL::text,
  p_provider_event_id text DEFAULT NULL::text,
  p_request_id text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_json jsonb;
  v_order record;
  v_payment_transaction_id uuid;
BEGIN
  v_order_json := confirm_order_payment(
    p_order_id,
    p_provider,
    p_provider_payment_id,
    p_provider_order_id,
    p_provider_event_id,
    p_request_id
  );

  SELECT *
    INTO v_order
    FROM orders
   WHERE id = p_order_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  UPDATE payment_transactions
     SET gateway_txn_id = COALESCE(p_provider_payment_id, gateway_txn_id),
         provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
         provider_payment_id = p_provider_payment_id,
         provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
         status = 'captured',
         captured_at = COALESCE(captured_at, now()),
         request_id = COALESCE(p_request_id, request_id),
         idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
         updated_at = now()
   WHERE order_id = p_order_id
     AND gateway = p_provider
     AND deleted_at IS NULL
   RETURNING id INTO v_payment_transaction_id;

  IF v_payment_transaction_id IS NULL THEN
    INSERT INTO payment_transactions (
      order_id,
      store_id,
      site_id,
      gateway,
      gateway_txn_id,
      provider_order_id,
      provider_payment_id,
      provider_event_id,
      amount,
      currency,
      status,
      payment_method,
      metadata,
      request_id,
      idempotency_key,
      captured_at
    )
    VALUES (
      p_order_id,
      v_order.store_id,
      v_order.store_id,
      p_provider,
      p_provider_payment_id,
      p_provider_order_id,
      p_provider_payment_id,
      p_provider_event_id,
      COALESCE(v_order.total, 0),
      COALESCE(v_order.currency, 'INR'),
      'captured',
      p_provider,
      jsonb_build_object('source', 'payment_confirmation'),
      p_request_id,
      p_idempotency_key,
      now()
    )
    RETURNING id INTO v_payment_transaction_id;
  END IF;

  INSERT INTO payment_attempts (
    site_id,
    order_id,
    payment_transaction_id,
    provider,
    attempt_type,
    status,
    amount,
    currency,
    provider_order_id,
    provider_payment_id,
    provider_event_id,
    idempotency_key,
    request_id,
    metadata
  )
  VALUES (
    v_order.store_id,
    p_order_id,
    v_payment_transaction_id,
    p_provider,
    'capture',
    'succeeded',
    COALESCE(v_order.total, 0),
    COALESCE(v_order.currency, 'INR'),
    p_provider_order_id,
    p_provider_payment_id,
    COALESCE(p_provider_event_id, 'capture:' || p_provider || ':' || p_provider_payment_id),
    p_idempotency_key,
    p_request_id,
    jsonb_build_object('provider_payment_id', p_provider_payment_id)
  )
  ON CONFLICT DO NOTHING;

  RETURN v_order_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order_refund(
  p_refund_id uuid,
  p_provider_refund_id text DEFAULT NULL::text,
  p_provider_event_id text DEFAULT NULL::text,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_request_id text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_refund RECORD;
  v_order RECORD;
  v_total_succeeded NUMERIC(12,2);
  v_order_total NUMERIC(12,2);
  v_payment_status TEXT;
BEGIN
  IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT *
    INTO v_refund
    FROM refunds
   WHERE id = p_refund_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund not found';
  END IF;

  IF v_refund.status = 'succeeded' THEN
    RETURN jsonb_build_object('refund', to_jsonb(v_refund), 'idempotent_replay', true);
  END IF;

  SELECT *
    INTO v_order
    FROM orders
   WHERE id = v_refund.order_id
     AND deleted_at IS NULL
   FOR UPDATE;

  UPDATE refunds
     SET status = 'succeeded',
         provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
         provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
         updated_at = NOW(),
         updated_by = p_actor_id
   WHERE id = p_refund_id;

  UPDATE refund_transactions
     SET status = 'succeeded',
         provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
         provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
         updated_at = NOW(),
         updated_by = p_actor_id
   WHERE order_id = v_refund.order_id
     AND site_id = v_refund.site_id
     AND metadata ->> 'refund_id' = p_refund_id::TEXT
     AND deleted_at IS NULL;

  INSERT INTO refund_attempts (
    site_id,
    refund_transaction_id,
    provider,
    status,
    provider_refund_id,
    provider_event_id,
    idempotency_key,
    request_id,
    metadata,
    created_by
  )
  SELECT
    rt.site_id,
    rt.id,
    CASE
      WHEN v_refund.provider IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer', 'gift_card') THEN v_refund.provider
      WHEN v_refund.refund_method = 'gift_card' THEN 'gift_card'
      WHEN v_refund.refund_method = 'manual' THEN 'bank_transfer'
      WHEN v_order.payment_gateway IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer') THEN v_order.payment_gateway
      WHEN v_order.payment_method IN ('stripe', 'razorpay', 'paypal', 'cod', 'bank_transfer') THEN v_order.payment_method
      ELSE 'bank_transfer'
    END,
    'succeeded',
    p_provider_refund_id,
    p_provider_event_id,
    p_idempotency_key,
    p_request_id,
    jsonb_build_object('refund_id', p_refund_id),
    p_actor_id
  FROM refund_transactions rt
  WHERE rt.order_id = v_refund.order_id
    AND rt.site_id = v_refund.site_id
    AND rt.metadata ->> 'refund_id' = p_refund_id::TEXT
    AND rt.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_succeeded
    FROM refunds
   WHERE order_id = v_refund.order_id
     AND site_id = v_refund.site_id
     AND status = 'succeeded'
     AND deleted_at IS NULL;

  v_order_total := COALESCE(v_order.total, 0);
  v_payment_status := CASE WHEN v_total_succeeded >= v_order_total THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE payment_transactions
     SET status = v_payment_status,
         refunded_at = CASE WHEN v_payment_status = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
         updated_at = NOW(),
         updated_by = p_actor_id
   WHERE id = v_refund.payment_transaction_id
     AND deleted_at IS NULL;

  UPDATE returns
     SET status = 'refunded',
         refunded_at = NOW(),
         updated_at = NOW(),
         updated_by = p_actor_id
   WHERE id = v_refund.return_id
     AND deleted_at IS NULL;

  UPDATE orders
     SET refund_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE 'partially_refunded' END,
         payment_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE payment_status END,
         status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE status END,
         return_status = 'refunded',
         updated_at = NOW(),
         updated_by = p_actor_id
   WHERE id = v_refund.order_id;

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
    v_refund.site_id,
    v_refund.site_id,
    'refund',
    p_refund_id::TEXT,
    'refund.succeeded',
    jsonb_build_object(
      'site_id', v_refund.site_id,
      'order_id', v_refund.order_id,
      'refund_id', p_refund_id,
      'amount', v_refund.amount,
      'provider_refund_id', p_provider_refund_id
    ),
    'refund.succeeded:' || p_refund_id::TEXT,
    p_request_id,
    p_request_id,
    1,
    p_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_refund.order_id),
    'refund', (SELECT to_jsonb(r) FROM refunds r WHERE r.id = p_refund_id),
    'total_refunded', v_total_succeeded
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_payment_failure_with_ledger(
  p_order_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_payment_status text,
  p_order_status text,
  p_reason text DEFAULT NULL::text,
  p_release_inventory boolean DEFAULT false,
  p_request_id text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_json jsonb;
  v_order record;
  v_payment_transaction_id uuid;
  v_attempt_status text := CASE WHEN p_payment_status = 'refunded' THEN 'succeeded' ELSE 'failed' END;
BEGIN
  v_order_json := record_order_payment_failure(
    p_order_id,
    p_provider,
    p_provider_event_id,
    p_payment_status,
    p_order_status,
    p_reason,
    p_release_inventory,
    p_request_id
  );

  SELECT *
    INTO v_order
    FROM orders
   WHERE id = p_order_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  UPDATE payment_transactions
     SET status = CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
         provider_event_id = p_provider_event_id,
         failure_reason = p_reason,
         refunded_at = CASE WHEN p_payment_status = 'refunded' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
         request_id = COALESCE(p_request_id, request_id),
         idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
         updated_at = now()
   WHERE order_id = p_order_id
     AND gateway = p_provider
     AND deleted_at IS NULL
   RETURNING id INTO v_payment_transaction_id;

  IF v_payment_transaction_id IS NULL THEN
    INSERT INTO payment_transactions (
      order_id,
      store_id,
      site_id,
      gateway,
      amount,
      currency,
      status,
      failure_reason,
      provider_event_id,
      payment_method,
      metadata,
      request_id,
      idempotency_key,
      refunded_at
    )
    VALUES (
      p_order_id,
      v_order.store_id,
      v_order.store_id,
      p_provider,
      COALESCE(v_order.total, 0),
      COALESCE(v_order.currency, 'INR'),
      CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
      p_reason,
      p_provider_event_id,
      p_provider,
      jsonb_build_object('source', 'payment_failure'),
      p_request_id,
      p_idempotency_key,
      CASE WHEN p_payment_status = 'refunded' THEN now() ELSE NULL END
    )
    RETURNING id INTO v_payment_transaction_id;
  END IF;

  INSERT INTO payment_attempts (
    site_id,
    order_id,
    payment_transaction_id,
    provider,
    attempt_type,
    status,
    amount,
    currency,
    provider_event_id,
    idempotency_key,
    request_id,
    failure_reason,
    metadata
  )
  VALUES (
    v_order.store_id,
    p_order_id,
    v_payment_transaction_id,
    p_provider,
    'failure',
    v_attempt_status,
    COALESCE(v_order.total, 0),
    COALESCE(v_order.currency, 'INR'),
    p_provider_event_id,
    p_idempotency_key,
    p_request_id,
    p_reason,
    jsonb_build_object('payment_status', p_payment_status, 'order_status', p_order_status)
  )
  ON CONFLICT DO NOTHING;

  RETURN v_order_json;
END;
$$;
