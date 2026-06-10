-- LetBuyy Executable Architecture V1 Task 014.
-- Billing module: sandbox UPI AutoPay mandates, merchant GST invoices, dunning,
-- usage metering, and permanent removal of the store-plan GMV rake.

UPDATE public.plans
SET gmv_percentage = 0,
    updated_at = now()
WHERE site_type = 'store'
  AND COALESCE(gmv_percentage, 0) <> 0;

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_store_zero_gmv_rake_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_store_zero_gmv_rake_check
  CHECK (site_type <> 'store' OR COALESCE(gmv_percentage, 0) = 0);

CREATE TABLE IF NOT EXISTS public.billing_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'upi_autopay',
  provider_mode text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'pending_provider',
  plan_slug text NOT NULL,
  billing_period text NOT NULL DEFAULT 'monthly',
  currency text NOT NULL DEFAULT 'INR',
  amount_minor bigint NOT NULL DEFAULT 0,
  external_mandate_id text,
  upi_vpa_hash text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT billing_mandates_provider_check CHECK (provider IN ('upi_autopay')),
  CONSTRAINT billing_mandates_provider_mode_check CHECK (provider_mode IN ('sandbox', 'live')),
  CONSTRAINT billing_mandates_status_check CHECK (status IN ('pending_provider', 'active', 'revoked', 'failed')),
  CONSTRAINT billing_mandates_billing_period_check CHECK (billing_period IN ('monthly', 'yearly')),
  CONSTRAINT billing_mandates_currency_check CHECK (currency = 'INR'),
  CONSTRAINT billing_mandates_amount_check CHECK (amount_minor >= 0),
  UNIQUE (site_id, idempotency_key),
  UNIQUE (site_id, external_mandate_id)
);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS site_id uuid,
  ADD COLUMN IF NOT EXISTS mandate_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS dunning_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dunning_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_dunning_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_billing_history_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.subscriptions
SET site_id = store_id
WHERE site_id IS NULL
  AND store_id IS NOT NULL;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_dunning_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_dunning_status_check
  CHECK (dunning_status IN ('none', 'past_due', 'paused', 'resolved'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_dunning_attempts_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_dunning_attempts_check
  CHECK (dunning_attempts >= 0);

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_site_id_fkey;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_mandate_id_fkey;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_mandate_id_fkey
  FOREIGN KEY (mandate_id) REFERENCES public.billing_mandates(id) ON DELETE SET NULL;

ALTER TABLE public.billing_history
  ADD COLUMN IF NOT EXISTS site_id uuid,
  ADD COLUMN IF NOT EXISTS billing_period text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

UPDATE public.billing_history
SET site_id = store_id,
    billing_period = COALESCE(billing_period, 'monthly')
WHERE site_id IS NULL
  AND store_id IS NOT NULL;

ALTER TABLE public.billing_history
  DROP CONSTRAINT IF EXISTS billing_history_site_id_fkey;

ALTER TABLE public.billing_history
  ADD CONSTRAINT billing_history_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE public.billing_history
  DROP CONSTRAINT IF EXISTS billing_history_billing_period_check;

ALTER TABLE public.billing_history
  ADD CONSTRAINT billing_history_billing_period_check
  CHECK (billing_period IS NULL OR billing_period IN ('monthly', 'yearly'));

CREATE TABLE IF NOT EXISTS public.merchant_billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  billing_history_id uuid REFERENCES public.billing_history(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  currency text NOT NULL DEFAULT 'INR',
  subtotal_minor bigint NOT NULL DEFAULT 0,
  cgst_minor bigint NOT NULL DEFAULT 0,
  sgst_minor bigint NOT NULL DEFAULT 0,
  igst_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  irn text,
  qr_payload text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT merchant_billing_invoices_status_check CHECK (status IN ('issued', 'payment_failed', 'void')),
  CONSTRAINT merchant_billing_invoices_currency_check CHECK (currency = 'INR'),
  CONSTRAINT merchant_billing_invoices_amounts_check CHECK (
    subtotal_minor >= 0
    AND cgst_minor >= 0
    AND sgst_minor >= 0
    AND igst_minor >= 0
    AND total_minor >= 0
  ),
  UNIQUE (site_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.billing_dunning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  billing_history_id uuid REFERENCES public.billing_history(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  attempt_number integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT billing_dunning_events_status_check CHECK (status IN ('scheduled', 'sent', 'resolved', 'cancelled')),
  CONSTRAINT billing_dunning_events_attempt_check CHECK (attempt_number >= 0)
);

CREATE TABLE IF NOT EXISTS public.billing_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  meter_name text NOT NULL,
  quantity numeric(20, 4) NOT NULL DEFAULT 0,
  amount_minor bigint NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'order.created',
  resource jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT billing_usage_events_amounts_check CHECK (quantity >= 0 AND amount_minor >= 0),
  UNIQUE (site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS subscriptions_site_id_status_idx
  ON public.subscriptions(site_id, status)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_site_id_idempotency_key_idx
  ON public.subscriptions(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billing_history_site_id_created_at_idx
  ON public.billing_history(site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billing_mandates_site_id_status_idx
  ON public.billing_mandates(site_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS merchant_billing_invoices_site_id_created_at_idx
  ON public.merchant_billing_invoices(site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS billing_dunning_events_site_id_next_attempt_idx
  ON public.billing_dunning_events(site_id, next_attempt_at)
  WHERE deleted_at IS NULL AND status = 'scheduled';

CREATE INDEX IF NOT EXISTS billing_usage_events_site_id_meter_idx
  ON public.billing_usage_events(site_id, meter_name, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_billing_mandates_updated_at ON public.billing_mandates;
CREATE TRIGGER update_billing_mandates_updated_at
  BEFORE UPDATE ON public.billing_mandates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_merchant_billing_invoices_updated_at ON public.merchant_billing_invoices;
CREATE TRIGGER update_merchant_billing_invoices_updated_at
  BEFORE UPDATE ON public.merchant_billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_billing_dunning_events_updated_at ON public.billing_dunning_events;
CREATE TRIGGER update_billing_dunning_events_updated_at
  BEFORE UPDATE ON public.billing_dunning_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_billing_usage_events_updated_at ON public.billing_usage_events;
CREATE TRIGGER update_billing_usage_events_updated_at
  BEFORE UPDATE ON public.billing_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_billing_history_updated_at ON public.billing_history;
CREATE TRIGGER update_billing_history_updated_at
  BEFORE UPDATE ON public.billing_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'subscriptions',
    'billing_history',
    'billing_mandates',
    'merchant_billing_invoices',
    'billing_dunning_events',
    'billing_usage_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())',
      v_table || '_tenant_site_guc',
      v_table
    );
  END LOOP;
END;
$$;
