-- LetBuyy Executable Architecture V1 Task 004: merchant-owned payment sessions.
-- Additive only. Provider live credentials remain HUMAN-REQUIRED and sandbox mode
-- is the local default.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payment_credentials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('razorpay', 'cashfree', 'upi', 'cod')),
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'needs_verification')),
  kms_key_ref text NOT NULL DEFAULT 'sandbox-kms://letbuyy/payment-credentials',
  encrypted_credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, provider, mode)
);

CREATE TABLE IF NOT EXISTS public.payment_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('razorpay', 'cashfree', 'upi', 'cod')),
  token_ref text NOT NULL,
  token_type text NOT NULL DEFAULT 'provider_token' CHECK (token_type IN ('provider_token', 'upi_mandate', 'card_network_token')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, provider, token_ref)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('razorpay', 'cashfree', 'upi', 'cod')),
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requires_action', 'authorized', 'captured', 'failed', 'voided', 'refunded')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  provider_order_id text,
  provider_payment_id text,
  provider_session_id text,
  idempotency_key text NOT NULL,
  credential_id uuid REFERENCES public.payment_credentials(id) ON DELETE SET NULL,
  token_id uuid REFERENCES public.payment_tokens(id) ON DELETE SET NULL,
  client_action text NOT NULL DEFAULT 'none' CHECK (client_action IN ('none', 'redirect', 'upi_collect', 'cod_confirm')),
  expires_at timestamptz,
  authorized_at timestamptz,
  captured_at timestamptz,
  voided_at timestamptz,
  refunded_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, idempotency_key)
);

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_session_id text;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_session_id text;

ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_attempt_type_check;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'upi'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_attempt_type_check
  CHECK (attempt_type = ANY (ARRAY[
    'reference'::text,
    'authorize'::text,
    'capture'::text,
    'refund'::text,
    'failure'::text,
    'void'::text
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
    'upi'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

CREATE INDEX IF NOT EXISTS payment_credentials_site_provider_idx
  ON public.payment_credentials (site_id, provider, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_tokens_site_customer_idx
  ON public.payment_tokens (site_id, customer_id, provider)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payments_site_order_idx
  ON public.payments (site_id, order_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payments_site_status_idx
  ON public.payments (site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_uniq
  ON public.payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_payment_id_v1_uniq
  ON public.payment_transactions (gateway, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_attempts_payment_id_idx
  ON public.payment_attempts (payment_id, created_at DESC)
  WHERE payment_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_transactions_payment_id_idx
  ON public.payment_transactions (payment_id, created_at DESC)
  WHERE payment_id IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_payment_credentials_updated_at ON public.payment_credentials;
    CREATE TRIGGER trg_payment_credentials_updated_at
      BEFORE UPDATE ON public.payment_credentials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    DROP TRIGGER IF EXISTS trg_payment_tokens_updated_at ON public.payment_tokens;
    CREATE TRIGGER trg_payment_tokens_updated_at
      BEFORE UPDATE ON public.payment_tokens
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
    CREATE TRIGGER trg_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_credentials' AND policyname = 'payment_credentials_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY payment_credentials_tenant_site_guc ON public.payment_credentials USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_tokens' AND policyname = 'payment_tokens_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY payment_tokens_tenant_site_guc ON public.payment_tokens USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY payments_tenant_site_guc ON public.payments USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_attempts' AND policyname = 'payment_attempts_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY payment_attempts_tenant_site_guc ON public.payment_attempts USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_transactions' AND policyname = 'payment_transactions_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY payment_transactions_tenant_site_guc ON public.payment_transactions USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;
END;
$$;
