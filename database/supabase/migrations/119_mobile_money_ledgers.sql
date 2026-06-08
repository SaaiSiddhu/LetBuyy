-- Mobile merchant money ledgers.
-- Writers:
--   services/api-gateway/src/routes/payouts.ts -> payout_statements, wallet_ledger_entries
--   services/api-gateway/src/routes/commission.ts -> commission_reconciliation_entries
--   services/api-gateway/src/routes/commission.ts -> commission_schedules

CREATE TABLE IF NOT EXISTS public.payout_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  statement_number text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  provider text DEFAULT 'razorpay_route'::text NOT NULL,
  provider_mode text DEFAULT 'sandbox'::text NOT NULL,
  rail text DEFAULT 'razorpay_route'::text NOT NULL,
  currency text DEFAULT 'INR'::text NOT NULL,
  gross_amount_minor integer DEFAULT 0 NOT NULL,
  platform_fee_minor integer DEFAULT 0 NOT NULL,
  tax_minor integer DEFAULT 0 NOT NULL,
  net_amount_minor integer DEFAULT 0 NOT NULL,
  period_start date,
  period_end date,
  available_on date,
  processing_at timestamp with time zone,
  released_at timestamp with time zone,
  failed_at timestamp with time zone,
  utr text,
  provider_reference text,
  failure_reason text,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT payout_statements_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'released'::text, 'failed'::text])),
  CONSTRAINT payout_statements_amounts_check
    CHECK (gross_amount_minor >= 0 AND platform_fee_minor >= 0 AND tax_minor >= 0 AND net_amount_minor >= 0),
  CONSTRAINT payout_statements_currency_check CHECK (char_length(currency) = 3)
);

CREATE TABLE IF NOT EXISTS public.wallet_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  payout_statement_id uuid REFERENCES public.payout_statements(id) ON DELETE SET NULL,
  entry_type text NOT NULL,
  direction text NOT NULL,
  status text DEFAULT 'posted'::text NOT NULL,
  currency text DEFAULT 'INR'::text NOT NULL,
  amount_minor integer DEFAULT 0 NOT NULL,
  available_on date,
  reference_type text,
  reference_id text,
  description text,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT wallet_ledger_entries_type_check
    CHECK (entry_type = ANY (ARRAY['payout_credit'::text, 'payout_debit'::text, 'adjustment'::text, 'hold'::text, 'release'::text])),
  CONSTRAINT wallet_ledger_entries_direction_check
    CHECK (direction = ANY (ARRAY['credit'::text, 'debit'::text])),
  CONSTRAINT wallet_ledger_entries_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'posted'::text, 'held'::text, 'reversed'::text])),
  CONSTRAINT wallet_ledger_entries_amount_check CHECK (amount_minor >= 0),
  CONSTRAINT wallet_ledger_entries_currency_check CHECK (char_length(currency) = 3)
);

CREATE TABLE IF NOT EXISTS public.commission_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text DEFAULT 'Default commission'::text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  currency text DEFAULT 'INR'::text NOT NULL,
  commission_bps integer DEFAULT 300 NOT NULL,
  gst_bps integer DEFAULT 1800 NOT NULL,
  effective_from date DEFAULT CURRENT_DATE NOT NULL,
  effective_to date,
  source text DEFAULT 'mobile_money_contract'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT commission_schedules_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])),
  CONSTRAINT commission_schedules_bps_check CHECK (commission_bps >= 0 AND commission_bps <= 10000 AND gst_bps >= 0 AND gst_bps <= 2800),
  CONSTRAINT commission_schedules_currency_check CHECK (char_length(currency) = 3)
);

CREATE TABLE IF NOT EXISTS public.commission_reconciliation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payout_statement_id uuid REFERENCES public.payout_statements(id) ON DELETE SET NULL,
  commission_schedule_id uuid REFERENCES public.commission_schedules(id) ON DELETE SET NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  currency text DEFAULT 'INR'::text NOT NULL,
  gross_amount_minor integer DEFAULT 0 NOT NULL,
  commission_bps integer DEFAULT 300 NOT NULL,
  commission_amount_minor integer DEFAULT 0 NOT NULL,
  gst_bps integer DEFAULT 1800 NOT NULL,
  gst_amount_minor integer DEFAULT 0 NOT NULL,
  net_payable_minor integer DEFAULT 0 NOT NULL,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT commission_reconciliation_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'included_in_payout'::text, 'reconciled'::text, 'reversed'::text])),
  CONSTRAINT commission_reconciliation_amounts_check
    CHECK (gross_amount_minor >= 0 AND commission_amount_minor >= 0 AND gst_amount_minor >= 0 AND net_payable_minor >= 0),
  CONSTRAINT commission_reconciliation_bps_check CHECK (commission_bps >= 0 AND commission_bps <= 10000 AND gst_bps >= 0 AND gst_bps <= 2800),
  CONSTRAINT commission_reconciliation_currency_check CHECK (char_length(currency) = 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_statements_site_number
  ON public.payout_statements(site_id, statement_number)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_statements_site_idempotency
  ON public.payout_statements(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_statements_site_status
  ON public.payout_statements(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_site_idempotency
  ON public.wallet_ledger_entries(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_site_created
  ON public.wallet_ledger_entries(site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_schedules_site_active
  ON public.commission_schedules(site_id, status, effective_from DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_reconciliation_site_order
  ON public.commission_reconciliation_entries(site_id, order_id)
  WHERE order_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_reconciliation_site_idempotency
  ON public.commission_reconciliation_entries(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_reconciliation_site_status
  ON public.commission_reconciliation_entries(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_payout_statements_updated_at ON public.payout_statements;
CREATE TRIGGER update_payout_statements_updated_at
  BEFORE UPDATE ON public.payout_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_wallet_ledger_entries_updated_at ON public.wallet_ledger_entries;
CREATE TRIGGER update_wallet_ledger_entries_updated_at
  BEFORE UPDATE ON public.wallet_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_commission_schedules_updated_at ON public.commission_schedules;
CREATE TRIGGER update_commission_schedules_updated_at
  BEFORE UPDATE ON public.commission_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_commission_reconciliation_entries_updated_at ON public.commission_reconciliation_entries;
CREATE TRIGGER update_commission_reconciliation_entries_updated_at
  BEFORE UPDATE ON public.commission_reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.payout_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_reconciliation_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payout_statements_service_all ON public.payout_statements;
CREATE POLICY payout_statements_service_all ON public.payout_statements
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS payout_statements_site_owner_all ON public.payout_statements;
CREATE POLICY payout_statements_site_owner_all ON public.payout_statements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = payout_statements.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = payout_statements.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS wallet_ledger_entries_service_all ON public.wallet_ledger_entries;
CREATE POLICY wallet_ledger_entries_service_all ON public.wallet_ledger_entries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS wallet_ledger_entries_site_owner_all ON public.wallet_ledger_entries;
CREATE POLICY wallet_ledger_entries_site_owner_all ON public.wallet_ledger_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = wallet_ledger_entries.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = wallet_ledger_entries.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS commission_schedules_service_all ON public.commission_schedules;
CREATE POLICY commission_schedules_service_all ON public.commission_schedules
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS commission_schedules_site_owner_all ON public.commission_schedules;
CREATE POLICY commission_schedules_site_owner_all ON public.commission_schedules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = commission_schedules.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = commission_schedules.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS commission_reconciliation_entries_service_all ON public.commission_reconciliation_entries;
CREATE POLICY commission_reconciliation_entries_service_all ON public.commission_reconciliation_entries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS commission_reconciliation_entries_site_owner_all ON public.commission_reconciliation_entries;
CREATE POLICY commission_reconciliation_entries_site_owner_all ON public.commission_reconciliation_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = commission_reconciliation_entries.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = commission_reconciliation_entries.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
