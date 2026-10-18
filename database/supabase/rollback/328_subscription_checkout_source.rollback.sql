BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('activate_merchant_subscription_v1', 'public.activate_merchant_subscription_v1(jsonb)', ARRAY['p_input']::text[], 'jsonb', false, 1)
  ) AS expected(name, signature, input_names, result_type, returns_set, overloads)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 328 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 328 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

DO $f$ BEGIN IF EXISTS(SELECT 1 FROM public.billing_history WHERE subscription_checkout IS NOT NULL) THEN
 RAISE EXCEPTION '328 rollback refuses retained checkout evidence; retain forward schema'; END IF; END $f$;
DROP POLICY subscription_checkout_backend_read_v1 ON public.billing_history;
DROP TRIGGER protect_subscription_receipt_writer_v1 ON public.subscriptions;
DROP TRIGGER protect_subscription_billing_writer_v1 ON public.billing_history;
DROP FUNCTION public.protect_subscription_receipt_writer_v1();
DROP FUNCTION public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb);
DROP FUNCTION public.bind_merchant_subscription_checkout_v1(uuid,uuid,uuid,text,text);
DROP FUNCTION public.read_merchant_subscription_checkout_v1(uuid,uuid,text,text,text,text);
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE s public.sites%ROWTYPE;plan public.plans%ROWTYPE;existing public.subscriptions%ROWTYPE;created public.subscriptions%ROWTYPE;
 actor uuid;site uuid;plan_id uuid;gateway text;payment text;period text;amount bigint;tax bigint;total bigint;
 started timestamptz;finished timestamptz;promo timestamptz;constraint_name text;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k
  WHERE k NOT IN('user_id','store_id','plan_id','plan_slug','plan_name','billing_period','amount_paid','payment_gateway',
   'external_subscription_id','razorpay_order_id','razorpay_payment_id','period_start','period_end','promo_ends_at',
   'products_limit','invoice_number','invoice_description','tax_amount','total_amount')) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_CONTEXT_INVALID');
 END IF;
 actor:=(p_input->>'user_id')::uuid;site:=(p_input->>'store_id')::uuid;plan_id:=(p_input->>'plan_id')::uuid;
 gateway:=p_input->>'payment_gateway';payment:=nullif(btrim(p_input->>'razorpay_payment_id'),'');period:=p_input->>'billing_period';
 amount:=(p_input->>'amount_paid')::bigint;tax:=(p_input->>'tax_amount')::bigint;total:=(p_input->>'total_amount')::bigint;
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
 -- Global payment lock first, then the exact store. Different payments at the
 -- same store also serialize old-entitlement retirement with the new receipt.
 IF payment IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:subscription:razorpay:'||payment,0));END IF;
 SELECT * INTO s FROM public.sites WHERE id=site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(actor=s.custom_user_id OR actor=s.user_id,false) OR NOT EXISTS(SELECT 1 FROM public.users_custom WHERE id=actor) THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_OWNER_REQUIRED');
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
 INSERT INTO public.subscriptions(user_id,store_id,site_id,plan,plan_id,status,billing_period,current_period_start,current_period_end,promo_ends_at,
  payment_gateway,external_subscription_id,razorpay_order_id,razorpay_payment_id,amount_paid,currency,products_limit,stores_limit,idempotency_key)
 VALUES(actor,site,site,plan.slug,plan.id,'active',period,started,finished,promo,gateway,p_input->>'external_subscription_id',
  p_input->>'razorpay_order_id',payment,amount,'INR',(p_input->>'products_limit')::integer,1,
  CASE WHEN payment IS NOT NULL THEN 'razorpay_payment:'||payment ELSE NULL END) RETURNING * INTO created;
 UPDATE public.subscriptions SET status='cancelled',cancelled_at=started WHERE store_id=site AND status='active' AND id<>created.id;
 UPDATE public.sites SET trial_status=CASE WHEN amount>0 THEN 'paid' ELSE 'active' END,updated_at=started WHERE id=site;
 INSERT INTO public.billing_history(user_id,store_id,site_id,subscription_id,invoice_number,description,amount,currency,tax_amount,total_amount,
  payment_gateway,payment_id,provider_payment_reference,payment_status,billing_period,period_start,period_end)
 VALUES(actor,site,site,created.id,p_input->>'invoice_number',p_input->>'invoice_description',amount,'INR',tax,total,gateway,
  coalesce(payment,p_input->>'external_subscription_id',p_input->>'razorpay_order_id'),payment,'paid',period,started,finished);
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(actor,'user','merchant_subscription.activated','subscription',created.id,jsonb_build_object('site_id',site,'provider',gateway,'payment_reference',payment));
 RETURN jsonb_build_object('accepted',true,'subscription',to_jsonb(created),'replayed',false);
EXCEPTION WHEN unique_violation THEN
 GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
 IF constraint_name IN('subscriptions_razorpay_payment_global_uidx','billing_history_provider_payment_reference_uidx') THEN
  RETURN jsonb_build_object('accepted',false,'code','SUBSCRIPTION_PAYMENT_CONFLICT');
 END IF;
 RAISE;
END $function$;
REVOKE ALL ON FUNCTION public.activate_merchant_subscription_v1(jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.activate_merchant_subscription_v1(jsonb) TO service_role;
ALTER TABLE public.billing_history DROP COLUMN subscription_checkout,DROP COLUMN subscription_checkout_key,
 DROP COLUMN subscription_checkout_request,DROP COLUMN subscription_checkout_reference;
NOTIFY pgrst,'reload schema';
COMMIT;
