-- Serialize release claims per site and reserve payable for provider transfers
-- that are still in flight and have not posted their canonical payout debit.
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
  v_reserved_minor bigint;
  v_available_minor bigint;
  v_existing_key text;
BEGIN
  -- A statement row lock alone cannot serialize two different statements for
  -- the same site. All claims now take this transaction-scoped site lock first.
  PERFORM pg_advisory_xact_lock(hashtextextended('payout-release:' || p_site_id::text, 0));

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

  -- A transfer claim is an outstanding obligation until its canonical payout
  -- transaction exists. The transaction check closes the short gap between
  -- posting that debit and linking it back to the compatibility statement.
  SELECT COALESCE(sum(statement.net_amount_minor_bigint), 0)::bigint
    INTO v_reserved_minor
    FROM public.payout_statements AS statement
   WHERE statement.site_id = p_site_id
     AND statement.deleted_at IS NULL
     AND statement.status IN ('processing', 'released')
     AND NOT EXISTS (
       SELECT 1
         FROM public.ledger_transactions AS payout
        WHERE payout.site_id = statement.site_id
          AND payout.source_type = 'payout'
          AND payout.source_id = statement.id::text
     );

  v_available_minor := v_balance_minor - v_reserved_minor;
  IF v_available_minor < v_statement.net_amount_minor_bigint THEN
    RAISE EXCEPTION 'insufficient merchant payable balance for payout %, balance=%, reserved=%, available=%, required=%',
      p_statement_id,
      v_balance_minor,
      v_reserved_minor,
      v_available_minor,
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
