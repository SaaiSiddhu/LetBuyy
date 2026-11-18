-- Accounts first-party native authorization, using the canonical sessions table.
-- Request/code/JTI consumption and session registration are one transaction.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:416:merchant-mobile',0));

-- Owner-approved source freeze: attest existing closed ACLs, with no permission
-- delta. Pattern is canonical431, limited to the two existing money definers.
DO $native418_acl$
DECLARE
  v_target record;
  v_fn record;
BEGIN
  FOR v_target IN SELECT signature, result_type FROM (VALUES
    ('public.issue_gst_invoice(uuid,uuid,text)', 'jsonb'),
    ('public.issue_gift_card(uuid,text,numeric,text,timestamp with time zone,jsonb,uuid,text,text)', 'jsonb')
  ) AS targets(signature, result_type) LOOP
    SELECT p.* INTO v_fn FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_target.signature);
    IF NOT FOUND OR NOT v_fn.prosecdef OR v_fn.prokind <> 'f'
       OR v_fn.proretset
       OR v_fn.prorettype IS DISTINCT FROM pg_catalog.to_regtype(v_target.result_type) THEN
      RAISE EXCEPTION '418 native auth ACL refuses unexpected definer function ABI: %', v_target.signature;
    END IF;
    IF pg_catalog.has_function_privilege('anon', v_fn.oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_fn.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(v_fn.proacl, pg_catalog.acldefault('f', v_fn.proowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION '418 native auth ACL refuses open Data API definer ACL: %', v_target.signature;
    END IF;
  END LOOP;
END;
$native418_acl$;
REVOKE ALL ON FUNCTION public.issue_gst_invoice(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_gift_card(uuid,text,numeric,text,timestamp with time zone,jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.merchant_2fa_factors ADD COLUMN login_last_counter bigint;
CREATE FUNCTION public.consume_merchant_login_factor(p_user_id uuid,p_factor_id uuid,p_secret_hash text,p_counter bigint,p_recovery_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f public.merchant_2fa_factors; current_counter bigint:=floor(extract(epoch FROM clock_timestamp())/30);
BEGIN
 SELECT * INTO f FROM public.merchant_2fa_factors WHERE id=p_factor_id AND custom_user_id=p_user_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR encode(extensions.digest(f.secret_ciphertext,'sha256'),'hex') IS DISTINCT FROM p_secret_hash THEN RETURN false; END IF;
 IF p_recovery_hash IS NOT NULL AND p_counter IS NULL THEN
  IF NOT(p_recovery_hash=ANY(f.recovery_code_hashes)) THEN RETURN false; END IF;
  UPDATE public.merchant_2fa_factors SET recovery_code_hashes=array_remove(recovery_code_hashes,p_recovery_hash),last_verified_at=clock_timestamp(),updated_by=p_user_id WHERE id=f.id;
 ELSIF p_counter IS NOT NULL AND p_recovery_hash IS NULL THEN
  IF p_counter<current_counter-1 OR p_counter>current_counter+1 OR p_counter<=coalesce(f.login_last_counter,-1) THEN RETURN false; END IF;
  UPDATE public.merchant_2fa_factors SET login_last_counter=p_counter,last_verified_at=clock_timestamp(),updated_by=p_user_id WHERE id=f.id;
 ELSE RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.consume_merchant_login_factor(uuid,uuid,text,bigint,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.consume_merchant_login_factor(uuid,uuid,text,bigint,text) TO service_role;

CREATE FUNCTION public.register_identity_merchant_session_v1(p_user_id uuid,p_device_id uuid,p_token text,p_jti text,p_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE session_id uuid;
BEGIN
 PERFORM 1 FROM public.users_custom WHERE id=p_user_id AND email_verified=true FOR SHARE;
 IF NOT FOUND OR p_token IS NULL OR length(p_token)<32 OR p_expires_at<=clock_timestamp()
  OR p_expires_at>clock_timestamp()+interval '30 days 30 seconds' THEN RETURN NULL; END IF;
 IF NOT public.consume_merchant_session_jti(p_jti,p_user_id,p_expires_at) THEN RETURN NULL; END IF;
 INSERT INTO public.sessions(user_id,device_id,token,expires_at) VALUES(p_user_id,p_device_id,p_token,p_expires_at) RETURNING id INTO session_id;
 RETURN jsonb_build_object('token',p_token,'expires_at',p_expires_at,'session_id',session_id);
END $$;
REVOKE ALL ON FUNCTION public.register_identity_merchant_session_v1(uuid,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.register_identity_merchant_session_v1(uuid,uuid,text,text,timestamptz) TO service_role;

CREATE TABLE public.merchant_mobile_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id text NOT NULL CHECK(client_id IN ('merchant_android','merchant_ios')),
 callback_id text NOT NULL CHECK(callback_id IN ('android_https','ios_session')),
 environment text NOT NULL CHECK(environment IN ('development','staging','production')),
 purpose text NOT NULL CHECK(purpose IN ('login','signup','create_store','switch_account','manage_security')),
 redirect_uri text NOT NULL,
 challenge text NOT NULL CHECK(challenge ~ '^[A-Za-z0-9_-]{43}$'),
 state text NOT NULL CHECK(state ~ '^[A-Za-z0-9_-]{43}$'),
 launch_hash text NOT NULL CHECK(launch_hash ~ '^[a-f0-9]{64}$'),
 management_hash text NOT NULL CHECK(management_hash ~ '^[a-f0-9]{64}$'),
 browser_hash text CHECK(browser_hash ~ '^[a-f0-9]{64}$'),
 expected_user_id uuid REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 authorized_user_id uuid REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 source_session_id uuid REFERENCES public.sessions(id) ON DELETE RESTRICT,
 approved_at timestamptz,
 code_hash text UNIQUE CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 code_expires_at timestamptz,
 consumed_at timestamptz,
 cancelled_at timestamptz,
 native_session_id uuid REFERENCES public.sessions(id) ON DELETE RESTRICT,
 site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '15 minutes'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 created_by uuid REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 updated_by uuid REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 CHECK((consumed_at IS NULL)=(native_session_id IS NULL)),
 CHECK(NOT(consumed_at IS NOT NULL AND cancelled_at IS NOT NULL))
);
CREATE INDEX merchant_mobile_requests_expiry ON public.merchant_mobile_requests(expires_at);
CREATE INDEX merchant_mobile_requests_actor ON public.merchant_mobile_requests(authorized_user_id,created_at);
ALTER TABLE public.merchant_mobile_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_mobile_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY merchant_mobile_requests_service ON public.merchant_mobile_requests TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON public.merchant_mobile_requests FROM PUBLIC,anon,authenticated,app_tenant;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.merchant_mobile_requests TO service_role;
CREATE TRIGGER merchant_mobile_requests_updated BEFORE UPDATE ON public.merchant_mobile_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Each action is called only by the narrow, signed Accounts persistence adapter.
CREATE FUNCTION public.create_merchant_mobile_request(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.merchant_mobile_requests;
BEGIN
 -- Bounded retention; codes never outlive the request, even when cleanup is delayed.
 DELETE FROM public.merchant_mobile_requests WHERE id IN (
  SELECT id FROM public.merchant_mobile_requests WHERE expires_at<now()-interval '1 day' ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED);
 INSERT INTO public.merchant_mobile_requests(id,client_id,callback_id,environment,purpose,redirect_uri,challenge,state,launch_hash,management_hash,expected_user_id,created_by)
 VALUES((p_input->>'id')::uuid,p_input->>'clientId',p_input->>'callbackId',p_input->>'environment',p_input->>'purpose',p_input->>'redirectUri',p_input->>'challenge',p_input->>'state',p_input->>'launchHash',p_input->>'managementHash',(p_input->>'expectedUserId')::uuid,(p_input->>'expectedUserId')::uuid) RETURNING * INTO r;
 RETURN jsonb_build_object('requestId',r.id,'expiresAt',r.expires_at);
END $$;

CREATE FUNCTION public.bind_merchant_mobile_request(p_request_id uuid,p_launch_hash text,p_browser_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.merchant_mobile_requests;
BEGIN
 SELECT * INTO r FROM public.merchant_mobile_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.expires_at<=clock_timestamp() OR r.cancelled_at IS NOT NULL OR r.consumed_at IS NOT NULL OR r.launch_hash<>p_launch_hash
  OR p_browser_hash !~ '^[a-f0-9]{64}$' OR (r.browser_hash IS NOT NULL AND r.browser_hash<>p_browser_hash) THEN RETURN NULL; END IF;
 UPDATE public.merchant_mobile_requests SET browser_hash=p_browser_hash WHERE id=r.id;
 RETURN jsonb_build_object('purpose',r.purpose,'expectedUserId',r.expected_user_id,'expiresAt',r.expires_at);
END $$;

CREATE FUNCTION public.approve_merchant_mobile_request(p_request_id uuid,p_browser_hash text,p_session_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.merchant_mobile_requests; s public.sessions;
BEGIN
 SELECT * INTO r FROM public.merchant_mobile_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.browser_hash IS DISTINCT FROM p_browser_hash OR r.expires_at<=clock_timestamp() OR r.cancelled_at IS NOT NULL OR r.code_hash IS NOT NULL THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.sessions WHERE token=p_session_token FOR UPDATE;
 IF NOT FOUND OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp() OR s.last_active<clock_timestamp()-interval '8 hours'
  OR (r.expected_user_id IS NOT NULL AND r.expected_user_id<>s.user_id)
  OR (r.authorized_user_id IS NOT NULL AND r.authorized_user_id<>s.user_id) THEN RETURN NULL; END IF;
 PERFORM 1 FROM public.users_custom WHERE id=s.user_id AND email_verified=true FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.merchant_2fa_factors WHERE custom_user_id=s.user_id AND status='active' AND deleted_at IS NULL AND enrolled_at>s.created_at) THEN RETURN NULL; END IF;
 UPDATE public.merchant_mobile_requests SET authorized_user_id=s.user_id,source_session_id=s.id,approved_at=clock_timestamp(),updated_by=s.user_id WHERE id=r.id;
 RETURN jsonb_build_object('purpose',r.purpose,'requestId',r.id);
END $$;

CREATE FUNCTION public.complete_merchant_mobile_request(p_request_id uuid,p_browser_hash text,p_session_token text,p_code_hash text,p_site_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.merchant_mobile_requests; s public.sessions;
BEGIN
 SELECT * INTO r FROM public.merchant_mobile_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.browser_hash IS DISTINCT FROM p_browser_hash OR r.approved_at IS NULL OR r.expires_at<=clock_timestamp()
  OR r.cancelled_at IS NOT NULL OR r.code_hash IS NOT NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=r.source_session_id AND token=p_session_token FOR UPDATE;
 IF NOT FOUND OR s.user_id<>r.authorized_user_id OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp() OR s.last_active<clock_timestamp()-interval '8 hours' THEN RETURN NULL; END IF;
 IF r.purpose='create_store' THEN
  PERFORM 1 FROM public.sites WHERE id=p_site_id AND custom_user_id=s.user_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
 ELSIF p_site_id IS NOT NULL THEN RETURN NULL; END IF;
 UPDATE public.merchant_mobile_requests SET code_hash=p_code_hash,code_expires_at=least(expires_at,clock_timestamp()+interval '60 seconds'),site_id=p_site_id WHERE id=r.id;
 RETURN jsonb_build_object('redirectUri',r.redirect_uri,'state',r.state,'requestId',r.id,'environment',r.environment,'clientId',r.client_id,'callbackId',r.callback_id);
END $$;

CREATE FUNCTION public.inspect_merchant_mobile_exchange(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.merchant_mobile_requests; s public.sessions;
BEGIN
 SELECT * INTO r FROM public.merchant_mobile_requests WHERE id=(p_input->>'requestId')::uuid FOR UPDATE;
 IF NOT FOUND OR r.expires_at<=clock_timestamp() OR r.code_expires_at<=clock_timestamp() OR r.code_hash IS NULL OR r.consumed_at IS NOT NULL OR r.cancelled_at IS NOT NULL
  OR r.code_hash IS DISTINCT FROM (p_input->>'codeHash') OR r.challenge IS DISTINCT FROM (p_input->>'challenge')
  OR r.state IS DISTINCT FROM (p_input->>'state') OR r.client_id IS DISTINCT FROM (p_input->>'clientId')
  OR r.callback_id IS DISTINCT FROM (p_input->>'callbackId') OR r.environment IS DISTINCT FROM (p_input->>'environment') THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.sessions WHERE id=r.source_session_id FOR UPDATE;
 IF NOT FOUND OR s.revoked_at IS NOT NULL OR s.user_id<>r.authorized_user_id OR s.expires_at<=clock_timestamp() OR s.last_active<clock_timestamp()-interval '8 hours' THEN RETURN NULL; END IF;
 PERFORM 1 FROM public.users_custom WHERE id=s.user_id AND email_verified=true FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.merchant_2fa_factors WHERE custom_user_id=s.user_id AND status='active' AND deleted_at IS NULL AND enrolled_at>s.created_at) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('userId',s.user_id,'siteId',r.site_id);
END $$;

CREATE FUNCTION public.exchange_merchant_mobile_request(p_input jsonb,p_user_id uuid,p_token text,p_jti text,p_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; native_id uuid;
BEGIN
 result:=public.inspect_merchant_mobile_exchange(p_input);
 IF result IS NULL OR (result->>'userId')::uuid<>p_user_id OR p_token IS NULL OR length(p_token)<32 OR p_jti IS NULL
  OR p_expires_at<=clock_timestamp() OR p_expires_at>clock_timestamp()+interval '30 days 30 seconds' THEN RETURN NULL; END IF;
 -- No await/separate transaction between these effects. An insert failure rolls back ALL.
 result:=public.register_identity_merchant_session_v1(p_user_id,NULL,p_token,p_jti,p_expires_at);
 IF result IS NULL THEN RETURN NULL; END IF;
 native_id:=(result->>'session_id')::uuid;
 UPDATE public.merchant_mobile_requests SET consumed_at=clock_timestamp(),native_session_id=native_id,updated_by=p_user_id WHERE id=(p_input->>'requestId')::uuid;
 RETURN jsonb_build_object('sessionId',native_id,'userId',p_user_id,'expiresAt',p_expires_at,'siteId',(SELECT site_id FROM public.merchant_mobile_requests WHERE id=(p_input->>'requestId')::uuid));
END $$;

CREATE FUNCTION public.cancel_merchant_mobile_request(p_request_id uuid,p_management_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.merchant_mobile_requests;
BEGIN
 SELECT * INTO r FROM public.merchant_mobile_requests WHERE id=p_request_id AND management_hash=p_management_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF r.consumed_at IS NOT NULL THEN
  -- A lost exchange reply can be cancelled using only this protected request's
  -- management proof. Never revoke its separate browser or another app session.
  UPDATE public.sessions SET revoked_at=coalesce(revoked_at,clock_timestamp()),revoked_reason=coalesce(revoked_reason,'mobile_handoff_cancelled') WHERE id=r.native_session_id;
  RETURN true;
 END IF;
 UPDATE public.merchant_mobile_requests SET cancelled_at=coalesce(cancelled_at,clock_timestamp())
  WHERE id=p_request_id AND management_hash=p_management_hash AND consumed_at IS NULL;
 RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.create_merchant_mobile_request(jsonb),public.bind_merchant_mobile_request(uuid,text,text),public.approve_merchant_mobile_request(uuid,text,text),public.complete_merchant_mobile_request(uuid,text,text,text,uuid),public.inspect_merchant_mobile_exchange(jsonb),public.exchange_merchant_mobile_request(jsonb,uuid,text,text,timestamptz),public.cancel_merchant_mobile_request(uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.create_merchant_mobile_request(jsonb),public.bind_merchant_mobile_request(uuid,text,text),public.approve_merchant_mobile_request(uuid,text,text),public.complete_merchant_mobile_request(uuid,text,text,text,uuid),public.inspect_merchant_mobile_exchange(jsonb),public.exchange_merchant_mobile_request(jsonb,uuid,text,text,timestamptz),public.cancel_merchant_mobile_request(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
