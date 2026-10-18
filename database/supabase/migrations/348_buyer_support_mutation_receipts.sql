-- N6.6-SUPPORT-MUTATION-RECOVERY-01. Extend the canonical buyer support writer.
-- Reproduced before repair through the production worker: one key created two
-- tickets/complaints, and one key posted two public requester messages.
-- A claim, ticket/message, audit, applicable canonical audit outbox event and
-- recorded response commit together. A failed attempt leaves no claim.
-- Rollback intentionally retains committed receipts, with access revoked, so
-- reapplying cannot turn a previously committed action into a second effect.
BEGIN;

CREATE TABLE IF NOT EXISTS public.buyer_support_mutation_receipts (
  buyer_account_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  operation text NOT NULL CHECK (operation IN ('create','reply')),
  target text NOT NULL,
  request_hash text NOT NULL,
  ticket_id uuid,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (buyer_account_id,idempotency_key)
);
ALTER TABLE public.buyer_support_mutation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_support_mutation_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.buyer_support_mutation_receipts FROM PUBLIC, anon, authenticated, app_tenant;
GRANT SELECT, INSERT, UPDATE ON public.buyer_support_mutation_receipts TO service_role;
DROP POLICY IF EXISTS buyer_support_mutation_receipts_backend ON public.buyer_support_mutation_receipts;
CREATE POLICY buyer_support_mutation_receipts_backend ON public.buyer_support_mutation_receipts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS buyer_support_ticket_history_idx ON public.support_tickets
  (requester_user_id,created_at DESC,id DESC)
  WHERE requester_type='customer' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS buyer_support_public_history_idx ON public.ticket_messages
  (ticket_id,created_at ASC,id ASC) WHERE visibility='public' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.execute_buyer_support_mutation(
  p_buyer_account_id uuid, p_session_epoch integer, p_operation text,
  p_target_id uuid, p_idempotency_key text, p_payload jsonb,
  p_ticket_ref text, p_first_response_due_at timestamptz, p_resolution_due_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_target text := coalesce(p_target_id::text,'new');
  v_payload jsonb;
  v_hash text;
  v_receipt public.buyer_support_mutation_receipts%ROWTYPE;
  v_ticket public.support_tickets%ROWTYPE;
  v_message public.ticket_messages%ROWTYPE;
  v_intake jsonb;
  v_response jsonb;
  v_body text;
  v_subject text;
  v_site uuid;
  v_order uuid;
  v_order_site uuid;
  v_now timestamptz;
  v_audit_id uuid;
  v_action text;
BEGIN
  IF p_buyer_account_id IS NULL OR p_session_epoch IS NULL
     OR p_operation IS NULL OR p_operation NOT IN ('create','reply')
     OR (p_operation='create') <> (p_target_id IS NULL)
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 200
     OR p_idempotency_key <> btrim(p_idempotency_key) OR p_idempotency_key ~ '[[:cntrl:]]'
     OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR jsonb_typeof(p_payload->'body') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Invalid buyer support mutation' USING ERRCODE='22023';
  END IF;
  v_body := btrim(p_payload->>'body');
  IF length(v_body) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Invalid buyer support message' USING ERRCODE='22023';
  END IF;
  IF p_operation='create' THEN
    IF jsonb_typeof(p_payload->'subject') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid buyer support subject' USING ERRCODE='22023';
    END IF;
    v_subject := btrim(p_payload->>'subject');
    IF length(v_subject) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Invalid buyer support subject' USING ERRCODE='22023';
    END IF;
    v_site := (p_payload->>'site_id')::uuid;
    v_order := (p_payload->>'order_id')::uuid;
    v_payload := jsonb_build_object('subject',v_subject,'body',v_body,'site_id',v_site,'order_id',v_order);
  ELSE
    v_payload := jsonb_build_object('body',v_body);
  END IF;

  -- Lock current authority before either a new effect or cached result. A token
  -- passing middleware before revocation cannot bypass this transaction check.
  -- SHARE (not KEY SHARE) also orders session-epoch/status updates against it.
  PERFORM 1 FROM public.buyer_accounts
    WHERE id=p_buyer_account_id AND status='active' AND session_epoch=p_session_epoch FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buyer session ended' USING ERRCODE='PT401'; END IF;
  IF v_order IS NOT NULL THEN
    SELECT l.site_id INTO v_order_site FROM public.buyer_order_links l
      JOIN public.orders o ON o.id=l.order_id AND o.site_id=l.site_id
      WHERE l.buyer_account_id=p_buyer_account_id AND l.order_id=v_order FOR SHARE OF l,o;
    IF NOT FOUND OR (v_site IS NOT NULL AND v_site<>v_order_site) THEN
      RAISE EXCEPTION 'Order not found' USING ERRCODE='PT404';
    END IF;
    v_site := v_order_site;
    v_payload := jsonb_set(v_payload,'{site_id}',to_jsonb(v_site));
  END IF;

  -- A buyer's key cannot change operation, resource or normalized intent. The
  -- buyer namespace prevents another actor from observing or taking its result.
  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'operation',p_operation,'target',v_target,'payload',v_payload)::text,'UTF8')),'hex');
  INSERT INTO public.buyer_support_mutation_receipts
    (buyer_account_id,idempotency_key,operation,target,request_hash)
    VALUES(p_buyer_account_id,p_idempotency_key,p_operation,v_target,v_hash)
    ON CONFLICT(buyer_account_id,idempotency_key) DO NOTHING;
  SELECT * INTO STRICT v_receipt FROM public.buyer_support_mutation_receipts
    WHERE buyer_account_id=p_buyer_account_id AND idempotency_key=p_idempotency_key FOR UPDATE;

  IF p_target_id IS NOT NULL OR v_receipt.ticket_id IS NOT NULL THEN
    SELECT * INTO v_ticket FROM public.support_tickets
      WHERE id=coalesce(p_target_id,v_receipt.ticket_id) AND requester_user_id=p_buyer_account_id
        AND requester_type='customer' AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Support ticket not found' USING ERRCODE='PT404'; END IF;
  END IF;
  IF v_receipt.operation<>p_operation OR v_receipt.target<>v_target OR v_receipt.request_hash<>v_hash THEN
    RAISE EXCEPTION 'Support request key is already bound to another intent' USING ERRCODE='PT409';
  END IF;
  IF v_receipt.response IS NOT NULL THEN
    PERFORM 1 FROM public.ticket_messages
      WHERE id=(v_receipt.response->'mutation_receipt'->>'message_id')::uuid
        AND ticket_id=v_ticket.id AND author_type='requester' AND author_id=p_buyer_account_id
        AND visibility='public' AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Support message not found' USING ERRCODE='PT404'; END IF;
    RETURN v_receipt.response;
  END IF;
  v_now := clock_timestamp();

  IF p_operation='create' THEN
    -- Reuse the one canonical complaint+first-message insertion and SLA inputs.
    v_intake := public.open_buyer_support_ticket_with_complaint(p_ticket_ref,
      p_first_response_due_at,p_resolution_due_at,v_site,p_buyer_account_id,v_subject,v_body);
    SELECT * INTO STRICT v_ticket FROM public.support_tickets WHERE id=(v_intake->'ticket'->>'id')::uuid;
    SELECT * INTO STRICT v_message FROM public.ticket_messages WHERE id=(v_intake->'message'->>'id')::uuid;
    IF v_order IS NOT NULL THEN
      UPDATE public.support_tickets SET metadata=metadata||jsonb_build_object('order_id',v_order)
        WHERE id=v_ticket.id;
    END IF;
    v_response := (v_intake->'ticket')||jsonb_build_object(
      'complaint_copy',jsonb_build_object('subject',v_ticket.subject,'body',v_message.body,'recorded_at',v_message.created_at),
      'receipt_confirmed_at',v_message.created_at);
    v_action := 'buyer.support.ticket.create';
  ELSE
    INSERT INTO public.ticket_messages(ticket_id,author_type,author_id,visibility,body,created_at)
      VALUES(v_ticket.id,'requester',p_buyer_account_id,'public',v_body,v_now) RETURNING * INTO v_message;
    UPDATE public.support_tickets SET last_customer_message_at=v_now,
      status=CASE WHEN status='pending_customer' THEN 'pending_internal' ELSE status END
      WHERE id=v_ticket.id;
    v_response := jsonb_build_object('id',v_message.id,'author_type','requester','body',v_message.body,'created_at',v_message.created_at);
    v_site := v_ticket.site_id;
    v_action := 'buyer.support.ticket.reply';
  END IF;

  INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata,created_at)
    VALUES(p_buyer_account_id,'user',v_action,'support_ticket',v_ticket.id,
      jsonb_build_object('realm','buyer','message_id',v_message.id,'request_hash',v_hash),v_now) RETURNING id INTO v_audit_id;
  -- The canonical audit.recorded contract requires a real site. General platform
  -- tickets have no fabricated site and retain their atomic audit row only.
  -- No message body/email is copied to analytics/webhooks; no worker is activated.
  IF v_site IS NOT NULL THEN
    INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,actor_id,schema_version)
      VALUES(v_site,v_site,'audit',v_audit_id::text,'audit.recorded',
        jsonb_build_object('site_id',v_site,'audit_id',v_audit_id,'action',v_action,
          'resource_type','support_ticket','resource_id',v_ticket.id,'message_id',v_message.id),
        'buyer-support-audit:'||v_audit_id::text,p_buyer_account_id,1);
  END IF;
  v_response := v_response||jsonb_build_object('mutation_receipt',jsonb_build_object(
    'key',p_idempotency_key,'operation',p_operation,'ticket_id',v_ticket.id,
    'message_id',v_message.id,'confirmed_at',v_message.created_at));
  UPDATE public.buyer_support_mutation_receipts SET ticket_id=v_ticket.id,response=v_response
    WHERE buyer_account_id=p_buyer_account_id AND idempotency_key=p_idempotency_key;
  RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION public.execute_buyer_support_mutation(uuid,integer,text,uuid,text,jsonb,text,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.execute_buyer_support_mutation(uuid,integer,text,uuid,text,jsonb,text,timestamptz,timestamptz)
  TO service_role;
COMMIT;
