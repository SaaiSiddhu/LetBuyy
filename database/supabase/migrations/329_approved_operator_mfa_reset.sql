-- Owner-selected V1 operator factor custody: configured per-account factors,
-- independently approved administrator reset, canonical session revocation.
-- No authenticator secret, raw OTP, new issuer or parallel approval store.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:329:operator-mfa-reset',0));
ALTER TABLE public.sensitive_action_approvals ALTER COLUMN site_id DROP NOT NULL;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT IF EXISTS sensitive_action_approvals_action_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check CHECK(action IN (
 'refund.approve','payout.release','customer.dsr.erase','merchant.suspend','merchant.restore','developer.suspend',
 'money.reconciliation.resolve','ts.reinstate','runtime.control-command','operator.mfa.reset'));
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT IF EXISTS sensitive_action_approvals_scope_v1_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_scope_v1_check CHECK(
 (action='operator.mfa.reset' AND site_id IS NULL AND protocol_version IS NOT DISTINCT FROM 1 AND resource_type='platform_operator')
 OR (action<>'operator.mfa.reset' AND site_id IS NOT NULL));
CREATE OR REPLACE FUNCTION public.complete_console_mfa_v1(
 p_session_id uuid,p_cookie_sha256 text,p_email text,p_actor_id uuid,
 p_issued_at timestamptz,p_expires_at timestamptz,p_mfa_verified_at timestamptz,
 p_previous_session_id uuid,p_previous_cookie_sha256 text,p_counter bigint,p_factor_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_identity jsonb;v_state jsonb;v_principal public.principals%ROWTYPE;v_new public.sessions_v2%ROWTYPE;
 v_factor jsonb;v_fingerprint text;v_retired jsonb;v_guard jsonb;v_failures integer;v_last bigint;v_locked timestamptz;v_current bigint;v_result jsonb;v_reason text;
BEGIN
 IF p_factor_fingerprint IS NULL OR p_factor_fingerprint !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('accepted',false,'code','CONSOLE_FACTOR_PROOF_REQUIRED');END IF;
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
  IF v_new.metadata->>'console_factor_fingerprint' IS DISTINCT FROM p_factor_fingerprint THEN RETURN jsonb_build_object('accepted',false,'code','CONSOLE_FACTOR_PROOF_REQUIRED');END IF;
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
 v_factor:=coalesce(v_principal.metadata->'console_mfa_factor','{}'::jsonb);
 v_fingerprint:=v_factor->>'fingerprint';v_retired:=coalesce(v_factor->'retired','[]'::jsonb);
 IF jsonb_typeof(v_retired)<>'array' THEN RAISE EXCEPTION 'Invalid retained Console factor state';END IF;
 IF v_retired ? p_factor_fingerprint OR (coalesce((v_factor->>'reset_required')::boolean,false) AND v_fingerprint=p_factor_fingerprint)
  OR (v_fingerprint IS NOT NULL AND v_fingerprint<>p_factor_fingerprint AND NOT coalesce((v_factor->>'reset_required')::boolean,false)) THEN
  RETURN jsonb_build_object('accepted',true,'verified',false,'reason','reset_required');
 END IF;
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
 UPDATE public.principals SET metadata=jsonb_set(metadata,'{console_mfa_factor}',
  v_factor||jsonb_build_object('fingerprint',p_factor_fingerprint,'reset_required',false,
   'generation',coalesce((v_factor->>'generation')::integer,0),
   'retired',v_retired,'verified_at',clock_timestamp())),updated_at=clock_timestamp() WHERE id=v_principal.id;
 UPDATE public.sessions_v2 SET metadata=metadata||jsonb_build_object('console_factor_fingerprint',p_factor_fingerprint,'console_mfa_counter',p_counter,
  'console_mfa_previous_session',p_previous_session_id,'console_mfa_previous_digest',p_previous_cookie_sha256) WHERE id=p_session_id;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
  VALUES(p_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
   v_state->>'email','platform_console_mfa.verified','platform_console_session',p_session_id,
   jsonb_build_object('previous_session_id',p_previous_session_id,'durable_replay_guard',true));
 RETURN jsonb_build_object('accepted',true,'verified',true,'state',v_result,'replayed',false);
END $function$;
CREATE OR REPLACE FUNCTION public.complete_console_mfa_v1(
 p_session_id uuid,p_cookie_sha256 text,p_email text,p_actor_id uuid,
 p_issued_at timestamptz,p_expires_at timestamptz,p_mfa_verified_at timestamptz,
 p_previous_session_id uuid,p_previous_cookie_sha256 text,p_counter bigint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('accepted',false,'code','CONSOLE_FACTOR_PROOF_REQUIRED');
$fn$;

CREATE OR REPLACE FUNCTION public.console_mfa_reset_target_v1(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_user public.users_custom%ROWTYPE;v_identity jsonb;v_principal public.principals%ROWTYPE;v_count integer;v_factor jsonb;
BEGIN
 SELECT * INTO v_user FROM public.users_custom WHERE id=p_actor_id AND email_verified=true;
 IF NOT FOUND THEN RETURN NULL;END IF;
 v_identity:=public.resolve_console_operator_v1(v_user.email,p_actor_id);
 IF NOT coalesce((v_identity->>'accepted')::boolean,false) THEN RETURN NULL;END IF;
 SELECT count(*) INTO v_count FROM public.principals WHERE realm='admin' AND legacy_user_id=p_actor_id AND deleted_at IS NULL;
 IF v_count>1 THEN RETURN NULL;END IF;
 SELECT * INTO v_principal FROM public.principals WHERE realm='admin' AND legacy_user_id=p_actor_id AND deleted_at IS NULL;
 IF v_count=1 AND (v_principal.status<>'active' OR lower(v_principal.email) IS DISTINCT FROM lower(v_user.email)) THEN RETURN NULL;END IF;
 v_factor:=coalesce(v_principal.metadata->'console_mfa_factor','{}'::jsonb);
 RETURN jsonb_build_object('actor_id',p_actor_id,'email',lower(v_user.email),'name',v_user.full_name,'principal_id',v_principal.id,
  'factor',jsonb_build_object('fingerprint',v_factor->'fingerprint','generation',coalesce((v_factor->>'generation')::integer,0),
   'reset_required',coalesce((v_factor->>'reset_required')::boolean,false),'retired',coalesce(v_factor->'retired','[]'::jsonb)));
END $fn$;

CREATE OR REPLACE FUNCTION public.read_console_mfa_reset_targets_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,p_actor_id uuid DEFAULT NULL,p_query text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_permission jsonb;v_items jsonb;
BEGIN
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,false);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 IF length(coalesce(p_query,''))>160 THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_QUERY_INVALID');END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('actor_id',x.state->'actor_id','email',x.state->'email','name',x.state->'name',
  'reset_required',x.state->'factor'->'reset_required') ORDER BY x.email),'[]'::jsonb) INTO v_items FROM (
  SELECT u.email,public.console_mfa_reset_target_v1(u.id) state FROM public.users_custom u
   WHERE u.email_verified=true AND (p_actor_id IS NULL OR u.id=p_actor_id)
   AND (coalesce(p_query,'')='' OR position(lower(p_query) in lower(u.email))>0 OR position(lower(p_query) in lower(coalesce(u.full_name,'')))>0)
   AND (EXISTS(SELECT 1 FROM public.super_admin_allowlist a WHERE a.is_active=true AND lower(a.email)=lower(u.email) AND (a.user_id=u.id OR a.user_id IS NULL))
    OR EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=u.id AND e.store_id IS NULL AND e.status='active' AND e.is_active=true AND e.deleted_at IS NULL))
   ORDER BY u.email LIMIT 50
 ) x WHERE x.state IS NOT NULL;
 RETURN jsonb_build_object('accepted',true,'items',v_items);
END $fn$;

CREATE OR REPLACE FUNCTION public.create_console_mfa_reset_approval_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_actor_id uuid,p_reason text,p_request_key uuid,p_configured_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_permission jsonb;v_state jsonb;v_target jsonb;v_a public.sensitive_action_approvals%ROWTYPE;v_payload jsonb;v_lock uuid;v_requester uuid;
BEGIN
 SELECT p.legacy_user_id INTO v_requester FROM public.sessions_v2 x JOIN public.principals p ON p.id=x.principal_id
  WHERE x.id=p_session_id AND x.realm='admin' AND x.metadata->>'cookie_sha256'=p_cookie_sha256;
 FOR v_lock IN SELECT DISTINCT id FROM unnest(ARRAY[v_requester,p_actor_id]) id WHERE id IS NOT NULL ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||v_lock::text,0));
 END LOOP;
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 v_state:=v_permission->'session';
 IF p_actor_id IS NULL OR p_request_key IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 1000
  OR p_configured_fingerprint IS NULL OR p_configured_fingerprint !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:approval-request:'||(v_state->>'actor_id')||':'||p_request_key::text,0));
 SELECT * INTO v_a FROM public.sensitive_action_approvals WHERE protocol_version=1 AND maker_actor_id=(v_state->>'actor_id')::uuid
  AND action='operator.mfa.reset' AND resource_id=p_actor_id::text AND request_key=p_request_key;
 IF FOUND THEN
  IF v_a.requester_session_id<>p_session_id OR v_a.reason<>btrim(p_reason) OR v_a.payload->>'configured_fingerprint'<>p_configured_fingerprint THEN
   RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_a.id),'replayed',true);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||p_actor_id::text,0));
 v_target:=public.console_mfa_reset_target_v1(p_actor_id);
 IF v_target IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 IF coalesce((v_target->'factor'->>'reset_required')::boolean,false) THEN RETURN jsonb_build_object('accepted',false,'code','MFA_RESET_ALREADY_REQUIRED');END IF;
 IF v_target->'factor'->>'fingerprint' IS NOT NULL AND v_target->'factor'->>'fingerprint'<>p_configured_fingerprint THEN
  RETURN jsonb_build_object('accepted',false,'code','MFA_FACTOR_CONFIGURATION_CHANGED');END IF;
 v_payload:=jsonb_build_object('target',v_target,'configured_fingerprint',p_configured_fingerprint,'reason',btrim(p_reason));
 INSERT INTO public.sensitive_action_approvals(site_id,action,resource_type,resource_id,maker_actor_id,status,reason,
  protocol_version,requester_session_id,request_key,payload,payload_hash,expires_at,created_by)
 VALUES(NULL,'operator.mfa.reset','platform_operator',p_actor_id::text,(v_state->>'actor_id')::uuid,'pending',btrim(p_reason),
  1,p_session_id,p_request_key,v_payload,public.console_approval_payload_hash_v1('operator.mfa.reset',NULL,'platform_operator',p_actor_id::text,v_payload),
  least(clock_timestamp()+interval '10 minutes',(v_state->>'expires_at')::timestamptz,(v_state->>'mfa_verified_at')::timestamptz+interval '10 minutes'),(v_state->>'actor_id')::uuid)
 RETURNING * INTO v_a;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES(v_a.maker_actor_id,'employee',v_state->>'email','sensitive_action.requested','sensitive_action_approval',v_a.id,
  jsonb_build_object('action',v_a.action,'target_actor_id',p_actor_id,'payload_hash',v_a.payload_hash,'requester_session_id',p_session_id));
 UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp()) WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
 RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_a.id),'replayed',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.execute_console_mfa_reset_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,p_id uuid,p_actor_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_a public.sensitive_action_approvals%ROWTYPE;v_permission jsonb;v_state jsonb;v_checker jsonb;v_target jsonb;
 v_principal public.principals%ROWTYPE;v_factor jsonb;v_retired jsonb;v_count integer;v_result jsonb;v_job uuid;v_lock uuid;
BEGIN
 SELECT * INTO v_a FROM public.sensitive_action_approvals WHERE id=p_id AND protocol_version=1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NOT_FOUND');END IF;
 -- All participating actor locks precede session rows. Reciprocal resets and
 -- concurrent normal MFA rotation therefore share one deterministic order.
 FOR v_lock IN SELECT DISTINCT id FROM unnest(ARRAY[v_a.maker_actor_id,v_a.checker_actor_id,p_actor_id]) id WHERE id IS NOT NULL ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||v_lock::text,0));
 END LOOP;
 PERFORM id FROM public.sessions_v2 WHERE id=ANY(ARRAY[p_session_id,v_a.approver_session_id]) ORDER BY id FOR UPDATE;
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission;END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 v_state:=v_permission->'session';
 IF v_a.maker_actor_id<>(v_state->>'actor_id')::uuid OR v_a.requester_session_id<>p_session_id THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_REQUESTER_MISMATCH');END IF;
 IF p_actor_id IS NULL OR v_a.site_id IS NOT NULL OR v_a.action<>'operator.mfa.reset' OR v_a.resource_type<>'platform_operator'
  OR v_a.resource_id<>p_actor_id::text OR v_a.reason IS DISTINCT FROM btrim(p_reason)
  OR v_a.payload_hash IS DISTINCT FROM public.console_approval_payload_hash_v1(v_a.action,NULL,v_a.resource_type,v_a.resource_id,v_a.payload) THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_PAYLOAD_MISMATCH');END IF;
 IF v_a.status<>'approved' OR v_a.approver_session_id IS NULL OR v_a.checker_actor_id=v_a.maker_actor_id THEN RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_APPROVAL_REQUIRED');END IF;
 v_checker:=public.console_session_state_v1(v_a.approver_session_id,(SELECT metadata->>'cookie_sha256' FROM public.sessions_v2 WHERE id=v_a.approver_session_id));
 IF NOT coalesce((v_checker->>'accepted')::boolean,false) OR NOT coalesce((v_checker->>'is_super_admin')::boolean,false)
  OR (v_checker->>'actor_id')::uuid IS DISTINCT FROM v_a.checker_actor_id OR v_a.checker_actor_id=p_actor_id THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');END IF;
 IF v_a.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('accepted',true,'result',v_a.result||'{"replayed":true}'::jsonb);END IF;
 IF v_a.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||p_actor_id::text,0));
 PERFORM id FROM public.principals WHERE realm='admin' AND legacy_user_id=p_actor_id AND deleted_at IS NULL ORDER BY id FOR UPDATE;
 PERFORM x.id FROM public.sessions_v2 x JOIN public.principals p ON p.id=x.principal_id
  WHERE p.realm='admin' AND p.legacy_user_id=p_actor_id AND x.realm='admin' AND x.site_id IS NULL
   AND x.metadata->>'protocol'='platform-console-v1' ORDER BY x.id FOR UPDATE OF x;
 -- A membership/identity revocation that held a target session must finish
 -- before this fresh source read, rather than being hidden behind our write.
 v_target:=public.console_mfa_reset_target_v1(p_actor_id);
 IF v_target IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND');END IF;
 IF v_target IS DISTINCT FROM v_a.payload->'target' THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');END IF;
 IF v_target->>'principal_id' IS NULL THEN
  INSERT INTO public.principals(realm,actor_type,legacy_user_id,email,status,metadata)
   VALUES('admin','platform-operator',p_actor_id,v_target->>'email','active','{"source":"platform-console-v1"}'::jsonb) RETURNING * INTO v_principal;
  INSERT INTO public.account_links(principal_id,realm,provider,provider_subject) VALUES(v_principal.id,'admin','users_custom',p_actor_id::text);
 ELSE SELECT * INTO v_principal FROM public.principals WHERE id=(v_target->>'principal_id')::uuid FOR UPDATE;END IF;
 v_factor:=coalesce(v_principal.metadata->'console_mfa_factor','{}'::jsonb);v_retired:=coalesce(v_factor->'retired','[]'::jsonb);
 IF NOT v_retired ? (v_a.payload->>'configured_fingerprint') THEN v_retired:=v_retired||jsonb_build_array(v_a.payload->>'configured_fingerprint');END IF;
 UPDATE public.principals SET metadata=jsonb_set(metadata,'{console_mfa_factor}',v_factor||jsonb_build_object(
  'fingerprint',v_a.payload->>'configured_fingerprint','reset_required',true,'generation',coalesce((v_factor->>'generation')::integer,0)+1,
  'retired',v_retired,'reset_approval_id',p_id,'reset_at',clock_timestamp())),updated_at=clock_timestamp() WHERE id=v_principal.id;
 WITH revoked AS (
  UPDATE public.sessions_v2 SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='approved_mfa_reset'
   WHERE principal_id=v_principal.id AND realm='admin' AND site_id IS NULL AND status='active' AND metadata->>'protocol'='platform-console-v1' RETURNING id
 ) SELECT count(*) INTO v_count FROM revoked;
 INSERT INTO public.platform_queue_jobs(site_id,event_id,queue_name,job_type,payload,idempotency_key,created_by,updated_by)
 VALUES(NULL,p_id,'notification-jobs','email.operator_mfa_reset',jsonb_build_object('approval_id',p_id),
  'operator-mfa-reset-email:'||p_id::text,v_a.maker_actor_id,v_a.maker_actor_id) RETURNING id INTO v_job;
 v_result:=jsonb_build_object('actor_id',p_actor_id,'approval_id',p_id,'reset_required',true,'revoked_sessions',v_count,
  'notification_job_id',v_job,'notification_status','queued','replayed',false);
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES(v_a.maker_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,v_state->>'email',
  'operator.mfa.reset','platform_operator',p_actor_id,jsonb_build_object('approval_id',p_id,'reason',v_a.reason,
   'independent_approver_id',v_a.checker_actor_id,'payload_hash',v_a.payload_hash,'revoked_sessions',v_count,'notification_job_id',v_job));
 UPDATE public.sensitive_action_approvals SET consumed_at=clock_timestamp(),result=v_result,updated_by=v_a.maker_actor_id WHERE id=p_id;
 UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp()) WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
 RETURN jsonb_build_object('accepted',true,'result',v_result);
END $fn$;
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
  IF p_decision<>'cancel' AND v_approval.action='operator.mfa.reset'
    AND v_approval.resource_id=v_state->>'actor_id' THEN RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_SUPER_ADMIN_REQUIRED');END IF;
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
REVOKE ALL ON FUNCTION public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.complete_console_mfa_v1(uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text,bigint,text) TO service_role;
REVOKE ALL ON FUNCTION public.console_mfa_reset_target_v1(uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.console_mfa_reset_target_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.read_console_mfa_reset_targets_v1(uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_console_mfa_reset_targets_v1(uuid,text,text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.create_console_mfa_reset_approval_v1(uuid,text,text,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.create_console_mfa_reset_approval_v1(uuid,text,text,uuid,text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.execute_console_mfa_reset_v1(uuid,text,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.execute_console_mfa_reset_v1(uuid,text,text,uuid,uuid,text) TO service_role;

-- Project current delivery state from its canonical job; the committed reset
-- receipt stays immutable and never pretends provider acceptance is inbox proof.
CREATE OR REPLACE FUNCTION public.console_approval_view_v1(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT (to_jsonb(a)-'metadata')||CASE WHEN a.action='operator.mfa.reset' AND a.consumed_at IS NOT NULL
 THEN jsonb_build_object('notification_delivery',(SELECT jsonb_build_object('status',j.status,'attempts',j.attempts,'completed_at',j.completed_at)
  FROM public.platform_queue_jobs j WHERE j.id::text=a.result->>'notification_job_id' AND j.event_id=a.id
   AND j.job_type='email.operator_mfa_reset' AND j.site_id IS NULL)) ELSE '{}'::jsonb END
 FROM public.sensitive_action_approvals a WHERE a.id=p_id AND a.protocol_version=1;
$fn$;

-- First delivery binds its configured sender once under the existing job lease.
-- Later provider retries retain identical message content even after config edits.
CREATE OR REPLACE FUNCTION public.console_mfa_reset_delivery_v1(p_job_id uuid,p_worker_id text,p_sender text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_job public.platform_queue_jobs%ROWTYPE;v_a public.sensitive_action_approvals%ROWTYPE;v_sender text;
BEGIN
 SELECT * INTO v_job FROM public.platform_queue_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR v_job.queue_name<>'notification-jobs' OR v_job.job_type<>'email.operator_mfa_reset' OR v_job.site_id IS NOT NULL
  OR v_job.status<>'running' OR v_job.deleted_at IS NOT NULL OR v_job.locked_by IS DISTINCT FROM p_worker_id
  OR p_worker_id IS NULL OR v_job.locked_at IS NULL OR v_job.locked_at<clock_timestamp()-interval '120 seconds' THEN
  RAISE EXCEPTION 'A current operator notification lease is required';END IF;
 SELECT * INTO v_a FROM public.sensitive_action_approvals WHERE id=v_job.event_id AND action='operator.mfa.reset'
  AND site_id IS NULL AND protocol_version=1 AND consumed_at IS NOT NULL AND result->>'notification_job_id'=p_job_id::text;
 IF NOT FOUND OR v_job.payload->>'approval_id' IS DISTINCT FROM v_a.id::text
  OR v_job.idempotency_key IS DISTINCT FROM 'operator-mfa-reset-email:'||v_a.id::text THEN RAISE EXCEPTION 'Operator notification source does not match';END IF;
 v_sender:=v_job.payload->>'notification_sender';
 IF v_sender IS NULL THEN
  v_sender:=btrim(p_sender);
  IF v_sender IS NULL OR length(v_sender) NOT BETWEEN 3 AND 320 OR v_sender ~ '[\r\n]' OR v_sender !~ '@' THEN
   RAISE EXCEPTION 'Operator notification sender is not configured';END IF;
  UPDATE public.platform_queue_jobs SET payload=payload||jsonb_build_object('notification_sender',v_sender,'notification_template_version',1) WHERE id=p_job_id;
 END IF;
 RETURN jsonb_build_object('approval_id',v_a.id,'job_id',p_job_id,'email',v_a.payload->'target'->>'email',
  'sender',v_sender,'occurred_at',v_a.consumed_at,'target_actor_id',v_a.resource_id);
END $fn$;
CREATE OR REPLACE FUNCTION public.recover_expired_console_security_email_jobs_v1(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE r record;v_count integer:=0;
BEGIN
 FOR r IN SELECT id,locked_by FROM public.platform_queue_jobs WHERE queue_name='notification-jobs' AND job_type='email.operator_mfa_reset'
  AND site_id IS NULL AND status='running' AND deleted_at IS NULL AND locked_by IS NOT NULL AND locked_at<clock_timestamp()-interval '120 seconds'
  ORDER BY locked_at,id LIMIT least(greatest(coalesce(p_limit,25),1),100) FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.fail_platform_queue_job(r.id,r.locked_by,'Operator notification worker lease expired',30,
   jsonb_build_object('consumer_runtime','services/queue-workers','lease_recovered',true));v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $fn$;
REVOKE ALL ON FUNCTION public.console_mfa_reset_delivery_v1(uuid,text,text),public.recover_expired_console_security_email_jobs_v1(integer) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.console_mfa_reset_delivery_v1(uuid,text,text),public.recover_expired_console_security_email_jobs_v1(integer) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
