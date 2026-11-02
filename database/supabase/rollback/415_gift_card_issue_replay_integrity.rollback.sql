-- Pre-use rollback only. Existing gift card balances and issue intents must not
-- be exposed to the older, non-serializing RPC. Use a forward repair otherwise.
BEGIN;
-- Refuse ABI drift before any schema mutation; CREATE OR REPLACE must not add an overload.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('issue_gift_card', 'public.issue_gift_card(uuid,text,numeric,text,timestamptz,jsonb,uuid,text,text)', ARRAY['p_store_id','p_code','p_initial_value','p_currency','p_expires_at','p_recipient','p_actor_id','p_request_id','p_idempotency_key']::text[], 'jsonb', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 414 refuses to run: % signature or overload set changed', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid = pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 414 refuses to run: % input names or result ABI changed', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.gift_card_accounts LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot restore the unsafe gift-card issue RPC while cards exist; use a forward repair' USING ERRCODE = '55000';
  END IF;
END;
$guard$;

DROP INDEX IF EXISTS public.gift_card_accounts_site_issue_key_unique;

CREATE OR REPLACE FUNCTION public.issue_gift_card(p_store_id uuid, p_code text, p_initial_value numeric, p_currency text DEFAULT 'INR'::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_recipient jsonb DEFAULT '{}'::jsonb, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code_hash text;
  v_code_last4 text;
  v_account gift_card_accounts%ROWTYPE;
  v_balance numeric(12,2);
BEGIN
  IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF p_code IS NULL OR length(BTRIM(p_code)) < 4 THEN
    RAISE EXCEPTION 'gift card code is required';
  END IF;
  IF COALESCE(p_initial_value, 0) <= 0 THEN
    RAISE EXCEPTION 'gift card value must be greater than zero';
  END IF;

  -- Idempotent replay: the same issue key returns the already-issued card.
  SELECT * INTO v_account
    FROM gift_card_accounts
   WHERE site_id = p_store_id
     AND metadata->>'issue_idempotency_key' = p_idempotency_key
     AND deleted_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    v_code_hash := encode(extensions.digest(p_code, 'sha256'), 'hex');
    v_code_last4 := right(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'), 4);

    INSERT INTO gift_card_accounts (
      site_id, code_hash, code_last4, initial_value, balance, currency,
      status, expires_at, customer_id, metadata, created_by, updated_by
    )
    VALUES (
      p_store_id, v_code_hash, v_code_last4, p_initial_value, p_initial_value,
      COALESCE(NULLIF(BTRIM(p_currency), ''), 'INR'),
      'active', p_expires_at,
      NULLIF(p_recipient->>'customer_id', '')::uuid,
      jsonb_strip_nulls(jsonb_build_object(
        'issue_idempotency_key', p_idempotency_key,
        'recipient_email', p_recipient->>'recipient_email',
        'recipient_name', p_recipient->>'recipient_name',
        'note', p_recipient->>'note'
      )),
      p_actor_id, p_actor_id
    )
    ON CONFLICT (site_id, code_hash) DO NOTHING
    RETURNING * INTO v_account;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'gift card code collision; retry issuance';
    END IF;

    INSERT INTO gift_card_ledger_entries (
      site_id, gift_card_account_id, order_id, entry_type, amount, balance_after,
      idempotency_key, request_id, metadata, created_by
    )
    VALUES (
      p_store_id, v_account.id, NULL, 'issued', p_initial_value, p_initial_value,
      'gift_card.issued:' || v_account.id::text,
      p_request_id,
      jsonb_build_object('code_last4', v_account.code_last4),
      p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
  END IF;

  v_balance := public.gift_card_available_balance(v_account.id, p_store_id);

  RETURN jsonb_build_object(
    'id', v_account.id,
    'site_id', v_account.site_id,
    'store_id', v_account.site_id,
    'code_last4', v_account.code_last4,
    'initial_value', v_account.initial_value,
    'balance', v_balance,
    'currency', v_account.currency,
    'status', v_account.status,
    'expires_at', v_account.expires_at,
    'created_at', v_account.created_at
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
