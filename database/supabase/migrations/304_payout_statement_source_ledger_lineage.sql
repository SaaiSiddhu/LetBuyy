-- Record the exact canonical ledger transactions attached to each order source
-- when a payout statement is created. This is lineage evidence, not a second
-- money ledger and does not change statement amounts or eligibility.
-- Rollback: database/supabase/rollback/304_payout_statement_source_ledger_lineage.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.payout_statement_source_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  payout_statement_id uuid NOT NULL REFERENCES public.payout_statements(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  source_order_gross_minor bigint NOT NULL CHECK (source_order_gross_minor >= 0),
  canonical_merchant_payable_delta_minor bigint NOT NULL DEFAULT 0,
  canonical_transaction_count integer NOT NULL DEFAULT 0 CHECK (canonical_transaction_count >= 0),
  origin_transaction_count integer NOT NULL DEFAULT 0 CHECK (origin_transaction_count >= 0),
  lineage_status text NOT NULL DEFAULT 'missing'
    CHECK (lineage_status IN ('linked', 'adjustment_only', 'missing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_statement_id, site_id, order_id),
  CHECK (origin_transaction_count <= canonical_transaction_count)
);

CREATE TABLE IF NOT EXISTS public.payout_statement_source_ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  payout_statement_id uuid NOT NULL REFERENCES public.payout_statements(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  ledger_transaction_id uuid NOT NULL REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN ('payment_capture', 'cod_remittance', 'refund', 'reversal')),
  merchant_payable_delta_minor bigint NOT NULL,
  ledger_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_statement_id, order_id, ledger_transaction_id),
  FOREIGN KEY (payout_statement_id, site_id, order_id)
    REFERENCES public.payout_statement_source_orders(payout_statement_id, site_id, order_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS payout_statement_source_orders_site_statement_idx
  ON public.payout_statement_source_orders(site_id, payout_statement_id);
CREATE INDEX IF NOT EXISTS payout_statement_source_ledger_site_order_idx
  ON public.payout_statement_source_ledger_transactions(site_id, order_id, ledger_created_at);

ALTER TABLE public.payout_statement_source_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_statement_source_ledger_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payout_statement_source_orders, public.payout_statement_source_ledger_transactions
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT SELECT ON public.payout_statement_source_orders, public.payout_statement_source_ledger_transactions
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_payout_statement_source_ledger_lineage(
  p_payout_statement_id uuid,
  p_site_id uuid,
  p_source_order_ids jsonb,
  p_statement_created_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_transaction_count integer;
  v_origin_count integer;
  v_delta_minor bigint;
BEGIN
  IF p_payout_statement_id IS NULL OR p_site_id IS NULL
     OR jsonb_typeof(COALESCE(p_source_order_ids, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'payout source lineage payload is invalid' USING ERRCODE = '22023';
  END IF;

  FOR v_order IN
    SELECT order_row.id,
           round(order_row.total * 100)::bigint AS gross_minor
      FROM jsonb_array_elements_text(COALESCE(p_source_order_ids, '[]'::jsonb)) AS source_order(value)
      JOIN public.orders AS order_row ON order_row.id::text = source_order.value
     WHERE order_row.site_id = p_site_id
       AND order_row.store_id = p_site_id
       AND order_row.deleted_at IS NULL
     ORDER BY order_row.id
  LOOP
    INSERT INTO public.payout_statement_source_orders (
      site_id, payout_statement_id, order_id, source_order_gross_minor
    ) VALUES (
      p_site_id, p_payout_statement_id, v_order.id, v_order.gross_minor
    )
    ON CONFLICT (payout_statement_id, site_id, order_id) DO NOTHING;

    INSERT INTO public.payout_statement_source_ledger_transactions (
      site_id, payout_statement_id, order_id, ledger_transaction_id,
      source_type, merchant_payable_delta_minor, ledger_created_at
    )
    SELECT p_site_id,
           p_payout_statement_id,
           v_order.id,
           transaction_row.id,
           transaction_row.source_type,
           COALESCE(sum(CASE entry_row.side WHEN 'credit' THEN entry_row.amount_minor ELSE -entry_row.amount_minor END)
             FILTER (WHERE account_row.account_code = 'merchant_payable'), 0)::bigint,
           transaction_row.created_at
      FROM public.ledger_transactions AS transaction_row
      JOIN public.ledger_entries AS entry_row
        ON entry_row.transaction_id = transaction_row.id
       AND entry_row.site_id = transaction_row.site_id
       AND entry_row.deleted_at IS NULL
      JOIN public.ledger_accounts AS account_row
        ON account_row.id = entry_row.account_id
       AND account_row.site_id = transaction_row.site_id
       AND account_row.deleted_at IS NULL
     WHERE transaction_row.site_id = p_site_id
       AND transaction_row.deleted_at IS NULL
       AND transaction_row.source_type IN ('payment_capture', 'cod_remittance', 'refund', 'reversal')
       AND transaction_row.metadata->>'order_id' = v_order.id::text
       AND transaction_row.created_at <= p_statement_created_at
       AND (
         (transaction_row.source_type = 'payment_capture' AND EXISTS (
           SELECT 1
             FROM public.payment_transactions AS payment_transaction
            WHERE payment_transaction.site_id = p_site_id
              AND payment_transaction.order_id = v_order.id
              AND payment_transaction.deleted_at IS NULL
              AND (
                payment_transaction.id::text = transaction_row.metadata->>'payment_transaction_id'
                OR payment_transaction.provider_payment_id = transaction_row.metadata->>'provider_payment_id'
              )
         ))
         OR (transaction_row.source_type = 'cod_remittance' AND EXISTS (
           SELECT 1
             FROM public.cod_reconciliation_entries AS cod_entry
            WHERE cod_entry.site_id = p_site_id
              AND cod_entry.order_id = v_order.id
              AND cod_entry.id::text = transaction_row.source_id
              AND cod_entry.deleted_at IS NULL
         ))
         OR (transaction_row.source_type = 'refund' AND (
           EXISTS (
             SELECT 1
               FROM public.refunds AS refund_row
              WHERE refund_row.site_id = p_site_id
                AND refund_row.order_id = v_order.id
                AND refund_row.id::text = transaction_row.metadata->>'refund_id'
                AND refund_row.deleted_at IS NULL
           )
           OR EXISTS (
             SELECT 1
               FROM public.payment_transactions AS payment_transaction
              WHERE payment_transaction.site_id = p_site_id
                AND payment_transaction.order_id = v_order.id
                AND payment_transaction.deleted_at IS NULL
                AND payment_transaction.id::text = transaction_row.metadata->>'payment_transaction_id'
           )
         ))
         OR (transaction_row.source_type = 'reversal' AND EXISTS (
           SELECT 1
             FROM public.ledger_transactions AS original_transaction
            WHERE original_transaction.id = transaction_row.reversal_of
              AND original_transaction.site_id = p_site_id
              AND original_transaction.deleted_at IS NULL
              AND original_transaction.metadata->>'order_id' = v_order.id::text
         ))
       )
     GROUP BY transaction_row.id, transaction_row.source_type, transaction_row.created_at
    ON CONFLICT (payout_statement_id, order_id, ledger_transaction_id) DO NOTHING;

    SELECT count(*)::integer,
           count(*) FILTER (WHERE source_type IN ('payment_capture', 'cod_remittance'))::integer,
           COALESCE(sum(merchant_payable_delta_minor), 0)::bigint
      INTO v_transaction_count, v_origin_count, v_delta_minor
      FROM public.payout_statement_source_ledger_transactions
     WHERE site_id = p_site_id
       AND payout_statement_id = p_payout_statement_id
       AND order_id = v_order.id;

    UPDATE public.payout_statement_source_orders
       SET canonical_merchant_payable_delta_minor = v_delta_minor,
           canonical_transaction_count = v_transaction_count,
           origin_transaction_count = v_origin_count,
           lineage_status = CASE
             WHEN v_origin_count > 0 THEN 'linked'
             WHEN v_transaction_count > 0 THEN 'adjustment_only'
             ELSE 'missing'
           END
     WHERE site_id = p_site_id
       AND payout_statement_id = p_payout_statement_id
       AND order_id = v_order.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payout_statement_source_ledger_lineage(uuid, uuid, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE OR REPLACE FUNCTION public.capture_payout_statement_source_ledger_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(COALESCE(NEW.metadata->'source_order_ids', '[]'::jsonb)) = 'array'
     AND jsonb_array_length(COALESCE(NEW.metadata->'source_order_ids', '[]'::jsonb)) > 0 THEN
    PERFORM public.record_payout_statement_source_ledger_lineage(
      NEW.id, NEW.site_id, NEW.metadata->'source_order_ids', NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_payout_statement_source_ledger_lineage()
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

DROP TRIGGER IF EXISTS payout_statement_capture_source_ledger_lineage ON public.payout_statements;
CREATE TRIGGER payout_statement_capture_source_ledger_lineage
  AFTER INSERT ON public.payout_statements
  FOR EACH ROW EXECUTE FUNCTION public.capture_payout_statement_source_ledger_lineage();

DO $$
DECLARE
  v_statement record;
BEGIN
  FOR v_statement IN
    SELECT id, site_id, metadata->'source_order_ids' AS source_order_ids, created_at
      FROM public.payout_statements
     WHERE deleted_at IS NULL
       AND jsonb_typeof(COALESCE(metadata->'source_order_ids', '[]'::jsonb)) = 'array'
       AND jsonb_array_length(COALESCE(metadata->'source_order_ids', '[]'::jsonb)) > 0
  LOOP
    PERFORM public.record_payout_statement_source_ledger_lineage(
      v_statement.id, v_statement.site_id, v_statement.source_order_ids, v_statement.created_at
    );
  END LOOP;
END;
$$;

COMMIT;
