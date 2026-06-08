-- LetBuyy Executable Architecture V1 Task 013.
-- Settlement module: PA/COD statement ingest, no-custody payout instructions,
-- recon breaks, reserves, and canonical F6 ledger links for mobile V2 money
-- compatibility tables.

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
  v_transaction_id uuid;
BEGIN
  PERFORM set_config('app.site_id', p_site_id::text, true);
  v_transaction_id := public.post_ledger_transaction(
    p_site_id,
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

ALTER TABLE public.payout_statements
  ADD COLUMN IF NOT EXISTS canonical_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS release_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.wallet_ledger_entries
  ADD COLUMN IF NOT EXISTS canonical_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.commission_reconciliation_entries
  ADD COLUMN IF NOT EXISTS canonical_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  settlement_reference text NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay_route',
  provider_mode text NOT NULL DEFAULT 'mock',
  rail text NOT NULL DEFAULT 'pa_split',
  status text NOT NULL DEFAULT 'recorded',
  currency text NOT NULL DEFAULT 'INR',
  gross_amount_minor bigint NOT NULL DEFAULT 0,
  platform_fee_minor bigint NOT NULL DEFAULT 0,
  gst_minor bigint NOT NULL DEFAULT 0,
  net_amount_minor bigint NOT NULL DEFAULT 0,
  reserve_minor bigint NOT NULL DEFAULT 0,
  recon_break_minor bigint NOT NULL DEFAULT 0,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT settlements_provider_check CHECK (provider IN ('razorpay_route', 'cashfree', 'cod', 'manual')),
  CONSTRAINT settlements_provider_mode_check CHECK (provider_mode IN ('mock', 'sandbox', 'live')),
  CONSTRAINT settlements_rail_check CHECK (rail IN ('pa_split', 'cod_remittance')),
  CONSTRAINT settlements_status_check CHECK (status IN ('recorded', 'break_detected', 'failed')),
  CONSTRAINT settlements_currency_check CHECK (currency = 'INR'),
  CONSTRAINT settlements_amounts_check CHECK (
    gross_amount_minor >= 0
    AND platform_fee_minor >= 0
    AND gst_minor >= 0
    AND net_amount_minor >= 0
    AND reserve_minor >= 0
  ),
  UNIQUE (site_id, idempotency_key),
  UNIQUE (site_id, provider, settlement_reference)
);

CREATE TABLE IF NOT EXISTS public.reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  reserve_type text NOT NULL DEFAULT 'settlement_suspense',
  status text NOT NULL DEFAULT 'held',
  currency text NOT NULL DEFAULT 'INR',
  amount_minor bigint NOT NULL,
  release_after date,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT reserves_type_check CHECK (reserve_type IN ('settlement_suspense', 'rto', 'manual_hold')),
  CONSTRAINT reserves_status_check CHECK (status IN ('held', 'released', 'applied')),
  CONSTRAINT reserves_currency_check CHECK (currency = 'INR'),
  CONSTRAINT reserves_amount_check CHECK (amount_minor >= 0)
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  payout_statement_id uuid REFERENCES public.payout_statements(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  provider text NOT NULL DEFAULT 'razorpay_route',
  provider_mode text NOT NULL DEFAULT 'mock',
  rail text NOT NULL DEFAULT 'razorpay_route',
  currency text NOT NULL DEFAULT 'INR',
  amount_minor bigint NOT NULL,
  provider_reference text,
  utr text,
  failure_reason text,
  idempotency_key text NOT NULL,
  maker_actor_id uuid,
  checker_actor_id uuid,
  checked_at timestamptz,
  requires_step_up boolean NOT NULL DEFAULT true,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT payouts_status_check CHECK (status IN ('scheduled', 'processing', 'paid', 'failed', 'cancelled')),
  CONSTRAINT payouts_provider_check CHECK (provider IN ('razorpay_route', 'cashfree', 'manual')),
  CONSTRAINT payouts_provider_mode_check CHECK (provider_mode IN ('mock', 'sandbox', 'live')),
  CONSTRAINT payouts_rail_check CHECK (rail IN ('razorpay_route', 'cashfree_easy_split', 'manual')),
  CONSTRAINT payouts_currency_check CHECK (currency = 'INR'),
  CONSTRAINT payouts_amount_check CHECK (amount_minor >= 0),
  UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  payout_id uuid NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  amount_minor bigint NOT NULL,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  ledger_preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT payout_items_source_check CHECK (source_type IN ('settlement', 'payout_statement', 'commission', 'cod_remittance')),
  CONSTRAINT payout_items_currency_check CHECK (currency = 'INR'),
  CONSTRAINT payout_items_amount_check CHECK (amount_minor >= 0)
);

CREATE TABLE IF NOT EXISTS public.recon_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  break_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  currency text NOT NULL DEFAULT 'INR',
  amount_minor bigint NOT NULL,
  suspense_account_code text NOT NULL DEFAULT 'reserve',
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT recon_breaks_type_check CHECK (break_type IN ('amount_mismatch', 'missing_provider_feed', 'cod_short_remittance')),
  CONSTRAINT recon_breaks_status_check CHECK (status IN ('open', 'explained', 'resolved')),
  CONSTRAINT recon_breaks_currency_check CHECK (currency = 'INR'),
  CONSTRAINT recon_breaks_amount_check CHECK (amount_minor > 0),
  CONSTRAINT recon_breaks_suspense_check CHECK (suspense_account_code = 'reserve')
);

CREATE INDEX IF NOT EXISTS idx_settlements_site_created
  ON public.settlements(site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_settlements_site_status
  ON public.settlements(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reserves_site_status
  ON public.reserves(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_site_status
  ON public.payouts(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_items_site_payout
  ON public.payout_items(site_id, payout_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recon_breaks_site_status
  ON public.recon_breaks(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_statements_canonical_ledger
  ON public.payout_statements(site_id, canonical_ledger_transaction_id)
  WHERE canonical_ledger_transaction_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_canonical_ledger
  ON public.wallet_ledger_entries(site_id, canonical_ledger_transaction_id)
  WHERE canonical_ledger_transaction_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_reconciliation_canonical_ledger
  ON public.commission_reconciliation_entries(site_id, canonical_ledger_transaction_id)
  WHERE canonical_ledger_transaction_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_settlements_updated_at ON public.settlements;
CREATE TRIGGER update_settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_reserves_updated_at ON public.reserves;
CREATE TRIGGER update_reserves_updated_at
  BEFORE UPDATE ON public.reserves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_payouts_updated_at ON public.payouts;
CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_payout_items_updated_at ON public.payout_items;
CREATE TRIGGER update_payout_items_updated_at
  BEFORE UPDATE ON public.payout_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_recon_breaks_updated_at ON public.recon_breaks;
CREATE TRIGGER update_recon_breaks_updated_at
  BEFORE UPDATE ON public.recon_breaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'payout_statements',
    'wallet_ledger_entries',
    'commission_schedules',
    'commission_reconciliation_entries',
    'settlements',
    'reserves',
    'payouts',
    'payout_items',
    'recon_breaks'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_service_all', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_site_owner_all', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())',
      v_table || '_tenant_site_guc',
      v_table
    );
  END LOOP;
END;
$$;
