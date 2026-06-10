-- Rollback Phase D5 canonical money path hardening.

GRANT UPDATE, DELETE ON public.ledger_transactions TO service_role;
GRANT UPDATE, DELETE ON public.ledger_entries TO service_role;

DROP FUNCTION IF EXISTS public.reconcile_cod_remittance_with_ledger(
  uuid,
  uuid,
  bigint,
  text,
  text,
  uuid,
  text
);

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

DROP FUNCTION IF EXISTS public.resolve_money_ledger_source_site_id(text, text, jsonb);
DROP FUNCTION IF EXISTS public.money_ledger_source_uuid(text, jsonb);

DROP INDEX IF EXISTS public.idx_cod_reconciliation_canonical_ledger;

DROP TRIGGER IF EXISTS sync_cod_reconciliation_money_bigint ON public.cod_reconciliation_entries;
DROP FUNCTION IF EXISTS public.sync_cod_reconciliation_money_bigint();

ALTER TABLE public.cod_reconciliation_entries
  DROP COLUMN IF EXISTS canonical_ledger_transaction_id,
  DROP COLUMN IF EXISTS expected_amount_minor_bigint,
  DROP COLUMN IF EXISTS collected_amount_minor_bigint,
  DROP COLUMN IF EXISTS deposited_amount_minor_bigint,
  DROP COLUMN IF EXISTS difference_amount_minor_bigint;
