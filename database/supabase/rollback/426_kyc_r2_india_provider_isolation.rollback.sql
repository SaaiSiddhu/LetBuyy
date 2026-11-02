-- Reverting the provider filter is safe only before India receipts exist.
BEGIN;
-- Refuse ABI drift before any schema mutation; CREATE OR REPLACE must not add an overload.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('list_due_kyc_private_cleanup_v1', 'public.list_due_kyc_private_cleanup_v1(integer)', ARRAY['p_limit']::text[], 'record', true)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 422 refuses to run: % signature or overload set changed', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 422 refuses to run: % input names or result ABI changed', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
      WHERE storage_provider = 'aws_s3_mumbai' LIMIT 1) THEN
    RAISE EXCEPTION 'India KYC receipts exist; retain provider-isolated cleanup'
      USING ERRCODE = '55000';
  END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.list_due_kyc_private_cleanup_v1(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, site_id uuid, object_key text, purpose text, attempts integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public AS $fn$
  SELECT j.id, j.site_id, j.object_key, j.purpose, j.attempts
    FROM public.kyc_private_object_cleanup_jobs AS j
   WHERE j.status = 'pending' AND j.deleted_at IS NULL
     AND j.next_attempt_at <= now()
   ORDER BY j.created_at, j.id
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;
REVOKE ALL ON FUNCTION public.list_due_kyc_private_cleanup_v1(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_due_kyc_private_cleanup_v1(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
