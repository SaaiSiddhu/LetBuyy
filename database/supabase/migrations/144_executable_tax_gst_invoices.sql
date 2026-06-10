-- LetBuyy Executable Architecture V1 Task 008: GST tax calculation and immutable invoices.
-- Single writer: services/api-gateway/src/routes/tax.ts -> gst_invoices.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tax_registrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  gstin text NOT NULL,
  state_code text NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
  registration_type text NOT NULL DEFAULT 'regular'
    CHECK (registration_type IN ('regular', 'composition', 'unregistered')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT tax_registrations_gstin_check
    CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT tax_registrations_effective_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_registrations_site_gstin_active_idx
  ON public.tax_registrations (site_id, gstin)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hsn_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  hsn_code text NOT NULL CHECK (hsn_code ~ '^[0-9A-Za-z.-]{2,20}$'),
  description text,
  gst_rate_bps integer NOT NULL CHECK (gst_rate_bps >= 0 AND gst_rate_bps <= 4000),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT hsn_rates_effective_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS hsn_rates_site_code_window_idx
  ON public.hsn_rates (site_id, hsn_code, effective_from)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.tax_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('product', 'collection', 'shipping', 'order')),
  scope_id uuid,
  hsn_code text CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9A-Za-z.-]{2,20}$'),
  gst_rate_bps integer NOT NULL CHECK (gst_rate_bps >= 0 AND gst_rate_bps <= 4000),
  tax_inclusive boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT tax_overrides_window_check
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS tax_overrides_site_scope_idx
  ON public.tax_overrides (site_id, scope_type, scope_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gst_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  invoice_date timestamptz NOT NULL,
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  supplier jsonb NOT NULL,
  recipient jsonb NOT NULL,
  place_of_supply_state_code text NOT NULL CHECK (place_of_supply_state_code ~ '^[0-9]{2}$'),
  supply_type text NOT NULL CHECK (supply_type IN ('intra_state', 'inter_state')),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lines) = 'array'),
  taxable_amount_minor bigint NOT NULL CHECK (taxable_amount_minor >= 0),
  cgst_amount_minor bigint NOT NULL DEFAULT 0 CHECK (cgst_amount_minor >= 0),
  sgst_amount_minor bigint NOT NULL DEFAULT 0 CHECK (sgst_amount_minor >= 0),
  igst_amount_minor bigint NOT NULL DEFAULT 0 CHECK (igst_amount_minor >= 0),
  tax_amount_minor bigint NOT NULL CHECK (tax_amount_minor >= 0),
  total_amount_minor bigint NOT NULL CHECK (total_amount_minor >= 0),
  marketplace_tcs_bps integer NOT NULL DEFAULT 0 CHECK (marketplace_tcs_bps >= 0 AND marketplace_tcs_bps <= 1000),
  tcs_amount_minor bigint NOT NULL DEFAULT 0 CHECK (tcs_amount_minor >= 0),
  irp_mode text NOT NULL DEFAULT 'sandbox' CHECK (irp_mode IN ('sandbox', 'live')),
  irn text NOT NULL,
  qr_payload text NOT NULL,
  provider_ack jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'voided')),
  invoice jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT gst_invoices_tax_split_check
    CHECK (tax_amount_minor = cgst_amount_minor + sgst_amount_minor + igst_amount_minor)
);

CREATE UNIQUE INDEX IF NOT EXISTS gst_invoices_site_order_idx
  ON public.gst_invoices (site_id, order_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gst_invoices_site_number_idx
  ON public.gst_invoices (site_id, invoice_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS gst_invoices_site_date_idx
  ON public.gst_invoices (site_id, invoice_date DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.reject_gst_invoice_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'gst_invoices are immutable; create a void/reversal record instead';
END;
$$;

DROP TRIGGER IF EXISTS gst_invoices_reject_update ON public.gst_invoices;
CREATE TRIGGER gst_invoices_reject_update
  BEFORE UPDATE ON public.gst_invoices
  FOR EACH ROW EXECUTE FUNCTION public.reject_gst_invoice_mutation();

DROP TRIGGER IF EXISTS gst_invoices_reject_delete ON public.gst_invoices;
CREATE TRIGGER gst_invoices_reject_delete
  BEFORE DELETE ON public.gst_invoices
  FOR EACH ROW EXECUTE FUNCTION public.reject_gst_invoice_mutation();

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_tax_registrations_updated_at ON public.tax_registrations;
    CREATE TRIGGER update_tax_registrations_updated_at
      BEFORE UPDATE ON public.tax_registrations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    DROP TRIGGER IF EXISTS update_hsn_rates_updated_at ON public.hsn_rates;
    CREATE TRIGGER update_hsn_rates_updated_at
      BEFORE UPDATE ON public.hsn_rates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    DROP TRIGGER IF EXISTS update_tax_overrides_updated_at ON public.tax_overrides;
    CREATE TRIGGER update_tax_overrides_updated_at
      BEFORE UPDATE ON public.tax_overrides
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.tax_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_rates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tax_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gst_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_invoices FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('tax_registrations', 'tax_registrations_tenant_site_guc'),
    ('hsn_rates', 'hsn_rates_tenant_site_guc'),
    ('tax_overrides', 'tax_overrides_tenant_site_guc'),
    ('gst_invoices', 'gst_invoices_tenant_site_guc')
  ) AS policies(table_name, policy_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = r.table_name
         AND policyname = r.policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())',
        r.policy_name,
        r.table_name
      );
    END IF;
  END LOOP;
END;
$$;
