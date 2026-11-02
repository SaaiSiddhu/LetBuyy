-- The owned-test R2 sweeper must never claim a Mumbai S3 receipt. Provider
-- dispatch belongs to the persisted receipt, not to a coincidentally equal key.
BEGIN;

CREATE OR REPLACE FUNCTION public.list_due_kyc_private_cleanup_v1(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, site_id uuid, object_key text, purpose text, attempts integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public AS $fn$
  SELECT j.id, j.site_id, j.object_key, j.purpose, j.attempts
    FROM public.kyc_private_object_cleanup_jobs AS j
   WHERE j.status = 'pending' AND j.deleted_at IS NULL
     AND j.storage_provider = 'r2_fixture'
     AND j.next_attempt_at <= now()
   ORDER BY j.created_at, j.id
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$fn$;
REVOKE ALL ON FUNCTION public.list_due_kyc_private_cleanup_v1(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_due_kyc_private_cleanup_v1(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
