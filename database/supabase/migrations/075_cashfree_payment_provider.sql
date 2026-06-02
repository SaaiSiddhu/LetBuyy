-- Phase 3 production-readiness: enable Cashfree as a real online payment provider.
-- This is append-only and keeps the verified baseline intact.

ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

ALTER TABLE public.refund_attempts
  DROP CONSTRAINT IF EXISTS refund_attempts_provider_check;

ALTER TABLE public.refund_attempts
  ADD CONSTRAINT refund_attempts_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'cod'::text,
    'bank_transfer'::text,
    'gift_card'::text
  ]));

DO $$
DECLARE
  v_definition text;
  v_old text := 'p_payment_method NOT IN (''razorpay'', ''stripe'', ''paypal'', ''cod'')';
  v_new text := 'p_payment_method NOT IN (''razorpay'', ''stripe'', ''paypal'', ''cashfree'', ''cod'')';
BEGIN
  SELECT pg_get_functiondef(
    'public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text)'::regprocedure
  )
    INTO v_definition;

  IF v_definition IS NULL OR position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'create_checkout_order payment-method guard was not in the expected shape';
  END IF;

  EXECUTE replace(v_definition, v_old, v_new);
END $$;
