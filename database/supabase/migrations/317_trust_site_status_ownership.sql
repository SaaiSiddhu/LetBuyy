-- Canonical sites.status remains the visibility owner. A guarded revision tracks
-- explicit status writes, and existing active T&S holds prevent other writers
-- from publishing through them. No parallel visibility/hold store is introduced.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:317:trust-status',0));
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS status_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.ts_takedowns
 ADD COLUMN IF NOT EXISTS enforcement_session_id uuid REFERENCES public.sessions_v2(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS enforcement_key uuid,
 ADD COLUMN IF NOT EXISTS enforcement_payload_hash text,
 ADD COLUMN IF NOT EXISTS enforcement_result jsonb,
 ADD COLUMN IF NOT EXISTS applied_site_revision bigint,
 ADD COLUMN IF NOT EXISTS restoration_root_id uuid REFERENCES public.ts_takedowns(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS restoration_baseline_status text,
 ADD COLUMN IF NOT EXISTS restoration_baseline_published boolean;
ALTER TABLE public.ts_takedowns DROP CONSTRAINT IF EXISTS ts_takedowns_enforcement_binding_v1;
ALTER TABLE public.ts_takedowns ADD CONSTRAINT ts_takedowns_enforcement_binding_v1 CHECK(enforcement_key IS NULL OR
 (enforcement_session_id IS NOT NULL AND enforced_by IS NOT NULL AND enforcement_payload_hash IS NOT NULL AND enforcement_payload_hash ~ '^[0-9a-f]{64}$'
  AND applied_site_revision IS NOT NULL AND applied_site_revision>0 AND restoration_root_id IS NOT NULL AND restoration_baseline_status IS NOT NULL AND restoration_baseline_published IS NOT NULL AND action_type='suspend_site'));
CREATE UNIQUE INDEX IF NOT EXISTS ts_takedowns_enforcement_key_v1_idx ON public.ts_takedowns(case_id,enforced_by,enforcement_key) WHERE enforcement_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.guard_site_status_revision_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
BEGIN
 NEW.status_revision:=CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD.status_revision END;
 IF NEW.status='suspended' THEN NEW.published:=false; END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.enforce_active_trust_site_hold_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
BEGIN
 IF (CASE WHEN TG_OP='DELETE' THEN true ELSE NEW.status IS DISTINCT FROM 'suspended' END) AND EXISTS(
   SELECT 1 FROM public.ts_takedowns t WHERE t.site_id=OLD.id AND t.action_type='suspend_site' AND t.status='active' AND t.deleted_at IS NULL) THEN
   RAISE EXCEPTION 'TS_ACTIVE_SITE_RESTRICTION' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 NEW.status_revision:=OLD.status_revision+1;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS a_guard_site_status_revision_v1 ON public.sites;
CREATE TRIGGER a_guard_site_status_revision_v1 BEFORE INSERT OR UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.guard_site_status_revision_v1();
DROP TRIGGER IF EXISTS b_enforce_active_trust_site_hold_v1 ON public.sites;
CREATE TRIGGER b_enforce_active_trust_site_hold_v1 BEFORE UPDATE OF status OR DELETE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.enforce_active_trust_site_hold_v1();
CREATE OR REPLACE FUNCTION public.protect_trust_enforcement_binding_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'trust enforcement records are retained'; END IF;
 IF OLD.enforcement_key IS NOT NULL THEN
  IF ROW(NEW.case_id,NEW.site_id,NEW.subject_type,NEW.subject_id,NEW.action_type,NEW.reason,NEW.enforced_by,NEW.enforced_at,
   NEW.enforcement_session_id,NEW.enforcement_key,NEW.enforcement_payload_hash,NEW.applied_site_revision,
   NEW.restoration_root_id,NEW.restoration_baseline_status,NEW.restoration_baseline_published,NEW.created_at,NEW.created_by,NEW.deleted_at,NEW.deleted_by)
   IS DISTINCT FROM ROW(OLD.case_id,OLD.site_id,OLD.subject_type,OLD.subject_id,OLD.action_type,OLD.reason,OLD.enforced_by,OLD.enforced_at,
   OLD.enforcement_session_id,OLD.enforcement_key,OLD.enforcement_payload_hash,OLD.applied_site_revision,
   OLD.restoration_root_id,OLD.restoration_baseline_status,OLD.restoration_baseline_published,OLD.created_at,OLD.created_by,OLD.deleted_at,OLD.deleted_by) THEN
    RAISE EXCEPTION 'trust enforcement binding is immutable';
  END IF;
  IF OLD.enforcement_result IS NOT NULL AND NEW.enforcement_result IS DISTINCT FROM OLD.enforcement_result THEN
   RAISE EXCEPTION 'trust enforcement receipt is immutable';
  END IF;
  IF OLD.status='reversed' AND ROW(NEW.status,NEW.reversed_by,NEW.reversed_at) IS DISTINCT FROM ROW(OLD.status,OLD.reversed_by,OLD.reversed_at) THEN
   RAISE EXCEPTION 'trust enforcement reversal is immutable';
  END IF;
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS protect_trust_enforcement_binding_v1 ON public.ts_takedowns;
CREATE TRIGGER protect_trust_enforcement_binding_v1 BEFORE UPDATE OR DELETE ON public.ts_takedowns FOR EACH ROW EXECUTE FUNCTION public.protect_trust_enforcement_binding_v1();
-- A reviewed digest must stay stable through the atomic effect. Every child
-- writer obtains the same parent lock, including updates to an existing child
-- for which PostgreSQL would not otherwise recheck its unchanged foreign key.
CREATE OR REPLACE FUNCTION public.lock_trust_review_case_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM id FROM public.ts_cases WHERE id=NEW.case_id FOR UPDATE;
 ELSIF TG_OP='DELETE' THEN
  PERFORM id FROM public.ts_cases WHERE id=OLD.case_id FOR UPDATE;
 ELSE
  PERFORM id FROM public.ts_cases WHERE id=ANY(ARRAY[OLD.case_id,NEW.case_id]) ORDER BY id FOR UPDATE;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS lock_trust_review_case_v1 ON public.ts_evidence;
CREATE TRIGGER lock_trust_review_case_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.ts_evidence FOR EACH ROW EXECUTE FUNCTION public.lock_trust_review_case_v1();
DROP TRIGGER IF EXISTS lock_trust_review_case_v1 ON public.ts_appeals;
CREATE TRIGGER lock_trust_review_case_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.ts_appeals FOR EACH ROW EXECUTE FUNCTION public.lock_trust_review_case_v1();
DROP TRIGGER IF EXISTS lock_trust_review_case_v1 ON public.ts_case_events;
CREATE TRIGGER lock_trust_review_case_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.ts_case_events FOR EACH ROW EXECUTE FUNCTION public.lock_trust_review_case_v1();
REVOKE ALL ON FUNCTION public.guard_site_status_revision_v1(),public.enforce_active_trust_site_hold_v1(),public.protect_trust_enforcement_binding_v1(),public.lock_trust_review_case_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_site_status_revision_v1(),public.enforce_active_trust_site_hold_v1(),public.protect_trust_enforcement_binding_v1(),public.lock_trust_review_case_v1() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
