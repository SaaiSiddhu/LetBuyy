-- Owner authorized managed test collections with the platform test account, 2026-11-02.
-- Sandbox simulation only: no live provider approval, custody or bank settlement.
-- Keep per-site immutable connections while allowing this explicit test account
-- to back distinct managed sandbox roots. Merchant-owned uniqueness is unchanged.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
CREATE FUNCTION public.store_payment_managed_sandbox_supported_v1() RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS 'SELECT true';
REVOKE ALL ON FUNCTION public.store_payment_managed_sandbox_supported_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.store_payment_managed_sandbox_supported_v1() TO service_role;
DROP INDEX public.payment_credentials_one_manual_key;
CREATE UNIQUE INDEX payment_credentials_one_manual_key ON public.payment_credentials(provider,mode,provider_key_id)
 WHERE id=connection_id AND provider_key_id IS NOT NULL
 AND coalesce(metadata->>'account_model','')<>'managed_sandbox';
CREATE UNIQUE INDEX payment_credentials_one_managed_sandbox_key ON public.payment_credentials(site_id,provider,mode,provider_key_id)
 WHERE id=connection_id AND metadata->>'account_model'='managed_sandbox';
ALTER TABLE public.payment_credentials ADD CONSTRAINT payment_credentials_managed_sandbox_only CHECK(
 coalesce(metadata->>'account_model','')<>'managed_sandbox' OR
 coalesce(provider='razorpay' AND mode='sandbox' AND provider_key_id ~ '^rzp_test_[A-Za-z0-9]+$'
  AND kms_key_ref LIKE 'payment-config:v3:%',false));
CREATE FUNCTION public.guard_managed_payment_credential_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE root public.payment_credentials;
BEGIN
 IF NEW.connection_id<>NEW.id THEN
  SELECT * INTO root FROM public.payment_credentials WHERE id=NEW.connection_id AND site_id=NEW.site_id FOR KEY SHARE;
  IF coalesce(root.metadata->>'account_model','') IS DISTINCT FROM coalesce(NEW.metadata->>'account_model','') THEN
   RAISE EXCEPTION 'Payment account model cannot change within a connection' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER managed_payment_credential_v1 BEFORE INSERT OR UPDATE ON public.payment_credentials
 FOR EACH ROW EXECUTE FUNCTION public.guard_managed_payment_credential_v1();
REVOKE ALL ON FUNCTION public.guard_managed_payment_credential_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_managed_payment_credential_v1() TO service_role;
CREATE OR REPLACE FUNCTION public.commit_store_payment_configuration_v1(p_site_id uuid,p_actor_id uuid,
 p_expected_revision timestamptz,p_claim_id uuid,p_request_hash text,p_operation text,p_payload jsonb,
 p_credentials_usable boolean,p_public_response jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites; receipt public.idempotency_keys; root public.payment_credentials;
 v_id uuid; v_root uuid; v_version integer; c public.payment_credentials; reply jsonb; razor jsonb; now_at timestamptz:=clock_timestamp();
 managed boolean:=p_payload->>'account_model'='managed_sandbox';
BEGIN
 IF p_operation IS NULL OR p_operation NOT IN('save','methods') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_public_response) IS DISTINCT FROM 'object' OR p_public_response->>'success' IS DISTINCT FROM 'true'
  OR p_public_response->'data'->>'store_id' IS DISTINCT FROM p_site_id::text
  OR length(p_public_response::text)>16384
  OR p_public_response::text ~ '"(key_secret|key_secret_ciphertext|encrypted_credentials|access_token|refresh_token)"' THEN
  RAISE EXCEPTION 'PAYMENT_CONFIG_INVALID' USING ERRCODE='22023';
 END IF;
 SELECT * INTO s FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL
  AND (custom_user_id=p_actor_id OR user_id=p_actor_id) FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_CONFIG_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM public.idempotency_keys WHERE id=p_claim_id AND site_id=p_site_id
  AND scope='http:'||CASE WHEN p_operation='save' THEN 'POST' ELSE 'PATCH' END||':/stores/'||p_site_id::text||'/payment-config'
  AND request_hash=p_request_hash AND deleted_at IS NULL FOR UPDATE;
 IF receipt.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_CONFIG_RECEIPT_UNAVAILABLE' USING ERRCODE='22023'; END IF;
 IF receipt.status='completed' THEN RETURN receipt.response_body; END IF;
 IF receipt.status<>'processing' OR receipt.locked_until IS NULL OR receipt.locked_until<=clock_timestamp()
  OR s.updated_at IS DISTINCT FROM p_expected_revision THEN
  RAISE EXCEPTION 'PAYMENT_CONFIG_CONFLICT' USING ERRCODE='22023';
 END IF;
 IF p_operation='save' THEN
  IF p_credentials_usable IS DISTINCT FROM true OR (SELECT count(*) FROM jsonb_object_keys(p_payload))<>(CASE WHEN managed THEN 4 ELSE 3 END)
   OR (p_payload ? 'account_model' AND p_payload->>'account_model' IS DISTINCT FROM 'managed_sandbox')
   OR NOT(p_payload ?& ARRAY['credential_id','key_id','key_secret_ciphertext'])
   OR jsonb_typeof(p_payload->'credential_id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_payload->'key_id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_payload->'key_secret_ciphertext') IS DISTINCT FROM 'string'
   OR p_payload->>'key_id' !~ '^rzp_test_[A-Za-z0-9]{3,119}$'
   OR length(p_payload->>'key_secret_ciphertext') NOT BETWEEN 80 AND 4096 THEN
   RAISE EXCEPTION 'PAYMENT_CONFIG_INVALID' USING ERRCODE='22023'; END IF;
  v_id:=(p_payload->>'credential_id')::uuid;
  IF p_payload->>'key_secret_ciphertext' NOT LIKE 'v3:%:'||v_id::text||':%' THEN
   RAISE EXCEPTION 'PAYMENT_CONFIG_INVALID' USING ERRCODE='22023'; END IF;
  -- Serialize first ownership of this exact recorded key as well as this site's
  -- revision. No different store can win a concurrent root-key claim.
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-key:sandbox:'||(p_payload->>'key_id'),0));
  SELECT * INTO root FROM public.payment_credentials WHERE provider='razorpay' AND mode='sandbox'
   AND provider_key_id=p_payload->>'key_id' AND id=connection_id
   AND coalesce(metadata->>'account_model'='managed_sandbox',false)=coalesce(managed,false)
   AND (NOT coalesce(managed,false) OR site_id=p_site_id) FOR UPDATE;
  IF root.id IS NOT NULL AND root.site_id<>p_site_id THEN
   RAISE EXCEPTION 'PAYMENT_CONNECTION_OWNERSHIP_CONFLICT' USING ERRCODE='22023'; END IF;
  v_root:=coalesce(root.id,v_id);
  SELECT coalesce(max(credential_version),0)+1 INTO v_version FROM public.payment_credentials WHERE connection_id=v_root;
  INSERT INTO public.payment_credentials(id,site_id,provider,mode,status,kms_key_ref,encrypted_credentials,
   last_verified_at,connection_id,credential_version,provider_key_id,created_by,updated_by,metadata)
  VALUES(v_id,p_site_id,'razorpay','sandbox','active','payment-config:v3:'||split_part(p_payload->>'key_secret_ciphertext',':',2),
   jsonb_build_object('key_secret_ciphertext',p_payload->>'key_secret_ciphertext'),now_at,v_root,v_version,p_payload->>'key_id',p_actor_id,p_actor_id,
   CASE WHEN managed THEN jsonb_build_object('account_model','managed_sandbox') ELSE '{}'::jsonb END);
  UPDATE public.payment_credentials SET selected_for_checkout=false,updated_by=p_actor_id
   WHERE site_id=p_site_id AND mode='sandbox' AND selected_for_checkout;
  razor:=jsonb_build_object('credential_id',v_id,'key_id',p_payload->>'key_id','test_mode',true,'verified',true,
   'connected_at',now_at,'updated_at',now_at);
  UPDATE public.sites SET payment_settings=jsonb_build_object('mode',CASE WHEN managed THEN 'managedSandbox' ELSE 'ownAccount' END,'gateways',jsonb_build_array('razorpay'),'razorpay',razor),
   online_payment_enabled=false,updated_by=p_actor_id,updated_at=now_at WHERE id=p_site_id RETURNING * INTO s;
 ELSE
  IF (SELECT count(*) FROM jsonb_object_keys(p_payload)) NOT BETWEEN 1 AND 2
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN('online_payment_enabled','cod_enabled'))
   OR (p_payload ? 'online_payment_enabled' AND jsonb_typeof(p_payload->'online_payment_enabled')<>'boolean')
   OR (p_payload ? 'cod_enabled' AND jsonb_typeof(p_payload->'cod_enabled')<>'boolean') THEN
   RAISE EXCEPTION 'PAYMENT_CONFIG_INVALID' USING ERRCODE='22023'; END IF;
  IF p_payload->>'online_payment_enabled'='true' THEN
   IF p_credentials_usable IS DISTINCT FROM true OR coalesce(s.payment_settings->>'mode','') NOT IN('ownAccount','managedSandbox') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_READY' USING ERRCODE='22023'; END IF;
   SELECT * INTO c FROM public.payment_credentials WHERE id=(s.payment_settings->'razorpay'->>'credential_id')::uuid
    AND site_id=p_site_id AND provider='razorpay' AND mode='sandbox' AND status='active' AND deleted_at IS NULL FOR UPDATE;
   IF c.id IS NULL OR c.last_verified_at IS NULL
    OR (s.payment_settings->>'mode'='managedSandbox') IS DISTINCT FROM coalesce(c.metadata->>'account_model'='managed_sandbox',false) THEN RAISE EXCEPTION 'PAYMENT_NOT_READY' USING ERRCODE='22023'; END IF;
   UPDATE public.payment_credentials SET selected_for_checkout=false,updated_by=p_actor_id WHERE site_id=p_site_id AND mode='sandbox' AND selected_for_checkout;
   UPDATE public.payment_credentials SET selected_for_checkout=true,updated_by=p_actor_id WHERE id=c.id AND site_id=p_site_id;
  ELSIF p_payload->>'online_payment_enabled'='false' THEN
   UPDATE public.payment_credentials SET selected_for_checkout=false,updated_by=p_actor_id WHERE site_id=p_site_id AND mode='sandbox' AND selected_for_checkout;
  END IF;
  UPDATE public.sites SET online_payment_enabled=coalesce((p_payload->>'online_payment_enabled')::boolean,online_payment_enabled),
   cod_enabled=coalesce((p_payload->>'cod_enabled')::boolean,cod_enabled),updated_by=p_actor_id,updated_at=now_at
   WHERE id=p_site_id RETURNING * INTO s;
 END IF;
 IF p_public_response->'data'->>'online_payment_enabled' IS DISTINCT FROM coalesce(s.online_payment_enabled,false)::text
  OR p_public_response->'data'->>'cod_enabled' IS DISTINCT FROM coalesce(s.cod_enabled,false)::text THEN
  RAISE EXCEPTION 'PAYMENT_CONFIG_INVALID_PROJECTION' USING ERRCODE='22023'; END IF;
 reply:=jsonb_set(p_public_response,'{data,revision}',to_jsonb(s.updated_at));
 UPDATE public.idempotency_keys SET status='completed',response_body=reply,status_code=200,
  response_hash=encode(sha256(convert_to(reply::text,'UTF8')),'hex'),resource_type='site_payment_configuration',resource_id=p_site_id,
  locked_until=NULL WHERE id=receipt.id AND site_id=p_site_id;
 RETURN reply;
END $fn$;
REVOKE ALL ON FUNCTION public.commit_store_payment_configuration_v1(uuid,uuid,timestamptz,uuid,text,text,jsonb,boolean,jsonb)
 FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.commit_store_payment_configuration_v1(uuid,uuid,timestamptz,uuid,text,text,jsonb,boolean,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
