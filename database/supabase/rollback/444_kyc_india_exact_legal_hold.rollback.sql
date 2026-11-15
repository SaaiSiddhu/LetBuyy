-- A legal hold cannot be discarded by rollback after it has been recorded.
BEGIN;
-- Bind the complete current ABI before restoring the earlier definitions.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('list_due_kyc_india_cleanup_v1', 'public.list_due_kyc_india_cleanup_v1(integer)', ARRAY['p_limit']::text[], 'record', true),
    ('claim_due_kyc_india_cleanup_v1', 'public.claim_due_kyc_india_cleanup_v1(uuid,uuid)', ARRAY['p_id','p_site']::text[], 'text', false),
    ('kyc_india_cleanup_overdue_v1', 'public.kyc_india_cleanup_overdue_v1()', ARRAY[]::text[], 'jsonb', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 444 refuses to run: % signature or overload set changed', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 444 refuses to run: % input names or result ABI changed', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

-- Remove the guarded signatures before restoring previous definitions, so a
-- future ABI change cannot create an unexpected overload during rollback.
DROP FUNCTION public.list_due_kyc_india_cleanup_v1(integer);
-- This refusal is in the same transaction; on a recorded hold it restores the
-- preceding DROP as well. Keep it before any replacement or table removal.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_india_legal_holds LIMIT 1) THEN
    RAISE EXCEPTION 'India KYC legal holds exist; retain exact hold enforcement'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP FUNCTION public.claim_due_kyc_india_cleanup_v1(uuid,uuid);
DROP FUNCTION public.kyc_india_cleanup_overdue_v1();

CREATE OR REPLACE FUNCTION public.list_due_kyc_india_cleanup_v1(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, site_id uuid, object_key text, document_type text,
  purpose text, attempts integer, object_version_id text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public AS $fn$
  SELECT j.id, j.site_id, j.object_key, j.document_type, j.purpose,
    j.attempts, j.object_version_id
    FROM public.kyc_private_object_cleanup_jobs AS j
   WHERE j.status IN ('pending', 'deleting') AND j.deleted_at IS NULL
     AND j.storage_provider = 'aws_s3_mumbai'
     AND j.next_attempt_at <= now()
   ORDER BY j.created_at, j.id
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;

REVOKE ALL ON FUNCTION public.list_due_kyc_india_cleanup_v1(integer)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.list_due_kyc_india_cleanup_v1(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_kyc_india_cleanup_v1(p_id uuid, p_site uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  j public.kyc_private_object_cleanup_jobs%ROWTYPE;
  d public.merchant_kyc_documents%ROWTYPE;
BEGIN
  SELECT * INTO j FROM public.kyc_private_object_cleanup_jobs
   WHERE id = p_id AND site_id = p_site AND storage_provider = 'aws_s3_mumbai'
     AND status IN ('pending', 'deleting') AND deleted_at IS NULL
     AND next_attempt_at <= now() FOR UPDATE;
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  SELECT * INTO d FROM public.merchant_kyc_documents
   WHERE site_id = j.site_id AND metadata->>'private_object_key' = j.object_key
     AND deleted_at IS NULL FOR SHARE;
  IF FOUND THEN
    IF j.purpose = 'upload_reservation' AND j.status = 'pending'
      AND j.object_version_id IS NOT NULL
      AND d.metadata->>'private_storage_provider' = 'aws_s3_mumbai'
      AND d.metadata->>'private_object_version_id' = j.object_version_id THEN
      UPDATE public.kyc_private_object_cleanup_jobs
         SET status = 'completed', outcome = 'retained', completed_at = now()
       WHERE id = j.id;
      RETURN 'retained';
    END IF;
    RETURN 'conflict';
  END IF;
  IF j.status = 'pending' THEN
    UPDATE public.kyc_private_object_cleanup_jobs SET status = 'deleting'
     WHERE id = j.id;
  END IF;
  RETURN 'delete';
END $fn$;

REVOKE ALL ON FUNCTION public.claim_due_kyc_india_cleanup_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.claim_due_kyc_india_cleanup_v1(uuid,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.kyc_india_cleanup_overdue_v1()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public AS $fn$
  SELECT jsonb_build_object(
    'overdue_count', count(*),
    'oldest_due_at', min(due_at)
  )
  FROM (
    SELECT CASE
      WHEN purpose = 'replaced_object' THEN deletion_requested_at + interval '24 hours'
      ELSE intent_expires_at + interval '24 hours'
    END AS due_at
    FROM public.kyc_private_object_cleanup_jobs
    WHERE storage_provider = 'aws_s3_mumbai'
      AND status IN ('pending', 'deleting') AND deleted_at IS NULL
  ) AS pending
  WHERE due_at <= now();
$fn$;

REVOKE ALL ON FUNCTION public.kyc_india_cleanup_overdue_v1()
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.kyc_india_cleanup_overdue_v1()
  TO service_role;

DROP FUNCTION public.release_kyc_india_legal_hold_v1(uuid,text,text,uuid,uuid,uuid,text,text);
DROP FUNCTION public.create_kyc_india_legal_hold_v1(uuid,text,text,uuid,uuid,text,text,text,timestamptz,timestamptz,text);
DROP TRIGGER kyc_india_exact_hold_guard_v1 ON public.kyc_india_legal_holds;
DROP FUNCTION public.guard_kyc_india_exact_hold_v1();
DROP TRIGGER kyc_india_legal_hold_updated_at ON public.kyc_india_legal_holds;
DROP TABLE public.kyc_india_legal_holds;

NOTIFY pgrst, 'reload schema';
COMMIT;
