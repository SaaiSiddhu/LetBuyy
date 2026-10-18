-- Phase 2 / F3.5: a buyer complaint and its canonical support ticket are one write.
-- The Gateway has already authenticated the buyer session, checked its epoch and derived the
-- requester id. This service-role-only function keeps the first public message from being lost
-- behind a partially created ticket if either insert fails.

BEGIN;

CREATE OR REPLACE FUNCTION public.open_buyer_support_ticket_with_complaint(
  p_ticket_ref text,
  p_first_response_due_at timestamptz,
  p_resolution_due_at timestamptz,
  p_site_id uuid,
  p_requester_user_id uuid,
  p_subject text,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_ticket public.support_tickets%ROWTYPE;
  v_message public.ticket_messages%ROWTYPE;
BEGIN
  IF p_ticket_ref IS NULL OR btrim(p_ticket_ref) = ''
     OR p_requester_user_id IS NULL
     OR p_subject IS NULL OR btrim(p_subject) = ''
     OR p_body IS NULL OR btrim(p_body) = ''
     OR p_first_response_due_at IS NULL
     OR p_resolution_due_at IS NULL THEN
    RAISE EXCEPTION 'buyer support intake requires a reference, buyer, subject, body and SLA deadlines'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.support_tickets (
    ticket_ref, first_response_due_at, resolution_due_at, site_id,
    requester_type, requester_user_id, subject, channel, status,
    last_customer_message_at, created_at
  )
  VALUES (
    p_ticket_ref, p_first_response_due_at, p_resolution_due_at, p_site_id,
    'customer', p_requester_user_id, btrim(p_subject), 'chat', 'open',
    v_now, v_now
  )
  RETURNING * INTO v_ticket;

  INSERT INTO public.ticket_messages (
    ticket_id, author_type, author_id, visibility, body, created_at
  )
  VALUES (
    v_ticket.id, 'requester', p_requester_user_id, 'public', btrim(p_body), v_now
  )
  RETURNING * INTO v_message;

  RETURN jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'ticket_ref', v_ticket.ticket_ref,
      'subject', v_ticket.subject,
      'status', v_ticket.status,
      'topic', v_ticket.topic,
      'created_at', v_ticket.created_at,
      'last_agent_message_at', v_ticket.last_agent_message_at
    ),
    'message', jsonb_build_object(
      'id', v_message.id,
      'author_type', v_message.author_type,
      'body', v_message.body,
      'created_at', v_message.created_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_buyer_support_ticket_with_complaint(text, timestamptz, timestamptz, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.open_buyer_support_ticket_with_complaint(text, timestamptz, timestamptz, uuid, uuid, text, text)
  TO service_role;

COMMIT;
