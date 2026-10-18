-- Canonical T&S tables and the existing approval/session owners. No generic
-- bearer verifier, external notification, app-platform activation or new store.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:318:trust-approval',0));
DO $precondition$ BEGIN
 IF to_regprocedure('public.enforce_active_trust_site_hold_v1()') IS NULL THEN RAISE EXCEPTION '318 requires site status ownership317'; END IF;
END $precondition$;

CREATE OR REPLACE FUNCTION public.console_trust_reinstatement_context_v1(p_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_case public.ts_cases%ROWTYPE; v_site public.sites%ROWTYPE; v_takedowns jsonb; v_others jsonb; v_roots jsonb;v_sources jsonb;
BEGIN
 SELECT * INTO v_case FROM public.ts_cases WHERE id=p_case_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
 IF v_case.status NOT IN ('actioned','appealed') THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED'); END IF;
 -- Policy edits serialize with the reviewed context until this transaction
 -- completes, just as child evidence/appeal/event writers lock the case.
 PERFORM id FROM public.ts_policies WHERE id=v_case.policy_id FOR SHARE;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) INTO v_takedowns FROM (
  SELECT * FROM public.ts_takedowns WHERE case_id=p_case_id AND status='active' AND deleted_at IS NULL ORDER BY id LIMIT 101) t;
 IF jsonb_array_length(v_takedowns)=0 THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NO_ACTIVE_RESTRICTION'); END IF;
 IF jsonb_array_length(v_takedowns)>100 THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_CONTEXT_TOO_LARGE'); END IF;
 -- Other action families retain their accepted/frozen/provider owner gates.
 -- Never label an unimplemented payout/app/theme restoration successful.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_takedowns) t WHERE t->>'action_type'<>'suspend_site') THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_RESTORATION_SCOPE_UNAVAILABLE');
 END IF;
 IF v_case.site_id IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_takedowns) t
   WHERE t->>'site_id' IS DISTINCT FROM v_case.site_id::text OR t->>'subject_type' IS DISTINCT FROM v_case.subject_type
    OR t->>'subject_id' IS DISTINCT FROM v_case.subject_id) THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_SCOPE_MISMATCH');
 END IF;
 SELECT * INTO v_site FROM public.sites WHERE id=v_case.site_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
 IF v_site.status<>'suspended' THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED'); END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) INTO v_others FROM(
  SELECT * FROM public.ts_takedowns WHERE site_id=v_case.site_id AND case_id<>p_case_id AND action_type='suspend_site'
   AND status='active' AND deleted_at IS NULL ORDER BY id LIMIT 101) t;
 IF jsonb_array_length(v_others)>100 THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_CONTEXT_TOO_LARGE'); END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) INTO v_roots FROM public.ts_takedowns t
  WHERE t.id IN(SELECT (a->>'restoration_root_id')::uuid FROM jsonb_array_elements(v_takedowns) a);
 SELECT jsonb_build_object(
  'evidence',(SELECT jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'[]'),'UTF8')),'hex')) FROM public.ts_evidence e WHERE e.case_id=p_case_id AND e.deleted_at IS NULL),
  'appeals',(SELECT jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id)::text,'[]'),'UTF8')),'hex')) FROM public.ts_appeals a WHERE a.case_id=p_case_id AND a.deleted_at IS NULL),
  'events',(SELECT jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'[]'),'UTF8')),'hex')) FROM public.ts_case_events e WHERE e.case_id=p_case_id AND e.deleted_at IS NULL),
  'policy',(SELECT encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') FROM public.ts_policies p WHERE p.id=v_case.policy_id)
 ) INTO v_sources;
 RETURN jsonb_build_object('accepted',true,'context',jsonb_build_object('case',to_jsonb(v_case),'takedowns',v_takedowns,
  'site',jsonb_build_object('id',v_site.id,'status',v_site.status,'status_revision',v_site.status_revision,'published',v_site.published,'legacy_updated_by',CASE WHEN v_site.status_revision=0 THEN v_site.updated_by ELSE NULL END),
  'other_active_takedowns',v_others,'roots',v_roots,'review_sources',v_sources));
END $function$;

CREATE OR REPLACE FUNCTION public.create_console_trust_approval_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_case_id uuid,p_reason text,p_request_key uuid,p_note_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb; v_state jsonb; v_a public.sensitive_action_approvals%ROWTYPE; v_context jsonb; v_payload jsonb; v_site uuid;
BEGIN
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED'); END IF;
 v_state:=v_permission->'session';
 IF p_case_id IS NULL OR p_request_key IS NULL OR p_reason IS NULL OR length(btrim(p_reason))<8 OR length(btrim(p_reason))>1000
  OR p_note_metadata IS NULL OR jsonb_typeof(p_note_metadata)<>'object' OR octet_length(p_note_metadata::text)>4096 THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:approval-request:'||(v_state->>'actor_id')||':'||p_request_key::text,0));
 SELECT * INTO v_a FROM public.sensitive_action_approvals WHERE protocol_version=1 AND action='ts.reinstate' AND resource_type='ts_case'
  AND resource_id=p_case_id::text AND maker_actor_id=(v_state->>'actor_id')::uuid AND request_key=p_request_key;
 IF FOUND THEN
  IF v_a.requester_session_id<>p_session_id OR v_a.reason<>btrim(p_reason) OR v_a.payload->'note_metadata' IS DISTINCT FROM p_note_metadata THEN
   RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');
  END IF;
  RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_a.id),'replayed',true);
 END IF;
 SELECT site_id INTO v_site FROM public.ts_cases WHERE id=p_case_id AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
 PERFORM id FROM public.sites WHERE id=v_site FOR SHARE;
 v_context:=public.console_trust_reinstatement_context_v1(p_case_id);
 IF NOT coalesce((v_context->>'accepted')::boolean,false) THEN RETURN v_context; END IF;
 v_payload:=jsonb_build_object('context',v_context->'context','reason',btrim(p_reason),'note_metadata',p_note_metadata);
 INSERT INTO public.sensitive_action_approvals(site_id,action,resource_type,resource_id,maker_actor_id,status,reason,protocol_version,
  requester_session_id,request_key,payload,payload_hash,expires_at,created_by)
 VALUES(v_site,'ts.reinstate','ts_case',p_case_id::text,(v_state->>'actor_id')::uuid,'pending',btrim(p_reason),1,p_session_id,p_request_key,v_payload,
  public.console_approval_payload_hash_v1('ts.reinstate',v_site,'ts_case',p_case_id::text,v_payload),
  least(clock_timestamp()+interval '10 minutes',(v_state->>'expires_at')::timestamptz,(v_state->>'mfa_verified_at')::timestamptz+interval '10 minutes'),
  (v_state->>'actor_id')::uuid) RETURNING * INTO v_a;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES(v_a.maker_actor_id,CASE WHEN(v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,v_state->>'email','sensitive_action.requested','sensitive_action_approval',v_a.id,
  jsonb_build_object('action',v_a.action,'case_id',p_case_id,'payload_hash',v_a.payload_hash,'requester_session_id',p_session_id));
 UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
  WHERE id IN(SELECT(g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants')g);
 RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_a.id),'replayed',false);
END $function$;

CREATE OR REPLACE FUNCTION public.execute_console_trust_reinstatement_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_id uuid,p_case_id uuid,p_reason text,p_note_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_a public.sensitive_action_approvals%ROWTYPE; v_permission jsonb; v_state jsonb; v_checker jsonb; v_context jsonb;
 v_case public.ts_cases%ROWTYPE; v_site public.sites%ROWTYPE; v_last public.ts_takedowns%ROWTYPE; v_baseline text;
 v_next text; v_published boolean; v_outcome text; v_result jsonb; v_ids jsonb;
BEGIN
 SELECT * INTO v_a FROM public.sensitive_action_approvals WHERE id=p_id AND protocol_version=1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NOT_FOUND'); END IF;
 PERFORM id FROM public.sessions_v2 WHERE id=ANY(ARRAY[p_session_id,v_a.approver_session_id]) ORDER BY id FOR UPDATE;
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED'); END IF;
 v_state:=v_permission->'session';
 IF v_a.maker_actor_id<>(v_state->>'actor_id')::uuid OR v_a.requester_session_id<>p_session_id THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_REQUESTER_MISMATCH');
 END IF;
 IF v_a.action<>'ts.reinstate' OR v_a.resource_type<>'ts_case' OR v_a.resource_id IS DISTINCT FROM p_case_id::text
  OR v_a.reason IS DISTINCT FROM btrim(p_reason) OR v_a.payload->'note_metadata' IS DISTINCT FROM p_note_metadata
  OR v_a.payload_hash IS DISTINCT FROM public.console_approval_payload_hash_v1(v_a.action,v_a.site_id,v_a.resource_type,v_a.resource_id,v_a.payload) THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_PAYLOAD_MISMATCH');
 END IF;
 IF v_a.status<>'approved' OR v_a.approver_session_id IS NULL OR v_a.checker_actor_id=v_a.maker_actor_id THEN
  RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_APPROVAL_REQUIRED');
 END IF;
 v_checker:=public.console_session_state_v1(v_a.approver_session_id,(SELECT metadata->>'cookie_sha256' FROM public.sessions_v2 WHERE id=v_a.approver_session_id));
 IF NOT coalesce((v_checker->>'accepted')::boolean,false) OR NOT coalesce((v_checker->>'is_super_admin')::boolean,false)
  OR (v_checker->>'actor_id')::uuid IS DISTINCT FROM v_a.checker_actor_id THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');
 END IF;
 IF v_a.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('accepted',true,'result',v_a.result||'{"replayed":true}'::jsonb); END IF;
 IF v_a.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED'); END IF;
 SELECT * INTO v_case FROM public.ts_cases WHERE id=p_case_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR v_case.site_id IS DISTINCT FROM v_a.site_id THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_SCOPE_MISMATCH'); END IF;
 SELECT * INTO v_site FROM public.sites WHERE id=v_case.site_id AND deleted_at IS NULL FOR UPDATE;
 v_context:=public.console_trust_reinstatement_context_v1(p_case_id);
 IF NOT coalesce((v_context->>'accepted')::boolean,false) THEN RETURN v_context; END IF;
 IF v_context->'context' IS DISTINCT FROM v_a.payload->'context' THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED'); END IF;
 v_next:='suspended';v_published:=false;v_outcome:='independent_site_status_retained';
 IF jsonb_array_length(v_context->'context'->'other_active_takedowns')>0 THEN
  v_outcome:='other_safety_restriction_retained';
 ELSE
  SELECT * INTO v_last FROM public.ts_takedowns WHERE case_id=p_case_id AND status='active' AND deleted_at IS NULL
   ORDER BY applied_site_revision DESC NULLS LAST,enforced_at DESC,id DESC LIMIT 1;
  IF v_last.enforcement_key IS NOT NULL AND v_last.applied_site_revision=v_site.status_revision THEN
   v_baseline:=v_last.restoration_baseline_status;v_published:=v_last.restoration_baseline_published;
  ELSIF v_site.status_revision=0 AND v_site.updated_by=v_last.enforced_by AND NOT EXISTS(
   SELECT 1 FROM public.ts_takedowns t WHERE t.case_id=p_case_id AND t.status='active' AND t.deleted_at IS NULL
    AND (t.enforced_by IS DISTINCT FROM v_site.updated_by OR t.metadata->>'previous_site_status' IS DISTINCT FROM v_last.metadata->>'previous_site_status')) THEN
   v_baseline:=v_last.metadata->>'previous_site_status';v_published:=coalesce((v_last.metadata->>'previous_published')::boolean,false);
  END IF;
  IF v_baseline IN('published','draft','suspended') THEN
   v_next:=v_baseline;v_outcome:=CASE WHEN v_next='suspended' THEN 'preexisting_suspension_retained' ELSE 'owned_site_status_restored' END;
  END IF;
 END IF;
 SELECT jsonb_agg(t->'id' ORDER BY t->>'id') INTO v_ids FROM jsonb_array_elements(v_context->'context'->'takedowns')t;
 -- Reverse only this reviewed case's hold, then let the global site guard check
 -- every remaining active hold before a publication change can commit.
 UPDATE public.ts_takedowns SET status='reversed',reversed_by=v_a.maker_actor_id,reversed_at=clock_timestamp(),updated_by=v_a.maker_actor_id
  WHERE case_id=p_case_id AND status='active' AND deleted_at IS NULL;
 IF v_next IS DISTINCT FROM v_site.status OR (v_next='suspended' AND v_site.published IS DISTINCT FROM false) THEN
  UPDATE public.sites SET status=v_next,published=CASE WHEN v_next='suspended' THEN false ELSE v_published END,updated_by=v_a.maker_actor_id WHERE id=v_site.id;
 END IF;
 UPDATE public.ts_cases SET status='reinstated',closed_at=clock_timestamp(),updated_by=v_a.maker_actor_id,
  metadata=metadata||jsonb_build_object('reinstatement',jsonb_build_object('approval_id',p_id,'note_metadata',p_note_metadata,
   'site_restoration_outcome',v_outcome,'independent_approver_id',v_a.checker_actor_id)) WHERE id=p_case_id;
 SELECT jsonb_build_object('case',to_jsonb(c),'site',jsonb_build_object('id',s.id,'status',s.status,'status_revision',s.status_revision,'published',s.published),
  'site_restoration_outcome',v_outcome,'reversed_takedowns',v_ids,'approval_id',p_id,'replayed',false) INTO v_result
  FROM public.ts_cases c JOIN public.sites s ON s.id=c.site_id WHERE c.id=p_case_id;
 INSERT INTO public.ts_case_events(case_id,event_type,actor_type,actor_id,reason,metadata,created_by)
 VALUES(p_case_id,'reinstated',CASE WHEN(v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
  v_a.maker_actor_id,v_a.reason,v_result,v_a.maker_actor_id);
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES(v_a.maker_actor_id,CASE WHEN(v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,v_state->>'email',
  'trust_safety.case.reinstate','ts_case',p_case_id,jsonb_build_object('reason',v_a.reason,'approval_id',p_id,'payload_hash',v_a.payload_hash,'result',v_result));
 UPDATE public.sensitive_action_approvals SET consumed_at=clock_timestamp(),result=v_result,updated_by=v_a.maker_actor_id WHERE id=p_id;
 UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
  WHERE id IN(SELECT(g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants')g);
 RETURN jsonb_build_object('accepted',true,'result',v_result);
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_console_trust_site_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
 p_case_id uuid,p_action text,p_reason text,p_request_key uuid,p_note_metadata jsonb,p_notify_subject boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb; v_state jsonb; v_case public.ts_cases%ROWTYPE; v_site public.sites%ROWTYPE;
 v_old public.ts_takedowns%ROWTYPE; v_td public.ts_takedowns%ROWTYPE; v_prior public.ts_takedowns%ROWTYPE;
 v_id uuid:=gen_random_uuid();v_hash text;v_root uuid;v_baseline text;v_published boolean;v_result jsonb;v_revision bigint;v_delivery text;
BEGIN
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
 IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED'); END IF;
 v_state:=v_permission->'session';
 IF p_request_key IS NULL OR p_case_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason))<8 OR length(btrim(p_reason))>1000
  OR p_note_metadata IS NULL OR jsonb_typeof(p_note_metadata)<>'object' OR octet_length(p_note_metadata::text)>4096 THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');
 END IF;
 IF p_action IS DISTINCT FROM 'suspend_site' THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_RESTORATION_SCOPE_UNAVAILABLE'); END IF;
 v_delivery:=CASE WHEN coalesce(p_notify_subject,false) THEN 'pending_approved_delivery' ELSE 'not_requested' END;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('case_id',p_case_id,'action',p_action,'reason',btrim(p_reason),
  'notes',p_note_metadata,'notification_requested',coalesce(p_notify_subject,false))::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:ts-enforce:'||(v_state->>'actor_id')||':'||p_request_key::text,0));
 SELECT * INTO v_old FROM public.ts_takedowns WHERE case_id=p_case_id AND enforced_by=(v_state->>'actor_id')::uuid AND enforcement_key=p_request_key;
 IF FOUND THEN
  IF v_old.enforcement_session_id<>p_session_id OR v_old.enforcement_payload_hash<>v_hash THEN
   RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');
  END IF;
  IF v_old.enforcement_result IS NULL THEN RAISE EXCEPTION 'retained enforcement receipt is unavailable'; END IF;
  RETURN jsonb_build_object('accepted',true,'result',v_old.enforcement_result||'{"replayed":true}'::jsonb);
 END IF;
 SELECT * INTO v_case FROM public.ts_cases WHERE id=p_case_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
 IF v_case.site_id IS NULL OR v_case.status NOT IN('open','under_review','actioned','appealed') THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');
 END IF;
 IF v_case.subject_type<>'site' OR v_case.subject_id IS DISTINCT FROM v_case.site_id::text THEN
  RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_SCOPE_MISMATCH');
 END IF;
 SELECT * INTO v_site FROM public.sites WHERE id=v_case.site_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
 v_baseline:=v_site.status;v_published:=coalesce(v_site.published,false);v_root:=v_id;
 IF v_site.status='suspended' THEN
  SELECT * INTO v_prior FROM public.ts_takedowns WHERE site_id=v_site.id AND action_type='suspend_site' AND status='active' AND deleted_at IS NULL
   AND enforcement_key IS NOT NULL ORDER BY applied_site_revision DESC,id DESC LIMIT 1;
  IF FOUND AND v_prior.applied_site_revision=v_site.status_revision THEN
   v_baseline:=v_prior.restoration_baseline_status;v_published:=v_prior.restoration_baseline_published;v_root:=v_prior.restoration_root_id;
  END IF;
 END IF;
 UPDATE public.sites SET status='suspended',updated_by=(v_state->>'actor_id')::uuid WHERE id=v_site.id RETURNING status_revision INTO v_revision;
 INSERT INTO public.ts_takedowns(id,case_id,site_id,subject_type,subject_id,action_type,status,reason,enforced_by,metadata,created_by,
  enforcement_session_id,enforcement_key,enforcement_payload_hash,applied_site_revision,restoration_root_id,restoration_baseline_status,restoration_baseline_published)
 VALUES(v_id,p_case_id,v_site.id,v_case.subject_type,v_case.subject_id,'suspend_site','active',btrim(p_reason),(v_state->>'actor_id')::uuid,
  jsonb_build_object('previous_site_status',v_site.status,'previous_published',v_site.published,'notes',p_note_metadata,'notification_status',v_delivery),
  (v_state->>'actor_id')::uuid,p_session_id,p_request_key,v_hash,v_revision,v_root,v_baseline,v_published) RETURNING * INTO v_td;
 UPDATE public.ts_cases SET status='actioned',enforcement_action='suspend_site',enforced_by=(v_state->>'actor_id')::uuid,
  decision='violation',decision_reason=btrim(p_reason),updated_by=(v_state->>'actor_id')::uuid WHERE id=p_case_id RETURNING * INTO v_case;
 v_result:=jsonb_build_object('case',to_jsonb(v_case),'takedown',to_jsonb(v_td),'site',jsonb_build_object('id',v_site.id,'status','suspended','status_revision',v_revision,'published',false),
  'notification_status',v_delivery,'replayed',false);
 INSERT INTO public.ts_case_events(case_id,event_type,actor_type,actor_id,reason,metadata,created_by)
 VALUES(p_case_id,'enforcement_applied',CASE WHEN(v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
  (v_state->>'actor_id')::uuid,btrim(p_reason),jsonb_build_object('action','suspend_site','takedown_id',v_id,'notification_status',v_delivery),(v_state->>'actor_id')::uuid);
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES((v_state->>'actor_id')::uuid,CASE WHEN(v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
  v_state->>'email','trust_safety.case.enforce','ts_case',p_case_id,jsonb_build_object('reason',btrim(p_reason),'result',v_result,'request_key',p_request_key));
 UPDATE public.ts_takedowns SET enforcement_result=v_result WHERE id=v_id;
 UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
  WHERE id IN(SELECT(g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants')g);
 RETURN jsonb_build_object('accepted',true,'result',v_result);
END $function$;
-- The status guard forces suspended publication false. Preserve the canonical
-- merchant restore intent by updating both visibility fields atomically, with
-- every predecessor ownership/MFA/idempotency/consent guard unchanged.
CREATE OR REPLACE FUNCTION public.execute_console_merchant_moderation_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
  p_id uuid,p_site_id uuid,p_action text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_approval public.sensitive_action_approvals%ROWTYPE; v_permission jsonb; v_state jsonb; v_checker jsonb;
  v_site public.sites%ROWTYPE; v_next text; v_result jsonb;
BEGIN
  SELECT * INTO v_approval FROM public.sensitive_action_approvals WHERE id=p_id AND protocol_version=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NOT_FOUND'); END IF;
  PERFORM id FROM public.sessions_v2 WHERE id=ANY(ARRAY[p_session_id,v_approval.approver_session_id]) ORDER BY id FOR UPDATE;
  v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
  IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
  IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
    RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');
  END IF;
  v_state:=v_permission->'session';
  IF v_approval.maker_actor_id<>(v_state->>'actor_id')::uuid OR v_approval.requester_session_id<>p_session_id THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_REQUESTER_MISMATCH');
  END IF;
  IF v_approval.site_id IS DISTINCT FROM p_site_id OR v_approval.resource_type<>'site' OR v_approval.resource_id<>p_site_id::text
    OR p_action NOT IN ('suspend','restore') OR p_action IS NULL OR v_approval.action<>'merchant.'||p_action
    OR v_approval.payload->>'action' IS DISTINCT FROM p_action OR v_approval.reason IS DISTINCT FROM btrim(p_reason)
    OR v_approval.payload_hash IS DISTINCT FROM public.console_approval_payload_hash_v1(v_approval.action,v_approval.site_id,
      v_approval.resource_type,v_approval.resource_id,v_approval.payload) THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_PAYLOAD_MISMATCH');
  END IF;
  IF v_approval.status<>'approved' OR v_approval.approver_session_id IS NULL OR v_approval.checker_actor_id=v_approval.maker_actor_id THEN
    RETURN jsonb_build_object('accepted',false,'code','INDEPENDENT_APPROVAL_REQUIRED');
  END IF;
  v_checker:=public.console_session_state_v1(v_approval.approver_session_id,
    (SELECT metadata->>'cookie_sha256' FROM public.sessions_v2 WHERE id=v_approval.approver_session_id));
  IF NOT coalesce((v_checker->>'accepted')::boolean,false) OR NOT coalesce((v_checker->>'is_super_admin')::boolean,false)
    OR (v_checker->>'actor_id')::uuid IS DISTINCT FROM v_approval.checker_actor_id THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');
  END IF;
  IF v_approval.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('accepted',true,'result',v_approval.result||'{"replayed":true}'::jsonb);
  END IF;
  SELECT * INTO v_site FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
  IF v_approval.expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED');
  END IF;
  IF v_site.status IS DISTINCT FROM v_approval.payload->>'expected_status'
    OR v_site.updated_at IS DISTINCT FROM (v_approval.payload->>'expected_updated_at')::timestamptz THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');
  END IF;
  v_next:=CASE WHEN p_action='suspend' THEN 'suspended' ELSE 'published' END;
  UPDATE public.sites SET status=v_next,published=(v_next='published'),updated_by=v_approval.maker_actor_id,updated_at=clock_timestamp() WHERE id=p_site_id;
  SELECT jsonb_build_object('id',id,'name',name,'store_name',store_name,'subdomain',subdomain,'custom_domain',custom_domain,
    'status',status,'published',published,'updated_at',updated_at) INTO v_result FROM public.sites WHERE id=p_site_id;
  v_result:=jsonb_build_object('site',v_result,'approval_id',p_id,'publication_protocol','site-publication-v1','replayed',false);
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
    VALUES(v_approval.maker_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
      v_state->>'email',v_approval.action,'site',p_site_id,jsonb_build_object('reason',v_approval.reason,'old_status',v_site.status,
        'new_status',v_next,'approval_id',p_id,'secondary_approver_id',v_approval.checker_actor_id,'payload_hash',v_approval.payload_hash));
  UPDATE public.sensitive_action_approvals SET consumed_at=clock_timestamp(),result=v_result,updated_by=v_approval.maker_actor_id WHERE id=p_id;
  UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
    WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
  RETURN jsonb_build_object('accepted',true,'result',v_result);
END $function$;
REVOKE ALL ON FUNCTION public.console_trust_reinstatement_context_v1(uuid),
 public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb),
 public.execute_console_trust_reinstatement_v1(uuid,text,text,uuid,uuid,text,jsonb),
 public.enforce_console_trust_site_v1(uuid,text,text,uuid,text,text,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.console_trust_reinstatement_context_v1(uuid),
 public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb),
 public.execute_console_trust_reinstatement_v1(uuid,text,text,uuid,uuid,text,jsonb),
 public.enforce_console_trust_site_v1(uuid,text,text,uuid,text,text,uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
