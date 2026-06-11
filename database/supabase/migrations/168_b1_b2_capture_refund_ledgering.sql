-- Phase B1/B2: capture and refund ledgering.
-- The existing payment/refund hub RPCs now post balanced canonical ledger
-- entries in the same transaction as their money-state updates.

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
  v_payment_transaction_uuid uuid;
  v_refund_uuid uuid;
  v_compat_table text;
  v_site_id uuid;
BEGIN
  v_source_uuid := public.money_ledger_source_uuid(p_source_id, p_metadata);
  v_payment_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_id', ''), '{}'::jsonb);
  v_payment_transaction_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_transaction_id', ''), '{}'::jsonb);
  v_refund_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'refund_id', ''), '{}'::jsonb);
  v_compat_table := NULLIF(p_metadata ->> 'compatibility_table', '');

  IF p_source_type = 'payment_capture' THEN
    IF v_payment_transaction_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payment_transactions
       WHERE id = v_payment_transaction_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payment_transactions
       WHERE provider_payment_id = COALESCE(NULLIF(p_metadata ->> 'provider_payment_id', ''), p_source_id)
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_site_id IS NULL AND v_payment_uuid IS NOT NULL THEN
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
    IF v_refund_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.refunds
       WHERE id = v_refund_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_payment_transaction_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payment_transactions
       WHERE id = v_payment_transaction_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE id = v_payment_uuid
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
  v_site_id uuid;
  v_amount_minor bigint;
  v_ledger_transaction_id uuid;
  v_ledger_idempotency_key text;
BEGIN
  IF p_provider_payment_id IS NULL OR btrim(p_provider_payment_id) = '' THEN
    RAISE EXCEPTION 'provider_payment_id is required';
  END IF;

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
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_site_id := COALESCE(v_order.site_id, v_order.store_id);
  v_amount_minor := round(COALESCE(v_order.total, 0) * 100)::bigint;
  v_ledger_idempotency_key := COALESCE(NULLIF(p_idempotency_key, ''), p_provider_payment_id);

  UPDATE payment_transactions
     SET gateway_txn_id = COALESCE(p_provider_payment_id, gateway_txn_id),
         provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
         provider_payment_id = p_provider_payment_id,
         provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
         status = 'captured',
         captured_at = COALESCE(captured_at, now()),
         request_id = COALESCE(p_request_id, request_id),
         idempotency_key = COALESCE(v_ledger_idempotency_key, idempotency_key),
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
      v_site_id,
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
      v_ledger_idempotency_key,
      now()
    )
    RETURNING id INTO v_payment_transaction_id;
  END IF;

  IF v_amount_minor > 0 THEN
    v_ledger_transaction_id := public.post_settlement_ledger_transaction(
      v_site_id,
      'payment_capture',
      p_provider || ':' || p_provider_payment_id,
      v_ledger_idempotency_key,
      jsonb_build_array(
        jsonb_build_object(
          'account_code', 'pa_clearing',
          'side', 'debit',
          'amount_minor', v_amount_minor,
          'memo', 'Payment capture ' || p_provider || ':' || p_provider_payment_id
        ),
        jsonb_build_object(
          'account_code', 'merchant_payable',
          'side', 'credit',
          'amount_minor', v_amount_minor,
          'memo', 'Merchant payable capture ' || p_order_id::text
        )
      ),
      jsonb_build_object(
        'compatibility_table', 'payment_transactions',
        'payment_transaction_id', v_payment_transaction_id,
        'order_id', p_order_id,
        'provider', p_provider,
        'provider_payment_id', p_provider_payment_id,
        'provider_order_id', p_provider_order_id,
        'provider_event_id', p_provider_event_id
      ),
      p_request_id
    );

    UPDATE payment_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id),
           updated_at = now()
     WHERE id = v_payment_transaction_id;
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
    v_site_id,
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
    v_ledger_idempotency_key,
    p_request_id,
    jsonb_build_object('provider_payment_id', p_provider_payment_id, 'canonical_ledger_transaction_id', v_ledger_transaction_id)
  )
  ON CONFLICT DO NOTHING;

  RETURN v_order_json || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id);
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
  v_refund record;
  v_order record;
  v_total_succeeded numeric(12,2);
  v_existing_succeeded numeric(12,2);
  v_order_total numeric(12,2);
  v_payment_status text;
  v_amount_minor bigint;
  v_ledger_transaction_id uuid;
  v_ledger_idempotency_key text;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
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

  SELECT *
    INTO v_order
    FROM orders
   WHERE id = v_refund.order_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_order_total := COALESCE(v_order.total, 0);
  v_amount_minor := round(COALESCE(v_refund.amount, 0) * 100)::bigint;
  v_ledger_idempotency_key := COALESCE(NULLIF(p_idempotency_key, ''), NULLIF(v_refund.idempotency_key, ''), p_provider_refund_id, p_refund_id::text);

  IF v_refund.status <> 'succeeded' THEN
    SELECT COALESCE(SUM(amount), 0)
      INTO v_existing_succeeded
      FROM refunds
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND status = 'succeeded'
       AND id <> p_refund_id
       AND deleted_at IS NULL;

    IF v_existing_succeeded + COALESCE(v_refund.amount, 0) > v_order_total THEN
      RAISE EXCEPTION 'refund amount exceeds captured order total';
    END IF;

    UPDATE refunds
       SET status = 'succeeded',
           provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           updated_at = now(),
           updated_by = p_actor_id
     WHERE id = p_refund_id;

    UPDATE refund_transactions
       SET status = 'succeeded',
           provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           updated_at = now(),
           updated_by = p_actor_id
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND metadata ->> 'refund_id' = p_refund_id::text
       AND deleted_at IS NULL;
  END IF;

  IF v_amount_minor > 0 THEN
    v_ledger_transaction_id := public.post_settlement_ledger_transaction(
      v_refund.site_id,
      'refund',
      'refund:' || p_refund_id::text,
      v_ledger_idempotency_key,
      jsonb_build_array(
        jsonb_build_object(
          'account_code', 'merchant_payable',
          'side', 'debit',
          'amount_minor', v_amount_minor,
          'memo', 'Refund merchant payable reversal ' || p_refund_id::text
        ),
        jsonb_build_object(
          'account_code', 'refund_clearing',
          'side', 'credit',
          'amount_minor', v_amount_minor,
          'memo', 'Refund clearing ' || p_refund_id::text
        )
      ),
      jsonb_build_object(
        'compatibility_table', 'refunds',
        'refund_id', p_refund_id,
        'payment_transaction_id', v_refund.payment_transaction_id,
        'order_id', v_refund.order_id,
        'provider_refund_id', p_provider_refund_id,
        'provider_event_id', p_provider_event_id
      ),
      p_request_id
    );

    UPDATE refunds
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id),
           updated_at = now()
     WHERE id = p_refund_id;

    UPDATE refund_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id),
           updated_at = now()
     WHERE order_id = v_refund.order_id
       AND site_id = v_refund.site_id
       AND metadata ->> 'refund_id' = p_refund_id::text
       AND deleted_at IS NULL;
  END IF;

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
    v_ledger_idempotency_key,
    p_request_id,
    jsonb_build_object('refund_id', p_refund_id, 'canonical_ledger_transaction_id', v_ledger_transaction_id),
    p_actor_id
  FROM refund_transactions rt
  WHERE rt.order_id = v_refund.order_id
    AND rt.site_id = v_refund.site_id
    AND rt.metadata ->> 'refund_id' = p_refund_id::text
    AND rt.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_succeeded
    FROM refunds
   WHERE order_id = v_refund.order_id
     AND site_id = v_refund.site_id
     AND status = 'succeeded'
     AND deleted_at IS NULL;

  v_payment_status := CASE WHEN v_total_succeeded >= v_order_total THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE payment_transactions
     SET status = v_payment_status,
         refunded_at = CASE WHEN v_payment_status = 'refunded' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
         updated_at = now(),
         updated_by = p_actor_id
   WHERE id = v_refund.payment_transaction_id
     AND deleted_at IS NULL;

  UPDATE returns
     SET status = 'refunded',
         refunded_at = now(),
         updated_at = now(),
         updated_by = p_actor_id
   WHERE id = v_refund.return_id
     AND deleted_at IS NULL;

  UPDATE orders
     SET refund_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE 'partially_refunded' END,
         payment_status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE payment_status END,
         status = CASE WHEN v_payment_status = 'refunded' THEN 'refunded' ELSE status END,
         return_status = 'refunded',
         updated_at = now(),
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
    p_refund_id::text,
    'refund.succeeded',
    jsonb_build_object(
      'site_id', v_refund.site_id,
      'order_id', v_refund.order_id,
      'refund_id', p_refund_id,
      'amount', v_refund.amount,
      'provider_refund_id', p_provider_refund_id,
      'canonical_ledger_transaction_id', v_ledger_transaction_id
    ),
    'refund.succeeded:' || p_refund_id::text,
    p_request_id,
    p_request_id,
    1,
    p_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_refund.order_id),
    'refund', (SELECT to_jsonb(r) FROM refunds r WHERE r.id = p_refund_id),
    'total_refunded', v_total_succeeded,
    'canonical_ledger_transaction_id', v_ledger_transaction_id
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
  v_site_id uuid;
  v_amount_minor bigint;
  v_ledger_transaction_id uuid;
  v_ledger_idempotency_key text;
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
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_site_id := COALESCE(v_order.site_id, v_order.store_id);
  v_amount_minor := round(COALESCE(v_order.total, 0) * 100)::bigint;
  v_ledger_idempotency_key := COALESCE(NULLIF(p_idempotency_key, ''), NULLIF(p_provider_event_id, ''), p_order_id::text);

  UPDATE payment_transactions
     SET status = CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
         provider_event_id = p_provider_event_id,
         failure_reason = p_reason,
         refunded_at = CASE WHEN p_payment_status = 'refunded' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
         request_id = COALESCE(p_request_id, request_id),
         idempotency_key = COALESCE(v_ledger_idempotency_key, idempotency_key),
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
      v_site_id,
      p_provider,
      COALESCE(v_order.total, 0),
      COALESCE(v_order.currency, 'INR'),
      CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE 'failed' END,
      p_reason,
      p_provider_event_id,
      p_provider,
      jsonb_build_object('source', 'payment_failure'),
      p_request_id,
      v_ledger_idempotency_key,
      CASE WHEN p_payment_status = 'refunded' THEN now() ELSE NULL END
    )
    RETURNING id INTO v_payment_transaction_id;
  END IF;

  IF p_payment_status = 'refunded' AND v_amount_minor > 0 THEN
    v_ledger_transaction_id := public.post_settlement_ledger_transaction(
      v_site_id,
      'refund',
      'payment-failure:' || p_order_id::text || ':' || COALESCE(p_provider_event_id, v_ledger_idempotency_key),
      v_ledger_idempotency_key,
      jsonb_build_array(
        jsonb_build_object(
          'account_code', 'merchant_payable',
          'side', 'debit',
          'amount_minor', v_amount_minor,
          'memo', 'Payment failure refund merchant payable reversal ' || p_order_id::text
        ),
        jsonb_build_object(
          'account_code', 'refund_clearing',
          'side', 'credit',
          'amount_minor', v_amount_minor,
          'memo', 'Payment failure refund clearing ' || p_order_id::text
        )
      ),
      jsonb_build_object(
        'compatibility_table', 'payment_transactions',
        'payment_transaction_id', v_payment_transaction_id,
        'order_id', p_order_id,
        'provider', p_provider,
        'provider_event_id', p_provider_event_id
      ),
      p_request_id
    );

    UPDATE payment_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id),
           updated_at = now()
     WHERE id = v_payment_transaction_id;
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
    v_site_id,
    p_order_id,
    v_payment_transaction_id,
    p_provider,
    'failure',
    v_attempt_status,
    COALESCE(v_order.total, 0),
    COALESCE(v_order.currency, 'INR'),
    p_provider_event_id,
    v_ledger_idempotency_key,
    p_request_id,
    p_reason,
    jsonb_build_object(
      'payment_status', p_payment_status,
      'order_status', p_order_status,
      'canonical_ledger_transaction_id', v_ledger_transaction_id
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN v_order_json || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id);
END;
$$;
