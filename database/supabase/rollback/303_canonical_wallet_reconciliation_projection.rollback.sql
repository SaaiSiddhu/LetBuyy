-- Existing adjustment rows are retained as financial compatibility history.
-- This rollback restores the prior writer, so future refund/fee postings again
-- require a forward repair to keep wallet projections reconciled.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('resolve_money_ledger_source_site_id', 'public.resolve_money_ledger_source_site_id(text,text,jsonb)', ARRAY['p_source_type','p_source_id','p_metadata']::text[], 'uuid', false),
    ('post_settlement_ledger_transaction', 'public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text)', ARRAY['p_site_id','p_source_type','p_source_id','p_idempotency_key','p_lines','p_metadata','p_request_id']::text[], 'uuid', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 303 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 303 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;


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
    IF v_source_uuid IS NOT NULL THEN
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
SET search_path TO 'public'
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
  RETURN v_transaction_id;
END;
$$;

DROP FUNCTION public.ensure_canonical_money_wallet_projection(uuid);

COMMIT;
