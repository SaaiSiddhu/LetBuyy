-- Restore the transaction lock lost when migration 215 replaced issue_gift_card.
-- A reused issue intent may reveal the original account, never a newly generated code.
BEGIN;

-- The RPC lock protects callers of this function; the index protects the
-- intent invariant even if a future writer bypasses that function. Existing
-- duplicate issue keys must be reconciled before this migration can apply.
CREATE UNIQUE INDEX IF NOT EXISTS gift_card_accounts_site_issue_key_unique
  ON public.gift_card_accounts (site_id, (metadata->>'issue_idempotency_key'))
  WHERE metadata ? 'issue_idempotency_key';

CREATE OR REPLACE FUNCTION public.issue_gift_card(
  p_store_id uuid,
  p_code text,
  p_initial_value numeric,
  p_currency text DEFAULT 'INR',
  p_expires_at timestamptz DEFAULT NULL,
  p_recipient jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_code_hash text;
  v_code_last4 text;
  v_account gift_card_accounts%ROWTYPE;
  v_balance numeric(12,2);
  v_replayed boolean := false;
  v_currency text := COALESCE(NULLIF(BTRIM(p_currency), ''), 'INR');
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

  -- Serialize same-site, same-intent requests before the existence check.
  -- Seed 1 keeps the lock separate from checkout's seed-0 namespace.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 1));

  SELECT * INTO v_account
    FROM gift_card_accounts
   WHERE site_id = p_store_id
     AND metadata->>'issue_idempotency_key' = p_idempotency_key
   LIMIT 1;

  IF FOUND THEN
    v_replayed := true;
    IF v_account.initial_value IS DISTINCT FROM p_initial_value
       OR v_account.currency IS DISTINCT FROM v_currency
       OR v_account.expires_at IS DISTINCT FROM p_expires_at
       OR v_account.metadata->>'recipient_email' IS DISTINCT FROM p_recipient->>'recipient_email'
       OR v_account.metadata->>'recipient_name' IS DISTINCT FROM p_recipient->>'recipient_name'
       OR v_account.metadata->>'note' IS DISTINCT FROM p_recipient->>'note' THEN
      RAISE EXCEPTION 'gift card issue intent conflict' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_code_hash := encode(extensions.digest(p_code, 'sha256'), 'hex');
    v_code_last4 := right(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'), 4);

    INSERT INTO gift_card_accounts (
      site_id, code_hash, code_last4, initial_value, balance, currency,
      status, expires_at, customer_id, metadata, created_by, updated_by
    ) VALUES (
      p_store_id, v_code_hash, v_code_last4, p_initial_value, p_initial_value,
      v_currency, 'active', p_expires_at,
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
    ) VALUES (
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
    'created_at', v_account.created_at,
    'replayed', v_replayed
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
