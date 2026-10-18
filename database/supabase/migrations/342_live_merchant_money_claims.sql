-- Merchant transport guards delegate the existing canonical reservation and
-- payable claim writers. No provider call or second monetary ledger is added.
BEGIN;
CREATE FUNCTION public.reserve_owned_payment_refund_v1(p_site_id uuid,p_payment_id uuid,p_actor_id uuid,p_amount_minor bigint,p_idempotency_key text,p_step_up jsonb,p_request_id text DEFAULT NULL,p_metadata jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE s public.sites%ROWTYPE;p public.payments%ROWTYPE;a public.payment_attempts%ROWTYPE;r jsonb;v_amount bigint;v_ledger public.ledger_transactions%ROWTYPE;v_ref text;
BEGIN
 IF p_actor_id IS NULL OR p_site_id IS NULL OR p_payment_id IS NULL OR(p_amount_minor IS NOT NULL AND p_amount_minor<=0)OR p_idempotency_key IS NULL OR char_length(p_idempotency_key)NOT BETWEEN 8 AND 200 OR p_idempotency_key<>btrim(p_idempotency_key)OR p_idempotency_key~'[[:cntrl:]]'THEN RETURN jsonb_build_object('accepted',false,'status',400,'code','REFUND_INTENT_INVALID');END IF;
 IF nullif(current_setting('app.site_id',true),'')IS NOT NULL AND nullif(current_setting('app.site_id',true),'')::uuid IS DISTINCT FROM p_site_id THEN RETURN jsonb_build_object('accepted',false,'status',403,'code','MONEY_TENANT_MISMATCH');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:merchant-totp:'||p_actor_id::text,0));
 SELECT * INTO s FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
 IF s.id IS NULL OR NOT(coalesce(s.custom_user_id=p_actor_id,false)OR coalesce(s.user_id=p_actor_id,false))THEN RETURN jsonb_build_object('accepted',false,'status',403,'code','MONEY_OWNER_REQUIRED');END IF;
 IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'refund.approve',p_step_up)THEN RETURN jsonb_build_object('accepted',false,'status',428,'code','STEP_UP_INVALID');END IF;
 SELECT * INTO p FROM public.payments WHERE id=p_payment_id AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF p.id IS NULL THEN RETURN jsonb_build_object('accepted',false,'status',404,'code','PAYMENT_NOT_FOUND');END IF;
 SELECT * INTO a FROM public.payment_attempts WHERE payment_id=p_payment_id AND site_id=p_site_id AND attempt_type='refund'AND idempotency_key=p_idempotency_key AND deleted_at IS NULL FOR UPDATE;
 IF a.id IS NOT NULL AND a.created_by IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_CLAIM_ACTOR_MISMATCH');END IF;
 v_amount:=coalesce(p_amount_minor,CASE WHEN a.id IS NOT NULL THEN round(a.amount*100)::bigint ELSE p.amount_minor-coalesce(p.refunded_amount_minor,0)END);
 IF v_amount IS NULL OR v_amount<=0 OR v_amount>p.amount_minor THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_AMOUNT_INVALID');END IF;
 IF a.id IS NULL AND p_metadata->>'_requires_existing_claim'='true'THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_REVIEW_REQUIRED');END IF;
 IF a.id IS NOT NULL THEN
  IF round(a.amount*100)::bigint IS DISTINCT FROM v_amount OR a.currency IS DISTINCT FROM p.currency THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_AMOUNT_CONFLICT');END IF;
  IF nullif(p_metadata->>'provider_refund_id','')IS NOT NULL AND nullif(a.metadata->>'provider_refund_id','')IS NOT NULL AND p_metadata->>'provider_refund_id'IS DISTINCT FROM a.metadata->>'provider_refund_id'THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_REFERENCE_MISMATCH');END IF;
  IF a.status='succeeded'THEN
   v_ref:=nullif(a.metadata->>'provider_refund_id','');
   IF v_ref IS NULL OR coalesce(a.metadata->>'canonical_ledger_transaction_id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'OR p.status NOT IN('captured','refunded')OR p.currency<>'INR'OR coalesce(p.refunded_amount_minor,0)<v_amount OR p.refunded_amount_minor>p.amount_minor THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_REVIEW_REQUIRED');END IF;
   SELECT * INTO v_ledger FROM public.ledger_transactions WHERE id=(a.metadata->>'canonical_ledger_transaction_id')::uuid AND site_id=p_site_id AND source_type='refund'AND source_id=v_ref AND currency='INR';
   IF v_ledger.id IS NULL OR(SELECT count(*)FROM public.ledger_transactions WHERE site_id=p_site_id AND source_type='refund'AND source_id=v_ref)<>1 OR
    (SELECT coalesce(sum(amount_minor),0)FROM public.ledger_entries WHERE transaction_id=v_ledger.id AND side='debit')<>v_amount OR
    (SELECT coalesce(sum(amount_minor),0)FROM public.ledger_entries WHERE transaction_id=v_ledger.id AND side='credit')<>v_amount THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','REFUND_REVIEW_REQUIRED');END IF;
   RETURN jsonb_build_object('accepted',true,'reservation',jsonb_build_object('attempt_id',a.id,'status',a.status,'created',false,'amount_minor',v_amount,'provider_refund_id',v_ref),
    'completed',jsonb_build_object('payment',to_jsonb(p),'fully_refunded',p.status='refunded','ledger_transaction_id',v_ledger.id),'source_replayed',true);
  END IF;
 END IF;
 IF p.status<>'captured'THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','PAYMENT_NOT_REFUNDABLE');END IF;
 r:=public.reserve_payment_refund_attempt(p_payment_id,v_amount,p_idempotency_key,p_request_id,p_actor_id,
  (coalesce(p_metadata,'{}'::jsonb)-ARRAY['step_up_token','step_up_verified_at','_requires_existing_claim'])||p_step_up);
 IF(r->>'created')::boolean THEN
  INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
   VALUES(p_actor_id,'user','merchant.payment_refund.authorized','payment_attempt',(r->>'attempt_id')::uuid,
    jsonb_build_object('site_id',p_site_id,'payment_id',p_payment_id,'amount_minor',v_amount,'challenge_id',p_step_up->>'challenge_id','request_id',p_request_id));
 END IF;
 RETURN jsonb_build_object('accepted',true,'reservation',r,'payment',to_jsonb(p));
END $fn$;
CREATE FUNCTION public.claim_owned_payout_release_v1(p_site_id uuid,p_statement_id uuid,p_idempotency_key text,p_actor_id uuid,p_step_up jsonb,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE s public.sites%ROWTYPE;v_before public.payout_statements%ROWTYPE;v_after public.payout_statements%ROWTYPE;
BEGIN
 IF p_site_id IS NULL OR p_statement_id IS NULL OR p_actor_id IS NULL OR p_idempotency_key IS NULL OR char_length(p_idempotency_key)NOT BETWEEN 8 AND 200 OR p_idempotency_key<>btrim(p_idempotency_key)OR p_idempotency_key~'[[:cntrl:]]'THEN RETURN jsonb_build_object('accepted',false,'status',400,'code','PAYOUT_INTENT_INVALID');END IF;
 IF nullif(current_setting('app.site_id',true),'')IS NOT NULL AND nullif(current_setting('app.site_id',true),'')::uuid IS DISTINCT FROM p_site_id THEN RETURN jsonb_build_object('accepted',false,'status',403,'code','MONEY_TENANT_MISMATCH');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:merchant-totp:'||p_actor_id::text,0));
 SELECT * INTO s FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
 IF s.id IS NULL OR NOT(coalesce(s.custom_user_id=p_actor_id,false)OR coalesce(s.user_id=p_actor_id,false))THEN RETURN jsonb_build_object('accepted',false,'status',403,'code','MONEY_OWNER_REQUIRED');END IF;
 IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'payout.release',p_step_up)THEN RETURN jsonb_build_object('accepted',false,'status',428,'code','STEP_UP_INVALID');END IF;
 -- Preserve the canonical site advisory -> statement lock order.
 PERFORM pg_advisory_xact_lock(hashtextextended('payout-release:'||p_site_id::text,0));
 SELECT * INTO v_before FROM public.payout_statements WHERE id=p_statement_id AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF v_before.id IS NULL THEN RETURN jsonb_build_object('accepted',false,'status',404,'code','PAYOUT_NOT_FOUND');END IF;
 IF v_before.status='processing'AND v_before.release_claimed_by IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('accepted',false,'status',409,'code','PAYOUT_CLAIM_ACTOR_MISMATCH');END IF;
 SELECT * INTO v_after FROM public.claim_payout_statement_release(p_site_id,p_statement_id,p_idempotency_key,p_actor_id);
 IF v_after.id IS NULL OR v_after.status NOT IN('processing','released')THEN RAISE EXCEPTION 'payout claim requires review before provider contact';END IF;
 IF v_before.status='pending'AND v_after.status='processing'THEN
  UPDATE public.payout_statements SET metadata=coalesce(metadata,'{}'::jsonb)||p_step_up WHERE id=p_statement_id AND site_id=p_site_id RETURNING * INTO v_after;
  INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
   VALUES(p_actor_id,'user','merchant.payout_release.authorized','payout_statement',p_statement_id,
    jsonb_build_object('site_id',p_site_id,'amount_minor',v_after.net_amount_minor_bigint,'challenge_id',p_step_up->>'challenge_id','request_id',p_request_id));
 END IF;
 RETURN jsonb_build_object('accepted',true,'statement',to_jsonb(v_after));
END $fn$;
REVOKE ALL ON FUNCTION public.reserve_owned_payment_refund_v1(uuid,uuid,uuid,bigint,text,jsonb,text,jsonb),public.claim_owned_payout_release_v1(uuid,uuid,text,uuid,jsonb,text)FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.reserve_owned_payment_refund_v1(uuid,uuid,uuid,bigint,text,jsonb,text,jsonb),public.claim_owned_payout_release_v1(uuid,uuid,text,uuid,jsonb,text)TO service_role;
COMMIT;
