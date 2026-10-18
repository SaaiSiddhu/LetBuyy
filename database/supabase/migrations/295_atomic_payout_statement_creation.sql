-- Atomically create payout statements, reserve source orders, write their pending
-- wallet projection, and post an approved fee assessment when supplied by the
-- existing validated payout calculation. This migration does not choose rates.
-- Rollback: database/supabase/rollback/295_atomic_payout_statement_creation.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.create_payout_statement_with_effects(
  p_site_id uuid,
  p_statement_number text,
  p_provider text,
  p_provider_mode text,
  p_rail text,
  p_gross_amount_minor bigint,
  p_platform_fee_minor bigint,
  p_tax_minor bigint,
  p_net_amount_minor bigint,
  p_period_start date,
  p_period_end date,
  p_available_on date,
  p_idempotency_key text,
  p_source_order_ids uuid[],
  p_source_settlement_id uuid,
  p_metadata jsonb,
  p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_statement public.payout_statements%ROWTYPE;
  v_settlement_net bigint;
  v_source_count bigint;
  v_source_gross bigint;
  v_order_lines jsonb;
  v_wallet_key text;
  v_wallet public.wallet_ledger_entries%ROWTYPE;
  v_fee_ledger_id uuid;
  v_fee_total bigint;
  v_fee_lines jsonb := '[]'::jsonb;
BEGIN
  IF p_site_id IS NULL
     OR NULLIF(btrim(p_statement_number), '') IS NULL
     OR NULLIF(btrim(p_idempotency_key), '') IS NULL
     OR p_provider IS NULL OR p_provider NOT IN ('razorpay_route', 'cashfree', 'manual')
     OR p_provider_mode IS NULL OR p_provider_mode NOT IN ('sandbox', 'live')
     OR p_rail IS NULL OR p_rail NOT IN ('razorpay_route', 'cashfree_easy_split', 'manual')
     OR p_gross_amount_minor IS NULL
     OR p_platform_fee_minor IS NULL
     OR p_tax_minor IS NULL
     OR p_net_amount_minor IS NULL
     OR p_metadata IS NULL
     OR p_gross_amount_minor <= 0
     OR p_platform_fee_minor < 0
     OR p_tax_minor < 0
     OR p_net_amount_minor < 0
     OR p_gross_amount_minor <> p_platform_fee_minor + p_tax_minor + p_net_amount_minor
     OR p_gross_amount_minor > 2147483647
     OR p_platform_fee_minor > 2147483647
     OR p_tax_minor > 2147483647
     OR p_net_amount_minor > 2147483647
     OR (p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND p_period_end < p_period_start) THEN
    RAISE EXCEPTION 'payout statement payload is invalid' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_metadata->'source_order_ids', '[]'::jsonb)
       IS DISTINCT FROM to_jsonb(COALESCE(p_source_order_ids, ARRAY[]::uuid[])) THEN
    RAISE EXCEPTION 'payout source ids differ from their metadata snapshot' USING ERRCODE = '22023';
  END IF;

  IF p_source_settlement_id IS NOT NULL THEN
    IF cardinality(COALESCE(p_source_order_ids, ARRAY[]::uuid[])) <> 0
       OR p_metadata->>'source_type' IS DISTINCT FROM 'settlement'
       OR (p_metadata->>'source_settlement_id')::uuid IS DISTINCT FROM p_source_settlement_id THEN
      RAISE EXCEPTION 'settlement payout source payload is invalid' USING ERRCODE = '22023';
    END IF;

    SELECT net_amount_minor INTO v_settlement_net
      FROM public.settlements
     WHERE id = p_source_settlement_id
       AND site_id = p_site_id
       AND deleted_at IS NULL
       AND status = 'recorded'
     FOR UPDATE;
    IF NOT FOUND OR v_settlement_net IS DISTINCT FROM p_gross_amount_minor THEN
      RAISE EXCEPTION 'settlement payout does not match a recorded tenant settlement' USING ERRCODE = '23505';
    END IF;
  ELSIF p_metadata->>'source_type' = 'settlement' THEN
    RAISE EXCEPTION 'settlement payout source is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize all statement creation for a site. This makes the source-order
  -- uniqueness check safe across different idempotency keys as well as retries.
  PERFORM pg_advisory_xact_lock(hashtextextended('payout-create:' || p_site_id::text, 0));

  SELECT * INTO v_statement
    FROM public.payout_statements
   WHERE site_id = p_site_id
     AND idempotency_key = p_idempotency_key
     AND deleted_at IS NULL
   FOR UPDATE;

  IF FOUND THEN
    IF v_statement.provider IS DISTINCT FROM p_provider
       OR v_statement.provider_mode IS DISTINCT FROM p_provider_mode
       OR v_statement.rail IS DISTINCT FROM p_rail
       OR v_statement.currency IS DISTINCT FROM 'INR'
       OR v_statement.gross_amount_minor_bigint IS DISTINCT FROM p_gross_amount_minor
       OR v_statement.platform_fee_minor_bigint IS DISTINCT FROM p_platform_fee_minor
       OR v_statement.tax_minor_bigint IS DISTINCT FROM p_tax_minor
       OR v_statement.net_amount_minor_bigint IS DISTINCT FROM p_net_amount_minor
       OR v_statement.period_start IS DISTINCT FROM p_period_start
       OR v_statement.period_end IS DISTINCT FROM p_period_end
       OR COALESCE(v_statement.metadata->'source_order_ids', '[]'::jsonb)
            IS DISTINCT FROM COALESCE(p_metadata->'source_order_ids', '[]'::jsonb)
       OR COALESCE(v_statement.metadata->'source_order_numbers', '[]'::jsonb)
            IS DISTINCT FROM COALESCE(p_metadata->'source_order_numbers', '[]'::jsonb)
       OR v_statement.metadata->>'commission_bps' IS DISTINCT FROM p_metadata->>'commission_bps'
       OR v_statement.metadata->>'gst_bps' IS DISTINCT FROM p_metadata->>'gst_bps'
       OR v_statement.metadata->>'source_settlement_id' IS DISTINCT FROM p_metadata->>'source_settlement_id' THEN
      RAISE EXCEPTION 'payout idempotency key conflicts with a different request' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF p_source_settlement_id IS NOT NULL THEN
      NULL; -- The tenant settlement was validated and locked before idempotency lookup.
      IF EXISTS (
        SELECT 1
          FROM public.payout_statements AS prior
         WHERE prior.site_id = p_site_id
           AND prior.deleted_at IS NULL
           AND prior.metadata->>'source_settlement_id' = p_source_settlement_id::text
      ) THEN
        RAISE EXCEPTION 'settlement already has a payout statement' USING ERRCODE = '23505';
      END IF;
    ELSE
      IF cardinality(COALESCE(p_source_order_ids, ARRAY[]::uuid[])) = 0 THEN
        RAISE EXCEPTION 'payout statement requires paid source orders or a recorded settlement' USING ERRCODE = '22023';
      END IF;

      IF cardinality(p_source_order_ids) <> (
        SELECT count(DISTINCT source_id) FROM unnest(p_source_order_ids) AS source_id
      ) THEN
        RAISE EXCEPTION 'payout source order ids must be unique' USING ERRCODE = '22023';
      END IF;

      PERFORM order_row.id
        FROM public.orders AS order_row
       WHERE order_row.id = ANY(p_source_order_ids)
         AND order_row.store_id = p_site_id
         AND order_row.site_id = p_site_id
         AND order_row.payment_status = 'paid'
         AND order_row.currency = 'INR'
         AND (p_period_start IS NULL OR order_row.created_at >= (p_period_start::timestamp AT TIME ZONE 'UTC'))
         AND (p_period_end IS NULL OR order_row.created_at <= (((p_period_end + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond'))
         AND order_row.deleted_at IS NULL
       ORDER BY order_row.id
       FOR UPDATE;

      GET DIAGNOSTICS v_source_count = ROW_COUNT;
      IF v_source_count <> cardinality(p_source_order_ids) THEN
        RAISE EXCEPTION 'payout source orders are not all paid and owned by this site' USING ERRCODE = '23505';
      END IF;

      SELECT COALESCE(sum(round(order_row.total * 100)::bigint), 0),
             COALESCE(jsonb_agg(order_row.order_number ORDER BY order_row.created_at, order_row.id), '[]'::jsonb)
        INTO v_source_gross, v_order_lines
        FROM public.orders AS order_row
       WHERE order_row.id = ANY(p_source_order_ids)
         AND order_row.store_id = p_site_id
         AND order_row.site_id = p_site_id
         AND order_row.payment_status = 'paid'
         AND order_row.currency = 'INR'
         AND (p_period_start IS NULL OR order_row.created_at >= (p_period_start::timestamp AT TIME ZONE 'UTC'))
         AND (p_period_end IS NULL OR order_row.created_at <= (((p_period_end + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond'))
         AND order_row.deleted_at IS NULL;

      IF v_source_gross IS DISTINCT FROM p_gross_amount_minor THEN
        RAISE EXCEPTION 'payout gross amount does not equal its paid source orders' USING ERRCODE = '23514';
      END IF;

      IF EXISTS (
        SELECT 1
          FROM public.payout_statements AS prior
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(prior.metadata->'source_order_ids', '[]'::jsonb)) AS source_id(value)
         WHERE prior.site_id = p_site_id
           AND prior.deleted_at IS NULL
           AND source_id.value = ANY(SELECT unnest(p_source_order_ids)::text)
      ) THEN
        RAISE EXCEPTION 'one or more payout source orders are already included in a statement' USING ERRCODE = '23505';
      END IF;

      IF p_metadata->'source_order_numbers' IS DISTINCT FROM v_order_lines THEN
        RAISE EXCEPTION 'payout source metadata does not match its locked orders' USING ERRCODE = '23514';
      END IF;
    END IF;

    INSERT INTO public.payout_statements (
      site_id, statement_number, status, provider, provider_mode, rail, currency,
      gross_amount_minor, platform_fee_minor, tax_minor, net_amount_minor,
      period_start, period_end, available_on, idempotency_key, metadata,
      created_by, updated_by
    ) VALUES (
      p_site_id, p_statement_number, 'pending', p_provider, p_provider_mode, p_rail, 'INR',
      p_gross_amount_minor::integer, p_platform_fee_minor::integer, p_tax_minor::integer, p_net_amount_minor::integer,
      p_period_start, p_period_end, p_available_on, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb),
      p_actor_id, p_actor_id
    ) RETURNING * INTO v_statement;
  END IF;

  IF p_source_settlement_id IS NOT NULL THEN
    v_wallet_key := 'settlement-payout-credit:' || p_source_settlement_id::text;
  ELSE
    v_wallet_key := 'payout-credit:' || v_statement.id::text;
  END IF;

  INSERT INTO public.wallet_ledger_entries (
    site_id, payout_statement_id, entry_type, direction, status, currency,
    amount_minor, available_on, reference_type, reference_id, description,
    idempotency_key, metadata, created_by, updated_by
  ) VALUES (
    p_site_id, v_statement.id, 'payout_credit', 'credit', 'pending', 'INR',
    p_net_amount_minor::integer, v_statement.available_on,
    CASE WHEN p_source_settlement_id IS NULL THEN 'payout_statement' ELSE 'settlement' END,
    CASE WHEN p_source_settlement_id IS NULL THEN v_statement.id::text ELSE p_source_settlement_id::text END,
    CASE WHEN p_source_settlement_id IS NULL
      THEN 'Payout ' || v_statement.statement_number || ' pending settlement'
      ELSE 'Settlement payout ' || COALESCE(p_metadata->>'source_settlement_reference', p_source_settlement_id::text) || ' pending release'
    END,
    v_wallet_key,
    CASE WHEN p_source_settlement_id IS NULL
      THEN jsonb_build_object('source_order_ids', COALESCE(p_metadata->'source_order_ids', '[]'::jsonb))
      ELSE jsonb_build_object('source_type', 'settlement', 'source_settlement_id', p_source_settlement_id,
        'source_settlement_reference', p_metadata->>'source_settlement_reference')
    END,
    p_actor_id, p_actor_id
  ) ON CONFLICT DO NOTHING;

  SELECT * INTO v_wallet
    FROM public.wallet_ledger_entries
   WHERE site_id = p_site_id
     AND idempotency_key = v_wallet_key
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND
     OR v_wallet.payout_statement_id IS DISTINCT FROM v_statement.id
     OR v_wallet.entry_type IS DISTINCT FROM 'payout_credit'
     OR v_wallet.direction IS DISTINCT FROM 'credit'
     OR v_wallet.status NOT IN ('pending', 'posted')
     OR v_wallet.currency IS DISTINCT FROM 'INR'
     OR v_wallet.amount_minor_bigint IS DISTINCT FROM p_net_amount_minor THEN
    RAISE EXCEPTION 'payout pending wallet credit conflicts with its statement' USING ERRCODE = '23505';
  END IF;

  v_fee_total := p_platform_fee_minor + p_tax_minor;
  IF v_fee_total > 0 THEN
    v_fee_lines := jsonb_build_array(jsonb_build_object(
      'account_code', 'merchant_payable', 'side', 'debit', 'amount_minor', v_fee_total,
      'memo', 'Merchant fee and tax assessment ' || v_statement.statement_number
    ));
    IF p_platform_fee_minor > 0 THEN
      v_fee_lines := v_fee_lines || jsonb_build_array(jsonb_build_object(
        'account_code', 'platform_revenue', 'side', 'credit', 'amount_minor', p_platform_fee_minor,
        'memo', 'Platform fee assessment ' || v_statement.statement_number
      ));
    END IF;
    IF p_tax_minor > 0 THEN
      v_fee_lines := v_fee_lines || jsonb_build_array(jsonb_build_object(
        'account_code', 'gst_payable', 'side', 'credit', 'amount_minor', p_tax_minor,
        'memo', 'Tax on platform fee assessment ' || v_statement.statement_number
      ));
    END IF;

    v_fee_ledger_id := public.post_settlement_ledger_transaction(
      p_site_id, 'settlement', v_statement.id::text,
      'payout-fee-assessment:' || v_statement.id::text,
      v_fee_lines,
      jsonb_build_object('compatibility_table', 'payout_statements',
        'statement_number', v_statement.statement_number, 'ledger_role', 'fee_assessment'),
      NULL
    );

    UPDATE public.payout_statements
       SET canonical_ledger_transaction_id = v_fee_ledger_id,
           updated_by = p_actor_id
     WHERE id = v_statement.id
       AND site_id = p_site_id
       AND canonical_ledger_transaction_id IS DISTINCT FROM v_fee_ledger_id
     RETURNING * INTO v_statement;
  END IF;

  RETURN v_statement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payout_statement_with_effects(uuid, text, text, text, text, bigint, bigint, bigint, bigint, date, date, date, text, uuid[], uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.create_payout_statement_with_effects(uuid, text, text, text, text, bigint, bigint, bigint, bigint, date, date, date, text, uuid[], uuid, jsonb, uuid)
  TO service_role;

COMMIT;
