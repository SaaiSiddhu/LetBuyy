-- D05.4–8 has no approved retention/deletion/approver/incident policy.
-- This existing merchant intake may request review only. No PII deletion or
-- fulfillment is authorized. Reuse the canonical DSR/audit/outbox tables.
BEGIN;
CREATE FUNCTION public.request_merchant_erasure_review_v1(p_site uuid,p_actor uuid,p_email text,p_reason text,p_key text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE s public.sites%ROWTYPE;r public.data_subject_requests%ROWTYPE;v_key text;v_hash text;v_replayed boolean:=false;
BEGIN
 IF p_key IS NULL OR char_length(p_key) NOT BETWEEN 8 AND 200 OR p_reason IS NULL OR char_length(trim(p_reason)) NOT BETWEEN 8 AND 1000 OR coalesce(p_email,'')='' THEN
  RETURN jsonb_build_object('accepted',false,'code','DSR_INTENT_INVALID');END IF;
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT(coalesce(s.custom_user_id=p_actor,false)OR coalesce(s.user_id=p_actor,false)) THEN RETURN jsonb_build_object('accepted',false,'code','DSR_NOT_FOUND');END IF;
 v_key:='merchant-erasure-review-v1:'||p_site::text||':'||p_actor::text||':'||p_key;
 v_hash:=encode(extensions.digest(jsonb_build_object('site',p_site,'actor',p_actor,'email',lower(trim(p_email)),'reason',p_reason)::text,'sha256'),'hex');
 SELECT * INTO r FROM public.data_subject_requests WHERE source='manual' AND idempotency_key=v_key AND deleted_at IS NULL FOR UPDATE;
 IF FOUND THEN
  IF r.site_id IS DISTINCT FROM p_site OR r.actor_id IS DISTINCT FROM p_actor OR r.request_type<>'erasure' OR r.metadata->>'intake_sha256' IS DISTINCT FROM v_hash THEN
   RETURN jsonb_build_object('accepted',false,'code','IDEMPOTENCY_CONFLICT');END IF;
  v_replayed:=true;
 ELSE
  -- A pre-fix request under this same actor/site/key needs review of its actual
  -- history. Never relabel a historical partial or fulfilled erasure as pending.
  IF EXISTS(SELECT 1 FROM public.data_subject_requests WHERE source='manual'AND idempotency_key=p_key AND site_id=p_site AND actor_id=p_actor AND deleted_at IS NULL)THEN
   RETURN jsonb_build_object('accepted',false,'code','DSR_LEGACY_REVIEW_REQUIRED');END IF;
  INSERT INTO public.data_subject_requests(site_id,request_type,subject_type,subject_email,subject_display,source,status,due_at,idempotency_key,reason,metadata,actor_type,actor_id,request_id,created_by,updated_by)
   VALUES(p_site,'erasure','customer',lower(trim(p_email)),lower(trim(p_email)),'manual','open',clock_timestamp()+interval '30 days',v_key,p_reason,
    jsonb_build_object('intake_sha256',v_hash,'review_required',true,'policy_hold','D05.4-8','erasure_authorized',false),'system',p_actor,p_request_id,p_actor,p_actor) RETURNING * INTO r;
  INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
   VALUES(p_actor,'user','customer.erasure.review_requested','data_subject_request',r.id,jsonb_build_object('site_id',p_site,'policy_hold','D05.4-8','erased',false));
  INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
   VALUES(p_site,p_site,'customer',r.id,'customer.dsr_requested',jsonb_build_object('site_id',p_site,'customer_id',r.id,'customer_email_hash',encode(extensions.digest(lower(trim(p_email)),'sha256'),'hex'),'request_type','erasure'),
    'customer.dsr_requested:'||r.id::text,p_request_id,p_actor,1);
 END IF;
 IF r.status='fulfilled' OR r.fulfilled_at IS NOT NULL THEN RETURN jsonb_build_object('accepted',false,'code','DSR_LEGACY_REVIEW_REQUIRED');END IF;
 RETURN jsonb_build_object('accepted',true,'request_id',r.id,'status',r.status,'erased',false,'review_required',true,'policy_hold','D05.4-8','replayed',v_replayed);
END $fn$;
REVOKE ALL ON FUNCTION public.request_merchant_erasure_review_v1(uuid,uuid,text,text,text,text)FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.request_merchant_erasure_review_v1(uuid,uuid,text,text,text,text)TO service_role;
COMMIT;
