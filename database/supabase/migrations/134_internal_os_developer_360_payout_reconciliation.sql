-- Internal OS Wave 9: Developer 360 payout reconciliation and disputes.
-- Writer: /v1/operations/developers/* via services/api-gateway. Queue workers may read
-- reconciliation records for future payout-transfer automation, but live transfers remain human-gated.

ALTER TABLE public.partner_payout_ledger_entries
    ADD COLUMN IF NOT EXISTS held_at timestamptz,
    ADD COLUMN IF NOT EXISTS hold_reason text,
    ADD COLUMN IF NOT EXISTS hold_actor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS hold_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_partner_payout_ledger_hold
    ON public.partner_payout_ledger_entries (partner_id, held_at DESC)
    WHERE deleted_at IS NULL AND held_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payout_reconciliation_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.app_developers(id) ON DELETE CASCADE,
    payout_ledger_entry_id uuid REFERENCES public.partner_payout_ledger_entries(id) ON DELETE SET NULL,
    charge_id uuid REFERENCES public.app_billing_charges(id) ON DELETE SET NULL,
    app_id uuid REFERENCES public.marketplace_apps(id) ON DELETE SET NULL,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    reconciliation_key text NOT NULL,
    expected_partner_amount_minor integer NOT NULL DEFAULT 0 CHECK (expected_partner_amount_minor >= 0),
    ledger_partner_amount_minor integer NOT NULL DEFAULT 0 CHECK (ledger_partner_amount_minor >= 0),
    delta_minor integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    status text NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'mismatch', 'reviewing', 'resolved', 'ignored')),
    reason text,
    resolution_notes text,
    checked_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'employee' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'worker')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_reconciliation_records_key_active
    ON public.payout_reconciliation_records (reconciliation_key)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_records_partner_status
    ON public.payout_reconciliation_records (partner_id, status, checked_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_records_charge
    ON public.payout_reconciliation_records (charge_id)
    WHERE deleted_at IS NULL AND charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_records_site
    ON public.payout_reconciliation_records (site_id, checked_at DESC)
    WHERE deleted_at IS NULL AND site_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payout_disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.app_developers(id) ON DELETE CASCADE,
    payout_ledger_entry_id uuid REFERENCES public.partner_payout_ledger_entries(id) ON DELETE SET NULL,
    reconciliation_record_id uuid REFERENCES public.payout_reconciliation_records(id) ON DELETE SET NULL,
    opened_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'waiting_partner', 'resolved', 'rejected', 'withdrawn')),
    reason text NOT NULL CHECK (char_length(trim(reason)) >= 8),
    resolution text,
    amount_minor integer NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
    currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    opened_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'employee' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'worker')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_payout_disputes_partner_status
    ON public.payout_disputes (partner_id, status, opened_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payout_disputes_assignee_status
    ON public.payout_disputes (assignee_id, status, opened_at DESC)
    WHERE deleted_at IS NULL AND assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_disputes_reconciliation
    ON public.payout_disputes (reconciliation_record_id)
    WHERE deleted_at IS NULL AND reconciliation_record_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_payout_reconciliation_records_updated_at ON public.payout_reconciliation_records;
CREATE TRIGGER update_payout_reconciliation_records_updated_at
    BEFORE UPDATE ON public.payout_reconciliation_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_payout_disputes_updated_at ON public.payout_disputes;
CREATE TRIGGER update_payout_disputes_updated_at
    BEFORE UPDATE ON public.payout_disputes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.payout_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY payout_reconciliation_records_service_role_all ON public.payout_reconciliation_records
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY payout_disputes_service_role_all ON public.payout_disputes
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY payout_reconciliation_records_developer_owner_read ON public.payout_reconciliation_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.app_developers d
            WHERE d.id = payout_reconciliation_records.partner_id
              AND d.user_id = auth.uid()
        )
    );

CREATE POLICY payout_disputes_developer_owner_read ON public.payout_disputes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.app_developers d
            WHERE d.id = payout_disputes.partner_id
              AND d.user_id = auth.uid()
        )
    );

CREATE POLICY payout_reconciliation_records_operator_assignee_read ON public.payout_reconciliation_records
    FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.status = 'active'
              AND e.deleted_at IS NULL
        )
    );

CREATE POLICY payout_disputes_operator_assignee_read ON public.payout_disputes
    FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.status = 'active'
              AND e.deleted_at IS NULL
              AND (payout_disputes.assignee_id IS NULL OR payout_disputes.assignee_id = e.id)
        )
    );
