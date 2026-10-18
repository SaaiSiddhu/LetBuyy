-- Restore the pre-288 canonical writer. No ledger rows or idempotency records
-- are altered by this migration or its rollback.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('post_ledger_transaction', 'public.post_ledger_transaction(uuid,text,text,text,text,jsonb,jsonb,text)', ARRAY['p_site_id','p_currency','p_source_type','p_source_id','p_idempotency_key','p_lines','p_metadata','p_request_id']::text[], 'uuid', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 288 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 288 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

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

  IF p_currency <> 'INR' THEN
    RAISE EXCEPTION 'ledger currency % is not supported', p_currency;
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'ledger posting requires at least two lines';
  END IF;

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
    SELECT id INTO v_existing_id
      FROM public.ledger_transactions
     WHERE site_id = p_site_id
       AND source_type = p_source_type
       AND source_id = p_source_id
       AND idempotency_key = p_idempotency_key;
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

COMMIT;
