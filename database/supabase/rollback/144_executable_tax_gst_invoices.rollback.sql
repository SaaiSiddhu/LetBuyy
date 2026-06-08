-- Rollback for Task 008 GST tax calculation and immutable invoices.

DROP POLICY IF EXISTS gst_invoices_tenant_site_guc ON public.gst_invoices;
DROP POLICY IF EXISTS tax_overrides_tenant_site_guc ON public.tax_overrides;
DROP POLICY IF EXISTS hsn_rates_tenant_site_guc ON public.hsn_rates;
DROP POLICY IF EXISTS tax_registrations_tenant_site_guc ON public.tax_registrations;

DROP TRIGGER IF EXISTS gst_invoices_reject_update ON public.gst_invoices;
DROP TRIGGER IF EXISTS gst_invoices_reject_delete ON public.gst_invoices;
DROP TRIGGER IF EXISTS update_tax_overrides_updated_at ON public.tax_overrides;
DROP TRIGGER IF EXISTS update_hsn_rates_updated_at ON public.hsn_rates;
DROP TRIGGER IF EXISTS update_tax_registrations_updated_at ON public.tax_registrations;

DROP TABLE IF EXISTS public.gst_invoices;
DROP TABLE IF EXISTS public.tax_overrides;
DROP TABLE IF EXISTS public.hsn_rates;
DROP TABLE IF EXISTS public.tax_registrations;

DROP FUNCTION IF EXISTS public.reject_gst_invoice_mutation();
