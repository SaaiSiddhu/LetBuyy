-- 347: extend the existing subscription checkout receipt to explicit zero/internal
-- free activation. No catalog, public pricing, provider mode or historical receipt
-- mutation. The canonical activation transaction completes invoice/audit/intent.
BEGIN;
CREATE OR REPLACE FUNCTION public.claim_merchant_subscription_checkout_v1(
 p_actor uuid,p_site uuid,p_key text,p_request jsonb,p_quote jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET application_name='claim_merchant_subscription_checkout_v1:347' AS $f$
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;receipt uuid:=gen_random_uuid();amount bigint;scope text;free_quote boolean;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 -- The table admission lock is already held by the store SELECT above. A
 -- call compiled before rollback may have waited on that lock; verify the
 -- currently bound function's own SET attribute, not the caller/session GUC.
 -- Read the live catalog binding even for a cached frame; admit exact supported versions only.
 IF p_quote->>'mode'='free_activation' AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc current_binding
  WHERE current_binding.oid='public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)'::pg_catalog.regprocedure
   AND current_binding.proconfig && ARRAY['application_name=claim_merchant_subscription_checkout_v1:347','application_name=claim_merchant_subscription_checkout_v1:347:360']::text[]) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF nullif(btrim(p_key),'') IS NULL OR length(p_key)>200 OR jsonb_typeof(p_request) IS DISTINCT FROM 'object' THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 scope:='subscription.checkout:'||p_actor;
 PERFORM pg_advisory_xact_lock(hashtextextended(scope||':'||p_site||':'||p_key,0));
 SELECT * INTO c FROM public.billing_history WHERE site_id=p_site AND user_id=p_actor AND subscription_checkout_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF c.deleted_at IS NOT NULL OR c.subscription_checkout_request IS DISTINCT FROM p_request THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  RETURN jsonb_build_object('accepted',true,'claimed',false,'charge',to_jsonb(c));
 END IF;
 IF p_quote IS NULL THEN RETURN jsonb_build_object('accepted',true,'missing',true); END IF;
 -- 347: one discriminated internal free quote alongside unchanged paid modes.
 amount:=(p_quote->>'amount_minor')::bigint;
 free_quote:=p_quote->>'mode'='free_activation';
 IF amount IS NULL OR amount<0 OR amount>2147483647 OR (NOT free_quote AND amount=0) OR p_quote->>'currency' IS DISTINCT FROM 'INR'
  OR p_quote->>'mode' IS NULL OR p_quote->>'mode' NOT IN('razorpay_order','razorpay_subscription','free_activation') OR p_quote->'plan'->>'slug' IS DISTINCT FROM p_request->>'plan_slug'
  OR p_request->>'billing_period' IS NULL OR p_request->>'billing_period' NOT IN('monthly','yearly')
  OR NOT EXISTS(SELECT 1 FROM public.plans WHERE id=(p_quote->'plan'->>'id')::uuid AND slug=p_request->>'plan_slug' AND site_type=s.site_type AND is_active=true) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF free_quote AND (amount<>0 OR p_request->>'site_type' IS DISTINCT FROM s.site_type
  OR p_quote?'provider_input' OR p_quote->'response'->>'checkout_mode' IS DISTINCT FROM 'free_activation'
  OR p_quote->'response'->>'amount' IS DISTINCT FROM '0' OR p_quote->'response'->>'currency' IS DISTINCT FROM 'INR'
  OR p_quote->'response'->>'billing_period' IS DISTINCT FROM p_request->>'billing_period'
  OR p_quote->'response'->>'recurring' IS DISTINCT FROM 'false'
  OR p_quote->'response'->>'is_promo' IS DISTINCT FROM 'false'
  OR NOT EXISTS(SELECT 1 FROM public.plans p WHERE p.id=(p_quote->'plan'->>'id')::uuid
   AND CASE WHEN p_request->>'billing_period'='yearly' THEN coalesce(p.price_yearly_inr,p.price_monthly_inr*12) ELSE p.price_monthly_inr END=0)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 -- A pre-347 HTTP receipt can outlive the old unbound free activation. It
 -- cannot be guessed from the latest subscription or its creation time. After
 -- canonical route ownership is installed, refuse this ambiguous legacy key
 -- rather than creating a second outcome. Existing canonical quotes replay above.
 IF free_quote AND EXISTS(SELECT 1 FROM public.idempotency_keys old_http
  WHERE old_http.site_id=p_site AND old_http.key=btrim(p_key) AND old_http.deleted_at IS NULL
   AND old_http.scope IN('http:POST:/payments/subscription/order','http:POST:/payments/subscription/recover')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_LEGACY_CHECKOUT_PENDING'); END IF;
 INSERT INTO public.billing_history(id,user_id,store_id,site_id,invoice_number,description,amount,total_amount,currency,payment_gateway,
  payment_status,billing_period,subscription_checkout,subscription_checkout_key,subscription_checkout_request,subscription_checkout_reference)
 VALUES(receipt,p_actor,p_site,p_site,'QUOTE-'||receipt,'Pending subscription checkout',amount,amount,'INR',CASE WHEN free_quote THEN NULL ELSE 'razorpay' END,'pending',
  p_request->>'billing_period',p_quote,p_key,p_request,CASE WHEN free_quote THEN 'free_checkout:'||receipt ELSE NULL END) RETURNING * INTO c;
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,resource_type,resource_id,expires_at)
 VALUES(p_site,p_key,scope,encode(sha256(convert_to(p_request::text,'UTF8')),'hex'),'billing_history',receipt,'infinity');
 RETURN jsonb_build_object('accepted',true,'claimed',true,'charge',to_jsonb(c));
END $f$;
CREATE OR REPLACE FUNCTION public.bind_merchant_subscription_checkout_v1(p_actor uuid,p_site uuid,p_charge uuid,p_reference text,p_short_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 SELECT * INTO c FROM public.billing_history WHERE id=p_charge AND site_id=p_site AND user_id=p_actor AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR c.subscription_checkout IS NULL OR c.subscription_checkout->>'mode'='free_activation' OR nullif(btrim(p_reference),'') IS NULL OR length(p_reference)>200
  OR (c.subscription_checkout_reference IS NOT NULL AND c.subscription_checkout_reference<>p_reference) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
 UPDATE public.billing_history SET subscription_checkout_reference=p_reference,
  subscription_checkout=subscription_checkout||jsonb_build_object('short_url',p_short_url),updated_at=now() WHERE id=c.id RETURNING * INTO c;
 UPDATE public.idempotency_keys SET status='completed',locked_until=NULL,status_code=200,response_body=jsonb_build_object('billing_history_id',c.id)
  WHERE site_id=p_site AND scope='subscription.checkout:'||p_actor AND key=c.subscription_checkout_key AND resource_id=c.id;
 RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c));
END $f$;
CREATE OR REPLACE FUNCTION public.read_merchant_subscription_checkout_v1(p_actor uuid,p_site uuid,p_reference text,p_payment text,p_plan_slug text,p_period text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
DECLARE s public.sites%ROWTYPE;c public.billing_history%ROWTYPE;retained public.subscriptions%ROWTYPE;plan public.plans%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL;
 IF NOT FOUND OR NOT coalesce(p_actor=s.custom_user_id OR p_actor=s.user_id,false) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED'); END IF;
 SELECT * INTO c FROM public.billing_history WHERE subscription_checkout_reference=p_reference;
 IF FOUND THEN
  IF c.subscription_checkout->>'mode'='free_activation' OR c.deleted_at IS NOT NULL OR c.site_id IS DISTINCT FROM p_site OR c.user_id IS DISTINCT FROM p_actor
   OR c.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM p_plan_slug OR c.billing_period IS DISTINCT FROM p_period THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  RETURN jsonb_build_object('accepted',true,'charge',to_jsonb(c));
 END IF;
 -- A retained paid receipt can be read back; it cannot authorize a new purchase.
 SELECT * INTO retained FROM public.subscriptions WHERE razorpay_payment_id=p_payment AND deleted_at IS NULL;
 IF FOUND AND retained.user_id=p_actor AND retained.store_id=p_site AND retained.plan=p_plan_slug AND retained.billing_period=p_period THEN
  SELECT * INTO plan FROM public.plans WHERE slug=retained.plan AND site_type=s.site_type;
  RETURN jsonb_build_object('accepted',true,'charge',jsonb_build_object('amount',retained.amount_paid,'currency','INR',
   'subscription_checkout_reference',p_reference,'subscription_checkout',jsonb_build_object('plan',to_jsonb(plan),'mode',
    CASE WHEN p_reference LIKE 'sub_%' THEN 'razorpay_subscription' ELSE 'razorpay_order' END)));
 END IF;
 RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');
END $f$;
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET application_name='activate_merchant_subscription_v1:347' AS $function$
DECLARE s public.sites%ROWTYPE;plan public.plans%ROWTYPE;existing public.subscriptions%ROWTYPE;created public.subscriptions%ROWTYPE;
 actor uuid;site uuid;plan_id uuid;gateway text;payment text;period text;amount bigint;tax bigint;total bigint;
 charge public.billing_history%ROWTYPE;source_ref text;free_id uuid;is_free boolean;
 started timestamptz;finished timestamptz;promo timestamptz;constraint_name text;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k
  WHERE k NOT IN('user_id','store_id','plan_id','plan_slug','plan_name','billing_period','amount_paid','payment_gateway',
   'external_subscription_id','razorpay_order_id','razorpay_payment_id','period_start','period_end','promo_ends_at',
   'products_limit','invoice_number','invoice_description','tax_amount','total_amount',
   'subscription_checkout_id','subscription_checkout_key','subscription_checkout_request')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
 END IF;
 actor:=(p_input->>'user_id')::uuid;site:=(p_input->>'store_id')::uuid;plan_id:=(p_input->>'plan_id')::uuid;
 gateway:=p_input->>'payment_gateway';payment:=nullif(btrim(p_input->>'razorpay_payment_id'),'');period:=p_input->>'billing_period';
 amount:=(p_input->>'amount_paid')::bigint;tax:=(p_input->>'tax_amount')::bigint;total:=(p_input->>'total_amount')::bigint;
 -- 347: explicit retained free checkout context; the existing paid ABI remains intact.
 free_id:=nullif(p_input->>'subscription_checkout_id','')::uuid;is_free:=free_id IS NOT NULL;
 started:=(p_input->>'period_start')::timestamptz;finished:=(p_input->>'period_end')::timestamptz;promo:=(p_input->>'promo_ends_at')::timestamptz;
 IF actor IS NULL OR site IS NULL OR plan_id IS NULL OR period IS NULL OR period NOT IN('monthly','yearly')
  OR amount IS NULL OR amount<0 OR amount>2147483647 OR tax IS NULL OR tax<0 OR total IS NULL OR total<>amount+tax OR total>2147483647
  OR started IS NULL OR finished IS NULL OR finished<=started
  OR (gateway IS NOT NULL AND gateway NOT IN('razorpay','stripe')) OR (amount>0 AND gateway IS NULL)
  OR (gateway='razorpay' AND amount>0 AND payment IS NULL) OR (payment IS NOT NULL AND gateway IS DISTINCT FROM 'razorpay')
  OR coalesce(length(payment),0)>200 OR nullif(btrim(p_input->>'invoice_number'),'') IS NULL
  OR nullif(btrim(p_input->>'invoice_description'),'') IS NULL OR NOT(p_input?'products_limit') THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
 END IF;
 IF (p_input ?| ARRAY['subscription_checkout_id','subscription_checkout_key','subscription_checkout_request']) AND NOT is_free
  OR (is_free AND (amount<>0 OR tax<>0 OR total<>0 OR gateway IS NOT NULL OR payment IS NOT NULL
   OR p_input->>'razorpay_order_id' IS NOT NULL OR promo IS NOT NULL)) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 -- Global payment lock first, then the exact store. Different payments at the
 -- same store also serialize old-entitlement retirement with the new receipt.
 IF payment IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:razorpay:'||payment,0));END IF;
 SELECT * INTO s FROM public.sites WHERE id=site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(actor=s.custom_user_id OR actor=s.user_id,false) OR NOT EXISTS(SELECT 1 FROM public.users_custom WHERE id=actor) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');
 END IF;
 -- The table admission lock is already held by the store SELECT above. A
 -- call compiled before rollback may have waited on that lock; verify the
 -- currently bound function's own SET attribute, not the caller/session GUC.
 -- Read the live catalog binding even for a cached frame; admit exact supported versions only.
 IF is_free AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc current_binding
  WHERE current_binding.oid='public.activate_merchant_subscription_v1(jsonb)'::pg_catalog.regprocedure
   AND current_binding.proconfig && ARRAY['application_name=activate_merchant_subscription_v1:347','application_name=activate_merchant_subscription_v1:347:360']::text[]) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID'); END IF;
 IF is_free THEN
  SELECT * INTO charge FROM public.billing_history WHERE id=free_id FOR UPDATE;
  IF NOT FOUND OR charge.deleted_at IS NOT NULL OR charge.site_id IS DISTINCT FROM site OR charge.store_id IS DISTINCT FROM site
   OR charge.user_id IS DISTINCT FROM actor OR charge.amount IS DISTINCT FROM 0 OR charge.currency IS DISTINCT FROM 'INR'
   OR charge.payment_gateway IS NOT NULL OR charge.provider_payment_reference IS NOT NULL
   OR charge.subscription_checkout->>'mode' IS DISTINCT FROM 'free_activation'
   OR charge.subscription_checkout->>'amount_minor' IS DISTINCT FROM '0'
   OR charge.subscription_checkout_reference IS DISTINCT FROM 'free_checkout:'||charge.id
   OR charge.subscription_checkout_reference IS DISTINCT FROM p_input->>'external_subscription_id'
   OR charge.subscription_checkout_key IS DISTINCT FROM p_input->>'subscription_checkout_key'
   OR charge.subscription_checkout_request IS DISTINCT FROM p_input->'subscription_checkout_request'
   OR charge.subscription_checkout_request->>'plan_slug' IS DISTINCT FROM p_input->>'plan_slug'
   OR charge.subscription_checkout_request->>'site_type' IS DISTINCT FROM s.site_type
   OR charge.subscription_checkout_request->>'billing_period' IS DISTINCT FROM period
   OR charge.subscription_checkout->'plan'->>'id' IS DISTINCT FROM plan_id::text
   OR charge.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM p_input->>'plan_slug'
   OR charge.subscription_checkout->'plan'->>'name' IS DISTINCT FROM p_input->>'plan_name'
   OR charge.subscription_checkout->'plan'->'products_limit' IS DISTINCT FROM p_input->'products_limit'
   OR charge.billing_period IS DISTINCT FROM period THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
  IF charge.subscription_id IS NOT NULL THEN
   SELECT * INTO existing FROM public.subscriptions WHERE id=charge.subscription_id;
   IF NOT FOUND OR existing.deleted_at IS NOT NULL OR charge.payment_status IS DISTINCT FROM 'paid'
    OR existing.user_id IS DISTINCT FROM actor OR existing.store_id IS DISTINCT FROM site OR existing.site_id IS DISTINCT FROM site
    OR existing.plan_id IS DISTINCT FROM plan_id OR existing.plan IS DISTINCT FROM p_input->>'plan_slug'
    OR existing.billing_period IS DISTINCT FROM period OR existing.amount_paid IS DISTINCT FROM 0 OR existing.currency IS DISTINCT FROM 'INR'
    OR existing.payment_gateway IS NOT NULL OR existing.razorpay_payment_id IS NOT NULL OR existing.razorpay_order_id IS NOT NULL
    OR existing.external_subscription_id IS DISTINCT FROM charge.subscription_checkout_reference
    OR existing.current_period_start IS DISTINCT FROM charge.period_start OR existing.current_period_end IS DISTINCT FROM charge.period_end THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
   -- A completed intent may have been superseded. Read it; never reactivate it.
   RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(existing),'replayed',true);
  END IF;
  IF charge.payment_status IS DISTINCT FROM 'pending' THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT'); END IF;
 END IF;
 SELECT * INTO plan FROM public.plans WHERE id=plan_id AND site_type=s.site_type AND slug=p_input->>'plan_slug' AND is_active=true FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PLAN_CHANGED');END IF;
 IF payment IS NOT NULL THEN
  SELECT * INTO existing FROM public.subscriptions WHERE razorpay_payment_id=payment;
  IF FOUND THEN
   IF existing.deleted_at IS NOT NULL OR existing.store_id IS DISTINCT FROM site OR existing.site_id IS DISTINCT FROM site OR existing.user_id IS DISTINCT FROM actor
    OR (existing.plan_id IS NOT NULL AND existing.plan_id IS DISTINCT FROM plan_id) OR existing.plan IS DISTINCT FROM plan.slug
    OR existing.billing_period IS DISTINCT FROM period OR existing.amount_paid IS DISTINCT FROM amount
    OR (existing.razorpay_order_id IS NOT NULL AND existing.razorpay_order_id IS DISTINCT FROM p_input->>'razorpay_order_id')
    OR (existing.external_subscription_id IS NOT NULL AND existing.external_subscription_id IS DISTINCT FROM p_input->>'external_subscription_id') THEN
    RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
   END IF;
   RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(existing),'replayed',true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.billing_history WHERE provider_payment_reference=payment)
   OR EXISTS(SELECT 1 FROM public.payment_transactions t WHERE t.gateway='razorpay' AND t.provider_payment_id=payment) THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
  END IF;
 END IF;
 -- Only a server-persisted checkout can authorize a new real Razorpay activation.
 -- Explicit synthetic AutoPay IDs retain their existing sandbox classification.
 IF gateway='razorpay' AND payment NOT LIKE 'sandbox_autopay_payment:%' THEN
  source_ref:=coalesce(nullif(p_input->>'external_subscription_id',''),nullif(p_input->>'razorpay_order_id',''));
  SELECT * INTO charge FROM public.billing_history WHERE subscription_checkout_reference=source_ref FOR UPDATE;
  IF NOT FOUND OR charge.deleted_at IS NOT NULL OR charge.site_id IS DISTINCT FROM site OR charge.store_id IS DISTINCT FROM site
   OR charge.user_id IS DISTINCT FROM actor OR charge.subscription_checkout->'plan'->>'id' IS DISTINCT FROM plan_id::text
   OR charge.subscription_checkout->'plan'->>'slug' IS DISTINCT FROM plan.slug OR charge.billing_period IS DISTINCT FROM period
   OR charge.payment_gateway IS DISTINCT FROM 'razorpay' OR charge.amount IS DISTINCT FROM amount OR charge.currency IS DISTINCT FROM 'INR'
   OR charge.subscription_checkout->'plan'->'products_limit' IS DISTINCT FROM p_input->'products_limit'
   OR charge.payment_status NOT IN('pending','paid')
   OR (charge.payment_status='paid' AND charge.subscription_checkout->>'mode'<>'razorpay_subscription') THEN
   RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CHECKOUT_CONFLICT');
  END IF;
 END IF;
 INSERT INTO public.subscriptions(user_id,store_id,site_id,plan,plan_id,status,billing_period,current_period_start,current_period_end,promo_ends_at,
  payment_gateway,external_subscription_id,razorpay_order_id,razorpay_payment_id,amount_paid,currency,products_limit,stores_limit,idempotency_key)
 VALUES(actor,site,site,plan.slug,plan.id,'active',period,started,finished,promo,gateway,p_input->>'external_subscription_id',
  p_input->>'razorpay_order_id',payment,amount,'INR',(p_input->>'products_limit')::integer,1,
  CASE WHEN is_free THEN 'free_checkout:'||free_id WHEN payment IS NOT NULL THEN 'razorpay_payment:'||payment ELSE NULL END) RETURNING * INTO created;
 UPDATE public.subscriptions SET status='cancelled',cancelled_at=started WHERE store_id=site AND status='active' AND id<>created.id;
 UPDATE public.sites SET trial_status=CASE WHEN amount>0 THEN 'paid' ELSE 'active' END,updated_at=started WHERE id=site;
 IF charge.id IS NOT NULL AND charge.payment_status='pending' THEN
  UPDATE public.billing_history SET subscription_id=created.id,invoice_number=p_input->>'invoice_number',
   description=p_input->>'invoice_description',tax_amount=tax,total_amount=total,payment_id=CASE WHEN is_free THEN charge.subscription_checkout_reference ELSE payment END,
   provider_payment_reference=payment,payment_status='paid',period_start=started,period_end=finished,updated_at=now()
   WHERE id=charge.id;
 ELSE
 INSERT INTO public.billing_history(user_id,store_id,site_id,subscription_id,invoice_number,description,amount,currency,tax_amount,total_amount,
  payment_gateway,payment_id,provider_payment_reference,payment_status,billing_period,period_start,period_end)
 VALUES(actor,site,site,created.id,p_input->>'invoice_number',p_input->>'invoice_description',amount,'INR',tax,total,gateway,
  coalesce(payment,p_input->>'external_subscription_id',p_input->>'razorpay_order_id'),payment,'paid',period,started,finished);
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(actor,'user','merchant_subscription.activated','subscription',created.id,jsonb_build_object('site_id',site,'provider',gateway,'payment_reference',payment)
  ||CASE WHEN is_free THEN jsonb_build_object('checkout_receipt_id',charge.id,'request_hash',encode(sha256(convert_to(charge.subscription_checkout_request::text,'UTF8')),'hex')) ELSE '{}'::jsonb END);
 IF is_free THEN
  UPDATE public.idempotency_keys SET status='completed',locked_until=NULL,status_code=201,
   response_body=jsonb_build_object('billing_history_id',charge.id,'subscription_id',created.id)
   WHERE site_id=site AND scope='subscription.checkout:'||actor AND key=charge.subscription_checkout_key
    AND resource_id=charge.id AND request_hash=encode(sha256(convert_to(charge.subscription_checkout_request::text,'UTF8')),'hex');
  IF NOT FOUND THEN RAISE EXCEPTION 'free subscription checkout completion source unavailable'; END IF;
 END IF;
 RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(created),'replayed',false);
EXCEPTION WHEN unique_violation THEN
 GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
 IF constraint_name IN('subscriptions_razorpay_payment_global_uidx','billing_history_provider_payment_reference_uidx') THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
 END IF;
 RAISE;
END $function$;
REVOKE ALL ON FUNCTION public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.activate_merchant_subscription_v1(jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.activate_merchant_subscription_v1(jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
