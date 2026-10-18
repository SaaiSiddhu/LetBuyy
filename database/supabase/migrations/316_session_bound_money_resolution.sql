-- N1.6: money-break review uses the existing approval/session/ledger owners.
-- No ledger adjustment or provider movement is performed by an acknowledgement.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:316:money-approval',0));
DO $precondition$ BEGIN
  IF to_regprocedure('public.console_permission_snapshot_v1(uuid,text,boolean)') IS NULL
    OR to_regprocedure('public.decide_console_approval_v1(uuid,text,uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION '316 requires the canonical session-bound approval protocol315';
  END IF;
END $precondition$;

CREATE OR REPLACE FUNCTION public.create_console_money_approval_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
  p_site_id uuid,p_reason text,p_request_key uuid,p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb; v_state jsonb; v_approval public.sensitive_action_approvals%ROWTYPE;
 v_row public.money_ledger_site_reconciliations%ROWTYPE; v_payload jsonb; v_details jsonb; v_ref uuid;
BEGIN
  v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
  IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
  IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
    RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');
  END IF;
  v_state:=v_permission->'session';
  IF p_site_id IS NULL OR p_request_key IS NULL OR p_reason IS NULL OR length(btrim(p_reason))<8 OR length(btrim(p_reason))>1000
    OR p_details IS NULL OR jsonb_typeof(p_details)<>'object'
    OR (p_details-'resolution'-'provider_reference'-'suspense_ledger_transaction_id')<>'{}'::jsonb
    OR coalesce(p_details->>'resolution','') NOT IN ('acknowledge_suspense','provider_explained','request_recheck')
    OR jsonb_typeof(p_details->'provider_reference') NOT IN ('string','null')
    OR length(coalesce(p_details->>'provider_reference',''))>160
    OR (p_details->>'suspense_ledger_transaction_id' IS NOT NULL
      AND (p_details->>'suspense_ledger_transaction_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');
  END IF;
  v_ref:=(p_details->>'suspense_ledger_transaction_id')::uuid;
  v_details:=jsonb_build_object('resolution',p_details->>'resolution','provider_reference',nullif(btrim(p_details->>'provider_reference'),''),
    'suspense_ledger_transaction_id',v_ref);
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:approval-request:'||(v_state->>'actor_id')||':'||p_request_key::text,0));
  SELECT * INTO v_approval FROM public.sensitive_action_approvals a WHERE a.protocol_version=1
    AND a.maker_actor_id=(v_state->>'actor_id')::uuid AND a.action='money.reconciliation.resolve'
    AND a.resource_type='money_ledger_site_reconciliation' AND a.resource_id=p_site_id::text AND a.request_key=p_request_key;
  IF FOUND THEN
    IF v_approval.requester_session_id<>p_session_id OR v_approval.reason<>btrim(p_reason)
      OR v_approval.payload->'details' IS DISTINCT FROM v_details THEN
      RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_approval.id),'replayed',true);
  END IF;
  PERFORM id FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
  SELECT * INTO v_row FROM public.money_ledger_site_reconciliations WHERE site_id=p_site_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
  IF v_row.status<>'mismatch' OR v_row.variance_minor=0 THEN
    RETURN jsonb_build_object('accepted',false,'code','MONEY_RECONCILIATION_ALREADY_VERIFIED');
  END IF;
  IF v_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_transactions t WHERE t.id=v_ref AND t.site_id=p_site_id AND t.deleted_at IS NULL) THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EVIDENCE_MISMATCH');
  END IF;
  v_payload:=jsonb_build_object('details',v_details,'reason',btrim(p_reason),'expected_status',v_row.status,
    'expected_updated_at',v_row.updated_at,'wallet_available_minor',v_row.wallet_available_minor,
    'ledger_merchant_payable_minor',v_row.ledger_merchant_payable_minor,'variance_minor',v_row.variance_minor,
    'expected_verified_at',v_row.verified_at);
  INSERT INTO public.sensitive_action_approvals(site_id,action,resource_type,resource_id,maker_actor_id,status,reason,
    protocol_version,requester_session_id,request_key,payload,payload_hash,expires_at,created_by)
  VALUES(p_site_id,'money.reconciliation.resolve','money_ledger_site_reconciliation',p_site_id::text,(v_state->>'actor_id')::uuid,'pending',btrim(p_reason),
    1,p_session_id,p_request_key,v_payload,public.console_approval_payload_hash_v1('money.reconciliation.resolve',p_site_id,'money_ledger_site_reconciliation',p_site_id::text,v_payload),
    least(clock_timestamp()+interval '10 minutes',(v_state->>'expires_at')::timestamptz,(v_state->>'mfa_verified_at')::timestamptz+interval '10 minutes'),
    (v_state->>'actor_id')::uuid) RETURNING * INTO v_approval;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
  VALUES(v_approval.maker_actor_id,'employee',v_state->>'email','sensitive_action.requested','sensitive_action_approval',v_approval.id,
    jsonb_build_object('action',v_approval.action,'site_id',p_site_id,'payload_hash',v_approval.payload_hash,'requester_session_id',p_session_id));
  UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
    WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
  RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_approval.id),'replayed',false);
END $function$;

CREATE OR REPLACE FUNCTION public.execute_console_money_resolution_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
  p_id uuid,p_site_id uuid,p_reason text,p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_approval public.sensitive_action_approvals%ROWTYPE; v_permission jsonb; v_state jsonb; v_checker jsonb;
 v_row public.money_ledger_site_reconciliations%ROWTYPE; v_ref uuid; v_resolution jsonb; v_result jsonb; v_action text;
BEGIN
  SELECT * INTO v_approval FROM public.sensitive_action_approvals WHERE id=p_id AND protocol_version=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_NOT_FOUND'); END IF;
  PERFORM id FROM public.sessions_v2 WHERE id=ANY(ARRAY[p_session_id,v_approval.approver_session_id]) ORDER BY id FOR UPDATE;
  v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
  IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
  IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED'); END IF;
  v_state:=v_permission->'session';
  IF v_approval.maker_actor_id<>(v_state->>'actor_id')::uuid OR v_approval.requester_session_id<>p_session_id THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_REQUESTER_MISMATCH');
  END IF;
  IF v_approval.site_id IS DISTINCT FROM p_site_id OR v_approval.resource_id<>p_site_id::text
    OR v_approval.action<>'money.reconciliation.resolve' OR v_approval.resource_type<>'money_ledger_site_reconciliation'
    OR v_approval.reason IS DISTINCT FROM btrim(p_reason) OR v_approval.payload->'details' IS DISTINCT FROM p_details
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
  IF v_approval.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('accepted',true,'result',v_approval.result||'{"replayed":true}'::jsonb); END IF;
  PERFORM id FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
  SELECT * INTO v_row FROM public.money_ledger_site_reconciliations WHERE site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
  IF v_approval.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EXPIRED_OR_REVOKED'); END IF;
  IF v_row.status IS DISTINCT FROM v_approval.payload->>'expected_status'
    OR v_row.updated_at IS DISTINCT FROM (v_approval.payload->>'expected_updated_at')::timestamptz
    OR v_row.wallet_available_minor IS DISTINCT FROM (v_approval.payload->>'wallet_available_minor')::bigint
    OR v_row.ledger_merchant_payable_minor IS DISTINCT FROM (v_approval.payload->>'ledger_merchant_payable_minor')::bigint
    OR v_row.variance_minor IS DISTINCT FROM (v_approval.payload->>'variance_minor')::bigint
    OR v_row.verified_at IS DISTINCT FROM (v_approval.payload->>'expected_verified_at')::timestamptz
    OR v_row.status<>'mismatch' OR v_row.variance_minor=0 THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');
  END IF;
  v_ref:=(p_details->>'suspense_ledger_transaction_id')::uuid;
  IF v_ref IS NOT NULL THEN
    PERFORM id FROM public.ledger_transactions WHERE id=v_ref AND site_id=p_site_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_EVIDENCE_MISMATCH'); END IF;
  END IF;
  v_resolution:=p_details||jsonb_build_object('reason',v_approval.reason,'actor_id',v_approval.maker_actor_id,'actor_email',v_state->>'email',
    'secondary_approver_id',v_approval.checker_actor_id,'approval_id',p_id,'variance_minor',v_row.variance_minor,
    'resolved_at',clock_timestamp(),'source','admin-web');
  IF p_details->>'resolution'='request_recheck' THEN
    PERFORM public.refresh_money_ledger_site_reconciliation(p_site_id);
  END IF;
  UPDATE public.money_ledger_site_reconciliations SET metadata=metadata||jsonb_build_object('operator_resolution',v_resolution),
    updated_by=v_approval.maker_actor_id,updated_at=clock_timestamp() WHERE site_id=p_site_id;
  SELECT to_jsonb(r) INTO v_result FROM public.money_ledger_site_reconciliations r WHERE site_id=p_site_id;
  v_result:=jsonb_build_object('reconciliation',v_result,'resolution',v_resolution,'approval_id',p_id,'replayed',false);
  v_action:=CASE WHEN p_details->>'resolution'='request_recheck' THEN 'money_ledger.reconciliation.recheck_requested' ELSE 'money_ledger.breaks.resolve' END;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
  VALUES(v_approval.maker_actor_id,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,v_state->>'email',
    v_action,'money_ledger_site_reconciliation',p_site_id,jsonb_build_object('reason',v_approval.reason,'resolution',v_resolution,
      'status_before',v_row.status,'variance_before_minor',v_row.variance_minor,'payload_hash',v_approval.payload_hash));
  UPDATE public.sensitive_action_approvals SET consumed_at=clock_timestamp(),result=v_result,updated_by=v_approval.maker_actor_id WHERE id=p_id;
  UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
    WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
  RETURN jsonb_build_object('accepted',true,'result',v_result);
END $function$;
REVOKE ALL ON FUNCTION public.create_console_money_approval_v1(uuid,text,text,uuid,text,uuid,jsonb),
  public.execute_console_money_resolution_v1(uuid,text,text,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.create_console_money_approval_v1(uuid,text,text,uuid,text,uuid,jsonb),
  public.execute_console_money_resolution_v1(uuid,text,text,uuid,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
