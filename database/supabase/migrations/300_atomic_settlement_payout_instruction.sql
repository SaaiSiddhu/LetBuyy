-- Make settlement-backed payout statement, payout, item, and scheduled event
-- one local transaction. Provider execution remains a separate authorized step.
-- Rollback: database/supabase/rollback/300_atomic_settlement_payout_instruction.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.create_settlement_payout_with_effects(
  p_site_id uuid,
  p_settlement_id uuid,
  p_expected_amount_minor bigint,
  p_available_on date,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_settlement public.settlements%ROWTYPE;
  v_statement_id uuid;
  v_statement public.payout_statements%ROWTYPE;
  v_payout public.payouts%ROWTYPE;
  v_payout_item public.payout_items%ROWTYPE;
  v_event public.outbox_events%ROWTYPE;
  v_payout_key text;
  v_statement_key text;
  v_statement_number text;
  v_item_count integer;
  v_matching_item_count integer;
  v_preview jsonb;
  v_event_key text;
  v_event_payload jsonb;
  v_statement_metadata jsonb;
BEGIN
  IF p_site_id IS NULL OR p_settlement_id IS NULL
     OR p_expected_amount_minor IS NULL OR p_expected_amount_minor <= 0
     OR p_expected_amount_minor > 2147483647 OR p_available_on IS NULL THEN
    RAISE EXCEPTION 'settlement payout request is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_settlement
    FROM public.settlements
   WHERE id = p_settlement_id
     AND site_id = p_site_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND
     OR v_settlement.status IS DISTINCT FROM 'recorded'
     OR v_settlement.rail IS DISTINCT FROM 'pa_split'
     OR v_settlement.provider IS DISTINCT FROM 'razorpay_route'
     OR v_settlement.net_amount_minor IS DISTINCT FROM p_expected_amount_minor
     OR v_settlement.ledger_transaction_id IS NULL THEN
    RAISE EXCEPTION 'settlement is not eligible for a Route payout instruction' USING ERRCODE = '23505';
  END IF;

  v_statement_key := 'settlement-payout:' || v_settlement.id::text;
  v_statement_number := 'STL-' || upper(substr(replace(v_settlement.id::text, '-', ''), 1, 12));
  v_statement_metadata := jsonb_build_object(
    'source_type', 'settlement',
    'source_settlement_id', v_settlement.id,
    'source_settlement_reference', v_settlement.settlement_reference,
    'canonical_executor', 'payout_statements',
    'no_custody', true
  );

  v_statement_id := public.create_payout_statement_with_effects(
    p_site_id,
    v_statement_number,
    'razorpay_route',
    v_settlement.provider_mode,
    'razorpay_route',
    p_expected_amount_minor,
    0,
    0,
    p_expected_amount_minor,
    NULL,
    NULL,
    p_available_on,
    v_statement_key,
    ARRAY[]::uuid[],
    v_settlement.id,
    v_statement_metadata,
    p_actor_id
  );

  SELECT * INTO v_statement
    FROM public.payout_statements
   WHERE id = v_statement_id
     AND site_id = p_site_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND
     OR v_statement.metadata->>'source_settlement_id' IS DISTINCT FROM v_settlement.id::text
     OR v_statement.provider IS DISTINCT FROM 'razorpay_route'
     OR v_statement.rail IS DISTINCT FROM 'razorpay_route'
     OR v_statement.gross_amount_minor_bigint IS DISTINCT FROM p_expected_amount_minor
     OR v_statement.net_amount_minor_bigint IS DISTINCT FROM p_expected_amount_minor THEN
    RAISE EXCEPTION 'settlement payout statement conflicts with the source settlement' USING ERRCODE = '23505';
  END IF;

  v_payout_key := 'payout:' || v_settlement.idempotency_key;
  INSERT INTO public.payouts (
    site_id, settlement_id, payout_statement_id, status, provider,
    provider_mode, rail, currency, amount_minor, idempotency_key,
    requires_step_up, maker_actor_id, metadata, created_by, updated_by
  ) VALUES (
    p_site_id, v_settlement.id, v_statement.id, 'scheduled',
    'razorpay_route', v_settlement.provider_mode, 'razorpay_route', 'INR',
    p_expected_amount_minor, v_payout_key, true, p_actor_id,
    jsonb_build_object(
      'no_custody', true,
      'instruction_only', true,
      'canonical_executor', 'payout_statements',
      'payout_statement_id', v_statement.id
    ),
    p_actor_id, p_actor_id
  ) ON CONFLICT (site_id, idempotency_key) DO NOTHING;

  SELECT * INTO v_payout
    FROM public.payouts
   WHERE site_id = p_site_id
     AND idempotency_key = v_payout_key
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND
     OR v_payout.settlement_id IS DISTINCT FROM v_settlement.id
     OR v_payout.payout_statement_id IS DISTINCT FROM v_statement.id
     OR v_payout.provider IS DISTINCT FROM 'razorpay_route'
     OR v_payout.provider_mode IS DISTINCT FROM v_settlement.provider_mode
     OR v_payout.rail IS DISTINCT FROM 'razorpay_route'
     OR v_payout.currency IS DISTINCT FROM 'INR'
     OR v_payout.amount_minor IS DISTINCT FROM p_expected_amount_minor
     OR v_payout.requires_step_up IS DISTINCT FROM true
     OR v_payout.metadata->>'instruction_only' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'payout instruction key conflicts with different settlement terms' USING ERRCODE = '23505';
  END IF;

  v_preview := jsonb_build_object('lines', jsonb_build_array(
    jsonb_build_object(
      'account_code', 'merchant_payable',
      'side', 'debit',
      'amount_minor', p_expected_amount_minor,
      'memo', 'Merchant payable released ' || v_payout.id::text
    ),
    jsonb_build_object(
      'account_code', 'pa_clearing',
      'side', 'credit',
      'amount_minor', p_expected_amount_minor,
      'memo', 'PA split payout released ' || v_payout.id::text
    )
  ));

  SELECT count(*)::integer,
         count(*) FILTER (
           WHERE settlement_id = v_settlement.id
             AND source_type = 'settlement'
             AND source_id = v_settlement.id::text
         )::integer
    INTO v_item_count, v_matching_item_count
    FROM public.payout_items
   WHERE site_id = p_site_id
     AND payout_id = v_payout.id
     AND deleted_at IS NULL;
  IF v_item_count <> v_matching_item_count OR v_matching_item_count > 1 THEN
    RAISE EXCEPTION 'payout contains conflicting settlement items' USING ERRCODE = '23505';
  END IF;

  IF v_matching_item_count = 0 THEN
    INSERT INTO public.payout_items (
      site_id, payout_id, settlement_id, source_type, source_id,
      currency, amount_minor, ledger_transaction_id, ledger_preview,
      metadata, created_by, updated_by
    ) VALUES (
      p_site_id, v_payout.id, v_settlement.id, 'settlement', v_settlement.id::text,
      'INR', p_expected_amount_minor, v_settlement.ledger_transaction_id,
      v_preview, jsonb_build_object('payout_statement_id', v_statement.id),
      p_actor_id, p_actor_id
    ) RETURNING * INTO v_payout_item;
  ELSE
    SELECT * INTO v_payout_item
      FROM public.payout_items
     WHERE site_id = p_site_id
       AND payout_id = v_payout.id
       AND settlement_id = v_settlement.id
       AND source_type = 'settlement'
       AND source_id = v_settlement.id::text
       AND deleted_at IS NULL
     FOR UPDATE;
    IF NOT FOUND
       OR v_payout_item.currency IS DISTINCT FROM 'INR'
       OR v_payout_item.amount_minor IS DISTINCT FROM p_expected_amount_minor
       OR v_payout_item.ledger_transaction_id IS DISTINCT FROM v_settlement.ledger_transaction_id
       OR v_payout_item.ledger_preview IS DISTINCT FROM v_preview
       OR v_payout_item.metadata->>'payout_statement_id' IS DISTINCT FROM v_statement.id::text THEN
      RAISE EXCEPTION 'payout item conflicts with its settlement statement' USING ERRCODE = '23505';
    END IF;
  END IF;

  v_event_key := 'event:payout.scheduled:' || v_payout.id::text;
  v_event_payload := jsonb_build_object(
    'site_id', p_site_id,
    'payout_id', v_payout.id,
    'settlement_id', v_settlement.id,
    'amount', jsonb_build_object('amount_minor', p_expected_amount_minor, 'currency', 'INR'),
    'rail', 'razorpay_route'
  );
  INSERT INTO public.outbox_events (
    store_id, site_id, aggregate_type, aggregate_id, event_type,
    payload, idempotency_key, request_id, actor_id, schema_version
  ) VALUES (
    p_site_id, p_site_id, 'payout', v_payout.id::text, 'payout.scheduled',
    v_event_payload, v_event_key, p_request_id, p_actor_id, 1
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_event
    FROM public.outbox_events
   WHERE idempotency_key = v_event_key
   FOR UPDATE;
  IF NOT FOUND
     OR v_event.store_id IS DISTINCT FROM p_site_id
     OR v_event.site_id IS DISTINCT FROM p_site_id
     OR v_event.aggregate_type IS DISTINCT FROM 'payout'
     OR v_event.aggregate_id IS DISTINCT FROM v_payout.id::text
     OR v_event.event_type IS DISTINCT FROM 'payout.scheduled'
     OR v_event.payload IS DISTINCT FROM v_event_payload
     OR v_event.schema_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'payout scheduled event conflicts with its instruction' USING ERRCODE = '23505';
  END IF;

  RETURN to_jsonb(v_payout);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_settlement_payout_with_effects(uuid, uuid, bigint, date, uuid, text)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT EXECUTE ON FUNCTION public.create_settlement_payout_with_effects(uuid, uuid, bigint, date, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.create_settlement_payout_with_effects(uuid, uuid, bigint, date, uuid, text) IS
  'Atomically bind a recorded Route settlement to its payout statement, instruction, single payout item, and typed scheduled outbox event; never executes a provider payout.';

COMMIT;
