-- Reverting this race fix is safe only before India upload receipts exist.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
    WHERE storage_provider = 'aws_s3_mumbai') THEN
    RAISE EXCEPTION 'India KYC receipts exist; retain early-scan retry semantics'
      USING ERRCODE = '55000';
  END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.record_kyc_india_scan_v1(
  p_site uuid, p_receipt uuid, p_version text, p_event uuid,
  p_verdict text, p_scanned_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  j public.kyc_private_object_cleanup_jobs%ROWTYPE;
  d public.merchant_kyc_documents%ROWTYPE;
BEGIN
  IF p_site IS NULL OR p_receipt IS NULL OR p_event IS NULL OR p_version IS NULL
    OR p_verdict IS NULL OR p_verdict NOT IN ('clean', 'rejected') OR p_scanned_at IS NULL THEN
    RAISE EXCEPTION 'Invalid India KYC scan result' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO j FROM public.kyc_private_object_cleanup_jobs
   WHERE id = p_receipt AND site_id = p_site FOR UPDATE;
  IF NOT FOUND OR j.storage_provider <> 'aws_s3_mumbai'
    OR j.purpose <> 'upload_reservation' OR j.status <> 'completed'
    OR j.outcome <> 'retained' OR j.head_verified_at IS NULL
    OR j.object_version_id IS DISTINCT FROM p_version OR j.deleted_at IS NOT NULL THEN
    RETURN 'stale';
  END IF;
  SELECT * INTO d FROM public.merchant_kyc_documents
   WHERE site_id = p_site AND document_type = j.document_type AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR d.metadata->>'private_storage_provider' <> 'aws_s3_mumbai'
    OR d.metadata->>'private_upload_receipt_id' IS DISTINCT FROM j.id::text
    OR d.metadata->>'private_object_key' IS DISTINCT FROM j.object_key
    OR d.metadata->>'private_object_version_id' IS DISTINCT FROM p_version THEN
    RETURN 'stale';
  END IF;
  IF j.scan_event_id = p_event THEN
    IF j.scan_verdict <> p_verdict THEN
      RAISE EXCEPTION 'Conflicting replay of India KYC scan event' USING ERRCODE = '23514';
    END IF;
    RETURN 'replay';
  END IF;
  IF j.scan_verdict = 'rejected' OR j.scan_verdict = 'clean' AND p_verdict = 'clean' THEN
    RETURN 'unchanged';
  END IF;
  UPDATE public.kyc_private_object_cleanup_jobs
     SET scan_event_id = p_event, scan_verdict = p_verdict,
         scan_completed_at = p_scanned_at
   WHERE id = p_receipt AND site_id = p_site;
  UPDATE public.merchant_kyc_documents
     SET metadata = d.metadata || jsonb_build_object(
           'malware_scan_status', p_verdict, 'scan_event_id', p_event::text,
           'scan_completed_at', p_scanned_at),
         status = CASE WHEN p_verdict = 'rejected' THEN 'needs_review' ELSE d.status END,
         verified_at = CASE WHEN p_verdict = 'rejected' THEN NULL ELSE d.verified_at END,
         updated_at = now()
   WHERE id = d.id AND site_id = p_site;
  RETURN 'applied';
END $fn$;
REVOKE ALL ON FUNCTION public.record_kyc_india_scan_v1(uuid,uuid,text,uuid,text,timestamptz)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.record_kyc_india_scan_v1(uuid,uuid,text,uuid,text,timestamptz)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
