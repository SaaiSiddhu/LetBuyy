-- Persist a provider payout result and its canonical accounting/projection state
-- atomically after the external transfer call has returned.
-- Rollback: database/supabase/rollback/301_atomic_payout_release_finalization.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_payout_statement_release_with_effects(
  p_site_id uuid,
  p_statement_id uuid,
  p_release_idempotency_key text,
  p_result_status text,
  p_processed_at timestamptz,
  p_provider_reference text,
  p_utr text,
  p_failure_reason text,
  p_actor_id uuid,
  p_step_up_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.payout_statements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_statement public.payout_statements%ROWTYPE;
  v_wallet public.wallet_ledger_entries%ROWTYPE;
  v_ledger_id uuid;
  v_ledger_lines jsonb;
  v_wallet_key text;
  v_wallet_count integer;
  v_instruction_count integer;
  v_instruction public.payouts%ROWTYPE;
  v_instruction_status text;
  v_stored_release_key text;
BEGIN
  IF p_site_id IS NULL OR p_statement_id IS NULL
     OR NULLIF(btrim(p_release_idempotency_key), '') IS NULL
     OR p_result_status NOT IN ('processing', 'released', 'failed')
     OR p_processed_at IS NULL OR p_actor_id IS NULL
     OR p_step_up_metadata IS NULL OR jsonb_typeof(p_step_up_metadata) <> 'object' THEN
    RAISE EXCEPTION 'payout release result is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_statement
    FROM public.payout_statements
   WHERE id = p_statement_id
     AND site_id = p_site_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout statement not found' USING ERRCODE = 'P0002';
  END IF;

  v_stored_release_key := COALESCE(v_statement.release_idempotency_key, v_statement.metadata->>'release_idempotency_key');
  IF v_stored_release_key IS DISTINCT FROM p_release_idempotency_key THEN
    RAISE EXCEPTION 'payout release result does not match its durable claim' USING ERRCODE = '23505';
  END IF;
  IF v_statement.status NOT IN ('processing', 'released', 'failed') THEN
    RAISE EXCEPTION 'payout statement has no active release claim' USING ERRCODE = '23505';
  END IF;
  IF v_statement.status IN ('released', 'failed') AND v_statement.status IS DISTINCT FROM p_result_status THEN
    RAISE EXCEPTION 'payout release result conflicts with its finalized statement' USING ERRCODE = '23505';
  END IF;
  IF v_statement.status IN ('released', 'failed')
     AND (v_statement.provider_reference IS DISTINCT FROM p_provider_reference
       OR v_statement.utr IS DISTINCT FROM p_utr
       OR v_statement.failure_reason IS DISTINCT FROM p_failure_reason) THEN
    RAISE EXCEPTION 'payout release result differs from its finalized provider response' USING ERRCODE = '23505';
  END IF;

  IF p_result_status = 'released' THEN
    IF v_statement.net_amount_minor <= 0 OR v_statement.currency <> 'INR' THEN
      RAISE EXCEPTION 'payout statement amount is not releasable' USING ERRCODE = '23514';
    END IF;
    v_wallet_key := 'payout-debit:' || v_statement.id::text;
    v_ledger_lines := jsonb_build_array(
      jsonb_build_object(
        'account_code', 'merchant_payable',
        'side', 'debit',
        'amount_minor', v_statement.net_amount_minor,
        'memo', 'Merchant payable released ' || v_statement.statement_number
      ),
      jsonb_build_object(
        'account_code', 'pa_clearing',
        'side', 'credit',
        'amount_minor', v_statement.net_amount_minor,
        'memo', 'PA split payout released ' || v_statement.statement_number
      )
    );
    v_ledger_id := public.post_settlement_ledger_transaction(
      p_site_id,
      'payout',
      v_statement.id::text,
      'payout-release:' || v_statement.id::text,
      v_ledger_lines,
      jsonb_build_object('compatibility_table', 'payout_statements', 'statement_number', v_statement.statement_number),
      NULL
    );

    INSERT INTO public.wallet_ledger_entries (
      site_id, payout_statement_id, entry_type, direction, status, currency,
      amount_minor, reference_type, reference_id, description,
      idempotency_key, canonical_ledger_transaction_id, metadata, created_by, updated_by
    ) VALUES (
      p_site_id, v_statement.id, 'payout_debit', 'debit', 'posted',
      v_statement.currency, v_statement.net_amount_minor,
      'payout_statement', v_statement.id::text,
      'Payout ' || v_statement.statement_number || ' released',
      v_wallet_key, v_ledger_id,
      jsonb_build_object('provider_reference', p_provider_reference, 'utr', p_utr),
      p_actor_id, p_actor_id
    ) ON CONFLICT DO NOTHING;

    SELECT count(*)::integer INTO v_wallet_count
      FROM public.wallet_ledger_entries
     WHERE site_id = p_site_id
       AND idempotency_key = v_wallet_key
       AND deleted_at IS NULL;
    IF v_wallet_count <> 1 THEN
      RAISE EXCEPTION 'payout debit projection is missing or duplicated' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO v_wallet
      FROM public.wallet_ledger_entries
     WHERE site_id = p_site_id
       AND idempotency_key = v_wallet_key
       AND deleted_at IS NULL
     FOR UPDATE;
    IF v_wallet.payout_statement_id IS DISTINCT FROM v_statement.id
       OR v_wallet.entry_type IS DISTINCT FROM 'payout_debit'
       OR v_wallet.direction IS DISTINCT FROM 'debit'
       OR v_wallet.status IS DISTINCT FROM 'posted'
       OR v_wallet.currency IS DISTINCT FROM v_statement.currency
       OR v_wallet.amount_minor IS DISTINCT FROM v_statement.net_amount_minor
       OR v_wallet.canonical_ledger_transaction_id IS DISTINCT FROM v_ledger_id
       OR v_wallet.metadata IS DISTINCT FROM jsonb_build_object('provider_reference', p_provider_reference, 'utr', p_utr) THEN
      RAISE EXCEPTION 'payout debit projection conflicts with its canonical release' USING ERRCODE = '23505';
    END IF;

    UPDATE public.payout_statements
       SET status = 'released',
           released_at = COALESCE(released_at, p_processed_at),
           failed_at = NULL,
           provider_reference = p_provider_reference,
           utr = p_utr,
           failure_reason = NULL,
           release_ledger_transaction_id = v_ledger_id,
           metadata = COALESCE(metadata, '{}'::jsonb) || p_step_up_metadata,
           updated_by = p_actor_id,
           updated_at = p_processed_at
     WHERE id = v_statement.id AND site_id = p_site_id
     RETURNING * INTO v_statement;
    v_instruction_status := 'paid';
  ELSIF p_result_status = 'failed' THEN
    IF v_statement.release_ledger_transaction_id IS NOT NULL
       OR EXISTS (
         SELECT 1 FROM public.ledger_transactions AS ledger
          WHERE ledger.site_id = p_site_id
            AND ledger.source_type = 'payout'
            AND ledger.source_id = v_statement.id::text
       )
       OR EXISTS (
         SELECT 1 FROM public.wallet_ledger_entries AS wallet
          WHERE wallet.site_id = p_site_id
            AND wallet.idempotency_key = 'payout-debit:' || v_statement.id::text
            AND wallet.deleted_at IS NULL
       ) THEN
      RAISE EXCEPTION 'failed provider result conflicts with an existing payout release posting' USING ERRCODE = '23505';
    END IF;
    UPDATE public.payout_statements
       SET status = 'failed',
           failed_at = COALESCE(failed_at, p_processed_at),
           released_at = NULL,
           provider_reference = p_provider_reference,
           utr = p_utr,
           failure_reason = p_failure_reason,
           metadata = COALESCE(metadata, '{}'::jsonb) || p_step_up_metadata,
           updated_by = p_actor_id,
           updated_at = p_processed_at
     WHERE id = v_statement.id AND site_id = p_site_id
     RETURNING * INTO v_statement;
    v_instruction_status := 'failed';
  ELSE
    UPDATE public.payout_statements
       SET status = 'processing',
           provider_reference = COALESCE(p_provider_reference, provider_reference),
           utr = COALESCE(p_utr, utr),
           failure_reason = NULL,
           metadata = COALESCE(metadata, '{}'::jsonb) || p_step_up_metadata,
           updated_by = p_actor_id,
           updated_at = p_processed_at
     WHERE id = v_statement.id AND site_id = p_site_id
     RETURNING * INTO v_statement;
    v_instruction_status := 'processing';
  END IF;

  SELECT count(*)::integer INTO v_instruction_count
    FROM public.payouts
   WHERE site_id = p_site_id
     AND payout_statement_id = v_statement.id
     AND deleted_at IS NULL;
  IF v_instruction_count > 1
     OR (v_statement.metadata->>'source_settlement_id' IS NOT NULL AND v_instruction_count <> 1) THEN
    RAISE EXCEPTION 'settlement payout instruction is missing or duplicated' USING ERRCODE = '23505';
  END IF;

  IF v_instruction_count = 1 THEN
    UPDATE public.payouts
       SET status = v_instruction_status,
           provider_reference = p_provider_reference,
           utr = p_utr,
           failure_reason = p_failure_reason,
           ledger_transaction_id = CASE WHEN p_result_status = 'released' THEN v_ledger_id ELSE ledger_transaction_id END,
           checker_actor_id = p_actor_id,
           checked_at = p_processed_at,
           updated_by = p_actor_id,
           updated_at = p_processed_at
     WHERE site_id = p_site_id
       AND payout_statement_id = v_statement.id
       AND deleted_at IS NULL
     RETURNING * INTO v_instruction;
    IF NOT FOUND
       OR v_instruction.settlement_id::text IS DISTINCT FROM v_statement.metadata->>'source_settlement_id'
       OR v_instruction.amount_minor IS DISTINCT FROM v_statement.net_amount_minor THEN
      RAISE EXCEPTION 'settlement payout instruction differs from its statement' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN v_statement;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_payout_statement_release_with_effects(uuid, uuid, text, text, timestamptz, text, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payout_statement_release_with_effects(uuid, uuid, text, text, timestamptz, text, text, text, uuid, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.finalize_payout_statement_release_with_effects(uuid, uuid, text, text, timestamptz, text, text, text, uuid, jsonb) IS
  'Atomically stores provider payout outcome, canonical payout ledger debit, wallet projection, and settlement payout instruction sync after the external transfer adapter returns.';

COMMIT;
