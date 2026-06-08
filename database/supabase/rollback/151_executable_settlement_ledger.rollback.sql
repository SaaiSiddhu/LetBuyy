-- Rollback Task 013 settlement ledger layer.

DROP TRIGGER IF EXISTS update_recon_breaks_updated_at ON public.recon_breaks;
DROP TRIGGER IF EXISTS update_payout_items_updated_at ON public.payout_items;
DROP TRIGGER IF EXISTS update_payouts_updated_at ON public.payouts;
DROP TRIGGER IF EXISTS update_reserves_updated_at ON public.reserves;
DROP TRIGGER IF EXISTS update_settlements_updated_at ON public.settlements;

DROP TABLE IF EXISTS public.recon_breaks;
DROP TABLE IF EXISTS public.payout_items;
DROP TABLE IF EXISTS public.payouts;
DROP TABLE IF EXISTS public.reserves;
DROP TABLE IF EXISTS public.settlements;

DROP FUNCTION IF EXISTS public.post_settlement_ledger_transaction(uuid, text, text, text, jsonb, jsonb, text);

DROP INDEX IF EXISTS public.idx_commission_reconciliation_canonical_ledger;
DROP INDEX IF EXISTS public.idx_wallet_ledger_canonical_ledger;
DROP INDEX IF EXISTS public.idx_payout_statements_canonical_ledger;

ALTER TABLE IF EXISTS public.commission_reconciliation_entries
  DROP COLUMN IF EXISTS canonical_ledger_transaction_id;

ALTER TABLE IF EXISTS public.wallet_ledger_entries
  DROP COLUMN IF EXISTS canonical_ledger_transaction_id;

ALTER TABLE IF EXISTS public.payout_statements
  DROP COLUMN IF EXISTS release_ledger_transaction_id,
  DROP COLUMN IF EXISTS canonical_ledger_transaction_id;

DO $$
DECLARE
  v_table text;
  v_service_policy text;
  v_owner_policy text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'payout_statements',
    'wallet_ledger_entries',
    'commission_schedules',
    'commission_reconciliation_entries'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_tenant_site_guc', v_table);
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      v_service_policy := v_table || '_service_all';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_service_policy, v_table);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', v_service_policy, v_table);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND to_regprocedure('auth.uid()') IS NOT NULL THEN
      v_owner_policy := v_table || '_site_owner_all';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_owner_policy, v_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.sites WHERE sites.id = %I.site_id AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid()) AND sites.deleted_at IS NULL)) WITH CHECK (EXISTS (SELECT 1 FROM public.sites WHERE sites.id = %I.site_id AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid()) AND sites.deleted_at IS NULL))',
        v_owner_policy,
        v_table,
        v_table,
        v_table
      );
    END IF;
  END LOOP;
END;
$$;
