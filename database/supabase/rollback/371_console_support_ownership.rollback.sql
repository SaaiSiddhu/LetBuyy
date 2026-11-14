-- Restore the previous executor without deleting tickets, audit, clocks or durable receipts.
BEGIN;
DROP FUNCTION IF EXISTS public.console_support_ownership_contract_v1();
CREATE OR REPLACE FUNCTION public.execute_operator_support_mutation(
  p_actor_id uuid, p_actor_email text, p_operation text, p_target_id uuid,
  p_idempotency_key text, p_payload jsonb, p_escalation_keywords text[],
  p_first_response_hours integer, p_resolution_business_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_target text := coalesce(p_target_id::text,'new');
  v_hash text;
  v_receipt public.support_mutation_receipts%ROWTYPE;
  v_ticket public.support_tickets%ROWTYPE;
  v_macro public.ticket_macros%ROWTYPE;
  v_csat public.ticket_csat%ROWTYPE;
  v_reply jsonb;
  v_result jsonb;
  v_escalation jsonb := jsonb_build_object('status','not_triggered');
  v_now timestamptz;
  v_due timestamptz;
  v_days integer;
  v_case_id uuid;
  v_survey text;
  v_action text;
  v_resource text := 'support_ticket';
  v_resource_id uuid;
  v_audit jsonb := '{}'::jsonb;
  v_note text;
  v_note_metadata jsonb := '{}'::jsonb;
  v_constraint text;
BEGIN
  IF p_actor_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('create','reply','assign','escalate','resolve','csat','macro')
     OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 200
     OR length(btrim(coalesce(p_payload->>'reason',''))) < 8
     OR ((p_operation IN ('create','macro')) <> (p_target_id IS NULL)) THEN
    RAISE EXCEPTION 'Invalid support mutation' USING ERRCODE='22023';
  END IF;
  IF p_operation='create' AND p_payload->>'topic'='privacy' THEN
    RAISE EXCEPTION 'Privacy requests use buyer intake' USING ERRCODE='22023';
  END IF;
  v_hash := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  -- A concurrent insertion waits on this unique key. A failed transaction removes its claim;
  -- the waiter can then insert. After a successful commit the next SELECT sees its complete receipt.
  INSERT INTO public.support_mutation_receipts (actor_id,operation,target,idempotency_key,request_hash)
  VALUES (p_actor_id,p_operation,v_target,p_idempotency_key,v_hash)
  ON CONFLICT (actor_id,operation,target,idempotency_key) DO NOTHING;
  SELECT * INTO STRICT v_receipt FROM public.support_mutation_receipts
    WHERE actor_id=p_actor_id AND operation=p_operation AND target=v_target AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF v_receipt.request_hash <> v_hash THEN
    RAISE EXCEPTION 'Support mutation key payload conflict' USING ERRCODE='PT409';
  END IF;
  IF p_target_id IS NOT NULL THEN
    SELECT * INTO v_ticket FROM public.support_tickets WHERE id=p_target_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Support ticket not found' USING ERRCODE='P0002'; END IF;
  END IF;
  IF v_receipt.response IS NOT NULL THEN RETURN v_receipt.response; END IF;
  v_now := clock_timestamp();

  IF p_operation='create' THEN
    IF p_first_response_hours NOT BETWEEN 1 AND 168 OR p_resolution_business_days NOT BETWEEN 1 AND 90 THEN
      RAISE EXCEPTION 'Invalid support SLA defaults' USING ERRCODE='22023';
    END IF;
    v_due := v_now; v_days := p_resolution_business_days;
    WHILE v_days > 0 LOOP
      v_due := v_due + interval '1 day';
      IF extract(isodow FROM v_due AT TIME ZONE 'UTC') < 6 THEN v_days := v_days-1; END IF;
    END LOOP;
    INSERT INTO public.support_tickets (ticket_ref,site_id,requester_type,requester_email,requester_user_id,subject,channel,topic,
      priority,status,assignee_id,first_response_due_at,resolution_due_at,last_customer_message_at,metadata,created_by,updated_by)
    VALUES ('SUP-'||extract(year FROM v_now AT TIME ZONE 'UTC')::text||'-'||upper(left(replace(gen_random_uuid()::text,'-',''),8)),
      (p_payload->>'site_id')::uuid,p_payload->>'requester_type',p_payload->>'requester_email',(p_payload->>'requester_user_id')::uuid,
      p_payload->>'subject',p_payload->>'channel',p_payload->>'topic',p_payload->>'priority','open',(p_payload->>'assignee_id')::uuid,
      v_now + make_interval(hours=>p_first_response_hours),v_due,v_now,p_payload->'metadata',p_actor_id,p_actor_id)
    RETURNING * INTO v_ticket;
    INSERT INTO public.ticket_messages (ticket_id,author_type,author_id,author_email,visibility,body,created_by)
    VALUES (v_ticket.id,'requester',(p_payload->>'requester_user_id')::uuid,p_payload->>'requester_email','public',p_payload->>'body',p_actor_id);
    INSERT INTO public.ticket_sla_clocks (ticket_id,clock_type,due_at,created_by,updated_by) VALUES
      (v_ticket.id,'first_response',v_ticket.first_response_due_at,p_actor_id,p_actor_id),
      (v_ticket.id,'resolution',v_ticket.resolution_due_at,p_actor_id,p_actor_id);
    v_action := 'support.ticket.create';
    v_audit := jsonb_build_object('site_id',v_ticket.site_id);
  ELSIF p_operation='reply' THEN
    v_reply := public.reply_to_support_ticket(p_target_id,p_actor_id,p_actor_email,p_payload->>'visibility',p_payload->>'body',
      p_payload->>'status',(p_payload->>'macro_id')::uuid,p_payload->'attachments',p_payload->'metadata',p_payload->>'reason');
    SELECT * INTO STRICT v_ticket FROM public.support_tickets WHERE id=p_target_id;
    -- Migration 264 already writes the reply audit, inside THIS transaction.
  ELSIF p_operation='assign' THEN
    UPDATE public.support_tickets SET assignee_id=(p_payload->>'assignee_id')::uuid,status='pending_internal',updated_by=p_actor_id
      WHERE id=p_target_id RETURNING * INTO v_ticket;
    v_action := 'support.ticket.assign'; v_note := 'Ticket assignment changed.';
    v_audit := jsonb_build_object('assignee_id',v_ticket.assignee_id); v_note_metadata := v_audit;
  ELSIF p_operation='escalate' THEN
    UPDATE public.support_tickets SET status='escalated',escalated_to=p_payload->>'target',
      linked_incident_id=coalesce((p_payload->>'linked_incident_id')::uuid,linked_incident_id),
      metadata=metadata||jsonb_build_object('escalation',coalesce(p_payload->'metadata','{}'::jsonb)),updated_by=p_actor_id
      WHERE id=p_target_id RETURNING * INTO v_ticket;
    IF v_ticket.escalated_to='trust_safety' THEN
      v_case_id := public.link_support_trust_safety_case(v_ticket.id,p_actor_id,p_actor_email,p_payload->>'reason');
      v_escalation := jsonb_build_object('status','linked','ts_case_id',v_case_id);
    END IF;
    v_action := 'support.ticket.escalate';
    v_note := 'Ticket escalated to '||replace(v_ticket.escalated_to,'_',' ')||'.';
    v_audit := jsonb_build_object('target',v_ticket.escalated_to,'linked_ts_case_id',v_case_id,'linked_incident_id',v_ticket.linked_incident_id);
    v_note_metadata := v_audit;
  ELSIF p_operation='resolve' THEN
    v_survey := gen_random_uuid()::text;
    UPDATE public.support_tickets SET status='resolved',resolved_at=v_now,updated_by=p_actor_id WHERE id=p_target_id RETURNING * INTO v_ticket;
    UPDATE public.ticket_sla_clocks SET satisfied_at=v_now,paused=false,updated_by=p_actor_id
      WHERE ticket_id=p_target_id AND clock_type='resolution' AND deleted_at IS NULL;
    INSERT INTO public.ticket_csat (ticket_id,survey_token,requester_email,sent_at,metadata,created_by)
      VALUES (p_target_id,v_survey,v_ticket.requester_email,v_now,'{"delivery_mode":"dry_run"}',p_actor_id);
    v_note := coalesce(nullif(p_payload->>'resolution_note',''),'Ticket resolved. CSAT survey queued on the dry-run path.');
    v_note_metadata := jsonb_build_object('survey_token',v_survey);
    v_action := 'support.ticket.resolve'; v_audit := v_note_metadata;
  ELSIF p_operation='csat' THEN
    SELECT * INTO v_csat FROM public.ticket_csat WHERE ticket_id=p_target_id AND deleted_at IS NULL
      ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CSAT survey not found' USING ERRCODE='P0002'; END IF;
    UPDATE public.ticket_csat SET score=(p_payload->>'score')::integer,comment=p_payload->>'comment',responded_at=v_now,updated_by=p_actor_id
      WHERE id=v_csat.id RETURNING * INTO v_csat;
    v_action := 'support.csat.record'; v_audit := jsonb_build_object('score',v_csat.score);
  ELSE
    INSERT INTO public.ticket_macros (name,description,topic,body,is_active,tags,metadata,created_by,updated_by)
    VALUES (p_payload->>'name',p_payload->>'description',p_payload->>'topic',p_payload->>'body',(p_payload->>'is_active')::boolean,
      ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags')),p_payload->'metadata',p_actor_id,p_actor_id) RETURNING * INTO v_macro;
    v_action := 'support.macro.create'; v_resource := 'ticket_macro'; v_audit := jsonb_build_object('topic',v_macro.topic);
  END IF;

  -- Automatic keyword escalation is inside the action transaction. A privacy-rule refusal keeps
  -- the valid reply but records that refusal; every case/evidence/event/link failure rolls it ALL back.
  IF p_operation IN ('create','reply') AND EXISTS (SELECT 1 FROM unnest(p_escalation_keywords) keyword WHERE position(lower(keyword) in lower(concat_ws(' ',v_ticket.subject,p_payload->>'body',p_payload->>'reason'))) > 0) AND v_ticket.linked_ts_case_id IS NULL THEN
    BEGIN
      UPDATE public.support_tickets SET status='escalated',escalated_to='trust_safety',updated_by=p_actor_id WHERE id=v_ticket.id;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
      IF v_constraint='support_tickets_privacy_open_request_uidx' THEN
        v_escalation := jsonb_build_object('status','refused','reason','privacy_request_conflict');
      ELSE RAISE; END IF;
    END;
    IF v_escalation->>'status'<>'refused' THEN
      v_case_id := public.link_support_trust_safety_case(v_ticket.id,p_actor_id,p_actor_email,p_payload->>'reason');
      v_escalation := jsonb_build_object('status','linked','ts_case_id',v_case_id);
      INSERT INTO public.ticket_messages (ticket_id,author_type,author_id,visibility,body,metadata,created_by)
      VALUES (v_ticket.id,'system',p_actor_id,'internal','Ticket escalated to Trust & Safety because the thread mentioned fraud, abuse, or chargeback risk.',
        jsonb_build_object('linked_ts_case_id',v_case_id),p_actor_id);
      INSERT INTO public.audit_logs (actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata,created_at)
      VALUES (p_actor_id,'employee',p_actor_email,'support.ticket.escalate','support_ticket',v_ticket.id,
        jsonb_build_object('target','trust_safety','trigger','keyword','linked_ts_case_id',v_case_id,'reason',p_payload->>'reason'),clock_timestamp());
    END IF;
  END IF;
  IF v_note IS NOT NULL THEN
    INSERT INTO public.ticket_messages (ticket_id,author_type,author_id,visibility,body,metadata,created_by)
    VALUES (v_ticket.id,'system',p_actor_id,'internal',v_note,v_note_metadata,p_actor_id);
  END IF;
  IF v_action IS NOT NULL THEN
    v_resource_id := CASE WHEN p_operation='macro' THEN v_macro.id ELSE v_ticket.id END;
    INSERT INTO public.audit_logs (actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
    VALUES (p_actor_id,'employee',p_actor_email,v_action,v_resource,v_resource_id,
      v_audit||jsonb_build_object('reason',p_payload->>'reason'));
  END IF;
  IF p_operation='macro' THEN v_result := jsonb_build_object('macro',to_jsonb(v_macro));
  ELSIF p_operation='csat' THEN v_result := jsonb_build_object('csat',to_jsonb(v_csat));
  ELSE
    SELECT * INTO STRICT v_ticket FROM public.support_tickets WHERE id=v_ticket.id;
    v_result := jsonb_build_object('ticket',to_jsonb(v_ticket));
    IF p_operation IN ('create','reply','escalate') THEN
      v_result := v_result||jsonb_build_object('trust_safety_escalation',v_escalation,'linked_ts_case_id',v_case_id);
    END IF;
    IF p_operation='reply' THEN v_result := v_result||jsonb_build_object('message',v_reply->'message'); END IF;
    IF p_operation='resolve' THEN v_result := v_result||jsonb_build_object('csat_survey_token',v_survey); END IF;
  END IF;
  UPDATE public.support_mutation_receipts SET response=v_result
    WHERE actor_id=p_actor_id AND operation=p_operation AND target=v_target AND idempotency_key=p_idempotency_key;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
  IF v_constraint='support_tickets_privacy_open_request_uidx' THEN
    RAISE EXCEPTION 'support_ticket_privacy_request_conflict' USING ERRCODE='23505';
  END IF;
  RAISE;
END $$;
REVOKE ALL ON FUNCTION public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.execute_operator_support_mutation(uuid,text,text,uuid,text,jsonb,text[],integer,integer) TO service_role;
COMMIT;
