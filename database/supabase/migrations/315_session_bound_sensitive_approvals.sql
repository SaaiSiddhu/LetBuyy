-- N1.6: extend the canonical approval owner, never a parallel approval store.
-- Gateway evaluates the canonical TS permission resolver on an atomic source
-- snapshot; its private witness is checked again under session locks. Permission
-- changes revoke the affected Console sessions in the same DB transaction.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:315:sensitive-approvals',0));
DO $precondition$ BEGIN
  IF to_regprocedure('public.create_console_trust_approval_v1(uuid,text,text,uuid,text,uuid,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION '315 refuses later trust/publication schema; reapply canonical migration318';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='313'
    AND object_signature='public.sensitive_action_approvals' AND privilege='TABLE PRIVILEGE FENCE') THEN
    RAISE EXCEPTION '315 requires the canonical approval privilege fence';
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','app_tenant']) r
    WHERE has_table_privilege(r,'public.sensitive_action_approvals','SELECT,INSERT,UPDATE,DELETE')
      OR has_any_column_privilege(r,'public.sensitive_action_approvals','SELECT,INSERT,UPDATE,REFERENCES')) THEN
    RAISE EXCEPTION '315 refuses ordinary-role approval authority';
  END IF;
END $precondition$;

ALTER TABLE public.sensitive_action_approvals
  ADD COLUMN IF NOT EXISTS protocol_version smallint,
  ADD COLUMN IF NOT EXISTS requester_session_id uuid REFERENCES public.sessions_v2(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approver_session_id uuid REFERENCES public.sessions_v2(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS request_key uuid,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT IF EXISTS sensitive_action_approvals_action_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_action_check CHECK(action IN (
  'refund.approve','payout.release','customer.dsr.erase','merchant.suspend','merchant.restore',
  'developer.suspend','money.reconciliation.resolve','ts.reinstate','runtime.control-command'));
ALTER TABLE public.sensitive_action_approvals DROP CONSTRAINT IF EXISTS sensitive_action_approvals_protocol_v1_check;
ALTER TABLE public.sensitive_action_approvals ADD CONSTRAINT sensitive_action_approvals_protocol_v1_check CHECK(
  protocol_version IS NULL OR (protocol_version=1 AND maker_actor_id IS NOT NULL AND requester_session_id IS NOT NULL
    AND request_key IS NOT NULL AND payload IS NOT NULL AND jsonb_typeof(payload)='object'
    AND payload_hash IS NOT NULL AND payload_hash ~ '^[0-9a-f]{64}$' AND expires_at IS NOT NULL
    AND (status<>'approved' OR (checker_actor_id IS NOT NULL AND approver_session_id IS NOT NULL AND approved_at IS NOT NULL))
    AND ((consumed_at IS NULL AND result IS NULL) OR (consumed_at IS NOT NULL AND result IS NOT NULL AND status='approved'))));
CREATE UNIQUE INDEX IF NOT EXISTS sensitive_action_approvals_request_v1_idx
  ON public.sensitive_action_approvals(maker_actor_id,action,resource_type,resource_id,request_key) WHERE protocol_version=1;

CREATE OR REPLACE FUNCTION public.console_permission_snapshot_v1(p_session_id uuid,p_cookie_sha256 text,p_step_up boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_state jsonb; v_employee public.employees%ROWTYPE; v_count integer; v_input jsonb;
BEGIN
  v_state:=public.console_session_state_v1(p_session_id,p_cookie_sha256);
  IF NOT coalesce((v_state->>'accepted')::boolean,false) THEN RETURN v_state; END IF;
  -- Match the existing sensitive-action step-up window (security-controls.ts).
  IF NOT coalesce((v_state->>'mfa_verified')::boolean,false) OR (p_step_up AND
    (v_state->>'mfa_verified_at')::timestamptz<clock_timestamp()-interval '10 minutes') THEN
    RETURN jsonb_build_object('accepted',false,'code','STEP_UP_REQUIRED');
  END IF;
  SELECT count(*) INTO v_count FROM public.employees e WHERE e.user_id=(v_state->>'actor_id')::uuid
    AND e.store_id IS NULL AND e.status='active' AND e.is_active=true AND e.deleted_at IS NULL;
  IF v_count>1 THEN RETURN jsonb_build_object('accepted',false,'code','CONSOLE_MEMBERSHIP_AMBIGUOUS'); END IF;
  SELECT * INTO v_employee FROM public.employees e WHERE e.user_id=(v_state->>'actor_id')::uuid
    AND e.store_id IS NULL AND e.status='active' AND e.is_active=true AND e.deleted_at IS NULL;
  v_input:=jsonb_build_object('role',v_employee.role,'inlinePermissions',v_employee.permissions,
    'employeeId',v_employee.id,'isSuperAdmin',(v_state->>'is_super_admin')::boolean,
    'rolePermissionRows',coalesce((SELECT jsonb_agg(jsonb_build_object('permission',p.permission) ORDER BY p.id)
      FROM public.employee_permissions p WHERE p.role=v_employee.role),'[]'::jsonb),
    'employeeRolePermissions',coalesce((SELECT r.permissions FROM public.employee_roles r WHERE r.id=v_employee.role_id),'[]'::jsonb),
    'breakGlassGrants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'scope',g.scope,'expires_at',g.expires_at,
      'revoked_at',g.revoked_at,'deleted_at',g.deleted_at) ORDER BY g.id) FROM public.break_glass_grants g
      WHERE g.employee_id=v_employee.id AND g.expires_at>clock_timestamp() AND g.revoked_at IS NULL AND g.deleted_at IS NULL),'[]'::jsonb));
  RETURN jsonb_build_object('accepted',true,'session',v_state,'input',v_input,
    'evidence_hash',encode(sha256(convert_to(v_input::text,'UTF8')),'hex'));
END $function$;

CREATE OR REPLACE FUNCTION public.revoke_console_permission_sessions_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_old jsonb:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb:=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
BEGIN
  WITH revoked AS (
    UPDATE public.sessions_v2 s SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='permission_changed'
    FROM public.principals p WHERE p.id=s.principal_id AND p.realm='admin' AND s.realm='admin' AND s.site_id IS NULL
      AND s.status='active' AND s.metadata->>'protocol'='platform-console-v1'
      AND EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=p.legacy_user_id AND e.store_id IS NULL
        AND ((TG_TABLE_NAME='employee_permissions' AND e.role=ANY(ARRAY[v_old->>'role',v_new->>'role']))
          OR (TG_TABLE_NAME='employee_roles' AND e.role_id::text=ANY(ARRAY[v_old->>'id',v_new->>'id']))
          OR (TG_TABLE_NAME='break_glass_grants' AND e.id::text=ANY(ARRAY[v_old->>'employee_id',v_new->>'employee_id']))))
    RETURNING s.id
  ) INSERT INTO public.audit_logs(actor_type,action,resource_type,resource_id,metadata)
    SELECT 'system','platform_console_session.revoked','platform_console_session',id,
      jsonb_build_object('reason','permission_changed','source',TG_TABLE_NAME) FROM revoked;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS console_role_permission_revocation_v1 ON public.employee_permissions;
CREATE TRIGGER console_role_permission_revocation_v1 AFTER INSERT OR DELETE OR UPDATE OF role,permission
  ON public.employee_permissions FOR EACH ROW EXECUTE FUNCTION public.revoke_console_permission_sessions_v1();
DROP TRIGGER IF EXISTS console_role_definition_revocation_v1 ON public.employee_roles;
CREATE TRIGGER console_role_definition_revocation_v1 AFTER DELETE OR UPDATE OF id,permissions
  ON public.employee_roles FOR EACH ROW EXECUTE FUNCTION public.revoke_console_permission_sessions_v1();
DROP TRIGGER IF EXISTS console_break_glass_revocation_v1 ON public.break_glass_grants;
CREATE TRIGGER console_break_glass_revocation_v1 AFTER INSERT OR DELETE OR UPDATE OF employee_id,scope,expires_at,revoked_at,deleted_at
  ON public.break_glass_grants FOR EACH ROW EXECUTE FUNCTION public.revoke_console_permission_sessions_v1();

CREATE OR REPLACE FUNCTION public.console_approval_payload_hash_v1(p_action text,p_site uuid,p_resource_type text,p_resource_id text,p_payload jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
  SELECT encode(sha256(convert_to(jsonb_build_object('action',p_action,'site_id',p_site,'resource_type',p_resource_type,
    'resource_id',p_resource_id,'payload',p_payload)::text,'UTF8')),'hex');
$function$;
CREATE OR REPLACE FUNCTION public.protect_sensitive_approval_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.protocol_version=1 THEN RAISE EXCEPTION 'session-bound approvals are retained records'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.protocol_version IS NULL AND NEW.protocol_version=1 THEN
    RAISE EXCEPTION 'legacy approvals require a new session-bound request';
  END IF;
  IF TG_OP='UPDATE' AND OLD.protocol_version=1 THEN
    IF ROW(NEW.id,NEW.protocol_version,NEW.site_id,NEW.action,NEW.resource_type,NEW.resource_id,NEW.maker_actor_id,
      NEW.requester_session_id,NEW.request_key,NEW.payload,NEW.payload_hash,NEW.reason,NEW.created_at,NEW.deleted_at,NEW.deleted_by)
      IS DISTINCT FROM ROW(OLD.id,OLD.protocol_version,OLD.site_id,OLD.action,OLD.resource_type,OLD.resource_id,OLD.maker_actor_id,
      OLD.requester_session_id,OLD.request_key,OLD.payload,OLD.payload_hash,OLD.reason,OLD.created_at,OLD.deleted_at,OLD.deleted_by) THEN
      RAISE EXCEPTION 'session-bound approval intent is immutable';
    END IF;
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at AND NOT (OLD.status='pending' AND NEW.status='approved'
      AND NEW.expires_at<=OLD.expires_at AND NEW.expires_at>clock_timestamp()) THEN
      RAISE EXCEPTION 'approval expiry can only shorten on independent consent';
    END IF;
    IF OLD.consumed_at IS NOT NULL AND (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
      RAISE EXCEPTION 'consumed approval receipt is immutable';
    END IF;
    IF OLD.status<>'pending' AND ROW(NEW.status,NEW.checker_actor_id,NEW.approver_session_id,NEW.approved_at)
      IS DISTINCT FROM ROW(OLD.status,OLD.checker_actor_id,OLD.approver_session_id,OLD.approved_at) THEN
      RAISE EXCEPTION 'approval decision is immutable';
    END IF;
  END IF;
  IF NEW.protocol_version=1 THEN
    IF TG_OP='INSERT' AND (NEW.status<>'pending' OR NEW.checker_actor_id IS NOT NULL OR NEW.approver_session_id IS NOT NULL
      OR NEW.approved_at IS NOT NULL OR NEW.consumed_at IS NOT NULL OR NEW.result IS NOT NULL) THEN
      RAISE EXCEPTION 'session-bound approvals must begin pending';
    END IF;
    IF NEW.payload_hash IS DISTINCT FROM public.console_approval_payload_hash_v1(NEW.action,NEW.site_id,NEW.resource_type,NEW.resource_id,NEW.payload) THEN
      RAISE EXCEPTION 'approval payload fingerprint mismatch';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS protect_sensitive_approval_v1 ON public.sensitive_action_approvals;
CREATE TRIGGER protect_sensitive_approval_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.sensitive_action_approvals
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_approval_v1();

CREATE OR REPLACE FUNCTION public.console_approval_view_v1(p_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
  SELECT to_jsonb(a)-'metadata' FROM public.sensitive_action_approvals a WHERE a.id=p_id AND a.protocol_version=1;
$function$;

CREATE OR REPLACE FUNCTION public.create_console_approval_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,
  p_action text,p_resource_id uuid,p_reason text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb; v_state jsonb; v_approval public.sensitive_action_approvals%ROWTYPE;
  v_site public.sites%ROWTYPE; v_payload jsonb; v_hash text;
BEGIN
  v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,true);
  IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
  IF v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
    RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');
  END IF;
  v_state:=v_permission->'session';
  IF p_action NOT IN ('merchant.suspend','merchant.restore') OR p_action IS NULL OR p_resource_id IS NULL
    OR p_request_key IS NULL OR p_reason IS NULL OR length(btrim(p_reason))<8 OR length(btrim(p_reason))>1000 THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_INTENT_INVALID');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:approval-request:'||(v_state->>'actor_id')||':'||p_request_key::text,0));
  SELECT * INTO v_approval FROM public.sensitive_action_approvals a WHERE a.protocol_version=1
    AND a.maker_actor_id=(v_state->>'actor_id')::uuid AND a.action=p_action AND a.resource_type='site'
    AND a.resource_id=p_resource_id::text AND a.request_key=p_request_key;
  IF FOUND THEN
    IF v_approval.requester_session_id<>p_session_id OR v_approval.reason<>btrim(p_reason) THEN
      RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_approval.id),'replayed',true);
  END IF;
  SELECT * INTO v_site FROM public.sites WHERE id=p_resource_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_NOT_FOUND'); END IF;
  IF v_site.status IS DISTINCT FROM (CASE WHEN p_action='merchant.suspend' THEN 'published' ELSE 'suspended' END) THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_TARGET_STATE_CHANGED');
  END IF;
  v_payload:=jsonb_build_object('action',CASE WHEN p_action='merchant.suspend' THEN 'suspend' ELSE 'restore' END,
    'reason',btrim(p_reason),'expected_status',v_site.status,'expected_updated_at',v_site.updated_at);
  v_hash:=public.console_approval_payload_hash_v1(p_action,v_site.id,'site',v_site.id::text,v_payload);
  INSERT INTO public.sensitive_action_approvals(site_id,action,resource_type,resource_id,maker_actor_id,status,reason,
    protocol_version,requester_session_id,request_key,payload,payload_hash,expires_at,created_by)
    VALUES(v_site.id,p_action,'site',v_site.id::text,(v_state->>'actor_id')::uuid,'pending',btrim(p_reason),
      1,p_session_id,p_request_key,v_payload,v_hash,least(clock_timestamp()+interval '10 minutes',(v_state->>'expires_at')::timestamptz,
        (v_state->>'mfa_verified_at')::timestamptz+interval '10 minutes'),
      (v_state->>'actor_id')::uuid) RETURNING * INTO v_approval;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
    VALUES(v_approval.maker_actor_id,'employee',v_state->>'email','sensitive_action.requested','sensitive_action_approval',v_approval.id,
      jsonb_build_object('action',p_action,'site_id',v_site.id,'payload_hash',v_hash,'requester_session_id',p_session_id));
  UPDATE public.break_glass_grants SET used_at=coalesce(used_at,clock_timestamp())
    WHERE id IN (SELECT (g->>'id')::uuid FROM jsonb_array_elements(v_permission->'input'->'breakGlassGrants') g);
  RETURN jsonb_build_object('accepted',true,'approval',public.console_approval_view_v1(v_approval.id),'replayed',false);
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
END $function$;

CREATE OR REPLACE FUNCTION public.read_console_approvals_v1(p_session_id uuid,p_cookie_sha256 text,p_id uuid,p_page integer,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb; v_state jsonb; v_items jsonb; v_total bigint;
BEGIN
  v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,false);
  IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
  IF p_page IS NULL OR p_limit IS NULL OR p_page<1 OR p_page>10000 OR p_limit<1 OR p_limit>100 THEN
    RETURN jsonb_build_object('accepted',false,'code','APPROVAL_QUERY_INVALID');
  END IF;
  v_state:=v_permission->'session';
  SELECT count(*) INTO v_total FROM public.sensitive_action_approvals a WHERE a.protocol_version=1 AND (p_id IS NULL OR a.id=p_id)
    AND (a.maker_actor_id=(v_state->>'actor_id')::uuid OR a.checker_actor_id=(v_state->>'actor_id')::uuid OR (v_state->>'is_super_admin')::boolean);
  SELECT coalesce(jsonb_agg(public.console_approval_view_v1(a.id) ORDER BY a.created_at DESC,a.id DESC),'[]'::jsonb) INTO v_items FROM (
    SELECT a.id,a.created_at FROM public.sensitive_action_approvals a WHERE a.protocol_version=1 AND (p_id IS NULL OR a.id=p_id)
      AND (a.maker_actor_id=(v_state->>'actor_id')::uuid OR a.checker_actor_id=(v_state->>'actor_id')::uuid OR (v_state->>'is_super_admin')::boolean)
      ORDER BY a.created_at DESC,a.id DESC LIMIT p_limit OFFSET ((p_page-1)*p_limit)) a;
  RETURN jsonb_build_object('accepted',true,'items',v_items,'total',v_total,'page',p_page,'limit',p_limit,'has_next',p_page::bigint*p_limit<v_total);
END $function$;

REVOKE ALL ON FUNCTION public.console_permission_snapshot_v1(uuid,text,boolean),public.revoke_console_permission_sessions_v1(),
 public.console_approval_payload_hash_v1(text,uuid,text,text,jsonb),public.protect_sensitive_approval_v1(),public.console_approval_view_v1(uuid),
 public.create_console_approval_v1(uuid,text,text,text,uuid,text,uuid),public.decide_console_approval_v1(uuid,text,uuid,text,text),
 public.execute_console_merchant_moderation_v1(uuid,text,text,uuid,uuid,text,text),public.read_console_approvals_v1(uuid,text,uuid,integer,integer)
 FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.console_permission_snapshot_v1(uuid,text,boolean),public.revoke_console_permission_sessions_v1(),
 public.console_approval_payload_hash_v1(text,uuid,text,text,jsonb),public.protect_sensitive_approval_v1(),public.console_approval_view_v1(uuid),
 public.create_console_approval_v1(uuid,text,text,text,uuid,text,uuid),public.decide_console_approval_v1(uuid,text,uuid,text,text),
 public.execute_console_merchant_moderation_v1(uuid,text,text,uuid,uuid,text,text),public.read_console_approvals_v1(uuid,text,uuid,integer,integer)
 TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
