-- Roll the finalizer body back to migration 292. Canonical postings, their chart account/type
-- vocabulary and the billing_history foreign key are retained as financial audit evidence.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('finalize_ad_credit_purchase', 'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)', ARRAY['p_site_id','p_billing_history_id','p_provider_order_id','p_provider_payment_id','p_request_id','p_actor_id']::text[], 'jsonb', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 293 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 293 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;


CREATE OR REPLACE FUNCTION public.finalize_ad_credit_purchase(
  p_site_id uuid,
  p_billing_history_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_charge public.billing_history%ROWTYPE;
  v_credited jsonb;
BEGIN
  IF p_site_id IS NULL OR p_billing_history_id IS NULL
     OR NULLIF(btrim(p_provider_order_id), '') IS NULL
     OR NULLIF(btrim(p_provider_payment_id), '') IS NULL THEN
    RAISE EXCEPTION 'ad credit payment binding is incomplete';
  END IF;

  SELECT * INTO v_charge
    FROM public.billing_history
   WHERE id = p_billing_history_id
     AND site_id = p_site_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ad credit billing record not found for site'; END IF;

  IF v_charge.payment_gateway IS DISTINCT FROM 'razorpay'
     OR v_charge.payment_id IS DISTINCT FROM p_provider_order_id
     OR v_charge.currency IS DISTINCT FROM 'INR'
     OR v_charge.amount <= 0 THEN
    RAISE EXCEPTION 'ad credit payment does not match its stored order';
  END IF;

  IF v_charge.payment_status = 'paid' THEN
    IF v_charge.provider_payment_reference IS DISTINCT FROM p_provider_payment_id THEN
      RAISE EXCEPTION 'ad credit billing record was finalized by a different payment';
    END IF;
  ELSIF v_charge.payment_status = 'pending' THEN
    IF v_charge.provider_payment_reference IS NOT NULL THEN
      RAISE EXCEPTION 'pending ad credit billing record already has a payment reference';
    END IF;
  ELSE
    RAISE EXCEPTION 'ad credit billing record is not payable';
  END IF;

  v_credited := public.record_ad_credit_purchase(
    p_site_id,
    v_charge.amount::bigint,
    p_provider_payment_id,
    'ad.purchase:' || p_provider_payment_id,
    p_request_id,
    p_actor_id
  );

  IF v_charge.payment_status = 'pending' THEN
    UPDATE public.billing_history
       SET payment_status = 'paid',
           provider_payment_reference = p_provider_payment_id,
           updated_at = now(),
           updated_by = p_actor_id
     WHERE id = p_billing_history_id
       AND site_id = p_site_id
       AND payment_status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'ad credit billing record finalization lost its pending state'; END IF;
  END IF;

  RETURN v_credited || jsonb_build_object(
    'billing_history_id', p_billing_history_id,
    'payment_status', 'paid'
  );
END;
$$;

COMMIT;
