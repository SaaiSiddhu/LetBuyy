-- Rollback for 207_gift_card_issue_idempotency_advisory_lock.sql.
-- Restores migration 173's issue_gift_card definition exactly -- same
-- signature, same body, minus the Phase R5 advisory-lock PERFORM
-- statement. Verified by diff against 173_v1_gift_card_issuance_lifecycle.sql
-- during authoring: identical apart from that one statement.
--
-- Rolling back re-opens the varying-code double-issuance defect Phase R5
-- measured and closed (tests/executable/gift-card-issue-idempotency-postgres.
-- test.mjs) -- only use this if the advisory lock itself is found to be
-- unsafe (e.g. a deadlock under some scenario this phase's testing did not
-- cover).

BEGIN;

DROP FUNCTION IF EXISTS public.issue_gift_card(
    uuid, text, numeric, text, timestamp with time zone, jsonb, uuid, text, text
);

CREATE OR REPLACE FUNCTION public.issue_gift_card(
  p_store_id uuid,
  p_code text,
  p_initial_value numeric,
  p_currency text DEFAULT 'INR',
  p_expires_at timestamp with time zone DEFAULT NULL,
  p_recipient jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    v_code_hash := encode(digest(p_code, 'sha256'), 'hex');
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
$$;

COMMIT;
