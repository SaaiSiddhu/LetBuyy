-- Restore the payment_transactions branch removed by migration 303 and bind its
-- supplied order_id to the compatibility source row before canonical posting.
-- Rollback: database/supabase/rollback/305_restore_payment_transaction_ledger_source_resolution.rollback.sql

BEGIN;

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
  v_payment_transaction_uuid uuid;
  v_refund_uuid uuid;
  v_metadata_order_uuid uuid;
  v_source_order_uuid uuid;
  v_compat_table text;
  v_site_id uuid;
BEGIN
  v_source_uuid := public.money_ledger_source_uuid(p_source_id, p_metadata);
  v_payment_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_id', ''), '{}'::jsonb);
  v_payment_transaction_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_transaction_id', ''), '{}'::jsonb);
  v_refund_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'refund_id', ''), '{}'::jsonb);
  v_metadata_order_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'order_id', ''), '{}'::jsonb);
  v_compat_table := NULLIF(p_metadata ->> 'compatibility_table', '');

  IF p_source_type = 'payment_capture' THEN
    IF v_payment_transaction_uuid IS NOT NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.payment_transactions
       WHERE id = v_payment_transaction_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.payment_transactions
       WHERE provider_payment_id = COALESCE(NULLIF(p_metadata ->> 'provider_payment_id', ''), p_source_id)
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_site_id IS NULL AND v_payment_uuid IS NOT NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.payments
       WHERE id = v_payment_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.payments
       WHERE provider_payment_id = p_source_id
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

    IF v_metadata_order_uuid IS NOT NULL
       AND v_source_order_uuid IS DISTINCT FROM v_metadata_order_uuid THEN
      RETURN NULL;
    END IF;

  ELSIF p_source_type = 'refund' THEN
    IF v_refund_uuid IS NOT NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.refunds
       WHERE id = v_refund_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_payment_transaction_uuid IS NOT NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.payment_transactions
       WHERE id = v_payment_transaction_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_payment_uuid IS NOT NULL THEN
      SELECT site_id, order_id INTO v_site_id, v_source_order_uuid
        FROM public.payments
       WHERE id = v_payment_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_metadata_order_uuid IS NOT NULL
       AND v_source_order_uuid IS DISTINCT FROM v_metadata_order_uuid THEN
      RETURN NULL;
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

COMMIT;
