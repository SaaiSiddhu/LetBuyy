-- Keep the compatibility wallet projection in step with canonical merchant
-- payable debits that historically had no wallet-ledger counterpart.
BEGIN;

-- Legacy wallet-debit backfills use source_type=payout and identify the wallet
-- row in compatibility metadata. The D5 resolver handled wallet rows only for
-- settlement sources, so owner-run backfills of historical debit rows failed.
CREATE OR REPLACE FUNCTION public.resolve_money_ledger_source_site_id(
  p_source_type text,
  p_source_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_uuid uuid;
  v_payment_uuid uuid;
  v_refund_uuid uuid;
  v_compat_table text;
  v_site_id uuid;
BEGIN
  v_source_uuid := public.money_ledger_source_uuid(p_source_id, p_metadata);
  v_payment_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_id', ''), '{}'::jsonb);
  v_refund_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'refund_id', ''), '{}'::jsonb);
  v_compat_table := NULLIF(p_metadata ->> 'compatibility_table', '');

  IF p_source_type = 'payment_capture' THEN
    IF v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payments
       WHERE id = v_payment_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL THEN
      SELECT site_id INTO v_site_id FROM public.payments
       WHERE provider_payment_id = p_source_id AND deleted_at IS NULL LIMIT 1;
    END IF;
  ELSIF p_source_type = 'refund' THEN
    IF v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payments
       WHERE id = v_payment_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_refund_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.refunds
       WHERE id = v_refund_uuid AND deleted_at IS NULL;
    END IF;
  ELSIF p_source_type = 'settlement' THEN
    IF v_compat_table = 'payout_statements' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    ELSIF v_compat_table = 'commission_reconciliation_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.commission_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    ELSIF v_compat_table = 'wallet_ledger_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.settlements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.commission_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
  ELSIF p_source_type = 'cod_remittance' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.cod_reconciliation_entries
       WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
  ELSIF p_source_type = 'payout' THEN
    IF v_compat_table = 'wallet_ledger_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries
       WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payouts WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
  ELSIF p_source_type = 'reversal' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.ledger_transactions
       WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN v_site_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_canonical_money_wallet_projection(
  p_transaction_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_transaction public.ledger_transactions%ROWTYPE;
  v_projection public.wallet_ledger_entries%ROWTYPE;
  v_projection_count integer;
  v_payable_delta bigint;
  v_amount_minor bigint;
  v_direction text;
  v_idempotency_key text;
BEGIN
  SELECT * INTO v_transaction
    FROM public.ledger_transactions
   WHERE id = p_transaction_id
     AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_transaction.source_type IS DISTINCT FROM 'refund'
     AND v_transaction.source_type IS DISTINCT FROM 'reversal'
     AND NOT (
       v_transaction.source_type = 'settlement'
       AND v_transaction.metadata->>'ledger_role' = 'fee_assessment'
     ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE entry.side WHEN 'credit' THEN entry.amount_minor ELSE -entry.amount_minor END
  ), 0)::bigint
    INTO v_payable_delta
    FROM public.ledger_entries AS entry
    JOIN public.ledger_accounts AS account
      ON account.id = entry.account_id
     AND account.site_id = entry.site_id
   WHERE entry.transaction_id = v_transaction.id
     AND entry.site_id = v_transaction.site_id
     AND entry.currency = v_transaction.currency
     AND account.account_code = 'merchant_payable'
     AND entry.deleted_at IS NULL
     AND account.deleted_at IS NULL;

  IF v_payable_delta = 0 THEN
    RETURN;
  END IF;

  v_amount_minor := abs(v_payable_delta);
  v_direction := CASE WHEN v_payable_delta > 0 THEN 'credit' ELSE 'debit' END;
  v_idempotency_key := 'canonical-money-projection:' || v_transaction.id::text;

  SELECT count(*)::integer INTO v_projection_count
    FROM public.wallet_ledger_entries
   WHERE site_id = v_transaction.site_id
     AND canonical_ledger_transaction_id = v_transaction.id
     AND deleted_at IS NULL;

  IF v_projection_count > 1 THEN
    RAISE EXCEPTION 'canonical transaction % has duplicate wallet projections', v_transaction.id;
  ELSIF v_projection_count = 1 THEN
    SELECT * INTO v_projection
      FROM public.wallet_ledger_entries
     WHERE site_id = v_transaction.site_id
       AND canonical_ledger_transaction_id = v_transaction.id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF v_projection.entry_type IS DISTINCT FROM 'adjustment'
       OR v_projection.direction IS DISTINCT FROM v_direction
       OR v_projection.status IS DISTINCT FROM 'posted'
       OR v_projection.currency IS DISTINCT FROM v_transaction.currency
       OR v_projection.amount_minor_bigint IS DISTINCT FROM v_amount_minor THEN
      RAISE EXCEPTION 'canonical transaction % conflicts with its wallet projection', v_transaction.id;
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.wallet_ledger_entries (
    site_id,
    entry_type,
    direction,
    status,
    currency,
    amount_minor,
    amount_minor_bigint,
    reference_type,
    reference_id,
    description,
    idempotency_key,
    canonical_ledger_transaction_id,
    metadata,
    created_by,
    updated_by
  ) VALUES (
    v_transaction.site_id,
    'adjustment',
    v_direction,
    'posted',
    v_transaction.currency,
    LEAST(v_amount_minor, 2147483647)::integer,
    v_amount_minor,
    'ledger_transaction',
    v_transaction.id::text,
    CASE
      WHEN v_transaction.source_type = 'refund' THEN 'Canonical merchant payable refund'
      WHEN v_transaction.source_type = 'reversal' THEN 'Canonical merchant payable reversal'
      ELSE 'Canonical payout fee assessment'
    END,
    v_idempotency_key,
    v_transaction.id,
    jsonb_build_object(
      'projection_source_type', v_transaction.source_type,
      'projection_source_id', v_transaction.source_id,
      'projection_reason', CASE
        WHEN v_transaction.source_type = 'refund' THEN 'refund'
        WHEN v_transaction.source_type = 'reversal' THEN 'reversal'
        ELSE 'payout_fee_assessment'
      END
    ),
    v_transaction.created_by,
    v_transaction.updated_by
  )
  ON CONFLICT (site_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL
  DO NOTHING;

  SELECT * INTO v_projection
    FROM public.wallet_ledger_entries
   WHERE site_id = v_transaction.site_id
     AND idempotency_key = v_idempotency_key
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND
     OR v_projection.canonical_ledger_transaction_id IS DISTINCT FROM v_transaction.id
     OR v_projection.entry_type IS DISTINCT FROM 'adjustment'
     OR v_projection.direction IS DISTINCT FROM v_direction
     OR v_projection.status IS DISTINCT FROM 'posted'
     OR v_projection.currency IS DISTINCT FROM v_transaction.currency
     OR v_projection.amount_minor_bigint IS DISTINCT FROM v_amount_minor THEN
    RAISE EXCEPTION 'wallet projection idempotency key conflicts for canonical transaction %', v_transaction.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_canonical_money_wallet_projection(uuid)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

-- Migration-owner-only historical repair. This projection records recognized
-- canonical deltas; unrelated differences remain visible to reconciliation.
DO $$
DECLARE
  v_transaction_id uuid;
BEGIN
  FOR v_transaction_id IN
    SELECT id
      FROM public.ledger_transactions
     WHERE deleted_at IS NULL
       AND (
         source_type IN ('refund', 'reversal')
         OR (source_type = 'settlement' AND metadata->>'ledger_role' = 'fee_assessment')
       )
     ORDER BY created_at, id
  LOOP
    PERFORM public.ensure_canonical_money_wallet_projection(v_transaction_id);
  END LOOP;
END;
$$;

-- The canonical writer remains the sole financial writer. Its compatibility
-- projection is created in the same SQL transaction, including exact retries.
CREATE OR REPLACE FUNCTION public.post_settlement_ledger_transaction(
  p_site_id uuid,
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
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_source_site_id uuid;
  v_current_site_id uuid;
  v_transaction_id uuid;
BEGIN
  v_source_site_id := public.resolve_money_ledger_source_site_id(
    p_source_type,
    p_source_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  IF v_source_site_id IS NULL THEN
    RAISE EXCEPTION 'ledger source ownership could not be resolved for %.%', p_source_type, p_source_id;
  END IF;

  IF p_site_id IS NULL OR p_site_id <> v_source_site_id THEN
    RAISE EXCEPTION 'ledger source/site mismatch for %.%', p_source_type, p_source_id;
  END IF;

  v_current_site_id := public.current_site_id();
  IF v_current_site_id IS NOT NULL AND v_current_site_id <> v_source_site_id THEN
    RAISE EXCEPTION 'tenant GUC site_id does not match ledger source ownership';
  END IF;

  PERFORM set_config('app.site_id', v_source_site_id::text, true);
  v_transaction_id := public.post_ledger_transaction(
    v_source_site_id,
    'INR',
    p_source_type,
    p_source_id,
    p_idempotency_key,
    p_lines,
    COALESCE(p_metadata, '{}'::jsonb),
    p_request_id
  );

  PERFORM public.ensure_canonical_money_wallet_projection(v_transaction_id);
  RETURN v_transaction_id;
END;
$$;

COMMIT;
