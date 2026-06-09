-- Foundation Step-Up Wave 1: canonical money ledger authority.
-- Additive-only migration. Applies the Wave 1 cutover primitives without
-- changing shipped money column types in place.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS capture_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS refund_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS refunded_amount_minor bigint NOT NULL DEFAULT 0;

ALTER TABLE public.payments
  ALTER COLUMN mode SET DEFAULT 'sandbox';

ALTER TABLE public.payment_credentials
  ALTER COLUMN mode SET DEFAULT 'sandbox';

ALTER TABLE public.settlements
  ALTER COLUMN provider_mode SET DEFAULT 'sandbox';

ALTER TABLE public.payouts
  ALTER COLUMN provider_mode SET DEFAULT 'sandbox';

ALTER TABLE public.payout_statements
  ADD COLUMN IF NOT EXISTS release_idempotency_key text,
  ADD COLUMN IF NOT EXISTS release_claimed_by uuid,
  ADD COLUMN IF NOT EXISTS gross_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS platform_fee_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS tax_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS net_amount_minor_bigint bigint;

ALTER TABLE public.wallet_ledger_entries
  ADD COLUMN IF NOT EXISTS amount_minor_bigint bigint;

ALTER TABLE public.commission_reconciliation_entries
  ADD COLUMN IF NOT EXISTS gross_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS commission_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS gst_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS net_payable_minor_bigint bigint;

CREATE INDEX IF NOT EXISTS idx_payments_capture_ledger
  ON public.payments(site_id, capture_ledger_transaction_id)
  WHERE capture_ledger_transaction_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_refund_ledger
  ON public.payments(site_id, refund_ledger_transaction_id)
  WHERE refund_ledger_transaction_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_statements_release_claim
  ON public.payout_statements(site_id, release_idempotency_key)
  WHERE release_idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.money_ledger_site_reconciliations (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'mismatch',
  wallet_available_minor bigint NOT NULL DEFAULT 0,
  ledger_merchant_payable_minor bigint NOT NULL DEFAULT 0,
  variance_minor bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT money_ledger_site_reconciliations_status_check CHECK (status IN ('verified', 'mismatch'))
);

ALTER TABLE public.money_ledger_site_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_ledger_site_reconciliations_service_all ON public.money_ledger_site_reconciliations;
CREATE POLICY money_ledger_site_reconciliations_service_all ON public.money_ledger_site_reconciliations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS money_ledger_site_reconciliations_site_owner_read ON public.money_ledger_site_reconciliations;
CREATE POLICY money_ledger_site_reconciliations_site_owner_read ON public.money_ledger_site_reconciliations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = money_ledger_site_reconciliations.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP TRIGGER IF EXISTS update_money_ledger_site_reconciliations_updated_at ON public.money_ledger_site_reconciliations;
CREATE TRIGGER update_money_ledger_site_reconciliations_updated_at
  BEFORE UPDATE ON public.money_ledger_site_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.sync_payout_statement_money_bigint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.gross_amount_minor_bigint := COALESCE(NEW.gross_amount_minor_bigint, NEW.gross_amount_minor::bigint);
  NEW.platform_fee_minor_bigint := COALESCE(NEW.platform_fee_minor_bigint, NEW.platform_fee_minor::bigint);
  NEW.tax_minor_bigint := COALESCE(NEW.tax_minor_bigint, NEW.tax_minor::bigint);
  NEW.net_amount_minor_bigint := COALESCE(NEW.net_amount_minor_bigint, NEW.net_amount_minor::bigint);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_wallet_ledger_money_bigint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.amount_minor_bigint := COALESCE(NEW.amount_minor_bigint, NEW.amount_minor::bigint);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_commission_reconciliation_money_bigint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.gross_amount_minor_bigint := COALESCE(NEW.gross_amount_minor_bigint, NEW.gross_amount_minor::bigint);
  NEW.commission_amount_minor_bigint := COALESCE(NEW.commission_amount_minor_bigint, NEW.commission_amount_minor::bigint);
  NEW.gst_amount_minor_bigint := COALESCE(NEW.gst_amount_minor_bigint, NEW.gst_amount_minor::bigint);
  NEW.net_payable_minor_bigint := COALESCE(NEW.net_payable_minor_bigint, NEW.net_payable_minor::bigint);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_payout_statement_money_bigint ON public.payout_statements;
CREATE TRIGGER sync_payout_statement_money_bigint
  BEFORE INSERT OR UPDATE ON public.payout_statements
  FOR EACH ROW EXECUTE FUNCTION public.sync_payout_statement_money_bigint();

DROP TRIGGER IF EXISTS sync_wallet_ledger_money_bigint ON public.wallet_ledger_entries;
CREATE TRIGGER sync_wallet_ledger_money_bigint
  BEFORE INSERT OR UPDATE ON public.wallet_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_ledger_money_bigint();

DROP TRIGGER IF EXISTS sync_commission_reconciliation_money_bigint ON public.commission_reconciliation_entries;
CREATE TRIGGER sync_commission_reconciliation_money_bigint
  BEFORE INSERT OR UPDATE ON public.commission_reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_commission_reconciliation_money_bigint();

UPDATE public.payout_statements
SET
  gross_amount_minor_bigint = COALESCE(gross_amount_minor_bigint, gross_amount_minor::bigint),
  platform_fee_minor_bigint = COALESCE(platform_fee_minor_bigint, platform_fee_minor::bigint),
  tax_minor_bigint = COALESCE(tax_minor_bigint, tax_minor::bigint),
  net_amount_minor_bigint = COALESCE(net_amount_minor_bigint, net_amount_minor::bigint)
WHERE gross_amount_minor_bigint IS NULL
   OR platform_fee_minor_bigint IS NULL
   OR tax_minor_bigint IS NULL
   OR net_amount_minor_bigint IS NULL;

UPDATE public.wallet_ledger_entries
SET amount_minor_bigint = COALESCE(amount_minor_bigint, amount_minor::bigint)
WHERE amount_minor_bigint IS NULL;

UPDATE public.commission_reconciliation_entries
SET
  gross_amount_minor_bigint = COALESCE(gross_amount_minor_bigint, gross_amount_minor::bigint),
  commission_amount_minor_bigint = COALESCE(commission_amount_minor_bigint, commission_amount_minor::bigint),
  gst_amount_minor_bigint = COALESCE(gst_amount_minor_bigint, gst_amount_minor::bigint),
  net_payable_minor_bigint = COALESCE(net_payable_minor_bigint, net_payable_minor::bigint)
WHERE gross_amount_minor_bigint IS NULL
   OR commission_amount_minor_bigint IS NULL
   OR gst_amount_minor_bigint IS NULL
   OR net_payable_minor_bigint IS NULL;

CREATE OR REPLACE FUNCTION public.ledger_account_balance_minor(
  p_site_id uuid,
  p_account_code text
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(
    CASE ledger_entries.side
      WHEN 'credit' THEN ledger_entries.amount_minor
      ELSE -ledger_entries.amount_minor
    END
  ), 0)::bigint
  FROM public.ledger_entries
  JOIN public.ledger_accounts
    ON ledger_accounts.id = ledger_entries.account_id
   AND ledger_accounts.site_id = ledger_entries.site_id
  WHERE ledger_entries.site_id = p_site_id
    AND ledger_entries.deleted_at IS NULL
    AND ledger_accounts.account_code = p_account_code
    AND ledger_accounts.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.refresh_money_ledger_site_reconciliation(
  p_site_id uuid
)
RETURNS public.money_ledger_site_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_available_minor bigint;
  v_ledger_merchant_payable_minor bigint;
  v_variance_minor bigint;
  v_row public.money_ledger_site_reconciliations%ROWTYPE;
BEGIN
  SELECT COALESCE(SUM(
    CASE wallet_ledger_entries.direction
      WHEN 'credit' THEN wallet_ledger_entries.amount_minor_bigint
      ELSE -wallet_ledger_entries.amount_minor_bigint
    END
  ), 0)::bigint
    INTO v_wallet_available_minor
    FROM public.wallet_ledger_entries
   WHERE wallet_ledger_entries.site_id = p_site_id
     AND wallet_ledger_entries.status = 'posted'
     AND wallet_ledger_entries.deleted_at IS NULL;

  v_ledger_merchant_payable_minor := public.ledger_account_balance_minor(p_site_id, 'merchant_payable');
  v_variance_minor := v_ledger_merchant_payable_minor - v_wallet_available_minor;

  INSERT INTO public.money_ledger_site_reconciliations (
    site_id,
    status,
    wallet_available_minor,
    ledger_merchant_payable_minor,
    variance_minor,
    metadata,
    verified_at
  )
  VALUES (
    p_site_id,
    CASE WHEN v_variance_minor = 0 THEN 'verified' ELSE 'mismatch' END,
    v_wallet_available_minor,
    v_ledger_merchant_payable_minor,
    v_variance_minor,
    jsonb_build_object('source', 'foundation_wave_1_reconciliation'),
    CASE WHEN v_variance_minor = 0 THEN now() ELSE NULL END
  )
  ON CONFLICT (site_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    wallet_available_minor = EXCLUDED.wallet_available_minor,
    ledger_merchant_payable_minor = EXCLUDED.ledger_merchant_payable_minor,
    variance_minor = EXCLUDED.variance_minor,
    metadata = EXCLUDED.metadata,
    verified_at = EXCLUDED.verified_at,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_money_ledger_site_reconciliation(
  p_site_id uuid
)
RETURNS public.money_ledger_site_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.money_ledger_site_reconciliations%ROWTYPE;
BEGIN
  v_row := public.refresh_money_ledger_site_reconciliation(p_site_id);
  IF v_row.variance_minor <> 0 THEN
    RAISE EXCEPTION 'money ledger reconciliation mismatch for site %, variance=%', p_site_id, v_row.variance_minor;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_wallet_ledger_to_canonical(
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE(reconciled_site_id uuid, entries_backfilled integer, variance_minor bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry public.wallet_ledger_entries%ROWTYPE;
  v_transaction_id uuid;
  v_lines jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_site_id uuid;
  v_reconciliation public.money_ledger_site_reconciliations%ROWTYPE;
BEGIN
  FOR v_entry IN
    SELECT *
    FROM public.wallet_ledger_entries
    WHERE status = 'posted'
      AND deleted_at IS NULL
      AND canonical_ledger_transaction_id IS NULL
      AND amount_minor > 0
      AND (p_site_id IS NULL OR site_id = p_site_id)
    ORDER BY site_id, created_at, id
  LOOP
    PERFORM set_config('app.site_id', v_entry.site_id::text, true);
    IF v_entry.direction = 'credit' THEN
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', 'pa_clearing', 'side', 'debit', 'amount_minor', v_entry.amount_minor_bigint, 'memo', 'Wallet ledger compatibility backfill debit'),
        jsonb_build_object('account_code', 'merchant_payable', 'side', 'credit', 'amount_minor', v_entry.amount_minor_bigint, 'memo', 'Wallet ledger compatibility backfill credit')
      );
    ELSE
      v_lines := jsonb_build_array(
        jsonb_build_object('account_code', 'merchant_payable', 'side', 'debit', 'amount_minor', v_entry.amount_minor_bigint, 'memo', 'Wallet ledger compatibility backfill debit'),
        jsonb_build_object('account_code', 'pa_clearing', 'side', 'credit', 'amount_minor', v_entry.amount_minor_bigint, 'memo', 'Wallet ledger compatibility backfill credit')
      );
    END IF;

    v_transaction_id := public.post_settlement_ledger_transaction(
      v_entry.site_id,
      CASE WHEN v_entry.direction = 'credit' THEN 'settlement' ELSE 'payout' END,
      'wallet_ledger_entries:' || v_entry.id::text,
      COALESCE(v_entry.idempotency_key, 'wallet-ledger-backfill:' || v_entry.id::text),
      v_lines,
      jsonb_build_object('compatibility_table', 'wallet_ledger_entries', 'wallet_entry_id', v_entry.id),
      NULL
    );

    UPDATE public.wallet_ledger_entries
       SET canonical_ledger_transaction_id = v_transaction_id,
           amount_minor_bigint = COALESCE(amount_minor_bigint, amount_minor::bigint),
           updated_at = now()
     WHERE id = v_entry.id;

    v_counts := jsonb_set(
      v_counts,
      ARRAY[v_entry.site_id::text],
      to_jsonb(COALESCE((v_counts ->> v_entry.site_id::text)::integer, 0) + 1),
      true
    );
  END LOOP;

  FOR v_site_id IN
    SELECT DISTINCT site_id
    FROM public.wallet_ledger_entries
    WHERE deleted_at IS NULL
      AND (p_site_id IS NULL OR site_id = p_site_id)
  LOOP
    v_reconciliation := public.assert_money_ledger_site_reconciliation(v_site_id);
    reconciled_site_id := v_site_id;
    entries_backfilled := COALESCE((v_counts ->> v_site_id::text)::integer, 0);
    variance_minor := v_reconciliation.variance_minor;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_payout_statement_release(
  p_site_id uuid,
  p_statement_id uuid,
  p_idempotency_key text,
  p_actor_id uuid
)
RETURNS public.payout_statements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_statement public.payout_statements%ROWTYPE;
  v_balance_minor bigint;
  v_existing_key text;
BEGIN
  SELECT *
    INTO v_statement
    FROM public.payout_statements
   WHERE id = p_statement_id
     AND site_id = p_site_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout statement not found';
  END IF;

  v_existing_key := COALESCE(v_statement.release_idempotency_key, v_statement.metadata ->> 'release_idempotency_key');
  IF v_existing_key = p_idempotency_key THEN
    RETURN v_statement;
  END IF;

  IF v_statement.status = 'released' THEN
    RETURN v_statement;
  END IF;

  IF v_statement.status <> 'pending' THEN
    RAISE EXCEPTION 'payout statement % is not pending for release', p_statement_id;
  END IF;

  v_balance_minor := public.ledger_account_balance_minor(p_site_id, 'merchant_payable');
  IF v_balance_minor < v_statement.net_amount_minor_bigint THEN
    RAISE EXCEPTION 'insufficient merchant payable balance for payout %, balance=%, required=%',
      p_statement_id,
      v_balance_minor,
      v_statement.net_amount_minor_bigint;
  END IF;

  UPDATE public.payout_statements
     SET status = 'processing',
         processing_at = COALESCE(processing_at, now()),
         release_idempotency_key = p_idempotency_key,
         release_claimed_by = p_actor_id,
         metadata = COALESCE(metadata, '{}'::jsonb)
           || jsonb_build_object('release_idempotency_key', p_idempotency_key, 'release_claimed_by', p_actor_id),
         updated_by = p_actor_id,
         updated_at = now()
   WHERE id = p_statement_id
     AND site_id = p_site_id
   RETURNING * INTO v_statement;

  RETURN v_statement;
END;
$$;
