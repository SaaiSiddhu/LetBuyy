-- 293 — post each verified prepaid advertising purchase to the canonical money ledger.
--
-- D-5 keeps the entitlement ledger separate from merchant sales payable. This adds the matching
-- cash-clearing/liability journal in the existing canonical ledger, in the same transaction as
-- billing finalization and entitlement issuance. It does not create a withdrawal/refund path.
-- Rollback: database/supabase/rollback/293_ad_credit_purchase_canonical_liability.rollback.sql

BEGIN;

ALTER TABLE public.ledger_accounts
  DROP CONSTRAINT IF EXISTS ledger_accounts_account_code_check;
ALTER TABLE public.ledger_accounts
  ADD CONSTRAINT ledger_accounts_account_code_check CHECK (account_code IN (
    'pa_clearing',
    'merchant_payable',
    'platform_revenue',
    'gst_payable',
    'cod_receivable',
    'reserve',
    'vendor_payable',
    'refund_clearing',
    'ad_credit_liability'
  ));

ALTER TABLE public.ledger_transactions
  DROP CONSTRAINT IF EXISTS ledger_transactions_source_type_check;
ALTER TABLE public.ledger_transactions
  ADD CONSTRAINT ledger_transactions_source_type_check CHECK (source_type IN (
    'payment_capture',
    'refund',
    'settlement',
    'cod_remittance',
    'payout',
    'reversal',
    'ad_credit_purchase'
  ));

ALTER TABLE public.billing_history
  ADD COLUMN IF NOT EXISTS canonical_ledger_transaction_id uuid
    REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT;

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
  v_compat_table text;
  v_site_id uuid;
BEGIN
  v_source_uuid := public.money_ledger_source_uuid(p_source_id, p_metadata);
  v_payment_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_id', ''), '{}'::jsonb);
  v_payment_transaction_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_transaction_id', ''), '{}'::jsonb);
  v_refund_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'refund_id', ''), '{}'::jsonb);
  v_compat_table := NULLIF(p_metadata ->> 'compatibility_table', '');

  IF p_source_type = 'payment_capture' THEN
    IF v_payment_transaction_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payment_transactions
       WHERE id = v_payment_transaction_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL THEN
      SELECT site_id INTO v_site_id FROM public.payment_transactions
       WHERE provider_payment_id = COALESCE(NULLIF(p_metadata ->> 'provider_payment_id', ''), p_source_id)
         AND deleted_at IS NULL LIMIT 1;
    END IF;
    IF v_site_id IS NULL AND v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payments WHERE id = v_payment_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL THEN
      SELECT site_id INTO v_site_id FROM public.payments
       WHERE provider_payment_id = p_source_id AND deleted_at IS NULL LIMIT 1;
    END IF;
  ELSIF p_source_type = 'refund' THEN
    IF v_refund_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.refunds WHERE id = v_refund_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_payment_transaction_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payment_transactions
       WHERE id = v_payment_transaction_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payments WHERE id = v_payment_uuid AND deleted_at IS NULL;
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
      SELECT site_id INTO v_site_id FROM public.cod_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
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
      SELECT site_id INTO v_site_id FROM public.ledger_transactions WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
  ELSIF p_source_type = 'ad_credit_purchase' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.billing_history WHERE id = v_source_uuid;
    END IF;
  END IF;

  RETURN v_site_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_ad_credit_purchase(
  p_site_id uuid,
  p_billing_history_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_charge public.billing_history%ROWTYPE;
  v_credited jsonb;
  v_ledger_id uuid;
BEGIN
  IF p_site_id IS NULL OR p_billing_history_id IS NULL
     OR NULLIF(btrim(p_provider_order_id), '') IS NULL
     OR NULLIF(btrim(p_provider_payment_id), '') IS NULL THEN
    RAISE EXCEPTION 'ad credit payment binding is incomplete';
  END IF;

  SELECT * INTO v_charge FROM public.billing_history
   WHERE id = p_billing_history_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ad credit billing record not found for site'; END IF;

  IF v_charge.payment_gateway IS DISTINCT FROM 'razorpay'
     OR v_charge.payment_id IS DISTINCT FROM p_provider_order_id
     OR v_charge.currency IS DISTINCT FROM 'INR'
     OR v_charge.amount <= 0
     OR v_charge.amount <> trunc(v_charge.amount) THEN
    RAISE EXCEPTION 'ad credit payment does not match its stored order';
  END IF;

  IF v_charge.payment_status = 'paid' THEN
    IF v_charge.provider_payment_reference IS DISTINCT FROM p_provider_payment_id THEN
      RAISE EXCEPTION 'ad credit billing record was finalized by a different payment';
    END IF;
  ELSIF v_charge.payment_status = 'pending' THEN
    IF v_charge.provider_payment_reference IS NOT NULL THEN
      RAISE EXCEPTION 'pending ad credit billing record already has a payment reference';
    END IF;
  ELSE
    RAISE EXCEPTION 'ad credit billing record is not payable';
  END IF;

  v_ledger_id := public.post_settlement_ledger_transaction(
    p_site_id,
    'ad_credit_purchase',
    p_billing_history_id::text,
    'ad-credit-purchase:' || p_billing_history_id::text,
    jsonb_build_array(
      jsonb_build_object('account_code', 'pa_clearing', 'side', 'debit',
        'amount_minor', v_charge.amount::bigint, 'memo', 'Razorpay ad-credit purchase clearing'),
      jsonb_build_object('account_code', 'ad_credit_liability', 'side', 'credit',
        'amount_minor', v_charge.amount::bigint, 'memo', 'Prepaid advertising service entitlement')
    ),
    jsonb_build_object('compatibility_table', 'billing_history',
      'billing_history_id', p_billing_history_id,
      'provider_payment_reference', p_provider_payment_id),
    p_request_id
  );

  v_credited := public.record_ad_credit_purchase(
    p_site_id,
    v_charge.amount::bigint,
    p_provider_payment_id,
    'ad.purchase:' || p_provider_payment_id,
    p_request_id,
    p_actor_id
  );

  IF v_charge.payment_status = 'pending'
     OR v_charge.canonical_ledger_transaction_id IS NULL THEN
    UPDATE public.billing_history
       SET payment_status = 'paid',
           provider_payment_reference = COALESCE(provider_payment_reference, p_provider_payment_id),
           canonical_ledger_transaction_id = v_ledger_id,
           updated_at = now(),
           updated_by = p_actor_id
     WHERE id = p_billing_history_id AND site_id = p_site_id
       AND (payment_status = 'pending' OR canonical_ledger_transaction_id IS NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'ad credit billing record finalization lost its payable state'; END IF;
  ELSIF v_charge.canonical_ledger_transaction_id IS DISTINCT FROM v_ledger_id THEN
    RAISE EXCEPTION 'ad credit billing record is missing its canonical purchase posting';
  END IF;

  RETURN v_credited || jsonb_build_object(
    'billing_history_id', p_billing_history_id,
    'canonical_ledger_transaction_id', v_ledger_id,
    'payment_status', 'paid'
  );
END;
$$;

COMMIT;
