-- Non-content admission receipts only. No prompt, history, answer, credential or
-- monetary amount is stored. Reservations are conservative token-bound units,
-- not billed usage. No refund/reset after an ambiguous external dispatch.
BEGIN;
CREATE TABLE public.buyer_ai_daily_quotas (
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  quota_day date NOT NULL,
  requests_reserved integer NOT NULL CHECK (requests_reserved >= 0),
  tokens_reserved bigint NOT NULL CHECK (tokens_reserved >= 0),
  PRIMARY KEY (buyer_account_id, quota_day)
);
CREATE TABLE public.buyer_ai_operations (
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  session_epoch bigint NOT NULL CHECK (session_epoch >= 0),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  profile_id text NOT NULL CHECK (length(profile_id) BETWEEN 1 AND 80),
  reserved_tokens integer NOT NULL CHECK (reserved_tokens > 0),
  state text NOT NULL CHECK (state IN ('reserved','dispatched','completed','outcome_unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_account_id, request_id)
);
ALTER TABLE public.buyer_ai_daily_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_ai_daily_quotas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_ai_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_ai_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY buyer_ai_daily_owner ON public.buyer_ai_daily_quotas
  USING (buyer_account_id::text = nullif(current_setting('app.buyer_account_id', true), ''))
  WITH CHECK (buyer_account_id::text = nullif(current_setting('app.buyer_account_id', true), ''));
CREATE POLICY buyer_ai_operation_owner ON public.buyer_ai_operations
  USING (buyer_account_id::text = nullif(current_setting('app.buyer_account_id', true), ''))
  WITH CHECK (buyer_account_id::text = nullif(current_setting('app.buyer_account_id', true), ''));
REVOKE ALL ON public.buyer_ai_daily_quotas, public.buyer_ai_operations FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE FUNCTION public.reserve_buyer_ai_request(
  p_buyer_account_id uuid, p_session_epoch bigint, p_conversation_id uuid,
  p_request_id uuid, p_payload_hash text, p_profile_id text,
  p_request_limit integer, p_token_limit bigint, p_reserved_tokens integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_account public.buyer_accounts%ROWTYPE;
  v_existing public.buyer_ai_operations%ROWTYPE;
  v_day date := (statement_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_session_epoch IS NULL OR p_session_epoch < 0 OR p_conversation_id IS NULL OR p_request_id IS NULL
    OR p_payload_hash IS NULL OR p_payload_hash !~ '^[a-f0-9]{64}$'
    OR p_profile_id IS NULL OR length(p_profile_id) NOT BETWEEN 1 AND 80
    OR p_request_limit IS NULL OR p_request_limit NOT BETWEEN 1 AND 10000
    OR p_token_limit IS NULL OR p_token_limit NOT BETWEEN 1 AND 100000000
    OR p_reserved_tokens IS NULL OR p_reserved_tokens NOT BETWEEN 1 AND 2000000 THEN
    RAISE EXCEPTION 'Invalid AI admission' USING ERRCODE = '22023';
  END IF;
  -- Same lock order in every RPC: live account, then operation/counter. It also
  -- serializes first requests and session revocation against admission.
  SELECT * INTO v_account FROM public.buyer_accounts WHERE id=p_buyer_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.status <> 'active' OR v_account.session_epoch <> p_session_epoch THEN
    RETURN jsonb_build_object('status','unauthorized');
  END IF;
  SELECT * INTO v_existing FROM public.buyer_ai_operations
    WHERE buyer_account_id=p_buyer_account_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.session_epoch <> p_session_epoch OR v_existing.conversation_id <> p_conversation_id
      OR v_existing.payload_hash <> p_payload_hash OR v_existing.profile_id <> p_profile_id THEN
      RETURN jsonb_build_object('status','conflict');
    END IF;
    RETURN jsonb_build_object('status',CASE v_existing.state
      WHEN 'completed' THEN 'result_unavailable'
      WHEN 'outcome_unknown' THEN 'outcome_unknown' ELSE 'in_progress' END);
  END IF;
  INSERT INTO public.buyer_ai_daily_quotas VALUES(p_buyer_account_id,v_day,0,0)
    ON CONFLICT DO NOTHING;
  UPDATE public.buyer_ai_daily_quotas SET requests_reserved=requests_reserved+1,
      tokens_reserved=tokens_reserved+p_reserved_tokens
    WHERE buyer_account_id=p_buyer_account_id AND quota_day=v_day
      AND requests_reserved < p_request_limit
      AND tokens_reserved <= p_token_limit-p_reserved_tokens;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','quota_exceeded'); END IF;
  INSERT INTO public.buyer_ai_operations(buyer_account_id,request_id,conversation_id,
    session_epoch,payload_hash,profile_id,reserved_tokens,state)
    VALUES(p_buyer_account_id,p_request_id,p_conversation_id,p_session_epoch,
      p_payload_hash,p_profile_id,p_reserved_tokens,'reserved');
  RETURN jsonb_build_object('status','reserved');
END;
$$;

CREATE FUNCTION public.transition_buyer_ai_request(
  p_buyer_account_id uuid, p_session_epoch bigint, p_request_id uuid,
  p_from_state text, p_to_state text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_account public.buyer_accounts%ROWTYPE;
BEGIN
  IF NOT ((p_from_state='reserved' AND p_to_state='dispatched') OR
    (p_from_state='dispatched' AND p_to_state IN ('completed','outcome_unknown'))) THEN
    RAISE EXCEPTION 'Invalid AI transition' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_account FROM public.buyer_accounts WHERE id=p_buyer_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.status <> 'active' OR v_account.session_epoch <> p_session_epoch THEN RETURN false; END IF;
  UPDATE public.buyer_ai_operations SET state=p_to_state, updated_at=statement_timestamp()
    WHERE buyer_account_id=p_buyer_account_id AND session_epoch=p_session_epoch
      AND request_id=p_request_id AND state=p_from_state;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer) FROM PUBLIC,anon,authenticated,app_tenant;
REVOKE ALL ON FUNCTION public.transition_buyer_ai_request(uuid,bigint,uuid,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_buyer_ai_request(uuid,bigint,uuid,text,text) TO service_role;
COMMIT;
