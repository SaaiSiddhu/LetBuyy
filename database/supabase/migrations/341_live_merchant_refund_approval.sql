-- Current persisted merchant approval is required at the same transaction
-- boundary as the existing canonical refund posting and receipt. ABI retained.
BEGIN;
CREATE OR REPLACE FUNCTION public.complete_owned_order_refund_v1(
 p_site_id uuid,p_order_id uuid,p_return_id uuid,p_actor_id uuid,p_intent jsonb,p_request_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v_site public.sites;v_order public.orders;v_return public.returns;v_refund public.refunds;
 v_receipt public.idempotency_keys;v_scope text;v_key text;v_hash text;v_refund_id uuid;v_count integer;v_data jsonb;v_source_replayed boolean;
BEGIN
 IF nullif(current_setting('app.site_id',true),'') IS NOT NULL
  AND nullif(current_setting('app.site_id',true),'')::uuid IS DISTINCT FROM p_site_id THEN
  RAISE EXCEPTION 'refund tenant context mismatch' USING ERRCODE='42501'; END IF;
 IF p_intent IS NULL OR jsonb_typeof(p_intent)IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('status',400,'error','VALIDATION'); END IF;
 IF p_site_id IS NULL OR p_order_id IS NULL OR p_actor_id IS NULL
  OR p_intent-ARRAY['idempotency_key','refund_id','provider_refund_id','provider_event_id','notes','_step_up']<>'{}'::jsonb
  OR jsonb_typeof(p_intent->'idempotency_key') IS DISTINCT FROM 'string'
  OR length(p_intent->>'idempotency_key') NOT BETWEEN 8 AND 200 OR p_intent->>'idempotency_key'<>btrim(p_intent->>'idempotency_key')
  OR (p_intent->>'idempotency_key')~'[[:cntrl:]]'
  OR(p_intent?'refund_id'AND(jsonb_typeof(p_intent->'refund_id') IS DISTINCT FROM 'string'OR p_intent->>'refund_id'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'))
  OR(p_intent?'provider_refund_id'AND(jsonb_typeof(p_intent->'provider_refund_id') IS DISTINCT FROM 'string'OR length(p_intent->>'provider_refund_id')>200))
  OR(p_intent?'provider_event_id'AND(jsonb_typeof(p_intent->'provider_event_id') IS DISTINCT FROM 'string'OR length(p_intent->>'provider_event_id')>200))
  OR(p_intent?'notes'AND(jsonb_typeof(p_intent->'notes') IS DISTINCT FROM 'string'OR length(p_intent->>'notes')>1000)) THEN
  RETURN jsonb_build_object('status',400,'error','VALIDATION'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:merchant-totp:'||p_actor_id::text,0));
 SELECT * INTO v_site FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
 IF v_site.id IS NULL OR NOT(coalesce(v_site.custom_user_id=p_actor_id,false) OR coalesce(v_site.user_id=p_actor_id,false)) THEN
  RETURN jsonb_build_object('status',403,'error','REFUND_OWNER_REQUIRED'); END IF;
 IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'refund.approve',p_intent->'_step_up')THEN RETURN jsonb_build_object('status',428,'error','STEP_UP_INVALID');END IF;
 v_scope:='owned-refund-complete-v1:'||p_order_id::text||':'||coalesce(p_return_id::text,'order')||':'||p_actor_id::text;
 v_key:=p_intent->>'idempotency_key';
 v_hash:=encode(sha256(convert_to(jsonb_build_object('site',p_site_id,'order',p_order_id,'return',p_return_id,'actor',p_actor_id,'intent',p_intent-'_step_up')::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text||':'||v_scope||':'||v_key,4));
 SELECT * INTO v_receipt FROM public.idempotency_keys WHERE site_id=p_site_id AND scope=v_scope AND key=v_key FOR UPDATE;
 IF v_receipt.id IS NOT NULL THEN
  IF v_receipt.request_hash IS DISTINCT FROM v_hash THEN RETURN jsonb_build_object('status',409,'error','IDEMPOTENCY_CONFLICT'); END IF;
  IF v_receipt.status<>'completed'OR v_receipt.response_body IS NULL OR v_receipt.deleted_at IS NOT NULL THEN
   RETURN jsonb_build_object('status',503,'error','REFUND_RECEIPT_UNAVAILABLE'); END IF;
  v_refund_id:=v_receipt.resource_id;
 ELSIF p_intent?'refund_id' THEN v_refund_id:=(p_intent->>'refund_id')::uuid;
 ELSE
  SELECT count(*),min(id::text)::uuid INTO v_count,v_refund_id FROM public.refunds
   WHERE site_id=p_site_id AND order_id=p_order_id AND return_id=p_return_id AND deleted_at IS NULL AND status IN('pending','processing','succeeded');
  IF v_count>1 THEN RETURN jsonb_build_object('status',409,'error','REFUND_SELECTION_REQUIRED'); END IF;
 END IF;
 -- Match the canonical writer's refund -> order lock order. No supplied ID
 -- can mutate a row merely because the caller owns a different URL resource.
 SELECT * INTO v_refund FROM public.refunds WHERE id=v_refund_id AND site_id=p_site_id AND order_id=p_order_id
  AND(p_return_id IS NULL OR return_id=p_return_id)AND deleted_at IS NULL FOR UPDATE;
 IF v_refund.id IS NULL THEN RETURN jsonb_build_object('status',404,'error','REFUND_NOT_FOUND'); END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND store_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF v_order.id IS NULL THEN RETURN jsonb_build_object('status',404,'error','REFUND_NOT_FOUND'); END IF;
 IF p_return_id IS NOT NULL THEN
  SELECT * INTO v_return FROM public.returns WHERE id=p_return_id AND site_id=p_site_id AND order_id=p_order_id AND deleted_at IS NULL FOR UPDATE;
  IF v_return.id IS NULL THEN RETURN jsonb_build_object('status',404,'error','REFUND_NOT_FOUND'); END IF;
 END IF;
 PERFORM set_config('app.site_id',p_site_id::text,true);
 IF v_receipt.id IS NOT NULL THEN
  IF v_refund.status<>'succeeded' OR v_receipt.response_hash IS DISTINCT FROM encode(sha256(convert_to(v_receipt.response_body::text,'UTF8')),'hex')
   OR v_receipt.response_body->'refund'->>'id' IS DISTINCT FROM v_refund.id::text
   OR v_receipt.response_body->'refund'->>'site_id' IS DISTINCT FROM p_site_id::text
   OR v_receipt.response_body->'refund'->>'order_id' IS DISTINCT FROM p_order_id::text
   OR v_receipt.response_body->'order'->>'id' IS DISTINCT FROM p_order_id::text
   OR v_receipt.response_body->'order'->>'store_id' IS DISTINCT FROM p_site_id::text THEN
   RETURN jsonb_build_object('status',409,'error','REFUND_REVIEW_REQUIRED'); END IF;
  -- The succeeded branch verifies its one canonical posting without writing
  -- money again. A receipt never substitutes for current source integrity.
  PERFORM public.complete_order_refund(v_refund.id,p_intent->>'provider_refund_id',p_intent->>'provider_event_id',p_actor_id,p_request_id,v_key);
  RETURN jsonb_build_object('status',200,'data',v_receipt.response_body,'replayed',true,'source_replayed',true);
 END IF;
 v_source_replayed:=v_refund.status='succeeded';
 v_data:=public.complete_order_refund(v_refund_id,p_intent->>'provider_refund_id',p_intent->>'provider_event_id',p_actor_id,p_request_id,v_key);
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
 VALUES(p_site_id,v_key,v_scope,v_hash,encode(sha256(convert_to(v_data::text,'UTF8')),'hex'),v_data,'completed',200,'refund',v_refund_id,p_request_id,now()+interval '24 hours');
 RETURN jsonb_build_object('status',200,'data',v_data,'replayed',false,'source_replayed',v_source_replayed);
END $fn$;
REVOKE ALL ON FUNCTION public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)TO service_role;
COMMIT;
