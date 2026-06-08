-- LetBuyy Executable Architecture V1 foundation kernel.
-- Additive only: tenant GUC helpers, canonical append-only double-entry
-- ledger, and foundation proof tables that build on existing outbox,
-- idempotency_keys, and audit_logs baseline tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_site_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.site_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_current_site_id(p_site_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.site_id', p_site_id::text, true);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.outbox_events') IS NOT NULL THEN
    ALTER TABLE public.outbox_events
      ADD COLUMN IF NOT EXISTS published_at timestamptz;

    CREATE INDEX IF NOT EXISTS outbox_events_published_at_idx
      ON public.outbox_events (published_at, event_type)
      WHERE published_at IS NOT NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.compensation_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  flow text NOT NULL CHECK (flow IN ('checkout_confirm', 'refund', 'settlement')),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, flow, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.outbox_consumptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  consumer text NOT NULL,
  idempotency_key text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (consumer, event_id),
  UNIQUE (consumer, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  account_code text NOT NULL CHECK (account_code IN (
    'pa_clearing',
    'merchant_payable',
    'platform_revenue',
    'gst_payable',
    'cod_receivable',
    'reserve',
    'vendor_payable',
    'refund_clearing'
  )),
  account_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, currency, account_code)
);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  source_type text NOT NULL CHECK (source_type IN (
    'payment_capture',
    'refund',
    'settlement',
    'cod_remittance',
    'payout',
    'reversal'
  )),
  source_id text NOT NULL,
  idempotency_key text NOT NULL,
  writer_module text NOT NULL DEFAULT 'settlement' CHECK (writer_module = 'settlement'),
  reversal_of uuid REFERENCES public.ledger_transactions(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, source_type, source_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  side text NOT NULL CHECK (side IN ('debit', 'credit')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  sequence integer NOT NULL,
  memo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (transaction_id, sequence)
);

CREATE INDEX IF NOT EXISTS compensation_actions_site_status_idx
  ON public.compensation_actions (site_id, status, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS outbox_consumptions_site_event_idx
  ON public.outbox_consumptions (site_id, event_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_accounts_site_code_idx
  ON public.ledger_accounts (site_id, currency, account_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_transactions_site_source_idx
  ON public.ledger_transactions (site_id, source_type, source_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_site_currency_idx
  ON public.ledger_entries (site_id, currency, created_at);

CREATE OR REPLACE FUNCTION public.reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only; use reversing entries';
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ledger_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id uuid;
  v_delta bigint;
BEGIN
  v_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT COALESCE(SUM(
    CASE side
      WHEN 'debit' THEN amount_minor
      ELSE -amount_minor
    END
  ), 0)
    INTO v_delta
    FROM public.ledger_entries
   WHERE transaction_id = v_transaction_id;

  IF v_delta <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is not balanced: delta=%', v_transaction_id, v_delta;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_ledger_account(
  p_site_id uuid,
  p_currency text,
  p_account_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  INSERT INTO public.ledger_accounts (site_id, currency, account_code, account_name)
  VALUES (p_site_id, p_currency, p_account_code, replace(p_account_code, '_', ' '))
  ON CONFLICT (site_id, currency, account_code)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_ledger_transaction(
  p_site_id uuid,
  p_currency text,
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
  v_current_site_id uuid;
  v_transaction_id uuid;
  v_existing_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_sequence integer := 0;
  v_debits bigint := 0;
  v_credits bigint := 0;
  v_side text;
  v_amount bigint;
BEGIN
  v_current_site_id := public.current_site_id();
  IF v_current_site_id IS NULL OR v_current_site_id <> p_site_id THEN
    RAISE EXCEPTION 'tenant GUC site_id is required for ledger posting';
  END IF;

  IF p_currency <> 'INR' THEN
    RAISE EXCEPTION 'ledger currency % is not supported', p_currency;
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'ledger posting requires at least two lines';
  END IF;

  INSERT INTO public.ledger_transactions (
    site_id,
    currency,
    source_type,
    source_id,
    idempotency_key,
    metadata,
    request_id
  )
  VALUES (
    p_site_id,
    p_currency,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb),
    p_request_id
  )
  ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    SELECT id INTO v_existing_id
      FROM public.ledger_transactions
     WHERE site_id = p_site_id
       AND source_type = p_source_type
       AND source_id = p_source_id
       AND idempotency_key = p_idempotency_key;
    RETURN v_existing_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_sequence := v_sequence + 1;
    v_side := v_line->>'side';
    v_amount := (v_line->>'amount_minor')::bigint;

    IF v_side NOT IN ('debit', 'credit') OR v_amount <= 0 THEN
      RAISE EXCEPTION 'invalid ledger line at sequence %', v_sequence;
    END IF;

    IF v_side = 'debit' THEN
      v_debits := v_debits + v_amount;
    ELSE
      v_credits := v_credits + v_amount;
    END IF;

    v_account_id := public.ensure_ledger_account(p_site_id, p_currency, v_line->>'account_code');

    INSERT INTO public.ledger_entries (
      transaction_id,
      site_id,
      account_id,
      currency,
      side,
      amount_minor,
      sequence,
      memo,
      metadata
    )
    VALUES (
      v_transaction_id,
      p_site_id,
      v_account_id,
      p_currency,
      v_side,
      v_amount,
      v_sequence,
      NULLIF(v_line->>'memo', ''),
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'ledger posting must balance: debit=% credit=%', v_debits, v_credits;
  END IF;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_balance_breaks()
RETURNS TABLE(site_id uuid, currency text, break_minor bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ledger_entries.site_id,
    ledger_entries.currency,
    SUM(CASE ledger_entries.side WHEN 'debit' THEN ledger_entries.amount_minor ELSE -ledger_entries.amount_minor END)::bigint AS break_minor
  FROM public.ledger_entries
  GROUP BY ledger_entries.site_id, ledger_entries.currency
  HAVING SUM(CASE ledger_entries.side WHEN 'debit' THEN ledger_entries.amount_minor ELSE -ledger_entries.amount_minor END) <> 0;
$$;

DROP TRIGGER IF EXISTS ledger_entries_reject_update ON public.ledger_entries;
CREATE TRIGGER ledger_entries_reject_update
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_entries_reject_delete ON public.ledger_entries;
CREATE TRIGGER ledger_entries_reject_delete
  BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_transactions_reject_update ON public.ledger_transactions;
CREATE TRIGGER ledger_transactions_reject_update
  BEFORE UPDATE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_transactions_reject_delete ON public.ledger_transactions;
CREATE TRIGGER ledger_transactions_reject_delete
  BEFORE DELETE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_entries_balance_enforced ON public.ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entries_balance_enforced
  AFTER INSERT ON public.ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ledger_transaction_balance();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'compensation_actions',
    'outbox_consumptions',
    'ledger_accounts',
    'ledger_transactions',
    'ledger_entries'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())',
      v_table || '_tenant_site_guc',
      v_table
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS update_compensation_actions_updated_at ON public.compensation_actions;
CREATE TRIGGER update_compensation_actions_updated_at
  BEFORE UPDATE ON public.compensation_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_outbox_consumptions_updated_at ON public.outbox_consumptions;
CREATE TRIGGER update_outbox_consumptions_updated_at
  BEFORE UPDATE ON public.outbox_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
