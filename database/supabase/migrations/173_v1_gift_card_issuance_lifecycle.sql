-- V1 LB-11: Gift card issuance + lifecycle (canonical model cutover).
--
-- The canonical redemption path (public.create_checkout_order) reads
-- public.gift_card_accounts and projects the spendable balance from
-- public.gift_card_ledger_entries. Issuance previously wrote the legacy
-- public.gift_cards table, which the redemption never reads -- so a gift card
-- issued from the merchant UI could never be redeemed at checkout.
--
-- These functions make issuance + lifecycle write the SAME canonical model the
-- checkout already expects. The balance is never stored mutably: the ledger
-- projection is the single source of truth (identical to create_checkout_order
-- and enforced by the canonical-ledger-only validator). gift_card_accounts.balance
-- stays the issued snapshot and is never decremented.
--
-- Additive + replayable: CREATE OR REPLACE FUNCTION only. All three tables
-- (gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions) and
-- their RLS already exist in the baseline. No table/column/index changes.

-- 1) Spendable balance projection -- the SAME formula create_checkout_order uses
--    to derive the redeemable balance, exposed as a reusable function so the
--    listing, validation, and status surfaces all read one canonical projection.
CREATE OR REPLACE FUNCTION public.gift_card_available_balance(p_account_id uuid, p_site_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric(12,2);
BEGIN
  SELECT COALESCE(
    SUM(
      CASE
        WHEN entry_type IN ('issued', 'credit', 'refund_credit', 'release') THEN amount
        WHEN entry_type IN ('debit', 'hold', 'expire', 'fraud_hold') THEN -amount
        ELSE 0
      END
    ),
    (SELECT COALESCE(initial_value, balance, 0)
       FROM gift_card_accounts
      WHERE id = p_account_id AND site_id = p_site_id)
  )
  INTO v_balance
  FROM gift_card_ledger_entries
  WHERE gift_card_account_id = p_account_id
    AND site_id = p_site_id
    AND deleted_at IS NULL;

  RETURN GREATEST(COALESCE(v_balance, 0), 0);
END;
$$;

-- 2) Issue a gift card into the canonical model: one account row + one 'issued'
--    ledger entry, atomically. The plaintext code is hashed with the SAME digest
--    create_checkout_order uses for lookup, so the issued card is immediately
--    redeemable. Only the hash + last4 are stored; the plaintext is returned to
--    the caller once and never persisted. Idempotent on p_idempotency_key.
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

-- 3) Merchant listing -- canonical accounts with the projected (spendable)
--    balance and a redemption count, one round-trip.
CREATE OR REPLACE FUNCTION public.list_gift_cards(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      gca.id,
      gca.site_id AS store_id,
      gca.code_last4,
      gca.initial_value,
      public.gift_card_available_balance(gca.id, gca.site_id) AS balance,
      gca.currency,
      gca.status,
      gca.fraud_hold_reason,
      gca.expires_at,
      gca.created_at,
      gca.metadata->>'recipient_email' AS recipient_email,
      (SELECT COUNT(*) FROM gift_card_redemptions r
        WHERE r.gift_card_account_id = gca.id AND r.deleted_at IS NULL) AS redemption_count
    FROM gift_card_accounts gca
    WHERE gca.site_id = p_store_id
      AND gca.deleted_at IS NULL
  ) t;

  RETURN v_rows;
END;
$$;

-- 4) Validate / balance check by code -- masked lookup for the merchant
--    validate surface (and any future customer balance check). Never returns
--    the code or hash; only last4 + projected balance + redeemability.
CREATE OR REPLACE FUNCTION public.check_gift_card_balance(p_store_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account gift_card_accounts%ROWTYPE;
  v_balance numeric(12,2);
BEGIN
  IF p_code IS NULL OR length(BTRIM(p_code)) < 4 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_account
    FROM gift_card_accounts
   WHERE site_id = p_store_id
     AND code_hash = encode(digest(p_code, 'sha256'), 'hex')
     AND deleted_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_balance := public.gift_card_available_balance(v_account.id, v_account.site_id);

  RETURN jsonb_build_object(
    'found', true,
    'id', v_account.id,
    'code_last4', v_account.code_last4,
    'initial_value', v_account.initial_value,
    'balance', v_balance,
    'currency', v_account.currency,
    'status', v_account.status,
    'expires_at', v_account.expires_at,
    'redeemable', (
      v_account.status = 'active'
      AND (v_account.expires_at IS NULL OR v_account.expires_at >= NOW())
      AND v_balance > 0
    )
  );
END;
$$;

-- 5) Fraud control -- hold / disable / reactivate. Updates only the status
--    field (redemption gates on status = 'active'); the spendable balance is
--    never mutated. Writes an audit ledger entry (amount 0) for the action.
CREATE OR REPLACE FUNCTION public.set_gift_card_status(
  p_store_id uuid,
  p_account_id uuid,
  p_status text,
  p_reason text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account gift_card_accounts%ROWTYPE;
  v_balance numeric(12,2);
  v_entry_type text;
BEGIN
  IF p_status NOT IN ('active', 'held', 'disabled') THEN
    RAISE EXCEPTION 'invalid gift card status: %', p_status;
  END IF;

  SELECT * INTO v_account
    FROM gift_card_accounts
   WHERE id = p_account_id
     AND site_id = p_store_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'gift card not found';
  END IF;

  v_balance := public.gift_card_available_balance(v_account.id, v_account.site_id);

  UPDATE gift_card_accounts
     SET status = p_status,
         fraud_hold_reason = CASE WHEN p_status = 'active' THEN NULL ELSE COALESCE(p_reason, fraud_hold_reason) END,
         updated_by = p_actor_id,
         updated_at = NOW()
   WHERE id = p_account_id
     AND site_id = p_store_id
  RETURNING * INTO v_account;

  v_entry_type := CASE WHEN p_status = 'active' THEN 'release' ELSE 'fraud_hold' END;

  INSERT INTO gift_card_ledger_entries (
    site_id, gift_card_account_id, order_id, entry_type, amount, balance_after,
    idempotency_key, request_id, metadata, created_by
  )
  VALUES (
    p_store_id, v_account.id, NULL, v_entry_type, 0, v_balance,
    'gift_card.status:' || v_account.id::text || ':' || gen_random_uuid()::text,
    p_request_id,
    jsonb_strip_nulls(jsonb_build_object('status', p_status, 'reason', p_reason)),
    p_actor_id
  )
  ON CONFLICT (site_id, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'id', v_account.id,
    'store_id', v_account.site_id,
    'code_last4', v_account.code_last4,
    'initial_value', v_account.initial_value,
    'balance', v_balance,
    'currency', v_account.currency,
    'status', v_account.status,
    'fraud_hold_reason', v_account.fraud_hold_reason,
    'expires_at', v_account.expires_at
  );
END;
$$;

-- 6) Audit trail / transactions -- the full ledger + order-linked redemptions
--    for one card, for merchant visibility.
CREATE OR REPLACE FUNCTION public.gift_card_transactions(p_store_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account gift_card_accounts%ROWTYPE;
  v_ledger jsonb;
  v_redemptions jsonb;
BEGIN
  SELECT * INTO v_account
    FROM gift_card_accounts
   WHERE id = p_account_id AND site_id = p_store_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb)
    INTO v_ledger
  FROM (
    SELECT id, entry_type, amount, balance_after, order_id, created_at, metadata
    FROM gift_card_ledger_entries
    WHERE gift_card_account_id = p_account_id AND site_id = p_store_id AND deleted_at IS NULL
  ) l;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_redemptions
  FROM (
    SELECT id, order_id, amount, status, created_at
    FROM gift_card_redemptions
    WHERE gift_card_account_id = p_account_id AND site_id = p_store_id AND deleted_at IS NULL
  ) r;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_account.id,
    'code_last4', v_account.code_last4,
    'balance', public.gift_card_available_balance(v_account.id, v_account.site_id),
    'status', v_account.status,
    'ledger', v_ledger,
    'redemptions', v_redemptions
  );
END;
$$;
