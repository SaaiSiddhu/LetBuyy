-- Rollback for Task 009 shipping serviceability, profiles, and shipment tracking.

DROP POLICY IF EXISTS shipments_tenant_site_guc ON public.shipments;
DROP POLICY IF EXISTS shipping_rates_tenant_site_guc ON public.shipping_rates;
DROP POLICY IF EXISTS shipping_zones_tenant_site_guc ON public.shipping_zones;
DROP POLICY IF EXISTS shipping_serviceability_rules_tenant_site_guc ON public.shipping_serviceability_rules;
DROP POLICY IF EXISTS shipping_profiles_tenant_site_guc ON public.shipping_profiles;

DROP INDEX IF EXISTS public.shipments_site_provider_tracking_idx;
DROP INDEX IF EXISTS public.shipping_zones_site_active_idx;
DROP INDEX IF EXISTS public.shipping_rates_site_active_idx;
DROP INDEX IF EXISTS public.shipping_serviceability_site_provider_pin_idx;
DROP INDEX IF EXISTS public.shipping_profiles_one_default_idx;

DROP TRIGGER IF EXISTS update_shipping_serviceability_rules_updated_at ON public.shipping_serviceability_rules;
DROP TRIGGER IF EXISTS update_shipping_profiles_updated_at ON public.shipping_profiles;

DROP TABLE IF EXISTS public.shipping_serviceability_rules;
DROP TABLE IF EXISTS public.shipping_profiles;

ALTER TABLE IF EXISTS public.shipments
  DROP COLUMN IF EXISTS tracking_events,
  DROP COLUMN IF EXISTS cod_amount_minor,
  DROP COLUMN IF EXISTS cod_eligible,
  DROP COLUMN IF EXISTS label_url,
  DROP COLUMN IF EXISTS awb,
  DROP COLUMN IF EXISTS provider_shipment_id,
  DROP COLUMN IF EXISTS provider;

ALTER TABLE IF EXISTS public.shipping_rates
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS cod_enabled,
  DROP COLUMN IF EXISTS site_id;

ALTER TABLE IF EXISTS public.shipping_zones
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS cod_enabled,
  DROP COLUMN IF EXISTS profile_id,
  DROP COLUMN IF EXISTS site_id;
