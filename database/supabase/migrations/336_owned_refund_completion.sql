-- N1.5/N1.6: one guarded ownership/receipt boundary delegates to the existing
-- canonical refund writer. No new monetary ledger or provider success authority.
BEGIN;
CREATE OR REPLACE FUNCTION public.complete_order_refund(
  p_refund_id uuid,
  p_provider_refund_id text DEFAULT NULL::text,
  p_provider_event_id text DEFAULT NULL::text,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_request_id text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
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
  v_existing_post public.ledger_transactions%ROWTYPE;
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

  -- A refund is one monetary source, regardless of transport receipt keys.
  -- Reuse its committed posting; never invoke the ledger again under a new key.
  IF NULLIF(p_provider_refund_id,'') IS NOT NULL AND v_refund.provider_refund_id IS NOT NULL
    AND p_provider_refund_id<>v_refund.provider_refund_id THEN
    RAISE EXCEPTION 'refund provider reference conflict' USING ERRCODE='22023'; END IF;
  IF v_refund.status<>'succeeded' AND EXISTS(SELECT 1 FROM public.ledger_transactions WHERE site_id=v_refund.site_id AND source_type='refund' AND source_id='refund:'||p_refund_id::text) THEN
    RAISE EXCEPTION 'refund source already posted; reconciliation is required'; END IF;
  IF v_refund.status='succeeded' THEN
    IF NULLIF(p_provider_refund_id,'') IS NOT NULL AND p_provider_refund_id IS DISTINCT FROM v_refund.provider_refund_id THEN
      RAISE EXCEPTION 'refund provider reference conflict' USING ERRCODE='22023'; END IF;
    IF round(coalesce(v_refund.amount,0)*100)::bigint>0 THEN
      IF coalesce(v_refund.metadata->>'canonical_ledger_transaction_id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        RAISE EXCEPTION 'succeeded refund requires its matching canonical posting'; END IF;
      SELECT * INTO v_existing_post FROM public.ledger_transactions
       WHERE id=nullif(v_refund.metadata->>'canonical_ledger_transaction_id','')::uuid
        AND site_id=v_refund.site_id AND currency='INR' AND source_type='refund' AND source_id='refund:'||p_refund_id::text;
      IF v_existing_post.id IS NULL OR
        (SELECT count(*)FROM public.ledger_transactions WHERE site_id=v_refund.site_id AND source_type='refund'AND source_id='refund:'||p_refund_id::text)<>1 OR
        (SELECT coalesce(sum(amount_minor),0) FROM public.ledger_entries WHERE transaction_id=v_existing_post.id AND side='debit')<>round(v_refund.amount*100)::bigint THEN
        RAISE EXCEPTION 'succeeded refund requires its matching canonical posting'; END IF;
      v_ledger_transaction_id:=v_existing_post.id;
    END IF;
    SELECT coalesce(sum(amount),0) INTO v_total_succeeded FROM public.refunds
     WHERE site_id=v_refund.site_id AND order_id=v_refund.order_id AND status='succeeded' AND deleted_at IS NULL;
    RETURN jsonb_build_object('order',to_jsonb(v_order),'refund',to_jsonb(v_refund),
      'total_refunded',v_total_succeeded,'canonical_ledger_transaction_id',v_ledger_transaction_id);
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

CREATE FUNCTION public.complete_owned_order_refund_v1(
 p_site_id uuid,p_order_id uuid,p_return_id uuid,p_actor_id uuid,p_intent jsonb,p_request_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v_site public.sites;v_order public.orders;v_return public.returns;v_refund public.refunds;
 v_receipt public.idempotency_keys;v_scope text;v_key text;v_hash text;v_refund_id uuid;v_count integer;v_data jsonb;v_source_replayed boolean;
BEGIN
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL
  AND nullif(current_setting('app.site_id',true),'')::uuid IS DISTINCT FROM p_site_id THEN
  RAISE EXCEPTION 'refund tenant context mismatch' USING ERRCODE='42501'; END IF;
 IF p_intent IS NULL OR jsonb_typeof(p_intent)IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('status',400,'error','VALIDATION'); END IF;
 IF p_site_id IS NULL OR p_order_id IS NULL OR p_actor_id IS NULL
  OR p_intent-ARRAY['idempotency_key','refund_id','provider_refund_id','provider_event_id','notes']<>'{}'::jsonb
  OR jsonb_typeof(p_intent->'idempotency_key') IS DISTINCT FROM 'string'
  OR length(p_intent->>'idempotency_key') NOT BETWEEN 8 AND 200 OR p_intent->>'idempotency_key'<>btrim(p_intent->>'idempotency_key')
  OR (p_intent->>'idempotency_key')~'[[:cntrl:]]'
  OR(p_intent?'refund_id'AND(jsonb_typeof(p_intent->'refund_id') IS DISTINCT FROM 'string'OR p_intent->>'refund_id'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'))
  OR(p_intent?'provider_refund_id'AND(jsonb_typeof(p_intent->'provider_refund_id') IS DISTINCT FROM 'string'OR length(p_intent->>'provider_refund_id')>200))
  OR(p_intent?'provider_event_id'AND(jsonb_typeof(p_intent->'provider_event_id') IS DISTINCT FROM 'string'OR length(p_intent->>'provider_event_id')>200))
  OR(p_intent?'notes'AND(jsonb_typeof(p_intent->'notes') IS DISTINCT FROM 'string'OR length(p_intent->>'notes')>1000)) THEN
  RETURN jsonb_build_object('status',400,'error','VALIDATION'); END IF;
 SELECT * INTO v_site FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
 IF v_site.id IS NULL OR NOT(coalesce(v_site.custom_user_id=p_actor_id,false) OR coalesce(v_site.user_id=p_actor_id,false)) THEN
  RETURN jsonb_build_object('status',403,'error','REFUND_OWNER_REQUIRED'); END IF;
 v_scope:='owned-refund-complete-v1:'||p_order_id::text||':'||coalesce(p_return_id::text,'order')||':'||p_actor_id::text;
 v_key:=p_intent->>'idempotency_key';
 v_hash:=encode(sha256(convert_to(jsonb_build_object('site',p_site_id,'order',p_order_id,'return',p_return_id,'actor',p_actor_id,'intent',p_intent)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text||':'||v_scope||':'||v_key,4));
 SELECT * INTO v_receipt FROM public.idempotency_keys WHERE site_id=p_site_id AND scope=v_scope AND key=v_key FOR UPDATE;
 IF v_receipt.id IS NOT NULL THEN
  IF v_receipt.request_hash IS DISTINCT FROM v_hash THEN RETURN jsonb_build_object('status',409,'error','IDEMPOTENCY_CONFLICT'); END IF;
  IF v_receipt.status<>'completed'OR v_receipt.response_body IS NULL OR v_receipt.deleted_at IS NOT NULL THEN
   RETURN jsonb_build_object('status',503,'error','REFUND_RECEIPT_UNAVAILABLE'); END IF;
  v_refund_id:=v_receipt.resource_id;
 ELSIF p_intent?'refund_id' THEN v_refund_id:=(p_intent->>'refund_id')::uuid;
 ELSE
  SELECT count(*),min(id::text)::uuid INTO v_count,v_refund_id FROM public.refunds
   WHERE site_id=p_site_id AND order_id=p_order_id AND return_id=p_return_id AND deleted_at IS NULL AND status IN('pending','processing','succeeded');
  IF v_count>1 THEN RETURN jsonb_build_object('status',409,'error','REFUND_SELECTION_REQUIRED'); END IF;
 END IF;
 -- Match the canonical writer's refund -> order lock order. No supplied ID
 -- can mutate a row merely because the caller owns a different URL resource.
 SELECT * INTO v_refund FROM public.refunds WHERE id=v_refund_id AND site_id=p_site_id AND order_id=p_order_id
  AND(p_return_id IS NULL OR return_id=p_return_id)AND deleted_at IS NULL FOR UPDATE;
 IF v_refund.id IS NULL THEN RETURN jsonb_build_object('status',404,'error','REFUND_NOT_FOUND'); END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND store_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF v_order.id IS NULL THEN RETURN jsonb_build_object('status',404,'error','REFUND_NOT_FOUND'); END IF;
 IF p_return_id IS NOT NULL THEN
  SELECT * INTO v_return FROM public.returns WHERE id=p_return_id AND site_id=p_site_id AND order_id=p_order_id AND deleted_at IS NULL FOR UPDATE;
  IF v_return.id IS NULL THEN RETURN jsonb_build_object('status',404,'error','REFUND_NOT_FOUND'); END IF;
 END IF;
 PERFORM set_config('app.site_id',p_site_id::text,true);
 IF v_receipt.id IS NOT NULL THEN
  IF v_refund.status<>'succeeded' OR v_receipt.response_hash IS DISTINCT FROM encode(sha256(convert_to(v_receipt.response_body::text,'UTF8')),'hex')
   OR v_receipt.response_body->'refund'->>'id' IS DISTINCT FROM v_refund.id::text
   OR v_receipt.response_body->'refund'->>'site_id' IS DISTINCT FROM p_site_id::text
   OR v_receipt.response_body->'refund'->>'order_id' IS DISTINCT FROM p_order_id::text
   OR v_receipt.response_body->'order'->>'id' IS DISTINCT FROM p_order_id::text
   OR v_receipt.response_body->'order'->>'store_id' IS DISTINCT FROM p_site_id::text THEN
   RETURN jsonb_build_object('status',409,'error','REFUND_REVIEW_REQUIRED'); END IF;
  -- The succeeded branch verifies its one canonical posting without writing
  -- money again. A receipt never substitutes for current source integrity.
  PERFORM public.complete_order_refund(v_refund.id,p_intent->>'provider_refund_id',p_intent->>'provider_event_id',p_actor_id,p_request_id,v_key);
  RETURN jsonb_build_object('status',200,'data',v_receipt.response_body,'replayed',true,'source_replayed',true);
 END IF;
 v_source_replayed:=v_refund.status='succeeded';
 v_data:=public.complete_order_refund(v_refund_id,p_intent->>'provider_refund_id',p_intent->>'provider_event_id',p_actor_id,p_request_id,v_key);
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
 VALUES(p_site_id,v_key,v_scope,v_hash,encode(sha256(convert_to(v_data::text,'UTF8')),'hex'),v_data,'completed',200,'refund',v_refund_id,p_request_id,now()+interval '24 hours');
 RETURN jsonb_build_object('status',200,'data',v_data,'replayed',false,'source_replayed',v_source_replayed);
END $fn$;
REVOKE ALL ON FUNCTION public.complete_order_refund(uuid,text,text,uuid,text,text),public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.complete_order_refund(uuid,text,text,uuid,text,text),public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text) TO service_role;
COMMIT;
