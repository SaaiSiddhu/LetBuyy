BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:317:trust-status',0));
DO $dependency$ BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='319') THEN RAISE EXCEPTION 'reverse migration319 before earlier trust rollback'; END IF;
 IF to_regprocedure('public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb)') IS NOT NULL THEN
   RAISE EXCEPTION 'reverse migration318 before rollback317';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sensitive_action_approvals'::regclass AND attname='protocol_version' AND NOT attisdropped) THEN
  IF EXISTS(SELECT 1 FROM public.sensitive_action_approvals WHERE protocol_version=1 AND action='ts.reinstate') THEN
   RAISE EXCEPTION 'rollback317 refuses retained trust approval evidence';
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.ts_takedowns'::regclass AND attname='enforcement_key' AND NOT attisdropped) THEN
  IF EXISTS(SELECT 1 FROM public.ts_takedowns WHERE enforcement_key IS NOT NULL) THEN
   RAISE EXCEPTION 'rollback317 refuses retained trust enforcement evidence';
  END IF;
 END IF;
END $dependency$;
DROP TRIGGER IF EXISTS lock_trust_review_case_v1 ON public.ts_evidence;
DROP TRIGGER IF EXISTS lock_trust_review_case_v1 ON public.ts_appeals;
DROP TRIGGER IF EXISTS lock_trust_review_case_v1 ON public.ts_case_events;
DROP FUNCTION IF EXISTS public.lock_trust_review_case_v1();
DROP TRIGGER IF EXISTS protect_trust_enforcement_binding_v1 ON public.ts_takedowns;
DROP FUNCTION IF EXISTS public.protect_trust_enforcement_binding_v1();
DROP TRIGGER IF EXISTS b_enforce_active_trust_site_hold_v1 ON public.sites;
DROP TRIGGER IF EXISTS a_guard_site_status_revision_v1 ON public.sites;
DROP FUNCTION IF EXISTS public.enforce_active_trust_site_hold_v1();
DROP FUNCTION IF EXISTS public.guard_site_status_revision_v1();
ALTER TABLE public.sites DROP COLUMN IF EXISTS status_revision;
DROP INDEX IF EXISTS public.ts_takedowns_enforcement_key_v1_idx;
ALTER TABLE public.ts_takedowns DROP CONSTRAINT IF EXISTS ts_takedowns_enforcement_binding_v1;
ALTER TABLE public.ts_takedowns DROP COLUMN IF EXISTS enforcement_session_id,DROP COLUMN IF EXISTS enforcement_key,
 DROP COLUMN IF EXISTS enforcement_payload_hash,DROP COLUMN IF EXISTS enforcement_result,DROP COLUMN IF EXISTS applied_site_revision,DROP COLUMN IF EXISTS restoration_root_id,
 DROP COLUMN IF EXISTS restoration_baseline_status,DROP COLUMN IF EXISTS restoration_baseline_published;
NOTIFY pgrst,'reload schema';
COMMIT;
