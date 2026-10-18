-- 292 — atomically bind a verified ad-credit payment to its billing row and entitlement credit.
--
-- HMAC verification remains in the shared Gateway verifier. This transaction is its durable
-- one-time finalizer: a row lock prevents two valid payment attempts for one provider order from
-- both issuing credits, while exact retries after a lost response remain safe.
-- Rollback: database/supabase/rollback/292_atomic_ad_credit_purchase_finalization.rollback.sql

BEGIN;

ALTER TABLE public.billing_history
  ADD COLUMN IF NOT EXISTS provider_payment_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS billing_history_provider_payment_reference_uidx
  ON public.billing_history (provider_payment_reference)
  WHERE provider_payment_reference IS NOT NULL;

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ad credit billing record not found for site';
  END IF;

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

  -- The RPC checks the provider payment id and amount against any prior use of its idempotency key.
  -- Its insert and the billing-row finalization below commit or roll back together.
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
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ad credit billing record finalization lost its pending state';
    END IF;
  END IF;

  RETURN v_credited || jsonb_build_object(
    'billing_history_id', p_billing_history_id,
    'payment_status', 'paid'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ad_credit_purchase(uuid, uuid, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.finalize_ad_credit_purchase(uuid, uuid, text, text, text, uuid)
  TO service_role;

COMMIT;
