-- Refuse to forget a bound/retired factor or approved reset evidence.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('complete_console_mfa_v1', 'public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint)', ARRAY['p_session_id','p_cookie_sha256','p_email','p_actor_id','p_issued_at','p_expires_at','p_mfa_verified_at','p_previous_session_id','p_previous_cookie_sha256','p_counter']::text[], 'jsonb', false, 2),
    ('complete_console_mfa_v1', 'public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint,text)', ARRAY['p_session_id','p_cookie_sha256','p_email','p_actor_id','p_issued_at','p_expires_at','p_mfa_verified_at','p_previous_session_id','p_previous_cookie_sha256','p_counter','p_factor_fingerprint']::text[], 'jsonb', false, 2),
    ('console_approval_view_v1', 'public.console_approval_view_v1(uuid)', ARRAY['p_id']::text[], 'jsonb', false, 1),
    ('decide_console_approval_v1', 'public.decide_console_approval_v1(uuid,text,uuid,text,text)', ARRAY['p_session_id','p_cookie_sha256','p_id','p_decision','p_payload_hash']::text[], 'jsonb', false, 1)
  ) AS expected(name, signature, input_names, result_type, returns_set, overloads)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 329 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 329 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.principals WHERE realm='admin' AND metadata ? 'console_mfa_factor')
 OR EXISTS(SELECT 1 FROM public.sensitive_action_approvals WHERE action='operator.mfa.reset')
 OR EXISTS(SELECT 1 FROM public.platform_queue_jobs WHERE job_type='email.operator_mfa_reset') THEN
  RAISE EXCEPTION '329 refuses retained Console factor or reset evidence';END IF;
END $guard$;
DROP FUNCTION IF EXISTS public.console_mfa_reset_delivery_v1(uuid,text,text);
DROP FUNCTION IF EXISTS public.recover_expired_console_security_email_jobs_v1(integer);
DROP FUNCTION IF EXISTS public.execute_console_mfa_reset_v1(uuid,text,text,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.create_console_mfa_reset_approval_v1(uuid,text,text,uuid,text,uuid,text);
DROP FUNCTION IF EXISTS public.read_console_mfa_reset_targets_v1(uuid,text,text,uuid,text);
DROP FUNCTION IF EXISTS public.console_mfa_reset_target_v1(uuid);
DROP FUNCTION IF EXISTS public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint,text);
CREATE OR REPLACE FUNCTION public.complete_console_mfa_v1(
 p_session_id uuid,p_cookie_sha256 text,p_email text,p_actor_id uuid,
 p_issued_at timestamptz,p_expires_at timestamptz,p_mfa_verified_at timestamptz,
 p_previous_session_id uuid,p_previous_cookie_sha256 text,p_counter bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_identity jsonb;v_state jsonb;v_principal public.principals%ROWTYPE;v_new public.sessions_v2%ROWTYPE;
 v_guard jsonb;v_failures integer;v_last bigint;v_locked timestamptz;v_current bigint;v_result jsonb;v_reason text;
BEGIN
 IF p_actor_id IS NULL OR p_session_id IS NULL OR p_session_id=p_previous_session_id OR p_mfa_verified_at IS NULL THEN
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');
 END IF;
 v_identity:=public.resolve_console_operator_v1(p_email,p_actor_id);
 IF NOT coalesce((v_identity->>'accepted')::boolean,false) THEN RETURN v_identity; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||p_actor_id::text,0));
 -- Exact committed-response retry may recover its own still-live target. It
 -- cannot mint another session, revive a revoked one or change its predecessor.
 SELECT * INTO v_new FROM public.sessions_v2 WHERE id=p_session_id FOR UPDATE;
 IF FOUND THEN
  IF v_new.metadata->>'console_mfa_previous_session' IS DISTINCT FROM p_previous_session_id::text
   OR v_new.metadata->>'console_mfa_previous_digest' IS DISTINCT FROM p_previous_cookie_sha256
   OR (v_new.metadata->>'console_mfa_counter')::bigint IS DISTINCT FROM p_counter THEN
   RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');
  END IF;
  v_state:=public.console_session_state_v1(p_session_id,p_cookie_sha256);
  IF NOT coalesce((v_state->>'accepted')::boolean,false) THEN RETURN v_state; END IF;
  RETURN jsonb_build_object('accepted',true,'verified',true,'state',v_state,'replayed',true);
 END IF;
 v_state:=public.console_session_state_v1(p_previous_session_id,p_previous_cookie_sha256);
 IF NOT coalesce((v_state->>'accepted')::boolean,false) OR v_state->>'actor_id' IS DISTINCT FROM p_actor_id::text THEN
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_PREVIOUS_SESSION_REQUIRED');
 END IF;
 SELECT p.* INTO v_principal FROM public.principals p JOIN public.sessions_v2 s ON s.principal_id=p.id
  WHERE s.id=p_previous_session_id FOR UPDATE OF p;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');END IF;
 v_guard:=coalesce(v_principal.metadata->'console_mfa_guard','{}'::jsonb);
 v_failures:=coalesce((v_guard->>'failures')::integer,0);v_last:=coalesce((v_guard->>'last_counter')::bigint,-1);
 v_locked:=(v_guard->>'locked_until')::timestamptz;
 IF v_failures<0 OR v_failures>5 OR v_last< -1 THEN RAISE EXCEPTION 'Console MFA guard state is invalid';END IF;
 IF v_locked>clock_timestamp() THEN
  RETURN jsonb_build_object('accepted',true,'verified',false,'reason','locked');
 END IF;
 IF v_locked IS NOT NULL THEN v_failures:=0;v_locked:=NULL;END IF;
 v_current:=floor(extract(epoch FROM clock_timestamp())/30)::bigint;
 IF p_counter IS NULL OR p_counter<v_current-1 OR p_counter>v_current+1 OR p_counter<=v_last THEN
  v_failures:=least(v_failures+1,5);IF v_failures=5 THEN v_locked:=clock_timestamp()+interval '5 minutes';END IF;
  UPDATE public.principals SET metadata=jsonb_set(metadata,'{console_mfa_guard}',jsonb_build_object(
   'failures',v_failures,'last_counter',v_last,'locked_until',v_locked)),updated_at=clock_timestamp() WHERE id=v_principal.id;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
   VALUES(p_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
    v_state->>'email','platform_console_mfa.failed','platform_console_session',p_previous_session_id,
    jsonb_build_object('locked',v_failures=5));
  RETURN jsonb_build_object('accepted',true,'verified',false,'reason',CASE WHEN v_failures=5 THEN 'locked' ELSE 'invalid' END);
 END IF;
 v_result:=public.transition_console_session_v1('register',p_session_id,p_cookie_sha256,p_email,p_actor_id,
  p_issued_at,p_expires_at,p_mfa_verified_at,p_previous_session_id,p_previous_cookie_sha256);
 IF NOT coalesce((v_result->>'accepted')::boolean,false) THEN RETURN v_result;END IF;
 UPDATE public.principals SET metadata=jsonb_set(metadata,'{console_mfa_guard}',jsonb_build_object(
  'failures',0,'last_counter',p_counter,'locked_until',NULL)),updated_at=clock_timestamp() WHERE id=v_principal.id;
 UPDATE public.sessions_v2 SET metadata=metadata||jsonb_build_object('console_mfa_counter',p_counter,
  'console_mfa_previous_session',p_previous_session_id,'console_mfa_previous_digest',p_previous_cookie_sha256) WHERE id=p_session_id;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
  VALUES(p_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
   v_state->>'email','platform_console_mfa.verified','platform_console_session',p_session_id,
   jsonb_build_object('previous_session_id',p_previous_session_id,'durable_replay_guard',true));
 RETURN jsonb_build_object('accepted',true,'verified',true,'state',v_result,'replayed',false);
END $function$;
CREATE OR REPLACE FUNCTION public.decide_console_approval_v1(p_session_id uuid,p_cookie_sha256 text,p_id uuid,p_decision text,p_payload_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_approval public.sensitive_action_approvals%ROWTYPE; v_permission jsonb; v_state jsonb; v_maker jsonb; v_status text;
BEGIN
  SELECT * INTO v_approval FROM public.sensitive_action_approvals WHERE id=p_id AND protocol_version=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NOT_FOUND'); END IF;
  PERFORM id FROM public.sessions_v2 WHERE id=ANY(ARRAY[p_session_id,v_approval.requester_session_id]) ORDER BY id FOR UPDATE;
  v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
  IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
  v_state:=v_permission->'session';
  IF p_decision NOT IN ('approve','reject','cancel') OR p_decision IS NULL THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');
  END IF;
  IF (p_decision='cancel' AND ((v_state->>'actor_id')::uuid<>v_approval.maker_actor_id OR p_session_id<>v_approval.requester_session_id))
    OR (p_decision<>'cancel' AND ((v_state->>'actor_id')::uuid=v_approval.maker_actor_id
      OR NOT coalesce((v_state->>'is_super_admin')::boolean,false))) THEN
    RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_SUPER_ADMIN_REQUIRED');
  END IF;
  IF p_payload_hash IS DISTINCT FROM v_approval.payload_hash OR v_approval.payload_hash IS DISTINCT FROM
    public.console_approval_payload_hash_v1(v_approval.action,v_approval.site_id,v_approval.resource_type,v_approval.resource_id,v_approval.payload) THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_PAYLOAD_MISMATCH');
  END IF;
  v_maker:=public.console_session_state_v1(v_approval.requester_session_id,
    (SELECT metadata->>'cookie_sha256' FROM public.sessions_v2 WHERE id=v_approval.requester_session_id));
  IF NOT coalesce((v_maker->>'accepted')::boolean,false) OR v_approval.expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');
  END IF;
  v_status:=CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'cancelled' END;
  IF v_approval.status<>'pending' THEN
    IF v_approval.status=v_status AND ((p_decision='cancel' AND v_approval.maker_actor_id=(v_state->>'actor_id')::uuid)
      OR (v_approval.checker_actor_id=(v_state->>'actor_id')::uuid AND v_approval.approver_session_id=p_session_id)) THEN
      RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(p_id),'replayed',true);
    END IF;
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_ALREADY_DECIDED');
  END IF;
  UPDATE public.sensitive_action_approvals SET status=v_status,
    expires_at=CASE WHEN p_decision='approve' THEN least(v_approval.expires_at,(v_state->>'expires_at')::timestamptz,
      (v_state->>'mfa_verified_at')::timestamptz+interval '10 minutes') ELSE v_approval.expires_at END,
    checker_actor_id=CASE WHEN p_decision='cancel' THEN NULL ELSE (v_state->>'actor_id')::uuid END,
    approver_session_id=CASE WHEN p_decision='cancel' THEN NULL ELSE p_session_id END,
    approved_at=CASE WHEN p_decision='approve' THEN clock_timestamp() ELSE NULL END,updated_by=(v_state->>'actor_id')::uuid WHERE id=p_id;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
    VALUES((v_state->>'actor_id')::uuid,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
      v_state->>'email','sensitive_action.'||v_status,'sensitive_action_approval',p_id,
      jsonb_build_object('action',v_approval.action,'payload_hash',v_approval.payload_hash,'approver_session_id',p_session_id));
  RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(p_id),'replayed',false);
END $function$;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT sensitive_action_approvals_scope_v1_check;
ALTER TABLE public.sensitive_action_approvals ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT sensitive_action_approvals_action_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check CHECK(action IN ('refund.approve','payout.release','customer.dsr.erase','merchant.suspend','merchant.restore','developer.suspend','money.reconciliation.resolve','ts.reinstate','runtime.control-command'));
CREATE OR REPLACE FUNCTION public.console_approval_view_v1(p_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
  SELECT to_jsonb(a)-'metadata' FROM public.sensitive_action_approvals a WHERE a.id=p_id AND a.protocol_version=1;
$function$;
NOTIFY pgrst,'reload schema';
COMMIT;
