-- Existing merchant factor, existing HMAC approval token, existing challenge
-- table. Bind one logical command; retain only an encrypted retry result.
BEGIN;
ALTER TABLE public.step_up_challenges ADD COLUMN merchant_result_ciphertext text;
CREATE FUNCTION public.issue_merchant_step_up_v1(p_site uuid,p_actor uuid,p_factor uuid,p_action text,p_key text,p_factor_sha256 text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE f public.merchant_2fa_factors%ROWTYPE;s public.sites%ROWTYPE;x public.step_up_challenges%ROWTYPE;v_hash text;v_replayed boolean:=false;
BEGIN
 IF p_actor IS NULL OR p_site IS NULL OR p_factor IS NULL OR p_action IS NULL OR p_action NOT IN('refund.approve','payout.release','customer.dsr.export','customer.dsr.erase') OR p_key IS NULL OR char_length(p_key)NOT BETWEEN 8 AND 200 THEN RETURN jsonb_build_object('accepted',false,'code','STEP_UP_INTENT_INVALID');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:merchant-totp:'||p_actor::text,0));
 SELECT * INTO f FROM public.merchant_2fa_factors WHERE id=p_factor AND custom_user_id=p_actor AND factor_type='totp'AND status='active'AND deleted_at IS NULL FOR SHARE;
 IF f.id IS NULL OR encode(extensions.digest(f.secret_ciphertext,'sha256'),'hex')IS DISTINCT FROM p_factor_sha256 THEN RETURN jsonb_build_object('accepted',false,'code','STEP_UP_FACTOR_REQUIRED');END IF;
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF s.id IS NULL OR NOT(coalesce(s.custom_user_id=p_actor,false)OR coalesce(s.user_id=p_actor,false))THEN RETURN jsonb_build_object('accepted',false,'code','STEP_UP_OWNER_REQUIRED');END IF;
 v_hash:=encode(extensions.digest(jsonb_build_object('site',p_site,'actor',p_actor,'factor',p_factor,'action',p_action)::text,'sha256'),'hex');
 SELECT * INTO x FROM public.step_up_challenges WHERE site_id=p_site AND idempotency_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF x.actor_id IS DISTINCT FROM p_actor OR x.action IS DISTINCT FROM p_action OR x.metadata->>'factor_id'IS DISTINCT FROM p_factor::text OR x.metadata->>'merchant_intent_sha256'IS DISTINCT FROM v_hash THEN RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  IF x.metadata->>'factor_sha256'IS DISTINCT FROM p_factor_sha256 OR x.deleted_at IS NOT NULL OR x.status<>'verified'OR x.expires_at<=clock_timestamp()THEN RETURN jsonb_build_object('accepted',false,'code','STEP_UP_EXPIRED');END IF;
  IF x.merchant_result_ciphertext IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','STEP_UP_LEGACY_KEY_REQUIRES_REVIEW');END IF;
  v_replayed:=true;
 ELSE
  IF jsonb_typeof(p_proof)IS DISTINCT FROM 'object'OR coalesce(p_proof->>'token_sha256','')!~'^[0-9a-f]{64}$' OR coalesce(p_proof->>'result_ciphertext','')='' OR coalesce(p_proof->>'jti','')='' OR
   nullif(p_proof->>'verified_at','')IS NULL OR nullif(p_proof->>'expires_at','')IS NULL OR
   (p_proof->>'verified_at')::timestamptz<clock_timestamp()-interval '1 minute'OR(p_proof->>'verified_at')::timestamptz>clock_timestamp()+interval '1 minute'OR
   (p_proof->>'expires_at')::timestamptz<=clock_timestamp()OR(p_proof->>'expires_at')::timestamptz>clock_timestamp()+interval '10 minutes 5 seconds'THEN RETURN jsonb_build_object('accepted',false,'code','STEP_UP_INTENT_INVALID');END IF;
  INSERT INTO public.step_up_challenges(id,site_id,actor_id,action,status,challenge_token_hash,verified_at,expires_at,idempotency_key,metadata,merchant_result_ciphertext,created_by,updated_by)
   VALUES((p_proof->>'id')::uuid,p_site,p_actor,p_action,'verified',p_proof->>'token_sha256',(p_proof->>'verified_at')::timestamptz,(p_proof->>'expires_at')::timestamptz,p_key,
    jsonb_build_object('mode','crypto','method','totp','step_up_crypto','hmac-sha256','factor_id',p_factor,'factor_sha256',p_factor_sha256,'merchant_intent_sha256',v_hash,'jti',p_proof->>'jti'),p_proof->>'result_ciphertext',p_actor,p_actor)RETURNING * INTO x;
  INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
   VALUES(p_actor,'user','merchant.step_up.verified','step_up_challenge',x.id,jsonb_build_object('site_id',p_site,'action',p_action,'factor_id',p_factor,'request_id',p_proof->>'request_id'));
  INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,idempotency_key,actor_id,schema_version,payload,request_id,trace_id)
   VALUES(p_site,p_site,'auth',x.id,'auth.stepup','auth.stepup:'||x.id::text,p_actor,1,jsonb_build_object('site_id',p_site,'action',p_action,'status','verified','method','totp'),p_proof->>'request_id',p_proof->>'request_id');
 END IF;
 RETURN jsonb_build_object('accepted',true,'challenge',jsonb_build_object('id',x.id,'site_id',x.site_id,'action',x.action,'status',x.status,'verified_at',x.verified_at,'expires_at',x.expires_at),'result_ciphertext',x.merchant_result_ciphertext,'replayed',v_replayed);
END $fn$;

-- This runs inside a sensitive command's transaction, holding the same actor
-- lock as factor changes. The MAC is verified by the service before this check;
-- no token or caller-controlled timestamp can substitute for persisted proof.
CREATE FUNCTION public.verify_merchant_step_up_v1(p_site uuid,p_actor uuid,p_action text,p_evidence jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE x public.step_up_challenges%ROWTYPE;f public.merchant_2fa_factors%ROWTYPE;v_verified timestamptz;v_expires timestamptz;
BEGIN
 IF p_site IS NULL OR p_actor IS NULL OR jsonb_typeof(p_evidence)IS DISTINCT FROM 'object'OR coalesce(p_evidence->>'challenge_id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RETURN false;END IF;
 BEGIN
  v_verified:=nullif(p_evidence->>'verified_at','')::timestamptz;v_expires:=nullif(p_evidence->>'expires_at','')::timestamptz;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END;
 IF v_verified IS NULL OR v_expires IS NULL THEN RETURN false;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:merchant-totp:'||p_actor::text,0));
 SELECT * INTO x FROM public.step_up_challenges WHERE id=(p_evidence->>'challenge_id')::uuid AND site_id=p_site AND actor_id=p_actor AND action=p_action AND status='verified'AND deleted_at IS NULL FOR SHARE;
 IF x.id IS NULL OR x.verified_at IS DISTINCT FROM v_verified OR x.expires_at IS DISTINCT FROM v_expires OR x.verified_at>clock_timestamp()+interval '1 minute'OR x.expires_at<=clock_timestamp()OR x.verified_at<clock_timestamp()-interval '10 minutes'OR x.merchant_result_ciphertext IS NULL OR x.challenge_token_hash IS DISTINCT FROM p_evidence->>'token_sha256' OR x.metadata->>'jti'IS DISTINCT FROM p_evidence->>'jti'OR coalesce(x.metadata->>'factor_id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'THEN RETURN false;END IF;
 SELECT * INTO f FROM public.merchant_2fa_factors WHERE id=(x.metadata->>'factor_id')::uuid AND custom_user_id=p_actor AND factor_type='totp'AND status='active'AND deleted_at IS NULL FOR SHARE;
 IF f.id IS NULL OR encode(extensions.digest(f.secret_ciphertext,'sha256'),'hex')IS DISTINCT FROM x.metadata->>'factor_sha256'THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM public.sites WHERE id=p_site AND deleted_at IS NULL AND(custom_user_id=p_actor OR user_id=p_actor));
END $fn$;
REVOKE ALL ON FUNCTION public.issue_merchant_step_up_v1(uuid,uuid,uuid,text,text,text,jsonb),public.verify_merchant_step_up_v1(uuid,uuid,text,jsonb)FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.issue_merchant_step_up_v1(uuid,uuid,uuid,text,text,text,jsonb),public.verify_merchant_step_up_v1(uuid,uuid,text,jsonb)TO service_role;
COMMIT;
