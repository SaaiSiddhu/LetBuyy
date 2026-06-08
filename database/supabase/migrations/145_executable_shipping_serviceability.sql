-- LetBuyy Executable Architecture V1 Task 009: shipping serviceability, profiles, and shipment tracking.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS cod_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.shipping_zones
   SET site_id = store_id
 WHERE site_id IS NULL;

ALTER TABLE public.shipping_rates
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cod_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.shipping_rates rates
   SET site_id = zones.site_id
  FROM public.shipping_zones zones
 WHERE rates.zone_id = zones.id
   AND rates.site_id IS NULL;

CREATE TABLE IF NOT EXISTS public.shipping_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  handling_fee_minor bigint NOT NULL DEFAULT 0 CHECK (handling_fee_minor >= 0),
  cod_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS shipping_profiles_one_default_idx
  ON public.shipping_profiles (site_id)
  WHERE is_default IS TRUE AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.shipping_serviceability_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'shiprocket' CHECK (provider IN ('shiprocket', 'delhivery', 'pickrr')),
  pincode text NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  serviceable boolean NOT NULL DEFAULT true,
  cod_available boolean NOT NULL DEFAULT true,
  min_cod_amount_minor bigint NOT NULL DEFAULT 0 CHECK (min_cod_amount_minor >= 0),
  max_cod_amount_minor bigint CHECK (max_cod_amount_minor IS NULL OR max_cod_amount_minor >= min_cod_amount_minor),
  min_weight_grams integer NOT NULL DEFAULT 1 CHECK (min_weight_grams >= 1),
  max_weight_grams integer NOT NULL DEFAULT 50000 CHECK (max_weight_grams >= min_weight_grams),
  estimated_days_min integer NOT NULL DEFAULT 3 CHECK (estimated_days_min >= 0),
  estimated_days_max integer NOT NULL DEFAULT 7 CHECK (estimated_days_max >= estimated_days_min),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS shipping_serviceability_site_provider_pin_idx
  ON public.shipping_serviceability_rules (site_id, provider, pincode)
  WHERE deleted_at IS NULL;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_shipment_id text,
  ADD COLUMN IF NOT EXISTS awb text,
  ADD COLUMN IF NOT EXISTS label_url text,
  ADD COLUMN IF NOT EXISTS cod_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cod_amount_minor bigint NOT NULL DEFAULT 0 CHECK (cod_amount_minor >= 0),
  ADD COLUMN IF NOT EXISTS tracking_events jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tracking_events) = 'array');

CREATE INDEX IF NOT EXISTS shipping_rates_site_active_idx
  ON public.shipping_rates (site_id, is_active, cod_enabled)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS shipping_zones_site_active_idx
  ON public.shipping_zones (site_id, cod_enabled)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS shipments_site_provider_tracking_idx
  ON public.shipments (site_id, provider, tracking_number)
  WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_shipping_profiles_updated_at ON public.shipping_profiles;
    CREATE TRIGGER update_shipping_profiles_updated_at
      BEFORE UPDATE ON public.shipping_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    DROP TRIGGER IF EXISTS update_shipping_serviceability_rules_updated_at ON public.shipping_serviceability_rules;
    CREATE TRIGGER update_shipping_serviceability_rules_updated_at
      BEFORE UPDATE ON public.shipping_serviceability_rules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.shipping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_serviceability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_serviceability_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_profiles' AND policyname = 'shipping_profiles_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY shipping_profiles_tenant_site_guc ON public.shipping_profiles USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_serviceability_rules' AND policyname = 'shipping_serviceability_rules_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY shipping_serviceability_rules_tenant_site_guc ON public.shipping_serviceability_rules USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_zones' AND policyname = 'shipping_zones_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY shipping_zones_tenant_site_guc ON public.shipping_zones USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_rates' AND policyname = 'shipping_rates_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY shipping_rates_tenant_site_guc ON public.shipping_rates USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipments' AND policyname = 'shipments_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY shipments_tenant_site_guc ON public.shipments USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;
END;
$$;
