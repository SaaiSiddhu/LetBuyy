-- F3.7: a ledger idempotency key may replay only the same financial request.
-- A reused (site, source, key) with different currency, lines or stable
-- transaction metadata is a conflict. request_id and top-level provider_event_id
-- are excluded: they can vary across transport retries and distinct provider
-- deliveries for the same payment. Those provider event receipts stay in their
-- own event/payment transaction records.

CREATE OR REPLACE FUNCTION public.post_ledger_transaction(
  p_site_id uuid,
  p_currency text,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_lines jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_site_id uuid;
  v_transaction_id uuid;
  v_existing_id uuid;
  v_existing_currency text;
  v_existing_metadata jsonb;
  v_existing_lines jsonb;
  v_requested_lines jsonb;
  v_line jsonb;
  v_account_id uuid;
  v_sequence integer := 0;
  v_debits bigint := 0;
  v_credits bigint := 0;
  v_side text;
  v_amount bigint;
BEGIN
  v_current_site_id := public.current_site_id();
  IF v_current_site_id IS NULL OR v_current_site_id <> p_site_id THEN
    RAISE EXCEPTION 'tenant GUC site_id is required for ledger posting';
  END IF;

  IF p_currency IS DISTINCT FROM 'INR' THEN
    RAISE EXCEPTION 'ledger currency % is not supported', p_currency;
  END IF;

  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'ledger posting requires at least two lines';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'account_code', item.value->>'account_code',
    'side', item.value->>'side',
    'amount_minor', (item.value->>'amount_minor')::bigint,
    'sequence', item.ordinality::integer,
    'memo', NULLIF(item.value->>'memo', ''),
    'metadata', COALESCE(item.value->'metadata', '{}'::jsonb)
  ) ORDER BY item.ordinality), '[]'::jsonb)
    INTO v_requested_lines
    FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS item(value, ordinality);

  INSERT INTO public.ledger_transactions (
    site_id,
    currency,
    source_type,
    source_id,
    idempotency_key,
    metadata,
    request_id
  )
  VALUES (
    p_site_id,
    p_currency,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb),
    p_request_id
  )
  ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    SELECT id, currency, metadata
      INTO v_existing_id, v_existing_currency, v_existing_metadata
      FROM public.ledger_transactions
     WHERE site_id = p_site_id
       AND source_type = p_source_type
       AND source_id = p_source_id
       AND idempotency_key = p_idempotency_key;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'account_code', account.account_code,
      'side', entry.side,
      'amount_minor', entry.amount_minor,
      'sequence', entry.sequence,
      'memo', entry.memo,
      'metadata', entry.metadata
    ) ORDER BY entry.sequence), '[]'::jsonb)
      INTO v_existing_lines
      FROM public.ledger_entries AS entry
      JOIN public.ledger_accounts AS account ON account.id = entry.account_id
     WHERE entry.transaction_id = v_existing_id;

    IF v_existing_id IS NULL
       OR v_existing_currency IS DISTINCT FROM p_currency
       -- A provider may deliver different authenticated event IDs for the same
       -- capture through verify and webhook paths. Those event receipts live in
       -- payment_webhook_events/payment_transactions; the ledger keeps the first
       -- event ID for reference, but it is not part of accounting request identity.
       OR (COALESCE(v_existing_metadata, '{}'::jsonb) - 'provider_event_id')
          IS DISTINCT FROM (COALESCE(p_metadata, '{}'::jsonb) - 'provider_event_id')
       OR v_existing_lines IS DISTINCT FROM v_requested_lines THEN
      RAISE EXCEPTION 'ledger idempotency key conflicts with a different request payload'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existing_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_sequence := v_sequence + 1;
    v_side := v_line->>'side';
    v_amount := (v_line->>'amount_minor')::bigint;

    IF v_side NOT IN ('debit', 'credit') OR v_amount <= 0 THEN
      RAISE EXCEPTION 'invalid ledger line at sequence %', v_sequence;
    END IF;

    IF v_side = 'debit' THEN
      v_debits := v_debits + v_amount;
    ELSE
      v_credits := v_credits + v_amount;
    END IF;

    v_account_id := public.ensure_ledger_account(p_site_id, p_currency, v_line->>'account_code');

    INSERT INTO public.ledger_entries (
      transaction_id,
      site_id,
      account_id,
      currency,
      side,
      amount_minor,
      sequence,
      memo,
      metadata
    )
    VALUES (
      v_transaction_id,
      p_site_id,
      v_account_id,
      p_currency,
      v_side,
      v_amount,
      v_sequence,
      NULLIF(v_line->>'memo', ''),
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'ledger posting must balance: debit=% credit=%', v_debits, v_credits;
  END IF;

  RETURN v_transaction_id;
END;
$$;
