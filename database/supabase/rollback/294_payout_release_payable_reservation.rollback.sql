-- Restore the immediately preceding release-claim behavior from migration 160.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('claim_payout_statement_release', 'public.claim_payout_statement_release(uuid,uuid,text,uuid)', ARRAY['p_site_id','p_statement_id','p_idempotency_key','p_actor_id']::text[], 'public.payout_statements', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 294 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 294 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

CREATE OR REPLACE FUNCTION public.claim_payout_statement_release(
  p_site_id uuid,
  p_statement_id uuid,
  p_idempotency_key text,
  p_actor_id uuid
)
RETURNS public.payout_statements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_statement public.payout_statements%ROWTYPE;
  v_balance_minor bigint;
  v_existing_key text;
BEGIN
  SELECT *
    INTO v_statement
    FROM public.payout_statements
   WHERE id = p_statement_id
     AND site_id = p_site_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout statement not found';
  END IF;

  v_existing_key := COALESCE(v_statement.release_idempotency_key, v_statement.metadata ->> 'release_idempotency_key');
  IF v_existing_key = p_idempotency_key THEN
    RETURN v_statement;
  END IF;

  IF v_statement.status = 'released' THEN
    RETURN v_statement;
  END IF;

  IF v_statement.status <> 'pending' THEN
    RAISE EXCEPTION 'payout statement % is not pending for release', p_statement_id;
  END IF;

  v_balance_minor := public.ledger_account_balance_minor(p_site_id, 'merchant_payable');
  IF v_balance_minor < v_statement.net_amount_minor_bigint THEN
    RAISE EXCEPTION 'insufficient merchant payable balance for payout %, balance=%, required=%',
      p_statement_id,
      v_balance_minor,
      v_statement.net_amount_minor_bigint;
  END IF;

  UPDATE public.payout_statements
     SET status = 'processing',
         processing_at = COALESCE(processing_at, now()),
         release_idempotency_key = p_idempotency_key,
         release_claimed_by = p_actor_id,
         metadata = COALESCE(metadata, '{}'::jsonb)
           || jsonb_build_object('release_idempotency_key', p_idempotency_key, 'release_claimed_by', p_actor_id),
         updated_by = p_actor_id,
         updated_at = now()
   WHERE id = p_statement_id
     AND site_id = p_site_id
   RETURNING * INTO v_statement;

  RETURN v_statement;
END;
$$;

COMMIT;
