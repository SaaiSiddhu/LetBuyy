-- P2-OPERATOR-QUEUE-CORRECTNESS (2026-10-02): an operator's reply to a support ticket is ONE transaction.
--
-- Before this migration, POST /v1/operations/support/tickets/:id/messages (services/api-gateway/src/routes/operations/
-- support.ts) made separate PostgREST calls: insert the message, update the ticket's status (result ignored), update the SLA
-- clocks (results ignored), insert the audit row (result ignored), then answer 200. When the database refused the status
-- change -- support_tickets_privacy_open_request_uidx (migration 262) refuses to reopen a closed privacy request while a newer
-- one of the same type is unresolved -- the message stayed, an audit row said the reply had happened, and the route answered
-- success. A ticket soft-deleted between the route's read and its writes was written to as if it were live.
--
-- reply_to_support_ticket does the whole reply in the caller's transaction (one PostgREST request), under a row lock:
--   1. lock the live ticket (deleted_at IS NULL) FOR UPDATE; none -> SQLSTATE P0002 'support ticket not found';
--   2. decide the new status: the caller's, or the reply's default (a public reply waits on the customer; an internal note
--      leaves the status alone) -- the rule the route applied before;
--   3. update the ticket: status, first_response_at (a public reply sets it once and never moves it), last_agent_message_at,
--      updated_by. A unique violation of the privacy index is re-raised as 23505 'support_ticket_privacy_request_conflict',
--      without the key values, so the gateway can answer 409;
--   4. insert the agent's message;
--   5. the SLA clock bookkeeping the route did: a first response satisfies the first-response clock, and waiting on the
--      customer pauses an unsatisfied resolution clock;
--   6. insert the audit row ('support.ticket.reply' or 'support.ticket.internal_note').
-- Any failure rolls back all of it. The Trust & Safety follow-on (a reply that mentions fraud and the like escalates the ticket)
-- is NOT here: it is a best-effort step the route runs after this commits, and reports on its own.
--
-- Times: v_now is clock_timestamp() taken AFTER the lock, so replies that queue on one ticket are stamped in the order they
-- commit (now() is the transaction's start, which can precede a reply that committed earlier). The message, the ticket's times,
-- the clock and the audit row all carry v_now.
--
-- Privilege: SECURITY DEFINER with a fixed search_path. EXECUTE is revoked from PUBLIC, anon, authenticated and app_tenant by
-- name (migration 256's rule; ratchet tests/governance/definer-function-api-roles.test.mjs) and granted to service_role, the
-- role of the gateway's PostgREST client. The function trusts its caller for who the actor is and whether they may reply: the
-- gateway establishes both (the ops gate and requirePermission('support:reply')) before it calls.
--
-- Rollback: database/supabase/rollback/264_support_ticket_reply_atomic.rollback.sql drops the function. The gateway's reply
-- route calls it, so rolling this migration back must ship with rolling that route back.

BEGIN;

CREATE OR REPLACE FUNCTION public.reply_to_support_ticket(
  p_ticket_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_visibility text,
  p_body text,
  p_status text,
  p_macro_id uuid,
  p_attachments jsonb,
  p_metadata jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_message public.ticket_messages%ROWTYPE;
  v_previous_status text;
  v_status text;
  v_first_response_at timestamptz;
  v_now timestamptz;
  v_constraint text;
BEGIN
  IF p_ticket_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'reply_to_support_ticket: a ticket and an actor are required' USING ERRCODE = '22023';
  END IF;
  IF p_visibility IS NULL OR p_visibility NOT IN ('public', 'internal') THEN
    RAISE EXCEPTION 'reply_to_support_ticket: visibility must be public or internal' USING ERRCODE = '22023';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'reply_to_support_ticket: a reply needs a body' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reply_to_support_ticket: a reply needs a reason' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'reply_to_support_ticket: unknown status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket
    FROM public.support_tickets
   WHERE id = p_ticket_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support ticket not found' USING ERRCODE = 'P0002';
  END IF;

  v_now := clock_timestamp();
  v_previous_status := v_ticket.status;
  v_status := coalesce(p_status, CASE WHEN p_visibility = 'public' THEN 'pending_customer' ELSE v_ticket.status END);
  v_first_response_at := CASE WHEN p_visibility = 'public' THEN coalesce(v_ticket.first_response_at, v_now) ELSE v_ticket.first_response_at END;

  BEGIN
    UPDATE public.support_tickets
       SET status = v_status,
           first_response_at = v_first_response_at,
           last_agent_message_at = v_now,
           updated_by = p_actor_id
     WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'support_tickets_privacy_open_request_uidx' THEN
      RAISE EXCEPTION 'support_ticket_privacy_request_conflict' USING ERRCODE = '23505';
    END IF;
    RAISE;
  END;

  INSERT INTO public.ticket_messages (
    ticket_id, author_type, author_id, author_email, visibility, body, macro_id, attachments, metadata, created_at, created_by
  )
  VALUES (
    p_ticket_id, 'agent', p_actor_id, p_actor_email, p_visibility, p_body, p_macro_id,
    coalesce(p_attachments, '[]'::jsonb), coalesce(p_metadata, '{}'::jsonb), v_now, p_actor_id
  )
  RETURNING * INTO v_message;

  IF v_first_response_at IS NOT NULL THEN
    UPDATE public.ticket_sla_clocks
       SET satisfied_at = v_first_response_at,
           updated_by = p_actor_id
     WHERE ticket_id = p_ticket_id
       AND clock_type = 'first_response';
  END IF;
  IF v_status = 'pending_customer' THEN
    UPDATE public.ticket_sla_clocks
       SET paused = true,
           paused_at = v_now,
           updated_by = p_actor_id
     WHERE ticket_id = p_ticket_id
       AND clock_type = 'resolution'
       AND satisfied_at IS NULL;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_type, actor_email, action, resource_type, resource_id, metadata, created_at)
  VALUES (
    p_actor_id,
    'employee',
    p_actor_email,
    CASE WHEN p_visibility = 'internal' THEN 'support.ticket.internal_note' ELSE 'support.ticket.reply' END,
    'support_ticket',
    p_ticket_id,
    jsonb_build_object(
      'visibility', p_visibility,
      'status', v_status,
      'previous_status', v_previous_status,
      'message_id', v_message.id,
      'reason', p_reason
    ),
    v_now
  );

  RETURN jsonb_build_object('ticket', to_jsonb(v_ticket), 'message', to_jsonb(v_message));
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_support_ticket(uuid, uuid, text, text, text, text, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.reply_to_support_ticket(uuid, uuid, text, text, text, text, uuid, jsonb, jsonb, text) TO service_role;

COMMIT;
