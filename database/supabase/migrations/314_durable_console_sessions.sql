-- N1.6: bind the existing signed Console cookie to the canonical identity/session
-- owners. No new issuer, auth store, merchant cutover or browser token is added.
-- These invoker RPCs are callable only by the trusted Gateway database role.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:314:console-sessions',0));

CREATE OR REPLACE FUNCTION public.resolve_console_operator_v1(p_email text,p_actor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_user public.users_custom%ROWTYPE; v_count integer; v_super boolean;
BEGIN
  SELECT count(*) INTO v_count FROM public.users_custom WHERE lower(email)=lower(p_email) AND email_verified=true;
  IF v_count<>1 THEN RETURN jsonb_build_object('accepted',false,'code','CONSOLE_IDENTITY_REQUIRED'); END IF;
  SELECT * INTO v_user FROM public.users_custom WHERE lower(email)=lower(p_email) AND email_verified=true;
  IF p_actor_id IS NOT NULL AND p_actor_id<>v_user.id THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_IDENTITY_MISMATCH');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.super_admin_allowlist a WHERE a.is_active=true
    AND lower(a.email)=lower(v_user.email) AND (a.user_id=v_user.id OR a.user_id IS NULL)) INTO v_super;
  IF NOT v_super AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=v_user.id
    AND e.store_id IS NULL AND e.status='active' AND e.is_active=true AND e.deleted_at IS NULL) THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_ACCESS_REVOKED');
  END IF;
  RETURN jsonb_build_object('accepted',true,'actor_id',v_user.id,'email',lower(v_user.email),'is_super_admin',v_super);
END $function$;

CREATE OR REPLACE FUNCTION public.console_session_state_v1(p_session_id uuid,p_cookie_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_session public.sessions_v2%ROWTYPE; v_principal public.principals%ROWTYPE; v_identity jsonb;
BEGIN
  SELECT * INTO v_session FROM public.sessions_v2 WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.realm<>'admin' OR v_session.site_id IS NOT NULL OR v_session.deleted_at IS NOT NULL
    OR v_session.metadata->>'protocol' IS DISTINCT FROM 'platform-console-v1'
    OR v_session.metadata->>'cookie_sha256' IS DISTINCT FROM p_cookie_sha256
    OR p_cookie_sha256 IS NULL OR p_cookie_sha256 !~ '^[0-9a-f]{64}$'
    OR v_session.sid IS DISTINCT FROM p_session_id::text OR v_session.status<>'active'
    OR v_session.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');
  END IF;
  SELECT * INTO v_principal FROM public.principals WHERE id=v_session.principal_id;
  IF v_session.absolute_expires_at<=clock_timestamp()
    OR (v_session.idle_expires_at IS NOT NULL AND v_session.idle_expires_at<=clock_timestamp()) THEN
    UPDATE public.sessions_v2 SET status='expired',revoke_reason='expired' WHERE id=v_session.id;
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_EXPIRED');
  END IF;
  IF v_principal.realm<>'admin' OR v_principal.status<>'active' OR v_principal.deleted_at IS NOT NULL
    OR v_principal.legacy_user_id IS NULL THEN
    UPDATE public.sessions_v2 SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='principal_revoked' WHERE id=v_session.id;
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_ACCESS_REVOKED');
  END IF;
  v_identity:=public.resolve_console_operator_v1(v_principal.email,v_principal.legacy_user_id);
  IF NOT coalesce((v_identity->>'accepted')::boolean,false) THEN
    UPDATE public.sessions_v2 SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='membership_revoked' WHERE id=v_session.id;
    RETURN v_identity;
  END IF;
  RETURN v_identity || jsonb_build_object('session_id',v_session.id,
    'mfa_verified',v_session.metadata->>'mfa_verified_at' IS NOT NULL,
    'mfa_verified_at',v_session.metadata->'mfa_verified_at',
    'expires_at',v_session.absolute_expires_at);
END $function$;

CREATE OR REPLACE FUNCTION public.transition_console_session_v1(
  p_operation text,p_session_id uuid,p_cookie_sha256 text,p_email text,p_actor_id uuid,
  p_issued_at timestamptz,p_expires_at timestamptz,p_mfa_verified_at timestamptz,
  p_previous_session_id uuid DEFAULT NULL,p_previous_cookie_sha256 text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_identity jsonb; v_state jsonb; v_principal public.principals%ROWTYPE; v_count integer;
  v_existing public.sessions_v2%ROWTYPE; v_actor uuid;
BEGIN
  IF p_operation NOT IN ('register','validate','revoke') OR p_operation IS NULL THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_OPERATION_INVALID');
  END IF;
  IF p_operation<>'register' THEN
    v_state:=public.console_session_state_v1(p_session_id,p_cookie_sha256);
    IF NOT coalesce((v_state->>'accepted')::boolean,false) THEN RETURN v_state; END IF;
    IF p_operation='revoke' THEN
      UPDATE public.sessions_v2 SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='logout' WHERE id=p_session_id;
      INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
        VALUES((v_state->>'actor_id')::uuid,CASE WHEN (v_state->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,v_state->>'email','platform_console_session.revoked',
          'platform_console_session',p_session_id,'{"reason":"logout"}'::jsonb);
    END IF;
    RETURN v_state;
  END IF;
  IF p_session_id IS NULL OR p_cookie_sha256 IS NULL OR p_cookie_sha256 !~ '^[0-9a-f]{64}$'
    OR p_issued_at IS NULL OR p_expires_at IS NULL OR p_expires_at<=p_issued_at
    OR p_expires_at>p_issued_at+interval '8 hours' OR p_issued_at>clock_timestamp()+interval '30 seconds'
    OR p_expires_at<=clock_timestamp() OR (p_mfa_verified_at IS NOT NULL
      AND (p_mfa_verified_at<p_issued_at OR p_mfa_verified_at>=p_expires_at OR p_mfa_verified_at>clock_timestamp()+interval '30 seconds')) THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');
  END IF;
  v_identity:=public.resolve_console_operator_v1(p_email,p_actor_id);
  IF NOT coalesce((v_identity->>'accepted')::boolean,false) THEN RETURN v_identity; END IF;
  v_actor:=(v_identity->>'actor_id')::uuid;
  -- A single ordering covers concurrent first login, MFA rotation and registration retry.
  PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||v_actor::text,0));
  SELECT * INTO v_existing FROM public.sessions_v2 WHERE id=p_session_id FOR UPDATE;
  IF FOUND THEN RETURN public.console_session_state_v1(p_session_id,p_cookie_sha256); END IF;
  -- Canonical principal deletion may cascade its sessions. An immutable audit
  -- receipt still prevents re-registering a previously issued cookie identity.
  IF EXISTS(SELECT 1 FROM public.audit_logs WHERE resource_id=p_session_id
    AND action='platform_console_session.registered' AND resource_type='platform_console_session') THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');
  END IF;
  IF p_issued_at<clock_timestamp()-interval '60 seconds' THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_REGISTRATION_EXPIRED');
  END IF;
  IF p_mfa_verified_at IS NOT NULL THEN
    v_state:=public.console_session_state_v1(p_previous_session_id,p_previous_cookie_sha256);
    IF NOT coalesce((v_state->>'accepted')::boolean,false) OR v_state->>'actor_id'<>v_actor::text
      OR p_previous_session_id=p_session_id THEN
      RETURN jsonb_build_object('accepted',false,'code','CONSOLE_PREVIOUS_SESSION_REQUIRED');
    END IF;
  ELSIF p_previous_session_id IS NOT NULL OR p_previous_cookie_sha256 IS NOT NULL THEN
    RETURN jsonb_build_object('accepted',false,'code','CONSOLE_SESSION_INVALID');
  END IF;
  SELECT count(*) INTO v_count FROM public.principals WHERE realm='admin' AND legacy_user_id=v_actor AND deleted_at IS NULL;
  IF v_count>1 THEN RETURN jsonb_build_object('accepted',false,'code','CONSOLE_PRINCIPAL_AMBIGUOUS'); END IF;
  IF v_count=0 THEN
    INSERT INTO public.principals(realm,actor_type,legacy_user_id,email,status,metadata)
      VALUES('admin','platform-operator',v_actor,v_identity->>'email','active','{"source":"platform-console-v1"}'::jsonb)
      RETURNING * INTO v_principal;
    INSERT INTO public.account_links(principal_id,realm,provider,provider_subject)
      VALUES(v_principal.id,'admin','users_custom',v_actor::text);
  ELSE
    SELECT * INTO v_principal FROM public.principals WHERE realm='admin' AND legacy_user_id=v_actor AND deleted_at IS NULL FOR UPDATE;
    IF v_principal.status<>'active' OR lower(v_principal.email) IS DISTINCT FROM v_identity->>'email' THEN
      RETURN jsonb_build_object('accepted',false,'code','CONSOLE_ACCESS_REVOKED');
    END IF;
  END IF;
  INSERT INTO public.sessions_v2(id,principal_id,realm,sid,status,issued_at,absolute_expires_at,metadata)
    VALUES(p_session_id,v_principal.id,'admin',p_session_id::text,'active',p_issued_at,p_expires_at,
      jsonb_build_object('protocol','platform-console-v1','cookie_sha256',p_cookie_sha256,'mfa_verified_at',p_mfa_verified_at));
  IF p_previous_session_id IS NOT NULL THEN
    UPDATE public.sessions_v2 SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='mfa_rotation' WHERE id=p_previous_session_id;
  END IF;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
    VALUES(v_actor,CASE WHEN (v_identity->>'is_super_admin')::boolean THEN 'super_admin' ELSE 'employee' END,
      v_identity->>'email','platform_console_session.registered','platform_console_session',p_session_id,
      jsonb_build_object('mfa_verified',p_mfa_verified_at IS NOT NULL,'previous_session_id',p_previous_session_id));
  RETURN public.console_session_state_v1(p_session_id,p_cookie_sha256);
END $function$;

-- A removal/downgrade permanently revokes existing cookies, even if the
-- membership is later restored before that cookie is presented again.
CREATE OR REPLACE FUNCTION public.revoke_console_membership_sessions_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
BEGIN
  IF TG_TABLE_NAME='employees' THEN
    IF OLD.store_id IS NOT NULL THEN RETURN OLD; END IF;
  END IF;
  UPDATE public.sessions_v2 s SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='membership_changed'
    FROM public.principals p WHERE p.id=s.principal_id AND p.realm='admin' AND s.realm='admin' AND s.site_id IS NULL
      AND s.status='active' AND s.metadata->>'protocol'='platform-console-v1'
      AND ((OLD.user_id IS NOT NULL AND p.legacy_user_id=OLD.user_id) OR lower(p.email)=lower(OLD.email));
  RETURN OLD;
END $function$;
DROP TRIGGER IF EXISTS console_allowlist_session_revocation_v1 ON public.super_admin_allowlist;
CREATE TRIGGER console_allowlist_session_revocation_v1 AFTER DELETE OR UPDATE OF is_active,user_id,email
  ON public.super_admin_allowlist FOR EACH ROW EXECUTE FUNCTION public.revoke_console_membership_sessions_v1();
DROP TRIGGER IF EXISTS console_staff_session_revocation_v1 ON public.employees;
CREATE TRIGGER console_staff_session_revocation_v1 AFTER DELETE OR UPDATE OF user_id,email,store_id,role,role_id,permissions,is_active,status,deleted_at
  ON public.employees FOR EACH ROW EXECUTE FUNCTION public.revoke_console_membership_sessions_v1();

-- This narrow trigger must also work when a self-service identity writer has
-- no right to update global admin sessions. It never grants authority: only
-- sessions of the actual OLD principal/user row can be revoked.
CREATE OR REPLACE FUNCTION public.revoke_console_identity_sessions_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
BEGIN
  WITH revoked AS (
    UPDATE public.sessions_v2 s SET status='revoked',revoked_at=clock_timestamp(),revoke_reason='identity_changed'
      WHERE s.realm='admin' AND s.site_id IS NULL AND s.status='active'
        AND s.metadata->>'protocol'='platform-console-v1'
        AND ((TG_TABLE_NAME='principals' AND s.principal_id=OLD.id)
          OR (TG_TABLE_NAME='users_custom' AND EXISTS(SELECT 1 FROM public.principals p
            WHERE p.id=s.principal_id AND p.realm='admin' AND p.legacy_user_id=OLD.id)))
      RETURNING s.id
  )
  INSERT INTO public.audit_logs(actor_type,action,resource_type,resource_id,metadata)
    SELECT 'system','platform_console_session.revoked','platform_console_session',id,
      jsonb_build_object('reason','identity_changed','source',TG_TABLE_NAME) FROM revoked;
  RETURN OLD;
END $function$;
DROP TRIGGER IF EXISTS console_principal_session_revocation_v1 ON public.principals;
CREATE TRIGGER console_principal_session_revocation_v1 AFTER DELETE OR UPDATE OF realm,legacy_user_id,email,status,deleted_at
  ON public.principals FOR EACH ROW EXECUTE FUNCTION public.revoke_console_identity_sessions_v1();
DROP TRIGGER IF EXISTS console_identity_session_revocation_v1 ON public.users_custom;
CREATE TRIGGER console_identity_session_revocation_v1 AFTER DELETE OR UPDATE OF email,email_verified
  ON public.users_custom FOR EACH ROW EXECUTE FUNCTION public.revoke_console_identity_sessions_v1();

REVOKE ALL ON FUNCTION public.resolve_console_operator_v1(text,uuid),public.console_session_state_v1(uuid,text),
  public.transition_console_session_v1(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text),
  public.revoke_console_membership_sessions_v1(),public.revoke_console_identity_sessions_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.resolve_console_operator_v1(text,uuid),public.console_session_state_v1(uuid,text),
  public.transition_console_session_v1(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text),
  public.revoke_console_membership_sessions_v1(),public.revoke_console_identity_sessions_v1() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
