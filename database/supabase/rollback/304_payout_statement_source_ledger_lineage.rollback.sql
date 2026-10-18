BEGIN;

DROP TRIGGER IF EXISTS payout_statement_capture_source_ledger_lineage ON public.payout_statements;
DROP FUNCTION IF EXISTS public.capture_payout_statement_source_ledger_lineage();
DROP FUNCTION IF EXISTS public.record_payout_statement_source_ledger_lineage(uuid, uuid, jsonb, timestamptz);

-- Source-link rows are derived lineage evidence. Preserve them for audit; the
-- parent tables stay available after rollback and remain read-only to app roles.
REVOKE ALL ON public.payout_statement_source_orders, public.payout_statement_source_ledger_transactions
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

COMMIT;
