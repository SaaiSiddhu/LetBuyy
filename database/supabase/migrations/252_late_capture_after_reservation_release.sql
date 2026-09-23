-- Migration 252: a provider capture never turns an order whose stock was released into a normal,
-- fulfillable order, and one provider payment is posted to the ledger exactly once (F-PAY4-1).
--
-- WHAT IS WRONG (reproduced, not inferred — tests/executable/late-capture-after-release-postgres.test.mjs
-- against migrations 000..251)
--
-- 1. LB-PAY-004. create_checkout_order commits stock at order creation on the razorpay rail, before
--    the buyer pays. expire_unpaid_committed_reservations (211) releases it after the grace period
--    through release_order_inventory (246), which stamps orders.inventory_released_at and marks the
--    reservations 'released' but leaves orders.status at 'pending'. confirm_order_payment
--    (000_baseline, never redefined) refuses only status IN ('cancelled','refunded'), so a capture that
--    lands after the sweep — slow UPI, a webhook retried hours later — sets the order 'confirmed' and
--    'paid' while its unit is back on the shelf or already sold to the next buyer. Measured: the late
--    order reads 'confirmed' with its reservation 'released', and create_order_fulfillment accepts it.
--
-- 2. A second attempt captured after payment.failed. Razorpay allows another attempt on the same
--    provider order; record_order_payment_failure cancels the order and releases its stock on the
--    first attempt's failure. The second attempt's capture then raises 'order is not payable':
--    the buyer's money is taken and nothing in the ledger records it. (webhook-service marks the
--    event 'failed', and its ignore-duplicates upsert acknowledges every retry as a duplicate.)
--
-- 3. LB-PAY-009 (found while reproducing 1). The buyer's verify callback and the payment.captured
--    webhook both confirm the same payment, under different idempotency keys
--    ('razorpay-verify-<pay>' vs 'payment-webhook:razorpay:<evt>:paid'). confirm_order_payment returns
--    early for the already-paid order, but this wrapper then posted a SECOND payment_capture ledger
--    transaction, because ledger_transactions dedupes only on
--    (site_id, source_type, source_id, idempotency_key). Measured: 2 capture postings for one payment
--    in both the sequential and the concurrent case, crediting merchant_payable twice.
--
-- WHAT THIS DEFINITION DOES
-- It locks the order FIRST and classifies the capture before anything is written:
--   * binding   — the capture must belong to the provider order this order was bound to (the same
--                 predicate confirm_order_payment applies; repeated here because the unfulfillable
--                 branch below never reaches it). A mismatch raises, as before.
--   * duplicate — this order is already paid by THIS provider payment: return the order unchanged
--                 with capture_outcome 'duplicate'. No second ledger posting, no second attempt row.
--   * paid by a DIFFERENT payment — raise, explicitly. Unchanged in effect: with a provider order id
--                 present the binding check above already raised this case; the explicit raise also
--                 closes the null-provider-order path, where the old wrapper overwrote the first
--                 payment's payment_transactions row with the second payment's id.
--   * unfulfillable — the order was never captured and it can no longer be fulfilled (cancelled or
--                 refunded, or its stock released by the sweep). The provider has the buyer's money,
--                 so the capture is RECORDED exactly as a normal capture (payment_transactions,
--                 the same balanced pa_clearing / merchant_payable posting, payment_attempts) — it is a
--                 fact the provider's settlement report will carry, and the existing refund reversal
--                 (record_order_payment_failure_with_ledger, refund_clearing) expects it booked that
--                 way. The ORDER leaves the fulfilment path: status 'cancelled', fulfillment_state
--                 'cancelled' (the shape order-risk.ts and the COD-expiry sweep already use), payment
--                 'paid', refund_status 'pending'. create_order_fulfillment refuses a cancelled order,
--                 so the database itself forbids shipping it. A refund obligation is queued in
--                 compensation_actions (flow 'checkout_confirm', action 'refund_captured_payment' —
--                 the precedent is routes/checkout.ts recordCheckoutCompensation), the contracted
--                 'order.cancelled' outbox event goes out in the same transaction (notification-core
--                 maps it to the customer's order_cancelled email), and an audit_activity_events row
--                 names the reason. Stock is not touched: the released unit stays with whoever has it.
--   * otherwise — the live 168 definition, byte for byte below the classification, now also
--                 returning capture_outcome 'confirmed'.
-- Every return carries capture_outcome and fulfillable, which the gateway reads to decide whether it
-- may announce order.paid.
--
-- WHAT THIS DOES NOT DO
-- * It does not re-reserve stock for a late capture. Re-taking inventory inside the money RPC is a
--   change to the reservation lineage; the conservative outcome here is refund-owed, never oversell.
-- * It does not execute the refund. LetBuyy's code records the obligation; the provider refund is
--   issued by whoever operates the capturing Razorpay account (that is D-2, open with counsel), and the
--   provider's refund.created webhook reconciles it through the existing
--   record_order_payment_failure_with_ledger path — proven to net merchant_payable to zero by the suite.
-- * It does not change who holds money, any account code, any fee, or any grant.
--
-- The 168 body is preserved verbatim; the diff against it is additive except the final RETURN, which
-- gains two keys. No other function is redefined.

BEGIN;

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
  -- F-PAY4-1 (252): the order as it stands when this capture arrives, and what the capture means for it.
  v_state record;
  v_unfulfillable_reason text;
  v_event_id text;
BEGIN
  IF p_provider_payment_id IS NULL OR btrim(p_provider_payment_id) = '' THEN
    RAISE EXCEPTION 'provider_payment_id is required';
  END IF;

  -- F-PAY4-1 (252): lock the order before anything is written and classify the capture against it.
  -- Every confirmation of this order — the verify callback, the webhook, their retries — serializes on
  -- this row lock, and so does the unpaid-reservation sweep (211 locks the same row FOR UPDATE SKIP
  -- LOCKED), so what is read here is what the rest of this transaction acts on.
  SELECT *
    INTO v_state
    FROM orders
   WHERE id = p_order_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_site_id := COALESCE(v_state.site_id, v_state.store_id);

  -- Binding: the same predicate confirm_order_payment applies, repeated here because the
  -- unfulfillable branch below never reaches that function. A capture for a provider order this
  -- order was not bound to is never recorded against it.
  IF p_provider_order_id IS NOT NULL
     AND v_state.payment_id IS NOT NULL
     AND v_state.payment_id <> p_provider_order_id
     AND v_state.payment_id <> p_provider_payment_id THEN
    RAISE EXCEPTION 'payment reference mismatch';
  END IF;

  -- Duplicate: this order is already paid by THIS provider payment. One provider payment is one
  -- ledger capture, whichever path (verify callback, webhook, retry) reports it.
  IF v_state.payment_id = p_provider_payment_id
     AND v_state.payment_status IN ('paid', 'refunded') THEN
    SELECT to_jsonb(o) INTO v_order_json FROM orders o WHERE o.id = p_order_id;
    RETURN v_order_json || jsonb_build_object(
      'canonical_ledger_transaction_id', (
        SELECT lt.id
          FROM ledger_transactions lt
         WHERE lt.site_id = v_site_id
           AND lt.source_type = 'payment_capture'
           AND lt.source_id = p_provider || ':' || p_provider_payment_id
         ORDER BY lt.created_at
         LIMIT 1
      ),
      'capture_outcome', 'duplicate',
      'fulfillable', (v_state.payment_status = 'paid' AND v_state.status NOT IN ('cancelled', 'refunded')),
      'unfulfillable_reason', (
        SELECT ca.payload ->> 'reason'
          FROM compensation_actions ca
         WHERE ca.site_id = v_site_id
           AND ca.flow = 'checkout_confirm'
           AND ca.idempotency_key = 'refund_captured_payment:' || p_provider || ':' || p_provider_payment_id
           AND ca.deleted_at IS NULL
         LIMIT 1
      )
    );
  END IF;

  -- Paid by a DIFFERENT provider payment. With a provider order id present the binding check above
  -- has already raised this; the explicit raise closes the path where no provider order id is sent.
  IF v_state.payment_status = 'paid' THEN
    RAISE EXCEPTION 'order is already paid by a different payment';
  END IF;

  -- Unfulfillable: never captured before, and it can no longer be fulfilled.
  IF v_state.status IN ('cancelled', 'refunded') THEN
    v_unfulfillable_reason := 'order_' || v_state.status;
  ELSIF v_state.inventory_released_at IS NOT NULL THEN
    v_unfulfillable_reason := 'reservation_released';
  END IF;

  IF v_unfulfillable_reason IS NOT NULL THEN
    v_amount_minor := round(COALESCE(v_state.total, 0) * 100)::bigint;
    v_ledger_idempotency_key := COALESCE(NULLIF(p_idempotency_key, ''), p_provider_payment_id);
    v_event_id := COALESCE(NULLIF(p_provider_event_id, ''), p_provider || ':payment:' || p_provider_payment_id);

    -- The provider event is recorded exactly as confirm_order_payment would record it.
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
      'checkout.payment.captured_unfulfillable',
      TRUE,
      'processed',
      jsonb_build_object(
        'order_id', p_order_id,
        'provider', p_provider,
        'provider_order_id', p_provider_order_id,
        'provider_payment_id', p_provider_payment_id,
        'reason', v_unfulfillable_reason,
        'request_id', p_request_id
      ),
      now()
    )
    ON CONFLICT (provider, provider_event_id)
    DO UPDATE SET
      signature_valid = TRUE,
      processing_status = 'processed',
      processed_at = COALESCE(payment_webhook_events.processed_at, now()),
      updated_at = now();

    -- The money: this order was never captured, so its one payment row (attach's 'pending', or
    -- payment.failed's 'failed') becomes the captured row — one row per (order, gateway), as 107 keeps it.
    UPDATE payment_transactions
       SET gateway_txn_id = COALESCE(p_provider_payment_id, gateway_txn_id),
           provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
           provider_payment_id = p_provider_payment_id,
           provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
           status = 'captured',
           captured_at = COALESCE(captured_at, now()),
           request_id = COALESCE(p_request_id, request_id),
           idempotency_key = COALESCE(v_ledger_idempotency_key, idempotency_key),
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object('unfulfillable_capture', v_unfulfillable_reason),
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
        v_state.store_id,
        v_site_id,
        p_provider,
        p_provider_payment_id,
        p_provider_order_id,
        p_provider_payment_id,
        p_provider_event_id,
        COALESCE(v_state.total, 0),
        COALESCE(v_state.currency, 'INR'),
        'captured',
        p_provider,
        jsonb_build_object('source', 'payment_confirmation', 'unfulfillable_capture', v_unfulfillable_reason),
        p_request_id,
        v_ledger_idempotency_key,
        now()
      )
      RETURNING id INTO v_payment_transaction_id;
    END IF;

    -- Booked exactly as a normal capture, so the provider's refund.created reverses it through the
    -- existing path (merchant_payable debit / refund_clearing credit) and nets to zero.
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
            'memo', 'Merchant payable capture ' || p_order_id::text || ' (unfulfillable: ' || v_unfulfillable_reason || ')'
          )
        ),
        jsonb_build_object(
          'compatibility_table', 'payment_transactions',
          'payment_transaction_id', v_payment_transaction_id,
          'order_id', p_order_id,
          'provider', p_provider,
          'provider_payment_id', p_provider_payment_id,
          'provider_order_id', p_provider_order_id,
          'provider_event_id', p_provider_event_id,
          'unfulfillable_reason', v_unfulfillable_reason
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
      COALESCE(v_state.total, 0),
      COALESCE(v_state.currency, 'INR'),
      p_provider_order_id,
      p_provider_payment_id,
      COALESCE(p_provider_event_id, 'capture:' || p_provider || ':' || p_provider_payment_id),
      v_ledger_idempotency_key,
      p_request_id,
      jsonb_build_object(
        'provider_payment_id', p_provider_payment_id,
        'canonical_ledger_transaction_id', v_ledger_transaction_id,
        'unfulfillable_reason', v_unfulfillable_reason
      )
    )
    ON CONFLICT DO NOTHING;

    -- The order leaves the fulfilment path; the money it took is owed back.
    UPDATE orders
       SET payment_status = 'paid',
           payment_id = p_provider_payment_id,
           payment_method = p_provider,
           payment_gateway = p_provider,
           status = 'cancelled',
           fulfillment_state = 'cancelled',
           refund_status = 'pending',
           payment_processed_at = now(),
           last_payment_event_id = v_event_id,
           updated_at = now()
     WHERE id = p_order_id;

    INSERT INTO compensation_actions (
      site_id,
      flow,
      aggregate_type,
      aggregate_id,
      idempotency_key,
      status,
      action,
      payload,
      request_id
    )
    VALUES (
      v_site_id,
      'checkout_confirm',
      'order',
      p_order_id,
      'refund_captured_payment:' || p_provider || ':' || p_provider_payment_id,
      'pending',
      'refund_captured_payment',
      jsonb_build_object(
        'reason', v_unfulfillable_reason,
        'provider', p_provider,
        'provider_payment_id', p_provider_payment_id,
        'provider_order_id', p_provider_order_id,
        'amount_minor', v_amount_minor,
        'currency', COALESCE(v_state.currency, 'INR'),
        'payment_transaction_id', v_payment_transaction_id,
        'canonical_ledger_transaction_id', v_ledger_transaction_id
      ),
      p_request_id
    )
    ON CONFLICT (site_id, flow, idempotency_key) DO NOTHING;

    -- The contracted event (packages/event-core 'order.cancelled', OrderPayloadSchema fields only), in
    -- the same transaction as the state change it announces.
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
      schema_version
    )
    VALUES (
      v_site_id,
      v_state.store_id,
      'order',
      p_order_id::text,
      'order.cancelled',
      -- orders carries no customer_id column (customer_email/_name/_phone/_gstin only), so the
      -- contract's optional customer_id is omitted, exactly as the gateway's order.paid emitter ends up doing.
      jsonb_strip_nulls(jsonb_build_object(
        'site_id', v_site_id,
        'order_id', p_order_id,
        'order_number', NULLIF(v_state.order_number, ''),
        'total', jsonb_build_object('amount_minor', v_amount_minor, 'currency', 'INR')
      )),
      'order.cancelled:' || p_order_id::text || ':captured_unfulfillable',
      p_request_id,
      p_request_id,
      1
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
      v_state.store_id,
      'webhook',
      'payment.captured_unfulfillable',
      'order',
      p_order_id::text,
      p_request_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'reason', v_unfulfillable_reason,
        'provider', p_provider,
        'provider_payment_id', p_provider_payment_id,
        'provider_event_id', v_event_id,
        'previous_status', v_state.status,
        'previous_payment_status', v_state.payment_status
      )
    );

    SELECT to_jsonb(o) INTO v_order_json FROM orders o WHERE o.id = p_order_id;
    RETURN v_order_json || jsonb_build_object(
      'canonical_ledger_transaction_id', v_ledger_transaction_id,
      'capture_outcome', 'captured_unfulfillable',
      'fulfillable', false,
      'unfulfillable_reason', v_unfulfillable_reason
    );
  END IF;

  -- Confirmed: the live 168 definition from here on, unchanged.
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

  RETURN v_order_json || jsonb_build_object(
    'canonical_ledger_transaction_id', v_ledger_transaction_id,
    'capture_outcome', 'confirmed',
    'fulfillable', true
  );
END;
$$;

COMMIT;
