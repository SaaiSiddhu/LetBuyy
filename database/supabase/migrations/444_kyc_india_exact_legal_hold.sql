-- A time-bounded hold names one exact Mumbai receipt. The hold insert and
-- cleanup claim lock the same receipt row, so neither can win after the other.
BEGIN;

CREATE TABLE public.kyc_india_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  receipt_id uuid NOT NULL REFERENCES public.kyc_private_object_cleanup_jobs(id) ON DELETE RESTRICT,
  authority_type text NOT NULL CHECK (authority_type IN ('court_order', 'statutory', 'provider_contract')),
  authority_reference text NOT NULL CHECK (length(btrim(authority_reference)) BETWEEN 8 AND 160),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 8 AND 1000),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 160),
  review_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  released_by uuid,
  release_request_key text,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  CONSTRAINT kyc_india_legal_hold_window CHECK (
    review_at > created_at AND review_at <= created_at + interval '30 days'
    AND expires_at >= review_at AND expires_at <= created_at + interval '365 days'
    AND (released_at IS NULL OR released_at >= created_at)
    AND (released_at IS NULL) = (released_by IS NULL)
    AND (released_at IS NULL) = (release_request_key IS NULL)
    AND (released_at IS NULL) = (release_reason IS NULL)
    AND (release_request_key IS NULL OR length(release_request_key) BETWEEN 8 AND 160)
    AND (release_reason IS NULL OR length(btrim(release_reason)) BETWEEN 8 AND 1000)
  )
);
CREATE UNIQUE INDEX kyc_india_hold_request_key_unique
  ON public.kyc_india_legal_holds(site_id, request_key);
CREATE UNIQUE INDEX kyc_india_one_open_hold_per_receipt
  ON public.kyc_india_legal_holds(receipt_id)
  WHERE released_at IS NULL AND deleted_at IS NULL;
CREATE INDEX kyc_india_legal_hold_review_idx
  ON public.kyc_india_legal_holds(review_at, id)
  WHERE released_at IS NULL AND deleted_at IS NULL;
CREATE INDEX kyc_india_legal_hold_site_idx
  ON public.kyc_india_legal_holds(site_id, receipt_id, id);
ALTER TABLE public.kyc_india_legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_india_legal_holds FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.kyc_india_legal_holds FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT SELECT, INSERT, UPDATE ON public.kyc_india_legal_holds TO service_role;
CREATE TRIGGER kyc_india_legal_hold_updated_at
  BEFORE UPDATE ON public.kyc_india_legal_holds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.guard_kyc_india_exact_hold_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
DECLARE j public.kyc_private_object_cleanup_jobs%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['released_at','released_by','release_request_key','release_reason','updated_at','updated_by'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['released_at','released_by','release_request_key','release_reason','updated_at','updated_by'])
      OR OLD.released_at IS NOT NULL
      OR NEW.released_at IS NULL OR NEW.released_by IS NULL
      OR NEW.release_request_key IS NULL OR NEW.release_reason IS NULL THEN
      RAISE EXCEPTION 'India KYC legal hold is append-only except release'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO j FROM public.kyc_private_object_cleanup_jobs
   WHERE id = NEW.receipt_id AND site_id = NEW.site_id
     AND storage_provider = 'aws_s3_mumbai' AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR j.status = 'deleting'
    OR (j.status = 'completed' AND j.outcome = 'deleted')
    OR j.attempts > 0 THEN
    RAISE EXCEPTION 'India KYC receipt is not holdable before deletion'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_kyc_india_exact_hold_v1()
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
CREATE TRIGGER kyc_india_exact_hold_guard_v1
  BEFORE INSERT OR UPDATE ON public.kyc_india_legal_holds
  FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_india_exact_hold_v1();

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
     AND NOT EXISTS (SELECT 1 FROM public.kyc_india_legal_holds h
       WHERE h.receipt_id = j.id AND h.site_id = j.site_id
         AND h.released_at IS NULL AND h.deleted_at IS NULL
         )
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
  IF EXISTS (SELECT 1 FROM public.kyc_india_legal_holds h
      WHERE h.receipt_id = j.id AND h.site_id = j.site_id
        AND h.released_at IS NULL AND h.deleted_at IS NULL
        ) THEN
    RETURN 'held';
  END IF;
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
    'overdue_count', count(*) FILTER (WHERE NOT held AND due_at <= now()),
    'oldest_due_at', min(due_at) FILTER (WHERE NOT held AND due_at <= now()),
    'held_count', (SELECT count(*) FROM public.kyc_india_legal_holds h
      WHERE h.released_at IS NULL AND h.deleted_at IS NULL),
    'hold_review_overdue_count', (SELECT count(*) FROM public.kyc_india_legal_holds h
      WHERE h.released_at IS NULL AND h.deleted_at IS NULL AND h.review_at <= now()),
    'hold_expired_count', (SELECT count(*) FROM public.kyc_india_legal_holds h
      WHERE h.released_at IS NULL AND h.deleted_at IS NULL AND h.expires_at <= now())
  )
  FROM (
    SELECT CASE
      WHEN j.purpose = 'replaced_object' THEN j.deletion_requested_at + interval '24 hours'
      ELSE j.intent_expires_at + interval '24 hours'
    END AS due_at,
    EXISTS (SELECT 1 FROM public.kyc_india_legal_holds h
      WHERE h.receipt_id = j.id AND h.site_id = j.site_id
        AND h.released_at IS NULL AND h.deleted_at IS NULL) AS held
    FROM public.kyc_private_object_cleanup_jobs j
    WHERE j.storage_provider = 'aws_s3_mumbai'
      AND j.status IN ('pending', 'deleting') AND j.deleted_at IS NULL
  ) AS pending;
$fn$;

REVOKE ALL ON FUNCTION public.kyc_india_cleanup_overdue_v1()
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.kyc_india_cleanup_overdue_v1()
  TO service_role;

-- A legal hold is a platform compliance action. Resolve the current Console
-- session again inside the mutation transaction; the browser's role claim and
-- any caller-supplied actor ID have no authority here.
CREATE FUNCTION public.create_kyc_india_legal_hold_v1(
  p_session_id uuid, p_cookie_sha256 text, p_permission_hash text,
  p_site_id uuid, p_receipt_id uuid, p_authority_type text,
  p_authority_reference text, p_reason text, p_review_at timestamptz,
  p_expires_at timestamptz, p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  permission jsonb;
  actor jsonb;
  prior public.kyc_india_legal_holds%ROWTYPE;
  receipt public.kyc_private_object_cleanup_jobs%ROWTYPE;
  inserted public.kyc_india_legal_holds%ROWTYPE;
BEGIN
  IF current_user <> 'service_role'
    OR nullif(current_setting('app.site_id', true), '') IS NOT NULL
    OR nullif(current_setting('app.tenant_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Platform service role required' USING ERRCODE = '42501';
  END IF;
  permission := public.console_permission_snapshot_v1(p_session_id, p_cookie_sha256, true);
  IF NOT coalesce((permission->>'accepted')::boolean, false) THEN RETURN permission; END IF;
  IF permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'PERMISSION_CHANGED');
  END IF;
  actor := permission->'session';
  IF NOT coalesce((actor->>'is_super_admin')::boolean, false)
    OR NOT coalesce((permission->'input'->>'isSuperAdmin')::boolean, false) THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_ADMIN_REQUIRED');
  END IF;
  IF p_site_id IS NULL OR p_receipt_id IS NULL
    OR coalesce(p_authority_type, '') NOT IN ('court_order', 'statutory', 'provider_contract')
    OR length(btrim(coalesce(p_authority_reference, ''))) NOT BETWEEN 8 AND 160
    OR length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 1000
    OR length(coalesce(p_request_key, '')) NOT BETWEEN 8 AND 160
    OR p_review_at IS NULL OR p_expires_at IS NULL
    OR p_review_at <= now() OR p_review_at > now() + interval '30 days'
    OR p_expires_at < p_review_at OR p_expires_at > now() + interval '365 days' THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_INVALID');
  END IF;
  SELECT * INTO prior FROM public.kyc_india_legal_holds
   WHERE site_id = p_site_id AND request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF prior.receipt_id IS DISTINCT FROM p_receipt_id
      OR prior.authority_type IS DISTINCT FROM p_authority_type
      OR prior.authority_reference IS DISTINCT FROM btrim(p_authority_reference)
      OR prior.reason IS DISTINCT FROM btrim(p_reason)
      OR prior.review_at IS DISTINCT FROM p_review_at
      OR prior.expires_at IS DISTINCT FROM p_expires_at
      OR prior.created_by IS DISTINCT FROM (actor->>'actor_id')::uuid THEN
      RETURN jsonb_build_object('accepted', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('accepted', true, 'hold_id', prior.id,
      'receipt_id', prior.receipt_id, 'replayed', true);
  END IF;
  SELECT * INTO receipt FROM public.kyc_private_object_cleanup_jobs
   WHERE id = p_receipt_id AND site_id = p_site_id
     AND storage_provider = 'aws_s3_mumbai' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR receipt.status = 'deleting'
    OR (receipt.status = 'completed' AND receipt.outcome = 'deleted')
    OR receipt.attempts > 0 THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_TOO_LATE');
  END IF;
  IF EXISTS (SELECT 1 FROM public.kyc_india_legal_holds
      WHERE receipt_id = p_receipt_id AND released_at IS NULL AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_ALREADY_EXISTS');
  END IF;
  INSERT INTO public.kyc_india_legal_holds
    (site_id, receipt_id, authority_type, authority_reference, reason, request_key,
     review_at, expires_at, created_by, updated_by)
  VALUES (p_site_id, p_receipt_id, p_authority_type, btrim(p_authority_reference),
    btrim(p_reason), p_request_key, p_review_at, p_expires_at,
    (actor->>'actor_id')::uuid, (actor->>'actor_id')::uuid)
  RETURNING * INTO inserted;
  INSERT INTO public.audit_logs(actor_id, actor_type, actor_email, action,
    resource_type, resource_id, metadata)
  VALUES ((actor->>'actor_id')::uuid, 'super_admin', actor->>'email',
    'kyc.legal_hold.created', 'kyc_india_legal_hold', inserted.id,
    jsonb_build_object('site_id', p_site_id, 'receipt_id', p_receipt_id,
      'authority_type', p_authority_type, 'session_id', p_session_id));
  RETURN jsonb_build_object('accepted', true, 'hold_id', inserted.id,
    'receipt_id', inserted.receipt_id, 'replayed', false);
END $fn$;
REVOKE ALL ON FUNCTION public.create_kyc_india_legal_hold_v1(
  uuid,text,text,uuid,uuid,text,text,text,timestamptz,timestamptz,text)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.create_kyc_india_legal_hold_v1(
  uuid,text,text,uuid,uuid,text,text,text,timestamptz,timestamptz,text)
  TO service_role;

CREATE FUNCTION public.release_kyc_india_legal_hold_v1(
  p_session_id uuid, p_cookie_sha256 text, p_permission_hash text,
  p_site_id uuid, p_receipt_id uuid, p_hold_id uuid,
  p_reason text, p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  permission jsonb;
  actor jsonb;
  hold public.kyc_india_legal_holds%ROWTYPE;
BEGIN
  IF current_user <> 'service_role'
    OR nullif(current_setting('app.site_id', true), '') IS NOT NULL
    OR nullif(current_setting('app.tenant_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Platform service role required' USING ERRCODE = '42501';
  END IF;
  permission := public.console_permission_snapshot_v1(p_session_id, p_cookie_sha256, true);
  IF NOT coalesce((permission->>'accepted')::boolean, false) THEN RETURN permission; END IF;
  IF permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'PERMISSION_CHANGED');
  END IF;
  actor := permission->'session';
  IF NOT coalesce((actor->>'is_super_admin')::boolean, false)
    OR NOT coalesce((permission->'input'->>'isSuperAdmin')::boolean, false) THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_ADMIN_REQUIRED');
  END IF;
  IF p_site_id IS NULL OR p_receipt_id IS NULL OR p_hold_id IS NULL
    OR length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 1000
    OR length(coalesce(p_request_key, '')) NOT BETWEEN 8 AND 160 THEN
    RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_INVALID');
  END IF;
  SELECT * INTO hold FROM public.kyc_india_legal_holds
   WHERE id = p_hold_id AND site_id = p_site_id AND receipt_id = p_receipt_id
     AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted', false, 'code', 'KYC_HOLD_NOT_FOUND'); END IF;
  IF hold.released_at IS NOT NULL THEN
    IF hold.release_request_key IS DISTINCT FROM p_request_key
      OR hold.release_reason IS DISTINCT FROM btrim(p_reason)
      OR hold.released_by IS DISTINCT FROM (actor->>'actor_id')::uuid THEN
      RETURN jsonb_build_object('accepted', false, 'code', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('accepted', true, 'hold_id', hold.id,
      'receipt_id', hold.receipt_id, 'replayed', true);
  END IF;
  UPDATE public.kyc_india_legal_holds
     SET released_at = now(), released_by = (actor->>'actor_id')::uuid,
       release_request_key = p_request_key, release_reason = btrim(p_reason),
       updated_by = (actor->>'actor_id')::uuid
   WHERE id = hold.id;
  INSERT INTO public.audit_logs(actor_id, actor_type, actor_email, action,
    resource_type, resource_id, metadata)
  VALUES ((actor->>'actor_id')::uuid, 'super_admin', actor->>'email',
    'kyc.legal_hold.released', 'kyc_india_legal_hold', hold.id,
    jsonb_build_object('site_id', p_site_id, 'receipt_id', p_receipt_id,
      'session_id', p_session_id));
  RETURN jsonb_build_object('accepted', true, 'hold_id', hold.id,
    'receipt_id', hold.receipt_id, 'replayed', false);
END $fn$;
REVOKE ALL ON FUNCTION public.release_kyc_india_legal_hold_v1(
  uuid,text,text,uuid,uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.release_kyc_india_legal_hold_v1(
  uuid,text,text,uuid,uuid,uuid,text,text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
