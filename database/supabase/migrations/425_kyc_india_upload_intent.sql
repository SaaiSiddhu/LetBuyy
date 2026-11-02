-- Expand the canonical private-object receipt before enabling direct India
-- upload. No Gateway route or deployed storage binding is activated here.
BEGIN;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD COLUMN storage_provider text NOT NULL DEFAULT 'r2_fixture',
  ADD COLUMN document_type text,
  ADD COLUMN expected_sha256_hex text,
  ADD COLUMN expected_bytes integer,
  ADD COLUMN expected_content_type text,
  ADD COLUMN reference_last4 text,
  ADD COLUMN upload_idempotency_key text,
  ADD COLUMN intent_expires_at timestamptz,
  ADD COLUMN object_version_id text,
  ADD COLUMN head_verified_at timestamptz;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD CONSTRAINT kyc_private_receipt_provider_check
    CHECK (storage_provider IN ('r2_fixture', 'aws_s3_mumbai')),
  ADD CONSTRAINT kyc_india_upload_intent_check CHECK (
    storage_provider <> 'aws_s3_mumbai' OR coalesce((
      document_type IN ('business_pan', 'gst_certificate', 'bank_proof', 'address_proof', 'identity_proof')
      AND object_key ~ ('^kyc/' || site_id::text || '/' || document_type || '/[a-f0-9-]{36}$')
      AND (
        purpose = 'replaced_object' AND object_version_id IS NOT NULL
        OR purpose = 'upload_reservation'
          AND object_key = 'kyc/' || site_id::text || '/' || document_type || '/' || id::text
          AND expected_sha256_hex ~ '^[a-f0-9]{64}$'
          AND expected_bytes BETWEEN 1 AND 5242880
          AND expected_content_type IN ('application/pdf', 'image/jpeg', 'image/png')
          AND reference_last4 ~ '^[A-Za-z0-9]{2,4}$'
          AND length(upload_idempotency_key) BETWEEN 8 AND 160
          AND created_by IS NOT NULL AND updated_by IS NOT NULL
          AND intent_expires_at > created_at
          AND intent_expires_at <= created_at + interval '5 minutes'
          AND next_attempt_at > intent_expires_at
      )
      AND (object_version_id IS NULL OR (
        object_version_id <> 'null' AND length(object_version_id) BETWEEN 1 AND 1024
        AND object_version_id !~ '[[:cntrl:]]'
      ))
      AND (head_verified_at IS NULL OR object_version_id IS NOT NULL)
      AND (purpose <> 'upload_reservation' OR status <> 'completed'
        OR outcome <> 'retained' OR (object_version_id IS NOT NULL AND head_verified_at IS NOT NULL))
    ), false)
  );

CREATE UNIQUE INDEX kyc_india_upload_intent_idempotency_idx
  ON public.kyc_private_object_cleanup_jobs(site_id, document_type, upload_idempotency_key)
  WHERE storage_provider = 'aws_s3_mumbai' AND purpose = 'upload_reservation' AND deleted_at IS NULL;

-- The merchant-facing Gateway uses the RLS-subject pooled role only to create
-- or read its own pending intent. It cannot approve, complete, delete, or set
-- a scanner verdict through this table. Existing R2 fixture writes remain
-- service-owned and test-only.
REVOKE ALL ON public.kyc_private_object_cleanup_jobs FROM app_tenant;
CREATE POLICY kyc_india_upload_intent_read_v1
  ON public.kyc_private_object_cleanup_jobs FOR SELECT TO app_tenant
  USING (site_id = public.current_site_id() AND storage_provider = 'aws_s3_mumbai');
CREATE POLICY kyc_india_upload_intent_insert_v1
  ON public.kyc_private_object_cleanup_jobs FOR INSERT TO app_tenant
  WITH CHECK (site_id = public.current_site_id() AND storage_provider = 'aws_s3_mumbai'
    AND purpose = 'upload_reservation' AND status = 'pending');
GRANT SELECT ON public.kyc_private_object_cleanup_jobs TO app_tenant;
GRANT INSERT (id, site_id, object_key, purpose, storage_provider, document_type,
  expected_sha256_hex, expected_bytes, expected_content_type, reference_last4,
  upload_idempotency_key, intent_expires_at, next_attempt_at, created_by,
  updated_by) ON public.kyc_private_object_cleanup_jobs TO app_tenant;

-- A future accepted S3 evidence row must carry a pinned version; neither a
-- bare POST success nor a latest-version HEAD may become current evidence.
ALTER TABLE public.merchant_kyc_documents
  ADD CONSTRAINT merchant_kyc_india_object_version_check CHECK (
    NOT (metadata ? 'private_storage_provider') OR coalesce((
      metadata->>'private_storage_provider' = 'aws_s3_mumbai'
      AND metadata->>'private_object_key' ~
        ('^kyc/' || site_id::text || '/' || document_type || '/[a-f0-9-]{36}$')
      AND length(coalesce(metadata->>'private_object_version_id', '')) BETWEEN 1 AND 1024
      AND metadata->>'private_object_version_id' <> 'null'
      AND metadata->>'private_object_version_id' !~ '[[:cntrl:]]'
      AND metadata->>'sha256' ~ '^[a-f0-9]{64}$'
      AND CASE WHEN metadata->>'byte_size' ~ '^[0-9]{1,7}$'
        THEN (metadata->>'byte_size')::integer BETWEEN 1 AND 5242880
        ELSE false END
      AND metadata->>'content_type' IN ('application/pdf', 'image/jpeg', 'image/png')
    ), false)
  );

CREATE FUNCTION public.guard_merchant_kyc_india_receipt_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF NEW.metadata->>'private_storage_provider' IS DISTINCT FROM 'aws_s3_mumbai' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kyc_private_object_cleanup_jobs AS j
     WHERE j.site_id = NEW.site_id AND j.document_type = NEW.document_type
       AND j.object_key = NEW.metadata->>'private_object_key'
       AND j.storage_provider = 'aws_s3_mumbai'
       AND j.purpose = 'upload_reservation'
       AND j.object_version_id = NEW.metadata->>'private_object_version_id'
       AND j.expected_sha256_hex = NEW.metadata->>'sha256'
       AND j.expected_bytes::text = NEW.metadata->>'byte_size'
       AND j.expected_content_type = NEW.metadata->>'content_type'
       AND j.reference_last4 = NEW.document_number_last4
       AND j.head_verified_at IS NOT NULL
       AND (j.status = 'pending' OR (j.status = 'completed' AND j.outcome = 'retained'))
       AND j.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'India KYC evidence requires a verified site-bound upload receipt'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_merchant_kyc_india_receipt_v1() FROM PUBLIC;
CREATE TRIGGER merchant_kyc_india_receipt_v1
  BEFORE INSERT OR UPDATE OF metadata, document_number_last4 ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_merchant_kyc_india_receipt_v1();

CREATE OR REPLACE FUNCTION public.queue_replaced_kyc_private_object_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  old_key text := OLD.metadata->>'private_object_key';
  new_key text := NEW.metadata->>'private_object_key';
  old_provider text := coalesce(OLD.metadata->>'private_storage_provider', 'r2_fixture');
  old_version text := OLD.metadata->>'private_object_version_id';
BEGIN
  IF old_key IS NULL OR old_key IS NOT DISTINCT FROM new_key THEN RETURN NEW; END IF;
  IF old_key !~ ('^kyc/' || OLD.site_id::text || '/' || OLD.document_type || '/[A-Za-z0-9_-]{1,160}$') THEN
    RAISE EXCEPTION 'Previous KYC object key is outside the owned document namespace'
      USING ERRCODE = '23514';
  END IF;
  IF old_provider = 'aws_s3_mumbai' AND (old_version IS NULL OR old_version = 'null') THEN
    RAISE EXCEPTION 'Previous India KYC object is missing its pinned version'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.kyc_private_object_cleanup_jobs
    (site_id, object_key, purpose, storage_provider, document_type, object_version_id)
  VALUES (OLD.site_id, old_key, 'replaced_object', old_provider, OLD.document_type, old_version)
  ON CONFLICT (object_key) DO UPDATE SET
    purpose = 'replaced_object', storage_provider = EXCLUDED.storage_provider,
    document_type = EXCLUDED.document_type, object_version_id = EXCLUDED.object_version_id,
    status = 'pending', outcome = NULL, completed_at = NULL,
    next_attempt_at = now(), attempts = 0
  WHERE public.kyc_private_object_cleanup_jobs.site_id = EXCLUDED.site_id;
  RETURN NEW;
END $fn$;

NOTIFY pgrst, 'reload schema';
COMMIT;
