-- Phase R5. Closes the issue_gift_card double-issuance defect Phase R4
-- registered as a low-severity idempotency-CONTRACT violation
-- (SKIP-GIFT-CARD-ISSUE-IDEMPOTENCY-CONTRACT) but which a later measurement
-- proved is real money duplication.
--
-- 173_v1_gift_card_issuance_lifecycle.sql's issue_gift_card has TWO
-- ON CONFLICT guards, and NEITHER dedupes on p_idempotency_key:
--   :95  the existence check is a non-locking SELECT on
--        metadata->>'issue_idempotency_key' -- check-then-act, no lock.
--   :120 ON CONFLICT (site_id, code_hash) DO NOTHING guards the CODE, not
--        the key -- concurrent callers with the SAME key but DIFFERENT
--        codes never collide here.
--   :133 the ledger row's own idempotency_key is
--        'gift_card.issued:' || v_account.id::text -- DERIVED from the
--        newly-created account id, so two different accounts produce two
--        different ledger keys, and :138's
--        ON CONFLICT (site_id, idempotency_key) never fires either.
-- Reproduced directly (Phase R5 W1, migrations-through-206 fixture, 3
-- concurrent issue_gift_card calls sharing one idempotency_key but three
-- different codes): 2 gift_card_accounts rows, 2 'issued' ledger rows,
-- ₹10,000 issued for a single ₹5,000 key. Real money duplication, not a
-- contract nicety.
--
-- Fix, mirroring 206_checkout_order_idempotency_advisory_lock.sql's shape
-- exactly: a transaction-scoped advisory lock keyed on (p_store_id,
-- p_idempotency_key), taken BEFORE the :95 existence check and therefore
-- before every mutation this function performs. pg_advisory_xact_lock
-- releases automatically at COMMIT/ROLLBACK -- no separate release, no
-- lock survives a crashed backend.
--
-- ONE deliberate difference from 206's lock call: hashtextextended's
-- second argument is a seed, and 206 passes 0. This function passes 1
-- instead, so an issue_gift_card lock and a create_checkout_order lock can
-- never collide even if a caller ever reused the same (store_id,
-- idempotency_key) string across both operations -- domain-separating the
-- two functions' lock namespaces at zero cost, rather than relying on
-- 206's own "harmless if it collides" reasoning across two DIFFERENT
-- money operations, not just two callers of the same one.
--
-- The function body below reproduces migration 173's issue_gift_card
-- byte-for-byte except for the one inserted PERFORM statement -- verified
-- by diff during authoring (see the phase report for the exact line
-- count). No balance-model, ledger-entry-shape, or other RPC change.

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

  -- Phase R5: serialize concurrent callers sharing the same (site_id,
  -- idempotency_key) BEFORE the existence check below and before every
  -- mutation this function performs. Transaction-scoped -- released
  -- automatically when this call commits or rolls back. Seed 1 (not 206's
  -- 0) domain-separates this lock namespace from create_checkout_order's.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 1));

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
