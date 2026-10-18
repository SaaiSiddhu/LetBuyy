-- Forward recovery preferred. Refuse to erase a financial receipt boundary or
-- reintroduce different-key double posting in a database with completed refunds.
BEGIN;
DO $newer_guard$BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)')AND prosrc LIKE '%verify_merchant_step_up_v1%')THEN
  RAISE EXCEPTION 'rollback336 refuses newer341 approval boundary; roll back341 first';END IF;
END $newer_guard$;
DO $guard$ DECLARE e record;p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope LIKE 'owned-refund-complete-v1:%')
  OR EXISTS(SELECT 1 FROM public.refunds WHERE status='succeeded') THEN
  RAISE EXCEPTION 'rollback336 refuses financial completion history; use a reviewed forward repair'; END IF;
 FOR e IN SELECT * FROM(VALUES
 ('public.complete_order_refund(uuid,text,text,uuid,text,text)',ARRAY['p_refund_id','p_provider_refund_id','p_provider_event_id','p_actor_id','p_request_id','p_idempotency_key']::text[]),
 ('public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)',ARRAY['p_site_id','p_order_id','p_return_id','p_actor_id','p_intent','p_request_id']::text[]))expected(signature,input_names) LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(e.signature);
  IF p.oid IS NULL OR p.proargnames[1:p.pronargs]IS DISTINCT FROM e.input_names OR p.prorettype<>'jsonb'::regtype OR p.proretset OR p.prokind<>'f'
   OR(SELECT count(*)FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1 THEN
   RAISE EXCEPTION 'rollback336 refuses changed completion ABI: %',e.signature; END IF;
 END LOOP;
END $guard$;
DROP FUNCTION public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text);
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
-- Security rollback retains the service-only fence; it never restores a public
-- money mutation permission. The exact callable body is the pre336 definition.
REVOKE ALL ON FUNCTION public.complete_order_refund(uuid,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.complete_order_refund(uuid,text,text,uuid,text,text) TO service_role;
COMMIT;
