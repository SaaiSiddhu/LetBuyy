-- F3.7: COD reconciliation retries are bound to one entry and request payload.
-- Keep the original SQL accounting writer private behind this validating wrapper.
BEGIN;

CREATE OR REPLACE FUNCTION public.reconcile_cod_remittance_with_ledger_checked(
  p_site_id uuid,
  p_entry_id uuid,
  p_deposited_amount_minor bigint,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS public.cod_reconciliation_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_replay public.cod_reconciliation_entries%ROWTYPE;
  v_result public.cod_reconciliation_entries%ROWTYPE;
  v_request jsonb;
  v_stored_request jsonb;
  v_expected_amount bigint;
BEGIN
  IF p_site_id IS NULL OR p_entry_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'site_id, entry_id, and idempotency_key are required' USING ERRCODE = '22023';
  END IF;

  v_request := jsonb_build_object(
    'entry_id', p_entry_id,
    'deposited_amount_minor', p_deposited_amount_minor,
    'notes', p_notes
  );
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_replay
    FROM public.cod_reconciliation_entries
   WHERE site_id = p_site_id
     AND reconciliation_idempotency_key = p_idempotency_key
     AND deleted_at IS NULL
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    v_stored_request := v_replay.metadata -> 'cod_reconciliation_request';
    IF v_stored_request IS NOT NULL THEN
      IF v_stored_request IS DISTINCT FROM v_request THEN
        RAISE EXCEPTION 'idempotency key is bound to a different COD reconciliation request' USING ERRCODE = '23505';
      END IF;
    ELSE
      -- Existing pre-migration rows have no request snapshot. Accept only when
      -- their durable result proves that this is an equivalent legacy retry.
      v_expected_amount := COALESCE(
        p_deposited_amount_minor,
        COALESCE(NULLIF(v_replay.collected_amount_minor_bigint, 0),
          v_replay.expected_amount_minor_bigint,
          v_replay.expected_amount_minor::bigint,
          0)
      );
      IF v_replay.id IS DISTINCT FROM p_entry_id
         OR v_expected_amount IS DISTINCT FROM COALESCE(v_replay.deposited_amount_minor_bigint, v_replay.deposited_amount_minor::bigint)
         OR (p_notes IS NOT NULL AND p_notes IS DISTINCT FROM v_replay.notes) THEN
        RAISE EXCEPTION 'idempotency key is bound to a different COD reconciliation request' USING ERRCODE = '23505';
      END IF;
      UPDATE public.cod_reconciliation_entries
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cod_reconciliation_request', v_request)
       WHERE id = v_replay.id AND site_id = p_site_id
       RETURNING * INTO v_replay;
    END IF;
    RETURN v_replay;
  END IF;

  v_result := public.reconcile_cod_remittance_with_ledger(
    p_site_id,
    p_entry_id,
    p_deposited_amount_minor,
    p_notes,
    p_idempotency_key,
    p_actor_id,
    p_request_id
  );

  UPDATE public.cod_reconciliation_entries
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cod_reconciliation_request', v_request)
   WHERE id = v_result.id
     AND site_id = p_site_id
     AND reconciliation_idempotency_key = p_idempotency_key
   RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COD reconciliation request binding could not be stored' USING ERRCODE = '23514';
  END IF;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger_checked(uuid, uuid, bigint, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_cod_remittance_with_ledger_checked(uuid, uuid, bigint, text, text, uuid, text)
  TO service_role;

-- Prevent bypassing payload validation through the compatibility implementation.
REVOKE ALL ON FUNCTION public.reconcile_cod_remittance_with_ledger(uuid, uuid, bigint, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;

COMMENT ON FUNCTION public.reconcile_cod_remittance_with_ledger_checked(uuid, uuid, bigint, text, text, uuid, text) IS
  'Service-role COD remittance boundary; binds replay to entry, deposited amount, and notes before invoking the canonical ledger transaction.';

COMMIT;
