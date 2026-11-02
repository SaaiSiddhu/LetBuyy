-- A replacement must not strand the previous private KYC object if R2 deletion
-- fails. The old key is queued in the same transaction as the evidence change.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.merchant_kyc_documents AS d
     WHERE d.metadata ? 'private_object_key'
       AND coalesce(d.metadata->>'private_object_key', '') !~
         ('^kyc/' || d.site_id::text || '/' || d.document_type || '/[A-Za-z0-9_-]{1,160}$')
  ) THEN
    RAISE EXCEPTION 'Existing private KYC object key needs a reviewed site-bound migration before cleanup can be enabled'
      USING ERRCODE = '23514';
  END IF;
END $preflight$;

-- Keep the preflight guarantee true after deployment. A service-side bug or
-- privileged import must not point a KYC row at another site's R2 namespace.
ALTER TABLE public.merchant_kyc_documents
  ADD CONSTRAINT merchant_kyc_private_object_key_owned_check CHECK (
    NOT coalesce(metadata ? 'private_object_key', false) OR (
      jsonb_typeof(metadata->'private_object_key') = 'string' AND
      metadata->>'private_object_key' ~
        ('^kyc/' || site_id::text || '/' || document_type || '/[A-Za-z0-9_-]{1,160}$')
    )
  );

CREATE TABLE public.kyc_private_object_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  object_key text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'replaced_object' CHECK (purpose IN ('replaced_object', 'upload_reservation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  outcome text CHECK (outcome IN ('deleted', 'retained')),
  CONSTRAINT kyc_private_cleanup_completion CHECK (
    (status = 'pending' AND outcome IS NULL AND completed_at IS NULL) OR
    (status = 'completed' AND outcome IS NOT NULL AND completed_at IS NOT NULL)
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT kyc_private_cleanup_site_key CHECK (
    object_key LIKE 'kyc/' || site_id::text || '/%'
  )
);

CREATE INDEX kyc_private_cleanup_due_idx
  ON public.kyc_private_object_cleanup_jobs(next_attempt_at, created_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

ALTER TABLE public.kyc_private_object_cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_private_object_cleanup_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.kyc_private_object_cleanup_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kyc_private_object_cleanup_jobs TO service_role;

CREATE TRIGGER kyc_private_cleanup_updated_at
  BEFORE UPDATE ON public.kyc_private_object_cleanup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- The cron has no single site before it discovers due records. A bounded
-- service-only RPC is the reviewed exception to the Gateway's tenant query
-- guard; every subsequent read and update carries the discovered site_id.
CREATE FUNCTION public.list_due_kyc_private_cleanup_v1(p_limit integer DEFAULT 20)
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

CREATE FUNCTION public.queue_replaced_kyc_private_object_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  old_key text := OLD.metadata->>'private_object_key';
  new_key text := NEW.metadata->>'private_object_key';
BEGIN
  IF old_key IS NULL OR old_key IS NOT DISTINCT FROM new_key THEN RETURN NEW; END IF;
  IF old_key !~ ('^kyc/' || OLD.site_id::text || '/' || OLD.document_type || '/[A-Za-z0-9_-]{1,160}$') THEN
    RAISE EXCEPTION 'Previous KYC object key is outside the owned document namespace'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.kyc_private_object_cleanup_jobs(site_id, object_key)
  VALUES (OLD.site_id, old_key)
  ON CONFLICT (object_key) DO UPDATE SET
    purpose = 'replaced_object', status = 'pending', outcome = NULL,
    completed_at = NULL, next_attempt_at = now(), attempts = 0
  WHERE public.kyc_private_object_cleanup_jobs.site_id = EXCLUDED.site_id;
  RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION public.queue_replaced_kyc_private_object_v1() FROM PUBLIC;
CREATE TRIGGER merchant_kyc_queue_replaced_private_object_v1
  AFTER UPDATE OF metadata ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.queue_replaced_kyc_private_object_v1();

NOTIFY pgrst, 'reload schema';
COMMIT;
