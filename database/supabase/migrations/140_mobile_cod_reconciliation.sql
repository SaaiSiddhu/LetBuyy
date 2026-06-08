-- Mobile COD reconciliation ledger.
-- Writers:
--   services/api-gateway/src/routes/cod-reconciliation.ts -> cod_reconciliation_entries
--   services/api-gateway/src/routes/cod-reconciliation.ts -> wallet_ledger_entries (COD remittance credits only)

ALTER TABLE public.wallet_ledger_entries
DROP CONSTRAINT IF EXISTS wallet_ledger_entries_type_check;

ALTER TABLE public.wallet_ledger_entries
ADD CONSTRAINT wallet_ledger_entries_type_check
  CHECK (entry_type = ANY (ARRAY[
    'payout_credit'::text,
    'payout_debit'::text,
    'adjustment'::text,
    'hold'::text,
    'release'::text,
    'cod_remittance_credit'::text
  ]));

CREATE TABLE IF NOT EXISTS public.cod_reconciliation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text DEFAULT 'pending'::text NOT NULL,
  currency text DEFAULT 'INR'::text NOT NULL,
  expected_amount_minor integer DEFAULT 0 NOT NULL,
  collected_amount_minor integer DEFAULT 0 NOT NULL,
  deposited_amount_minor integer DEFAULT 0 NOT NULL,
  difference_amount_minor integer DEFAULT 0 NOT NULL,
  collected_at timestamp with time zone,
  deposited_at timestamp with time zone,
  reconciled_at timestamp with time zone,
  collection_idempotency_key text,
  reconciliation_idempotency_key text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT cod_reconciliation_status_check
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'collected'::text,
      'reconciled'::text,
      'short'::text,
      'over'::text,
      'reversed'::text
    ])),
  CONSTRAINT cod_reconciliation_amounts_check
    CHECK (
      expected_amount_minor >= 0
      AND collected_amount_minor >= 0
      AND deposited_amount_minor >= 0
    ),
  CONSTRAINT cod_reconciliation_currency_check CHECK (char_length(currency) = 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cod_reconciliation_site_order
  ON public.cod_reconciliation_entries(site_id, order_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cod_reconciliation_site_collect_key
  ON public.cod_reconciliation_entries(site_id, collection_idempotency_key)
  WHERE collection_idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cod_reconciliation_site_reconcile_key
  ON public.cod_reconciliation_entries(site_id, reconciliation_idempotency_key)
  WHERE reconciliation_idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cod_reconciliation_site_status
  ON public.cod_reconciliation_entries(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_cod_reconciliation_entries_updated_at ON public.cod_reconciliation_entries;
CREATE TRIGGER update_cod_reconciliation_entries_updated_at
  BEFORE UPDATE ON public.cod_reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.cod_reconciliation_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cod_reconciliation_entries_service_all ON public.cod_reconciliation_entries;
CREATE POLICY cod_reconciliation_entries_service_all ON public.cod_reconciliation_entries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS cod_reconciliation_entries_site_owner_all ON public.cod_reconciliation_entries;
CREATE POLICY cod_reconciliation_entries_site_owner_all ON public.cod_reconciliation_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = cod_reconciliation_entries.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = cod_reconciliation_entries.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
