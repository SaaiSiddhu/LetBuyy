-- Complete the existing canonical payments capture writer. Provider proof is
-- obtained by the Gateway against the payment's frozen credentials. This RPC
-- never calls a PSP, collects funds, confirms an order or extends legacy252.
-- Canonical/legacy convergence and order lifecycle remain separately gated.
SET lock_timeout='5s';
SET statement_timeout='60s';
CREATE FUNCTION public.commit_canonical_payment_capture_v1(
 p_payment_id uuid,p_actor_id uuid,p_claim_id uuid,p_request_hash text,p_credential_id uuid,
 p_order_id uuid,p_provider_order_id text,p_provider_payment_id text,p_amount_minor bigint,p_currency text,
 p_request_id text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE pay public.payments; site public.sites; cred public.payment_credentials; receipt public.idempotency_keys;
 ledger_id uuid; reply jsonb; effect_key text; source_key text; old_site uuid; order_site uuid;
BEGIN
 IF current_user IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'PAYMENT_CAPTURE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_payment_id IS NULL OR p_actor_id IS NULL OR p_claim_id IS NULL OR p_credential_id IS NULL
  OR p_order_id IS NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 9999999999
  OR p_currency IS DISTINCT FROM 'INR' OR p_provider_order_id IS NULL OR length(p_provider_order_id) NOT BETWEEN 3 AND 200
  OR p_provider_payment_id IS NULL OR p_provider_payment_id !~ '^pay_[A-Za-z0-9_]{1,196}$'
  OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$'
  OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR length(p_metadata::text)>16384 THEN
  RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;

 SELECT * INTO pay FROM public.payments WHERE id=p_payment_id AND deleted_at IS NULL;
 IF pay.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_CAPTURE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 -- Derive tenant from the owned payment and current ownership, never a site
 -- request parameter. Holding the owner row also fences concurrent reassignment.
 SELECT * INTO site FROM public.sites WHERE id=pay.site_id AND deleted_at IS NULL
  AND (custom_user_id=p_actor_id OR user_id=p_actor_id) FOR SHARE;
 IF site.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_CAPTURE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 old_site:=public.current_site_id();
 IF old_site IS NOT NULL AND old_site<>site.id THEN
  RAISE EXCEPTION 'PAYMENT_CAPTURE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 -- Same order-first lock order as existing capture paths. No order mutation.
 SELECT coalesce(site_id,store_id) INTO order_site FROM public.orders
  WHERE id=pay.order_id AND deleted_at IS NULL FOR UPDATE;
 IF order_site IS DISTINCT FROM site.id THEN RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;
 SELECT * INTO pay FROM public.payments WHERE id=p_payment_id AND site_id=site.id AND deleted_at IS NULL FOR UPDATE;
 IF pay.order_id IS DISTINCT FROM p_order_id OR pay.credential_id IS DISTINCT FROM p_credential_id
  OR pay.provider IS DISTINCT FROM 'razorpay' OR pay.mode IS DISTINCT FROM 'sandbox'
  OR pay.provider_order_id IS DISTINCT FROM p_provider_order_id OR pay.amount_minor IS DISTINCT FROM p_amount_minor
  OR pay.currency IS DISTINCT FROM p_currency
  OR (pay.provider_payment_id IS NOT NULL AND pay.provider_payment_id<>p_provider_payment_id) THEN
  RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;
 SELECT * INTO receipt FROM public.idempotency_keys WHERE id=p_claim_id AND site_id=site.id
  AND scope='payment.capture:'||pay.id::text AND request_hash=p_request_hash AND deleted_at IS NULL FOR UPDATE;
 IF receipt.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;
 IF receipt.status='completed' THEN RETURN receipt.response_body; END IF;
 IF receipt.status<>'processing' OR receipt.locked_until IS NULL OR receipt.locked_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;
 IF pay.status='captured' AND pay.capture_ledger_transaction_id IS NOT NULL THEN
  -- A second valid HTTP command acknowledges the same effect, without another
  -- posting/attempt/event. The payment row is the serialization point.
  reply:=jsonb_build_object('data',jsonb_build_object('captured',true,'payment',to_jsonb(pay)));
 ELSE
  IF pay.status NOT IN('pending','requires_action','authorized') THEN
   RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;
  SELECT * INTO cred FROM public.payment_credentials WHERE id=pay.credential_id AND site_id=site.id
   AND provider=pay.provider AND mode=pay.mode AND status='active' AND deleted_at IS NULL FOR SHARE;
  IF cred.id IS NULL OR cred.last_verified_at IS NULL THEN
   RAISE EXCEPTION 'PAYMENT_CAPTURE_CONFLICT' USING ERRCODE='22023'; END IF;
  effect_key:='payment-capture:'||pay.id::text;
  source_key:='razorpay:'||p_provider_payment_id;
  -- Never create a second journal over unbound historical canonical/legacy
  -- captures. No invented history backfill: reconciliation must resolve them.
  IF EXISTS(SELECT 1 FROM public.ledger_transactions WHERE site_id=site.id AND source_type='payment_capture'
    AND source_id IN(p_provider_payment_id,source_key))
   OR EXISTS(SELECT 1 FROM public.payment_transactions WHERE site_id=site.id AND gateway='razorpay'
    AND provider_payment_id=p_provider_payment_id AND status IN('captured','completed','partially_refunded','refunded')) THEN
   RAISE EXCEPTION 'PAYMENT_CAPTURE_REVIEW' USING ERRCODE='22023'; END IF;
  ledger_id:=public.post_settlement_ledger_transaction(site.id,'payment_capture',source_key,effect_key,
   jsonb_build_array(
    jsonb_build_object('account_code','pa_clearing','side','debit','amount_minor',pay.amount_minor),
    jsonb_build_object('account_code','merchant_payable','side','credit','amount_minor',pay.amount_minor)),
   jsonb_build_object('payment_id',pay.id,'order_id',pay.order_id,'credential_id',pay.credential_id,
    'provider','razorpay','provider_mode',pay.mode,'provider_order_id',pay.provider_order_id,
    'provider_payment_id',p_provider_payment_id,'fee_assessment','deferred_to_payout_statement'),p_request_id);
  UPDATE public.payments SET status='captured',provider_payment_id=p_provider_payment_id,
   captured_at=clock_timestamp(),capture_ledger_transaction_id=ledger_id,
   metadata=coalesce(metadata,'{}'::jsonb)||p_metadata,request_id=p_request_id,updated_by=p_actor_id
   WHERE id=pay.id AND site_id=site.id RETURNING * INTO pay;
  INSERT INTO public.payment_attempts(site_id,order_id,payment_id,credential_id,credential_mode,provider,
   attempt_type,status,amount,currency,provider_order_id,provider_payment_id,provider_session_id,
   idempotency_key,request_id,metadata,created_by,updated_by)
  VALUES(site.id,pay.order_id,pay.id,pay.credential_id,pay.mode,'razorpay','capture','succeeded',
   pay.amount_minor::numeric/100,'INR',pay.provider_order_id,p_provider_payment_id,pay.provider_session_id,
   effect_key,p_request_id,p_metadata,p_actor_id,p_actor_id);
  INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,
   idempotency_key,request_id,actor_id,schema_version)
  VALUES(site.id,site.id,'order',pay.order_id,'payment.captured',jsonb_build_object(
   'order_id',pay.order_id,'payment_id',pay.id,'provider','razorpay','provider_event_id',p_provider_payment_id,
   'payment_status','paid'),effect_key,p_request_id,p_actor_id,1);
  reply:=jsonb_build_object('data',jsonb_build_object('captured',true,'payment',to_jsonb(pay)));
 END IF;
 UPDATE public.idempotency_keys SET status='completed',response_body=reply,status_code=200,
  resource_type='payment',resource_id=pay.id,locked_until=NULL,
  response_hash=encode(sha256(convert_to(reply::text,'UTF8')),'hex')
  WHERE id=receipt.id AND site_id=site.id;
 RETURN reply;
END $fn$;
REVOKE ALL ON FUNCTION public.commit_canonical_payment_capture_v1(uuid,uuid,uuid,text,uuid,uuid,text,text,bigint,text,text,jsonb)
 FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.commit_canonical_payment_capture_v1(uuid,uuid,uuid,text,uuid,uuid,text,text,bigint,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
