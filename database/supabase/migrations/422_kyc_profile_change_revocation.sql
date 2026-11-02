-- A previously reviewed document cannot attest to a changed legal, GST, or
-- invoice-address fact. Keep this revocation in the same transaction as the
-- canonical sites edit, including writes that do not pass through the Gateway.
BEGIN;

CREATE FUNCTION public.revoke_kyc_on_profile_change_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  affected_types text[] := ARRAY[]::text[];
BEGIN
  IF OLD.legal_name IS DISTINCT FROM NEW.legal_name
     OR OLD.business_profile->>'entity_type' IS DISTINCT FROM NEW.business_profile->>'entity_type'
     OR OLD.business_profile->>'pan_last4' IS DISTINCT FROM NEW.business_profile->>'pan_last4' THEN
    affected_types := array_append(affected_types, 'business_pan');
  END IF;
  IF OLD.gstin IS DISTINCT FROM NEW.gstin
     OR OLD.gst_state_code IS DISTINCT FROM NEW.gst_state_code THEN
    affected_types := array_append(affected_types, 'gst_certificate');
  END IF;
  IF OLD.invoice_address IS DISTINCT FROM NEW.invoice_address THEN
    affected_types := array_append(affected_types, 'address_proof');
  END IF;

  IF array_length(affected_types, 1) IS NOT NULL THEN
    UPDATE public.merchant_kyc_documents AS d
       SET status = CASE WHEN d.metadata->>'malware_scan_status' = 'rejected'
                         THEN 'rejected' ELSE 'needs_review' END,
           provider_reference = NULL,
           verified_at = NULL,
           rejected_at = NULL,
           rejection_reason = NULL,
           metadata = (d.metadata - 'provider_checked_at' - 'refresh_idempotency_key') ||
                      '{"provider_verified":false,"provider_unavailable":false,"profile_change_requires_resubmission":true}'::jsonb
     WHERE d.site_id = NEW.id
       AND d.document_type = ANY(affected_types)
       AND d.deleted_at IS NULL
       AND d.metadata ? 'private_object_key'
       AND d.metadata->>'profile_change_requires_resubmission' IS DISTINCT FROM 'true';
  END IF;
  RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION public.revoke_kyc_on_profile_change_v1() FROM PUBLIC;
CREATE TRIGGER sites_revoke_kyc_on_profile_change_v1
  AFTER UPDATE OF legal_name, business_profile, gstin, gst_state_code, invoice_address
  ON public.sites FOR EACH ROW
  EXECUTE FUNCTION public.revoke_kyc_on_profile_change_v1();

NOTIFY pgrst, 'reload schema';
COMMIT;
