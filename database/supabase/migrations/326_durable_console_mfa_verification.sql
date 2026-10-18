-- Durable replay/attempt state in the existing canonical Console principal.
-- No OTP or authenticator secret is persisted; actor/session authority is314.
BEGIN;
DO $later$ BEGIN IF to_regprocedure('public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint,text)') IS NOT NULL THEN RAISE EXCEPTION '326 requires rolling back configured-factor migration329 first';END IF;END $later$;
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
REVOKE ALL ON FUNCTION public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint)
 FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
