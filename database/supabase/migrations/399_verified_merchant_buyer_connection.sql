-- Explicit, inbox-proven Merchant-to-buyer connection. No password or role copying.
-- The issuer creates a fresh Merchant session only after the existing password/MFA check.
-- That session never reaches the browser. This bounded intent is host/request-bound and single-use.
-- Rollback preserves the private intent/audit history and revokes every unfinished capability.
BEGIN;
CREATE TABLE public.merchant_buyer_connection_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 merchant_session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
 email text NOT NULL,
 buyer_account_id uuid REFERENCES public.buyer_accounts(id) ON DELETE RESTRICT,
 verifier_hash text NOT NULL CHECK(verifier_hash ~ '^[a-f0-9]{64}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 code_salt text NOT NULL,
 code_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 outcome text CHECK(outcome IN ('connected','cancelled','locked','superseded','unavailable','delivery_failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 created_by uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 updated_by uuid REFERENCES public.users_custom(id) ON DELETE RESTRICT
);
CREATE INDEX merchant_buyer_connection_recent_idx ON public.merchant_buyer_connection_intents(merchant_user_id,created_at DESC);
CREATE INDEX merchant_buyer_connection_expiry_idx ON public.merchant_buyer_connection_intents(expires_at) WHERE consumed_at IS NULL;
ALTER TABLE public.merchant_buyer_connection_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_buyer_connection_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY merchant_buyer_connection_service_only ON public.merchant_buyer_connection_intents FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON public.merchant_buyer_connection_intents FROM PUBLIC,anon,authenticated,app_tenant;
GRANT SELECT,INSERT,UPDATE ON public.merchant_buyer_connection_intents TO service_role;
CREATE TRIGGER merchant_buyer_connection_updated_at BEFORE UPDATE ON public.merchant_buyer_connection_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.start_merchant_buyer_connection(p_session_id uuid,p_verifier_hash text,p_request_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE s public.sessions%ROWTYPE; u public.users_custom%ROWTYPE; b public.buyer_accounts%ROWTYPE;
 v_id uuid; v_code text; v_salt text; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_verifier_hash IS NULL OR p_verifier_hash !~ '^[a-f0-9]{64}$' OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('outcome','unavailable'); END IF;
 SELECT * INTO s FROM public.sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.revoked_at IS NOT NULL OR s.expires_at<=v_now OR s.created_at<v_now-interval '1 minute' THEN
  RETURN jsonb_build_object('outcome','unavailable'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('merchant_buyer_connection:'||s.user_id::text,0));
 SELECT * INTO u FROM public.users_custom WHERE id=s.user_id FOR SHARE;
 IF NOT FOUND OR u.email_verified IS DISTINCT FROM true OR (to_jsonb(u)->>'deleted_at') IS NOT NULL
  OR coalesce(to_jsonb(u)->>'status','active')<>'active' OR coalesce(to_jsonb(u)->>'is_active','true')='false' THEN
  RETURN jsonb_build_object('outcome','unavailable'); END IF;
 IF (SELECT count(*) FROM public.merchant_buyer_connection_intents WHERE merchant_user_id=u.id AND created_at>v_now-interval '1 hour')>=5 THEN
  RETURN jsonb_build_object('outcome','rate_limited'); END IF;
 -- Do not keep browser-invisible Merchant sessions alive beyond this connection.
 UPDATE public.sessions SET expires_at=least(expires_at,v_now+interval '10 minutes') WHERE id=s.id;
 UPDATE public.sessions SET revoked_at=v_now,revoked_reason='buyer_connection_superseded'
  WHERE id IN (SELECT merchant_session_id FROM public.merchant_buyer_connection_intents WHERE merchant_user_id=u.id AND consumed_at IS NULL) AND id<>s.id;
 UPDATE public.merchant_buyer_connection_intents SET consumed_at=v_now,outcome='superseded' WHERE merchant_user_id=u.id AND consumed_at IS NULL;
 SELECT * INTO b FROM public.buyer_accounts WHERE email=lower(btrim(u.email));
 IF FOUND AND b.status<>'active' THEN RETURN jsonb_build_object('outcome','unavailable'); END IF;
 v_code:=lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint & 4294967295)%1000000)::text,6,'0');
 v_salt:=encode(extensions.gen_random_bytes(16),'hex');
 INSERT INTO public.merchant_buyer_connection_intents(merchant_user_id,merchant_session_id,email,buyer_account_id,verifier_hash,request_hash,code_salt,code_hash,expires_at,created_by)
 VALUES(u.id,s.id,lower(btrim(u.email)),b.id,p_verifier_hash,p_request_hash,v_salt,encode(extensions.digest(v_salt||v_code,'sha256'),'hex'),v_now+interval '10 minutes',u.id) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(u.id,'user','buyer.merchant_connection.started','merchant_buyer_connection',v_id,jsonb_build_object('request_hash',p_request_hash));
 RETURN jsonb_build_object('outcome','started','intent_id',v_id,'email',lower(btrim(u.email)),'code',v_code,'expires_at',v_now+interval '10 minutes');
END; $$;

CREATE FUNCTION public.consume_merchant_buyer_connection(p_intent_id uuid,p_verifier_hash text,p_request_hash text,p_code text,p_consent boolean,p_cancel boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE i public.merchant_buyer_connection_intents%ROWTYPE; s public.sessions%ROWTYPE; u public.users_custom%ROWTYPE;
 b public.buyer_accounts%ROWTYPE; v_now timestamptz:=clock_timestamp(); v_outcome text;
BEGIN
 SELECT * INTO i FROM public.merchant_buyer_connection_intents WHERE id=p_intent_id FOR UPDATE;
 IF NOT FOUND OR i.deleted_at IS NOT NULL OR i.consumed_at IS NOT NULL OR i.expires_at<=v_now
  OR i.verifier_hash IS DISTINCT FROM p_verifier_hash OR i.request_hash IS DISTINCT FROM p_request_hash THEN
  RETURN jsonb_build_object('outcome','invalid'); END IF;
 IF p_cancel IS TRUE THEN
  UPDATE public.merchant_buyer_connection_intents SET consumed_at=v_now,outcome='cancelled' WHERE id=i.id;
  UPDATE public.sessions SET revoked_at=v_now,revoked_reason='buyer_connection_cancelled' WHERE id=i.merchant_session_id;
  RETURN jsonb_build_object('outcome','cancelled'); END IF;
 IF p_consent IS DISTINCT FROM true THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT * INTO s FROM public.sessions WHERE id=i.merchant_session_id FOR SHARE;
 SELECT * INTO u FROM public.users_custom WHERE id=i.merchant_user_id FOR SHARE;
 IF s.id IS NULL OR s.user_id IS DISTINCT FROM u.id OR s.revoked_at IS NOT NULL OR s.expires_at<=v_now OR s.last_active<v_now-interval '8 hours'
  OR u.id IS NULL OR u.email_verified IS DISTINCT FROM true OR lower(btrim(u.email)) IS DISTINCT FROM i.email
  OR (to_jsonb(u)->>'deleted_at') IS NOT NULL OR coalesce(to_jsonb(u)->>'status','active')<>'active' OR coalesce(to_jsonb(u)->>'is_active','true')='false' THEN v_outcome:='unavailable';
 ELSIF i.attempts>=5 THEN v_outcome:='locked';
 ELSIF p_code IS NULL OR p_code !~ '^[0-9]{6}$' OR encode(extensions.digest(i.code_salt||p_code,'sha256'),'hex') IS DISTINCT FROM i.code_hash THEN
  UPDATE public.merchant_buyer_connection_intents SET attempts=attempts+1,
   consumed_at=CASE WHEN attempts+1>=5 THEN v_now END,outcome=CASE WHEN attempts+1>=5 THEN 'locked' END WHERE id=i.id;
  IF i.attempts+1>=5 THEN UPDATE public.sessions SET revoked_at=v_now,revoked_reason='buyer_connection_locked' WHERE id=i.merchant_session_id; END IF;
  RETURN jsonb_build_object('outcome','invalid');
 END IF;
 IF v_outcome IS NOT NULL THEN
  UPDATE public.merchant_buyer_connection_intents SET consumed_at=v_now,outcome=v_outcome WHERE id=i.id;
  UPDATE public.sessions SET revoked_at=coalesce(revoked_at,v_now),revoked_reason=coalesce(revoked_reason,'buyer_connection_unavailable') WHERE id=i.merchant_session_id;
  RETURN jsonb_build_object('outcome','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('merchant_buyer_connection_email:'||i.email,0));
 SELECT * INTO b FROM public.buyer_accounts WHERE email=i.email FOR UPDATE;
 IF (i.buyer_account_id IS NOT NULL AND (b.id IS DISTINCT FROM i.buyer_account_id OR b.status<>'active'))
  OR (i.buyer_account_id IS NULL AND b.id IS NOT NULL) THEN
  UPDATE public.merchant_buyer_connection_intents SET consumed_at=v_now,outcome='unavailable' WHERE id=i.id;
  UPDATE public.sessions SET revoked_at=v_now,revoked_reason='buyer_connection_changed' WHERE id=i.merchant_session_id;
  RETURN jsonb_build_object('outcome','invalid'); END IF;
 IF b.id IS NULL THEN
  INSERT INTO public.buyer_accounts(email,email_verified,full_name) VALUES(i.email,true,u.full_name) RETURNING * INTO b;
 ELSIF b.email_verified IS DISTINCT FROM true THEN
  -- Inbox proof supersedes any sessions belonging to an unverified pre-registration.
  UPDATE public.buyer_accounts SET email_verified=true,session_epoch=session_epoch+1,updated_at=v_now WHERE id=b.id RETURNING * INTO b;
 END IF;
 UPDATE public.merchant_buyer_connection_intents SET consumed_at=v_now,outcome='connected',buyer_account_id=b.id,updated_by=u.id WHERE id=i.id;
 UPDATE public.sessions SET revoked_at=v_now,revoked_reason='buyer_connection_completed' WHERE id=i.merchant_session_id;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(u.id,'user','buyer.merchant_connection.completed','buyer_account',b.id,
  jsonb_build_object('intent_id',i.id,'request_hash',i.request_hash,'consent_version','merchant-buyer-connection-v1','verified_ownership','merchant_password_mfa_and_email_code'));
 RETURN jsonb_build_object('outcome','connected','buyer',jsonb_build_object('id',b.id,'email',b.email,'status',b.status,'session_epoch',b.session_epoch));
END; $$;
REVOKE ALL ON FUNCTION public.start_merchant_buyer_connection(uuid,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
REVOKE ALL ON FUNCTION public.consume_merchant_buyer_connection(uuid,text,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.start_merchant_buyer_connection(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_merchant_buyer_connection(uuid,text,text,text,boolean,boolean) TO service_role;

-- Recovery is a single transaction owned by the existing Merchant credential system.
CREATE FUNCTION public.complete_merchant_password_reset(p_token text,p_password_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE t public.verification_tokens%ROWTYPE; u public.users_custom%ROWTYPE; v_now timestamptz;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$'
  OR p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' THEN
  RETURN jsonb_build_object('outcome','invalid'); END IF;
 -- Read the bound principal first; serialize resets for that principal before locking
 -- reset capabilities, so two different reset links cannot deadlock each other.
 SELECT * INTO t FROM public.verification_tokens WHERE token=p_token AND type='password_reset';
 IF NOT FOUND OR t.user_id IS NULL THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT * INTO u FROM public.users_custom WHERE id=t.user_id FOR UPDATE;
 IF NOT FOUND OR u.email_verified IS DISTINCT FROM true
  OR lower(btrim(u.email)) IS DISTINCT FROM lower(btrim(t.email))
  OR (to_jsonb(u)->>'deleted_at') IS NOT NULL OR coalesce(to_jsonb(u)->>'status','active')<>'active'
  OR coalesce(to_jsonb(u)->>'is_active','true')='false' THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT * INTO t FROM public.verification_tokens WHERE id=t.id FOR UPDATE;
 v_now:=clock_timestamp();
 IF t.used IS DISTINCT FROM false OR t.expires_at<=v_now OR t.type<>'password_reset'
  OR t.token IS DISTINCT FROM p_token OR t.user_id IS DISTINCT FROM u.id
  OR lower(btrim(t.email)) IS DISTINCT FROM lower(btrim(u.email)) THEN
  RETURN jsonb_build_object('outcome','invalid'); END IF;
 UPDATE public.users_custom SET password_hash=p_password_hash,updated_at=v_now WHERE id=u.id;
 UPDATE public.verification_tokens SET used=true WHERE user_id=u.id AND type='password_reset' AND used=false;
 UPDATE public.sessions SET revoked_at=v_now,revoked_reason='password_reset' WHERE user_id=u.id AND revoked_at IS NULL;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(u.id,'user','auth.password_reset.completed','user',u.id,jsonb_build_object('verification_token_id',t.id,'requires_normal_mfa_sign_in',true));
 RETURN jsonb_build_object('outcome','reset','user',jsonb_build_object('id',u.id,'email',u.email));
END; $$;
REVOKE ALL ON FUNCTION public.complete_merchant_password_reset(text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.complete_merchant_password_reset(text,text) TO service_role;
COMMIT;
