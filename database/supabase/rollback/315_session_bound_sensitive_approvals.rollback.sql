-- A used approval is retained audit authority. Never discard its consent or
-- receipt to force a backwards schema rollback; use a reviewed forward repair.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:315:sensitive-approvals',0));
DO $retention$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sensitive_action_approvals'::regclass AND attname='protocol_version' AND NOT attisdropped) THEN
    IF EXISTS(SELECT 1 FROM public.sensitive_action_approvals WHERE protocol_version=1) THEN
      RAISE EXCEPTION 'rollback 315 refuses retained session-bound approval records; forward recovery is required';
    END IF;
  END IF;
END $retention$;
DO $dependency$ BEGIN
  IF to_regprocedure('public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'reverse migration318 before rollback315';
  END IF;
  IF to_regprocedure('public.create_console_money_approval_v1(uuid,text,text,uuid,text,uuid,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'reverse migration316 before rollback315';
  END IF;
END $dependency$;
DROP TRIGGER IF EXISTS protect_sensitive_approval_v1 ON public.sensitive_action_approvals;
DROP TRIGGER IF EXISTS console_role_permission_revocation_v1 ON public.employee_permissions;
DROP TRIGGER IF EXISTS console_role_definition_revocation_v1 ON public.employee_roles;
DROP TRIGGER IF EXISTS console_break_glass_revocation_v1 ON public.break_glass_grants;
DROP FUNCTION IF EXISTS public.read_console_approvals_v1(uuid,text,uuid,integer,integer);
DROP FUNCTION IF EXISTS public.execute_console_merchant_moderation_v1(uuid,text,text,uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.decide_console_approval_v1(uuid,text,uuid,text,text);
DROP FUNCTION IF EXISTS public.create_console_approval_v1(uuid,text,text,text,uuid,text,uuid);
DROP FUNCTION IF EXISTS public.console_approval_view_v1(uuid);
DROP FUNCTION IF EXISTS public.protect_sensitive_approval_v1();
DROP FUNCTION IF EXISTS public.console_approval_payload_hash_v1(text,uuid,text,text,jsonb);
DROP FUNCTION IF EXISTS public.revoke_console_permission_sessions_v1();
DROP FUNCTION IF EXISTS public.console_permission_snapshot_v1(uuid,text,boolean);
DROP INDEX IF EXISTS public.sensitive_action_approvals_request_v1_idx;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT IF EXISTS sensitive_action_approvals_protocol_v1_check;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT IF EXISTS sensitive_action_approvals_action_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check
  CHECK(action IN ('refund.approve','payout.release','customer.dsr.erase'));
ALTER TABLE public.sensitive_action_approvals DROP COLUMN IF EXISTS protocol_version,DROP COLUMN IF EXISTS requester_session_id,DROP COLUMN IF EXISTS approver_session_id,
  DROP COLUMN IF EXISTS request_key,DROP COLUMN IF EXISTS payload,DROP COLUMN IF EXISTS payload_hash,DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS approved_at,DROP COLUMN IF EXISTS consumed_at,DROP COLUMN IF EXISTS result;
NOTIFY pgrst,'reload schema';
COMMIT;
