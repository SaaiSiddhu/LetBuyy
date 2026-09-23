-- Rollback of 252: restore confirm_order_payment_with_ledger to its 168 definition.
--
-- This deliberately restores all three defects 252 closes: a capture that lands after the unpaid
-- sweep released the order's stock confirms the order again (LB-PAY-004); a capture on an order an
-- earlier payment.failed cancelled raises 'order is not payable' and is recorded nowhere; and the
-- verify callback plus the webhook post the same payment to the ledger twice (LB-PAY-009). The
-- executable suite applies this rollback on purpose to watch the first defect return, then re-applies
-- 252 — a fence never seen absent is not a fence that has been tested.
--
-- No data is changed; this is a function definition only. Orders 252 already moved to
-- 'cancelled' + refund-owed stay that way, and their compensation_actions rows remain the record of
-- the refund owed.

BEGIN;

-- SIGNATURE PRECONDITION (F-ROLLBACK-1's rule; tests/governance/rollback-signature-precondition.test.mjs
-- requires it of every rollback after 245 that restores a function).
--
-- 252 kept the parameter list of 168 exactly, so CREATE OR REPLACE below genuinely replaces rather
-- than adding an overload. Assert that instead of assuming it: if a later migration changes this
-- signature, running this file would create a SECOND confirm_order_payment_with_ledger and every
-- payment confirmation would then fail with "is not unique". Refuse instead.
DO $rollback_precondition$
DECLARE
    v_count integer;
    v_names text[];
    v_expected text[] := ARRAY[
        'p_order_id',
        'p_provider',
        'p_provider_payment_id',
        'p_provider_order_id',
        'p_provider_event_id',
        'p_request_id',
        'p_idempotency_key'
    ];
BEGIN
    SELECT count(*) INTO v_count
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'confirm_order_payment_with_ledger';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'rollback 252: public.confirm_order_payment_with_ledger does not exist, so there is nothing to restore.';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'rollback 252: public.confirm_order_payment_with_ledger already has % overloads. Every call is ambiguous already; resolve that before rolling anything back.', v_count;
    END IF;

    -- proargnames[1:pronargs] takes the INPUT parameters only.
    SELECT p.proargnames[1:p.pronargs] INTO v_names
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'confirm_order_payment_with_ledger';

    IF v_names IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'rollback 252 refuses to run: public.confirm_order_payment_with_ledger currently takes %s parameters (%s), but this rollback restores the 7-parameter signature (%s).',
                coalesce(array_length(v_names, 1), 0),
                array_to_string(v_names, ', '),
                array_to_string(v_expected, ', ')),
            DETAIL = 'CREATE OR REPLACE FUNCTION with a different parameter list does not replace the function, it adds a second overload -- after which every confirm_order_payment_with_ledger call fails with "is not unique".',
            HINT = 'Roll back the later migrations that changed this signature first, then re-run this rollback.';
    END IF;
END
$rollback_precondition$;

-- The 168 definition, verbatim (database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:133-312).
CREATE OR REPLACE FUNCTION public.confirm_order_payment_with_ledger(
  p_order_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_provider_order_id text DEFAULT NULL::text,
  p_provider_event_id text DEFAULT NULL::text,
  p_request_id text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_json jsonb;
  v_order record;
  v_payment_transaction_id uuid;
  v_site_id uuid;
  v_amount_minor bigint;
  v_ledger_transaction_id uuid;
  v_ledger_idempotency_key text;
BEGIN
  IF p_provider_payment_id IS NULL OR btrim(p_provider_payment_id) = '' THEN
    RAISE EXCEPTION 'provider_payment_id is required';
  END IF;

  v_order_json := confirm_order_payment(
    p_order_id,
    p_provider,
    p_provider_payment_id,
    p_provider_order_id,
    p_provider_event_id,
    p_request_id
  );

  SELECT *
    INTO v_order
    FROM orders
   WHERE id = p_order_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  v_site_id := COALESCE(v_order.site_id, v_order.store_id);
  v_amount_minor := round(COALESCE(v_order.total, 0) * 100)::bigint;
  v_ledger_idempotency_key := COALESCE(NULLIF(p_idempotency_key, ''), p_provider_payment_id);

  UPDATE payment_transactions
     SET gateway_txn_id = COALESCE(p_provider_payment_id, gateway_txn_id),
         provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
         provider_payment_id = p_provider_payment_id,
         provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
         status = 'captured',
         captured_at = COALESCE(captured_at, now()),
         request_id = COALESCE(p_request_id, request_id),
         idempotency_key = COALESCE(v_ledger_idempotency_key, idempotency_key),
         updated_at = now()
   WHERE order_id = p_order_id
     AND gateway = p_provider
     AND deleted_at IS NULL
   RETURNING id INTO v_payment_transaction_id;

  IF v_payment_transaction_id IS NULL THEN
    INSERT INTO payment_transactions (
      order_id,
      store_id,
      site_id,
      gateway,
      gateway_txn_id,
      provider_order_id,
      provider_payment_id,
      provider_event_id,
      amount,
      currency,
      status,
      payment_method,
      metadata,
      request_id,
      idempotency_key,
      captured_at
    )
    VALUES (
      p_order_id,
      v_order.store_id,
      v_site_id,
      p_provider,
      p_provider_payment_id,
      p_provider_order_id,
      p_provider_payment_id,
      p_provider_event_id,
      COALESCE(v_order.total, 0),
      COALESCE(v_order.currency, 'INR'),
      'captured',
      p_provider,
      jsonb_build_object('source', 'payment_confirmation'),
      p_request_id,
      v_ledger_idempotency_key,
      now()
    )
    RETURNING id INTO v_payment_transaction_id;
  END IF;

  IF v_amount_minor > 0 THEN
    v_ledger_transaction_id := public.post_settlement_ledger_transaction(
      v_site_id,
      'payment_capture',
      p_provider || ':' || p_provider_payment_id,
      v_ledger_idempotency_key,
      jsonb_build_array(
        jsonb_build_object(
          'account_code', 'pa_clearing',
          'side', 'debit',
          'amount_minor', v_amount_minor,
          'memo', 'Payment capture ' || p_provider || ':' || p_provider_payment_id
        ),
        jsonb_build_object(
          'account_code', 'merchant_payable',
          'side', 'credit',
          'amount_minor', v_amount_minor,
          'memo', 'Merchant payable capture ' || p_order_id::text
        )
      ),
      jsonb_build_object(
        'compatibility_table', 'payment_transactions',
        'payment_transaction_id', v_payment_transaction_id,
        'order_id', p_order_id,
        'provider', p_provider,
        'provider_payment_id', p_provider_payment_id,
        'provider_order_id', p_provider_order_id,
        'provider_event_id', p_provider_event_id
      ),
      p_request_id
    );

    UPDATE payment_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id),
           updated_at = now()
     WHERE id = v_payment_transaction_id;
  END IF;

  INSERT INTO payment_attempts (
    site_id,
    order_id,
    payment_transaction_id,
    provider,
    attempt_type,
    status,
    amount,
    currency,
    provider_order_id,
    provider_payment_id,
    provider_event_id,
    idempotency_key,
    request_id,
    metadata
  )
  VALUES (
    v_site_id,
    p_order_id,
    v_payment_transaction_id,
    p_provider,
    'capture',
    'succeeded',
    COALESCE(v_order.total, 0),
    COALESCE(v_order.currency, 'INR'),
    p_provider_order_id,
    p_provider_payment_id,
    COALESCE(p_provider_event_id, 'capture:' || p_provider || ':' || p_provider_payment_id),
    v_ledger_idempotency_key,
    p_request_id,
    jsonb_build_object('provider_payment_id', p_provider_payment_id, 'canonical_ledger_transaction_id', v_ledger_transaction_id)
  )
  ON CONFLICT DO NOTHING;

  RETURN v_order_json || jsonb_build_object('canonical_ledger_transaction_id', v_ledger_transaction_id);
END;
$$;

COMMIT;
