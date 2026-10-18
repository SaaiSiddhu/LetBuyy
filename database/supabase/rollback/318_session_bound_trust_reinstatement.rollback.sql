BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('execute_console_merchant_moderation_v1', 'public.execute_console_merchant_moderation_v1(uuid,text,text,uuid,uuid,text,text)', ARRAY['p_session_id','p_cookie_sha256','p_permission_hash','p_id','p_site_id','p_action','p_reason']::text[], 'jsonb', false, 1)
  ) AS expected(name, signature, input_names, result_type, returns_set, overloads)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 318 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 318 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:318:trust-approval',0));
DO $retention$ BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='319') THEN RAISE EXCEPTION 'reverse migration319 before earlier trust rollback'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sensitive_action_approvals'::regclass AND attname='protocol_version' AND NOT attisdropped) THEN
  IF EXISTS(SELECT 1 FROM public.sensitive_action_approvals WHERE protocol_version=1 AND (action='ts.reinstate' OR result->>'publication_protocol'='site-publication-v1')) THEN
   RAISE EXCEPTION 'rollback318 refuses retained trust consent/enforcement evidence; forward recovery is required';
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.ts_takedowns'::regclass AND attname='enforcement_key' AND NOT attisdropped) THEN
  IF EXISTS(SELECT 1 FROM public.ts_takedowns WHERE enforcement_key IS NOT NULL) THEN
   RAISE EXCEPTION 'rollback318 refuses retained trust consent/enforcement evidence; forward recovery is required';
  END IF;
 END IF;
END $retention$;
DROP FUNCTION IF EXISTS public.enforce_console_trust_site_v1(uuid,text,text,uuid,text,text,uuid,jsonb,boolean);
DROP FUNCTION IF EXISTS public.execute_console_trust_reinstatement_v1(uuid,text,text,uuid,uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb);
DROP FUNCTION IF EXISTS public.console_trust_reinstatement_context_v1(uuid);
-- Restore the exact canonical315 predecessor function; no receipt or row is rewritten.
DO $restore$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sensitive_action_approvals'::regclass AND attname='protocol_version' AND NOT attisdropped) THEN
  EXECUTE $predecessor$CREATE OR REPLACE FUNCTION public.execute_console_merchant_moderation_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
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
  UPDATE public.sites SET status=v_next,updated_by=v_approval.maker_actor_id,updated_at=clock_timestamp() WHERE id=p_site_id;
  SELECT jsonb_build_object('id',id,'name',name,'store_name',store_name,'subdomain',subdomain,'custom_domain',custom_domain,
    'status',status,'updated_at',updated_at) INTO v_result FROM public.sites WHERE id=p_site_id;
  v_result:=jsonb_build_object('site',v_result,'approval_id',p_id,'replayed',false);
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
    VALUES(v_approval.maker_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
      v_state->>'email',v_approval.action,'site',p_site_id,jsonb_build_object('reason',v_approval.reason,'old_status',v_site.status,
        'new_status',v_next,'approval_id',p_id,'secondary_approver_id',v_approval.checker_actor_id,'payload_hash',v_approval.payload_hash));
  UPDATE public.sensitive_action_approvals SET consumed_at=clock_timestamp(),result=v_result,updated_by=v_approval.maker_actor_id WHERE id=p_id;
  UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
    WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
  RETURN jsonb_build_object('accepted',true,'result',v_result);
END $function$;$predecessor$;
 END IF;
END $restore$;
NOTIFY pgrst,'reload schema';
COMMIT;
