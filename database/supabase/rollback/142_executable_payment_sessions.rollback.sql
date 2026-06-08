-- Rollback for Task 004 merchant-owned payment sessions.

DROP POLICY IF EXISTS payment_transactions_tenant_site_guc ON public.payment_transactions;
DROP POLICY IF EXISTS payment_attempts_tenant_site_guc ON public.payment_attempts;
DROP POLICY IF EXISTS payments_tenant_site_guc ON public.payments;
DROP POLICY IF EXISTS payment_tokens_tenant_site_guc ON public.payment_tokens;
DROP POLICY IF EXISTS payment_credentials_tenant_site_guc ON public.payment_credentials;

DROP INDEX IF EXISTS public.payment_transactions_payment_id_idx;
DROP INDEX IF EXISTS public.payment_attempts_payment_id_idx;
DROP INDEX IF EXISTS public.payment_transactions_provider_payment_id_v1_uniq;
DROP INDEX IF EXISTS public.payments_provider_payment_id_uniq;
DROP INDEX IF EXISTS public.payments_site_status_idx;
DROP INDEX IF EXISTS public.payments_site_order_idx;
DROP INDEX IF EXISTS public.payment_tokens_site_customer_idx;
DROP INDEX IF EXISTS public.payment_credentials_site_provider_idx;

ALTER TABLE IF EXISTS public.payment_attempts
  DROP COLUMN IF EXISTS payment_id,
  DROP COLUMN IF EXISTS provider_session_id;

ALTER TABLE IF EXISTS public.payment_transactions
  DROP COLUMN IF EXISTS payment_id,
  DROP COLUMN IF EXISTS provider_session_id;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
DROP TRIGGER IF EXISTS trg_payment_tokens_updated_at ON public.payment_tokens;
DROP TRIGGER IF EXISTS trg_payment_credentials_updated_at ON public.payment_credentials;

DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.payment_tokens;
DROP TABLE IF EXISTS public.payment_credentials;

ALTER TABLE IF EXISTS public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE IF EXISTS public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_attempt_type_check;

ALTER TABLE IF EXISTS public.payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

ALTER TABLE IF EXISTS public.payment_attempts
  ADD CONSTRAINT payment_attempts_attempt_type_check
  CHECK (attempt_type = ANY (ARRAY[
    'reference'::text,
    'authorize'::text,
    'capture'::text,
    'failure'::text,
    'void'::text
  ]));

ALTER TABLE IF EXISTS public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;

ALTER TABLE IF EXISTS public.payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));
