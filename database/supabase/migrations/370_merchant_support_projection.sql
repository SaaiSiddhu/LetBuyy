-- Owner-scoped merchant admission into canonical support records and receipts.
-- No staff grant, second ticket store, notification sender or privacy executor.
BEGIN;
CREATE FUNCTION public.execute_merchant_support_mutation_v1(
 p_actor_id uuid,p_site_id uuid,p_operation text,p_ticket_id uuid,p_key text,p_payload jsonb,
 p_first_response_hours integer DEFAULT 8,p_resolution_business_days integer DEFAULT 3
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE
 v_site public.sites%ROWTYPE; v_actor public.users_custom%ROWTYPE;
 v_ticket public.support_tickets%ROWTYPE; v_message public.ticket_messages%ROWTYPE;
 v_receipt public.support_mutation_receipts%ROWTYPE;
 v_operation text:=replace(p_operation,'recover_','');
 v_target text; v_hash text; v_result jsonb; v_now timestamptz:=clock_timestamp();
 v_due timestamptz; v_days integer; v_audit uuid;
BEGIN
 IF p_operation NOT IN('create','reply','recover_create','recover_reply') OR p_operation IS NULL
   OR p_actor_id IS NULL OR p_site_id IS NULL OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200
   OR p_key<>btrim(p_key) OR p_key~'[[:cntrl:]]'
   OR(v_operation='create')<>(p_ticket_id IS NULL) THEN
  RAISE EXCEPTION 'Invalid merchant support command' USING ERRCODE='22023';
 END IF;
 -- Live identity-based ownership is rechecked BEFORE receipt replay and held
 -- until commit, so an ownership change cannot race an admitted write.
 SELECT * INTO v_site FROM sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
 SELECT * INTO v_actor FROM users_custom WHERE id=p_actor_id FOR SHARE;
 IF v_site.id IS NULL OR v_actor.id IS NULL
  OR NOT(coalesce(v_site.custom_user_id=p_actor_id,false) OR coalesce(v_site.user_id=p_actor_id,false)) THEN
  RAISE EXCEPTION 'Merchant support access denied' USING ERRCODE='42501';
 END IF;
 IF p_ticket_id IS NOT NULL THEN
  SELECT * INTO v_ticket FROM support_tickets WHERE id=p_ticket_id AND site_id=p_site_id
   AND requester_type='merchant' AND requester_user_id=p_actor_id AND deleted_at IS NULL FOR UPDATE;
  IF v_ticket.id IS NULL THEN RAISE EXCEPTION 'Ticket not found' USING ERRCODE='P0002'; END IF;
 END IF;
 v_target:='merchant:'||p_site_id::text||':'||coalesce(p_ticket_id::text,'new');
 IF p_operation LIKE 'recover_%' THEN
  SELECT * INTO v_receipt FROM support_mutation_receipts WHERE actor_id=p_actor_id
   AND operation=v_operation AND target=v_target AND idempotency_key=p_key;
  RETURN jsonb_build_object('state',CASE WHEN v_receipt.response IS NULL THEN 'not_recorded' ELSE 'completed' END,'result',v_receipt.response);
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR length(btrim(coalesce(p_payload->>'body',''))) NOT BETWEEN 1 AND 4000
  OR (v_operation='create' AND(length(btrim(coalesce(p_payload->>'subject',''))) NOT BETWEEN 3 AND 240
   OR coalesce(p_payload->>'topic','') NOT IN('billing','technical','abuse','onboarding','payments','orders','themes','apps','general'))) THEN
  RAISE EXCEPTION 'Invalid support message' USING ERRCODE='22023';
 END IF;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('site_id',p_site_id,'payload',p_payload)::text,'UTF8')),'hex');
 INSERT INTO support_mutation_receipts(actor_id,operation,target,idempotency_key,request_hash)
  VALUES(p_actor_id,v_operation,v_target,p_key,v_hash) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_receipt FROM support_mutation_receipts WHERE actor_id=p_actor_id AND operation=v_operation
  AND target=v_target AND idempotency_key=p_key FOR UPDATE;
 IF v_receipt.request_hash<>v_hash THEN RAISE EXCEPTION 'Support key conflict' USING ERRCODE='PT409'; END IF;
 IF v_receipt.response IS NOT NULL THEN RETURN v_receipt.response; END IF;
 IF v_operation='create' THEN
  IF p_first_response_hours NOT BETWEEN 1 AND 168 OR p_resolution_business_days NOT BETWEEN 1 AND 90 THEN
   RAISE EXCEPTION 'Invalid support defaults' USING ERRCODE='22023';
  END IF;
  v_due:=v_now;v_days:=p_resolution_business_days;
  WHILE v_days>0 LOOP
   v_due:=v_due+interval '1 day';IF extract(isodow FROM v_due AT TIME ZONE 'UTC')<6 THEN v_days:=v_days-1;END IF;
  END LOOP;
  INSERT INTO support_tickets(ticket_ref,site_id,requester_type,requester_user_id,requester_email,subject,channel,topic,priority,status,
    first_response_due_at,resolution_due_at,last_customer_message_at,created_by,updated_by)
   VALUES('SUP-'||to_char(v_now,'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),p_site_id,'merchant',p_actor_id,v_actor.email,
    p_payload->>'subject','in_app',p_payload->>'topic','normal','open',v_now+make_interval(hours=>p_first_response_hours),v_due,v_now,p_actor_id,p_actor_id)
   RETURNING * INTO v_ticket;
  INSERT INTO ticket_sla_clocks(ticket_id,clock_type,due_at,created_by,updated_by)VALUES
   (v_ticket.id,'first_response',v_ticket.first_response_due_at,p_actor_id,p_actor_id),
   (v_ticket.id,'resolution',v_due,p_actor_id,p_actor_id);
 ELSE
  IF v_ticket.status IN('resolved','closed') THEN RAISE EXCEPTION 'Ticket is resolved; create a new request' USING ERRCODE='PT409';END IF;
  UPDATE support_tickets SET last_customer_message_at=v_now,updated_at=v_now,updated_by=p_actor_id,
   status=CASE WHEN status='pending_customer' THEN 'pending_internal' ELSE status END WHERE id=v_ticket.id RETURNING * INTO v_ticket;
 END IF;
 INSERT INTO ticket_messages(ticket_id,author_type,author_id,author_email,visibility,body,created_by)
  VALUES(v_ticket.id,'requester',p_actor_id,v_actor.email,'public',p_payload->>'body',p_actor_id)RETURNING * INTO v_message;
 INSERT INTO audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
  VALUES(p_actor_id,'user','merchant.support.ticket.'||v_operation,'support_ticket',v_ticket.id,
   jsonb_build_object('site_id',p_site_id,'realm','merchant','message_id',v_message.id))RETURNING id INTO v_audit;
 INSERT INTO outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,actor_id,schema_version)
  VALUES(p_site_id,p_site_id,'audit',v_audit::text,'audit.recorded',
   jsonb_build_object('site_id',p_site_id,'audit_id',v_audit,'action','merchant.support.ticket.'||v_operation,'resource_type','support_ticket','resource_id',v_ticket.id),
   'merchant-support-audit:'||v_audit::text,p_actor_id,1);
 v_result:=jsonb_build_object('ticket',jsonb_build_object('id',v_ticket.id,'site_id',v_ticket.site_id,'ticket_ref',v_ticket.ticket_ref,
  'subject',v_ticket.subject,'topic',v_ticket.topic,'status',v_ticket.status,'created_at',v_ticket.created_at,'updated_at',v_ticket.updated_at),
  'message',jsonb_build_object('id',v_message.id,'author_type','requester','body',v_message.body,'created_at',v_message.created_at));
 UPDATE support_mutation_receipts SET response=v_result WHERE actor_id=p_actor_id AND operation=v_operation AND target=v_target AND idempotency_key=p_key;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.execute_merchant_support_mutation_v1(uuid,uuid,text,uuid,text,jsonb,integer,integer) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.execute_merchant_support_mutation_v1(uuid,uuid,text,uuid,text,jsonb,integer,integer) TO service_role;
COMMIT;
