-- N6 web reload recovery: 348 replay needs private original text, which must
-- never be persisted in browser storage. Read only its canonical committed
-- receipt after CURRENT buyer/epoch, store, ticket and public-message checks.
-- No new writer, table grants, retention policy or alternative receipt store.
BEGIN;
CREATE OR REPLACE FUNCTION public.read_buyer_support_mutation_receipt(
  p_buyer_account_id uuid, p_session_epoch integer, p_site_id uuid,
  p_operation text, p_target_id uuid, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_receipt public.buyer_support_mutation_receipts%ROWTYPE;
  v_ticket public.support_tickets%ROWTYPE;
  v_message public.ticket_messages%ROWTYPE;
BEGIN
  IF p_buyer_account_id IS NULL OR p_session_epoch IS NULL OR p_site_id IS NULL
    OR p_operation IS NULL OR p_operation NOT IN ('create','reply')
    OR (p_operation='create') <> (p_target_id IS NULL)
    OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 200
    OR p_idempotency_key<>btrim(p_idempotency_key) OR p_idempotency_key ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid support receipt request' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.buyer_accounts WHERE id=p_buyer_account_id
    AND status='active' AND session_epoch=p_session_epoch FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buyer session ended' USING ERRCODE='PT401'; END IF;
  SELECT * INTO v_receipt FROM public.buyer_support_mutation_receipts
    WHERE buyer_account_id=p_buyer_account_id AND idempotency_key=p_idempotency_key FOR SHARE;
  IF NOT FOUND OR v_receipt.response IS NULL THEN
    -- This is NOT proof that an in-flight action cannot still commit. Keep its key.
    RAISE EXCEPTION 'Support receipt unavailable' USING ERRCODE='PT404';
  END IF;
  IF v_receipt.operation<>p_operation OR v_receipt.target<>coalesce(p_target_id::text,'new') THEN
    RAISE EXCEPTION 'Support receipt action conflict' USING ERRCODE='PT409';
  END IF;
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id=v_receipt.ticket_id
    AND site_id=p_site_id AND requester_type='customer'
    AND requester_user_id=p_buyer_account_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Support resource unavailable' USING ERRCODE='PT404'; END IF;
  SELECT * INTO v_message FROM public.ticket_messages
    WHERE id=(v_receipt.response->'mutation_receipt'->>'message_id')::uuid
    AND ticket_id=v_ticket.id AND author_id=p_buyer_account_id AND author_type='requester'
    AND visibility='public' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND OR v_message.body IS DISTINCT FROM (CASE WHEN p_operation='create'
    THEN v_receipt.response->'complaint_copy'->>'body' ELSE v_receipt.response->>'body' END)
    OR (p_operation='create' AND v_ticket.subject IS DISTINCT FROM v_receipt.response->'complaint_copy'->>'subject') THEN
    RAISE EXCEPTION 'Support resource unavailable' USING ERRCODE='PT404';
  END IF;
  RETURN v_receipt.response;
END $$;
REVOKE ALL ON FUNCTION public.read_buyer_support_mutation_receipt(uuid,integer,uuid,text,uuid,text)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.read_buyer_support_mutation_receipt(uuid,integer,uuid,text,uuid,text) TO service_role;
COMMIT;
