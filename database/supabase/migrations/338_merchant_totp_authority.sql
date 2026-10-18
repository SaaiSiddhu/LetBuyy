-- Merchant factors keep their existing canonical table. Credential command
-- receipts are account-bound (including before a store exists), private, and
-- contain only encrypted retry results. No second identity issuer is added.
BEGIN;
CREATE TABLE public.merchant_totp_commands_v1 (
 actor_id uuid NOT NULL REFERENCES public.users_custom(id),
 command_key text NOT NULL CHECK(char_length(command_key) BETWEEN 8 AND 200),
 command text NOT NULL CHECK(command IN ('enroll','verify','disable')),
 factor_id uuid NOT NULL REFERENCES public.merchant_2fa_factors(id),
 result_ciphertext text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,command_key)
);
ALTER TABLE public.merchant_totp_commands_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_totp_commands_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_totp_commands_v1 FROM PUBLIC,anon,authenticated,app_tenant,service_role;
-- A legacy authenticated Supabase session must not write a factor directly.
ALTER TABLE public.merchant_2fa_factors FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_2fa_factors FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT SELECT ON public.merchant_2fa_factors TO service_role;
-- Legacy verify-only login records activity, never factor/secret transitions.
GRANT UPDATE(last_verified_at) ON public.merchant_2fa_factors TO service_role;

CREATE FUNCTION public.execute_merchant_totp_command_v1(p_actor_id uuid,p_command text,p_key text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE f public.merchant_2fa_factors%ROWTYPE;r public.merchant_totp_commands_v1%ROWTYPE;
 v_factor uuid;v_recovery text[];v_replayed boolean:=false;
BEGIN
 IF p_actor_id IS NULL OR p_command IS NULL OR p_command NOT IN ('enroll','verify','disable') OR p_key IS NULL OR char_length(p_key) NOT BETWEEN 8 AND 200 OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
  RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_KEY_REQUIRED');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:merchant-totp:'||p_actor_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.users_custom WHERE id=p_actor_id) THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_NOT_FOUND');END IF;
 SELECT * INTO r FROM public.merchant_totp_commands_v1 WHERE actor_id=p_actor_id AND command_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF r.command<>p_command OR (p_command<>'enroll' AND r.factor_id IS DISTINCT FROM nullif(p_input->>'factor_id','')::uuid) THEN
   RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  v_replayed:=true;v_factor:=r.factor_id;
 ELSE v_factor:=nullif(p_input->>'factor_id','')::uuid;END IF;
 IF p_command='enroll' AND NOT v_replayed THEN
  SELECT * INTO f FROM public.merchant_2fa_factors WHERE custom_user_id=p_actor_id AND factor_type='totp' AND deleted_at IS NULL AND status<>'disabled' FOR UPDATE;
 ELSE
  SELECT * INTO f FROM public.merchant_2fa_factors WHERE id=v_factor AND custom_user_id=p_actor_id AND factor_type='totp' AND deleted_at IS NULL FOR UPDATE;
 END IF;
 IF p_command='enroll' THEN
  IF f.id IS NOT NULL AND f.status<>'pending' THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_ALREADY_ENABLED');END IF;
  IF v_replayed AND f.id IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_STATE_CHANGED');END IF;
  IF f.id IS NULL THEN
   IF coalesce(p_input->>'secret_ciphertext','')='' OR coalesce(p_input->>'label','')='' THEN RAISE EXCEPTION 'missing encrypted enrollment input';END IF;
   INSERT INTO public.merchant_2fa_factors(custom_user_id,factor_type,status,issuer,label,secret_ciphertext,metadata,created_by,updated_by)
   VALUES(p_actor_id,'totp','pending','LetBuyy',p_input->>'label',p_input->>'secret_ciphertext','{"algorithm":"SHA1","digits":6,"period":30}',p_actor_id,p_actor_id) RETURNING * INTO f;
  END IF;
 ELSIF f.id IS NULL OR (f.status='disabled' AND NOT(v_replayed AND p_command='disable')) THEN
  RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_NOT_FOUND');
 ELSE
  -- Verification was performed by the service against exactly this encrypted
  -- factor version. A concurrent disable/activation cannot invalidate that read
  -- and then be silently overwritten here.
  IF encode(extensions.digest(f.secret_ciphertext,'sha256'),'hex') IS DISTINCT FROM p_input->>'secret_sha256' THEN
   RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_STATE_CHANGED');END IF;
  IF v_replayed THEN
   IF p_command='verify' AND (f.status<>'active' OR p_input->>'proof_kind' IS DISTINCT FROM 'totp' OR p_input->>'proof_verified' IS DISTINCT FROM 'true'
      OR r.created_at<clock_timestamp()-interval '10 minutes') THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_STATE_CHANGED');END IF;
   IF p_command='disable' AND f.status<>'disabled' THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_STATE_CHANGED');END IF;
  ELSIF p_command='verify' THEN
   IF f.status<>'pending' THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_ALREADY_ENABLED');END IF;
   IF p_input->>'proof_kind' IS DISTINCT FROM 'totp' OR p_input->>'proof_verified' IS DISTINCT FROM 'true' THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_CODE_INVALID');END IF;
   SELECT array_agg(h) INTO v_recovery FROM jsonb_array_elements_text(p_input->'recovery_hashes')h;
   IF coalesce(array_length(v_recovery,1),0)<>8 OR EXISTS(SELECT 1 FROM unnest(v_recovery)h WHERE h!~'^[0-9a-f]{64}$') OR coalesce(p_input->>'result_ciphertext','')='' THEN RAISE EXCEPTION 'invalid encrypted recovery receipt';END IF;
   UPDATE public.merchant_2fa_factors SET status='active',enrolled_at=coalesce(enrolled_at,clock_timestamp()),last_verified_at=clock_timestamp(),
    recovery_code_hashes=v_recovery,updated_by=p_actor_id WHERE id=f.id RETURNING * INTO f;
  ELSE
   IF f.status IS DISTINCT FROM p_input->>'expected_status' THEN RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_STATE_CHANGED');END IF;
   IF f.status='active' AND NOT(coalesce(p_input->>'proof_kind'='totp' AND p_input->>'proof_verified'='true',false)
     OR coalesce(p_input->>'proof_kind'='recovery' AND p_input->>'recovery_hash'=ANY(f.recovery_code_hashes),false)) THEN
     RETURN jsonb_build_object('accepted',false,'code','TWO_FACTOR_CODE_INVALID');END IF;
   UPDATE public.merchant_2fa_factors SET status='disabled',disabled_at=clock_timestamp(),recovery_code_hashes='{}',updated_by=p_actor_id WHERE id=f.id RETURNING * INTO f;
  END IF;
 END IF;
 IF NOT v_replayed THEN
  INSERT INTO public.merchant_totp_commands_v1(actor_id,command_key,command,factor_id,result_ciphertext)
   VALUES(p_actor_id,p_key,p_command,f.id,CASE WHEN p_command='verify' THEN p_input->>'result_ciphertext' END) RETURNING * INTO r;
  INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
   VALUES(p_actor_id,'user','merchant.totp.'||p_command,'merchant_2fa_factor',f.id,jsonb_build_object('status',f.status,'command_version',1));
 END IF;
 RETURN jsonb_build_object('accepted',true,'factor',to_jsonb(f),'result_ciphertext',r.result_ciphertext,'replayed',v_replayed);
END $fn$;
REVOKE ALL ON FUNCTION public.execute_merchant_totp_command_v1(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.execute_merchant_totp_command_v1(uuid,text,text,jsonb) TO service_role;

-- Retire only confirmed credential-bearing legacy HTTP receipts. Retain keys,
-- request hashes and sanitized audit evidence; never archive the old secrets.
CREATE FUNCTION public.retire_merchant_totp_http_credentials_v1()RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE x record;n integer:=0;
BEGIN
 FOR x IN UPDATE public.idempotency_keys SET status='failed',status_code=409,response_hash=NULL,locked_until=NULL,
  response_body='{"error":{"code":"CREDENTIAL_RECEIPT_RETIRED","message":"Reload account security before retrying this operation."}}'
  WHERE scope IN ('http:POST:/2fa/totp/enroll','http:POST:/2fa/totp/verify')
   AND(response_body#>'{data,secret}'IS NOT NULL OR response_body#>'{data,otpauth_uri}'IS NOT NULL OR response_body#>'{data,recovery_codes}'IS NOT NULL)
  RETURNING id,scope
 LOOP
  INSERT INTO public.audit_logs(actor_type,action,resource_type,resource_id,metadata)
   VALUES('system','merchant.totp.legacy_receipt_retired','idempotency_key',x.id,jsonb_build_object('scope',x.scope,'credentials_removed',true));n:=n+1;
 END LOOP;
 RETURN n;
END $fn$;
REVOKE ALL ON FUNCTION public.retire_merchant_totp_http_credentials_v1()FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.retire_merchant_totp_http_credentials_v1()TO service_role;
SELECT public.retire_merchant_totp_http_credentials_v1();
COMMIT;
