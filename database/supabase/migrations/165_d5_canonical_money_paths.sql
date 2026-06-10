-- Phase D5: canonical money paths.
-- The settlement writer may set app.site_id only from an owned source row,
-- never from the caller-supplied p_site_id parameter.

ALTER TABLE public.cod_reconciliation_entries
  ADD COLUMN IF NOT EXISTS canonical_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS expected_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS collected_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS deposited_amount_minor_bigint bigint,
  ADD COLUMN IF NOT EXISTS difference_amount_minor_bigint bigint;

CREATE INDEX IF NOT EXISTS idx_cod_reconciliation_canonical_ledger
  ON public.cod_reconciliation_entries(site_id, canonical_ledger_transaction_id)
  WHERE canonical_ledger_transaction_id IS NOT NULL AND deleted_at IS NULL;

UPDATE public.cod_reconciliation_entries
SET expected_amount_minor_bigint = COALESCE(expected_amount_minor_bigint, expected_amount_minor::bigint),
    collected_amount_minor_bigint = COALESCE(collected_amount_minor_bigint, collected_amount_minor::bigint),
    deposited_amount_minor_bigint = COALESCE(deposited_amount_minor_bigint, deposited_amount_minor::bigint),
    difference_amount_minor_bigint = COALESCE(difference_amount_minor_bigint, difference_amount_minor::bigint)
WHERE expected_amount_minor_bigint IS NULL
   OR collected_amount_minor_bigint IS NULL
   OR deposited_amount_minor_bigint IS NULL
   OR difference_amount_minor_bigint IS NULL;

CREATE OR REPLACE FUNCTION public.sync_cod_reconciliation_money_bigint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.expected_amount_minor_bigint := COALESCE(NEW.expected_amount_minor_bigint, NEW.expected_amount_minor::bigint);
    NEW.collected_amount_minor_bigint := COALESCE(NEW.collected_amount_minor_bigint, NEW.collected_amount_minor::bigint);
    NEW.deposited_amount_minor_bigint := COALESCE(NEW.deposited_amount_minor_bigint, NEW.deposited_amount_minor::bigint);
    NEW.difference_amount_minor_bigint := COALESCE(NEW.difference_amount_minor_bigint, NEW.difference_amount_minor::bigint);
    RETURN NEW;
  END IF;

  IF NEW.expected_amount_minor_bigint IS NULL
     OR (
       NEW.expected_amount_minor IS DISTINCT FROM OLD.expected_amount_minor
       AND NEW.expected_amount_minor_bigint IS NOT DISTINCT FROM OLD.expected_amount_minor_bigint
     ) THEN
    NEW.expected_amount_minor_bigint := NEW.expected_amount_minor::bigint;
  END IF;

  IF NEW.collected_amount_minor_bigint IS NULL
     OR (
       NEW.collected_amount_minor IS DISTINCT FROM OLD.collected_amount_minor
       AND NEW.collected_amount_minor_bigint IS NOT DISTINCT FROM OLD.collected_amount_minor_bigint
     ) THEN
    NEW.collected_amount_minor_bigint := NEW.collected_amount_minor::bigint;
  END IF;

  IF NEW.deposited_amount_minor_bigint IS NULL
     OR (
       NEW.deposited_amount_minor IS DISTINCT FROM OLD.deposited_amount_minor
       AND NEW.deposited_amount_minor_bigint IS NOT DISTINCT FROM OLD.deposited_amount_minor_bigint
     ) THEN
    NEW.deposited_amount_minor_bigint := NEW.deposited_amount_minor::bigint;
  END IF;

  IF NEW.difference_amount_minor_bigint IS NULL
     OR (
       NEW.difference_amount_minor IS DISTINCT FROM OLD.difference_amount_minor
       AND NEW.difference_amount_minor_bigint IS NOT DISTINCT FROM OLD.difference_amount_minor_bigint
     ) THEN
    NEW.difference_amount_minor_bigint := NEW.difference_amount_minor::bigint;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_cod_reconciliation_money_bigint ON public.cod_reconciliation_entries;
CREATE TRIGGER sync_cod_reconciliation_money_bigint
  BEFORE INSERT OR UPDATE ON public.cod_reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_cod_reconciliation_money_bigint();

CREATE OR REPLACE FUNCTION public.money_ledger_source_uuid(
  p_source_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_id_text text;
BEGIN
  v_id_text := NULLIF(COALESCE(p_metadata, '{}'::jsonb) ->> 'source_uuid', '');
  IF v_id_text IS NULL AND p_source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_id_text := p_source_id;
  END IF;
  IF v_id_text IS NULL AND p_source_id ~* ':[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_id_text := substring(p_source_id from '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$');
  END IF;

  IF v_id_text IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_id_text::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_money_ledger_source_site_id(
  p_source_type text,
  p_source_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_uuid uuid;
  v_payment_uuid uuid;
  v_refund_uuid uuid;
  v_compat_table text;
  v_site_id uuid;
BEGIN
  v_source_uuid := public.money_ledger_source_uuid(p_source_id, p_metadata);
  v_payment_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'payment_id', ''), '{}'::jsonb);
  v_refund_uuid := public.money_ledger_source_uuid(COALESCE(p_metadata ->> 'refund_id', ''), '{}'::jsonb);
  v_compat_table := NULLIF(p_metadata ->> 'compatibility_table', '');

  IF p_source_type = 'payment_capture' THEN
    IF v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE id = v_payment_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE provider_payment_id = p_source_id
         AND deleted_at IS NULL
       LIMIT 1;
    END IF;

  ELSIF p_source_type = 'refund' THEN
    IF v_payment_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.payments
       WHERE id = v_payment_uuid
         AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_refund_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.refunds
       WHERE id = v_refund_uuid
         AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'settlement' THEN
    IF v_compat_table = 'payout_statements' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    ELSIF v_compat_table = 'commission_reconciliation_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.commission_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    ELSIF v_compat_table = 'wallet_ledger_entries' AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;

    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.settlements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.commission_reconciliation_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.wallet_ledger_entries WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'cod_remittance' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.cod_reconciliation_entries
       WHERE id = v_source_uuid
         AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'payout' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payouts WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;
    IF v_site_id IS NULL AND v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id FROM public.payout_statements WHERE id = v_source_uuid AND deleted_at IS NULL;
    END IF;

  ELSIF p_source_type = 'reversal' THEN
    IF v_source_uuid IS NOT NULL THEN
      SELECT site_id INTO v_site_id
        FROM public.ledger_transactions
       WHERE id = v_source_uuid
         AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN v_site_id;
END;
$$;

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
  v_source_site_id uuid;
  v_current_site_id uuid;
  v_transaction_id uuid;
BEGIN
  v_source_site_id := public.resolve_money_ledger_source_site_id(
    p_source_type,
    p_source_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  IF v_source_site_id IS NULL THEN
    RAISE EXCEPTION 'ledger source ownership could not be resolved for %.%', p_source_type, p_source_id;
  END IF;

  IF p_site_id IS NULL OR p_site_id <> v_source_site_id THEN
    RAISE EXCEPTION 'ledger source/site mismatch for %.%', p_source_type, p_source_id;
  END IF;

  v_current_site_id := public.current_site_id();
  IF v_current_site_id IS NOT NULL AND v_current_site_id <> v_source_site_id THEN
    RAISE EXCEPTION 'tenant GUC site_id does not match ledger source ownership';
  END IF;

  PERFORM set_config('app.site_id', v_source_site_id::text, true);
  v_transaction_id := public.post_ledger_transaction(
    v_source_site_id,
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

CREATE OR REPLACE FUNCTION public.reconcile_cod_remittance_with_ledger(
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
SET search_path TO 'public'
AS $$
DECLARE
  v_entry public.cod_reconciliation_entries%ROWTYPE;
  v_replay public.cod_reconciliation_entries%ROWTYPE;
  v_deposited_amount_minor bigint;
  v_collected_amount_minor bigint;
  v_expected_amount_minor bigint;
  v_status text;
  v_ledger_transaction_id uuid;
  v_wallet_idempotency_key text;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT *
    INTO v_replay
    FROM public.cod_reconciliation_entries
   WHERE site_id = p_site_id
     AND reconciliation_idempotency_key = p_idempotency_key
     AND deleted_at IS NULL
   LIMIT 1;

  IF FOUND THEN
    RETURN v_replay;
  END IF;

  SELECT *
    INTO v_entry
    FROM public.cod_reconciliation_entries
   WHERE id = p_entry_id
     AND site_id = p_site_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COD reconciliation entry not found';
  END IF;

  v_expected_amount_minor := COALESCE(v_entry.expected_amount_minor_bigint, v_entry.expected_amount_minor::bigint, 0);
  v_collected_amount_minor := COALESCE(NULLIF(v_entry.collected_amount_minor_bigint, 0), v_entry.expected_amount_minor_bigint, v_entry.expected_amount_minor::bigint, 0);
  v_deposited_amount_minor := COALESCE(p_deposited_amount_minor, v_collected_amount_minor);

  IF v_deposited_amount_minor < 0 THEN
    RAISE EXCEPTION 'deposited_amount_minor must be non-negative';
  END IF;

  v_status := CASE
    WHEN v_deposited_amount_minor < v_expected_amount_minor THEN 'short'
    WHEN v_deposited_amount_minor > v_expected_amount_minor THEN 'over'
    ELSE 'reconciled'
  END;

  UPDATE public.cod_reconciliation_entries
     SET status = v_status,
         collected_amount_minor = LEAST(v_collected_amount_minor, 2147483647)::integer,
         collected_amount_minor_bigint = v_collected_amount_minor,
         deposited_amount_minor = LEAST(v_deposited_amount_minor, 2147483647)::integer,
         deposited_amount_minor_bigint = v_deposited_amount_minor,
         difference_amount_minor = GREATEST(LEAST(v_deposited_amount_minor - v_expected_amount_minor, 2147483647), -2147483648)::integer,
         difference_amount_minor_bigint = v_deposited_amount_minor - v_expected_amount_minor,
         deposited_at = COALESCE(deposited_at, now()),
         reconciled_at = now(),
         reconciliation_idempotency_key = p_idempotency_key,
         notes = COALESCE(p_notes, notes),
         metadata = COALESCE(metadata, '{}'::jsonb)
           || jsonb_build_object('reconciled_by', 'merchant_mobile'),
         updated_by = p_actor_id,
         updated_at = now()
   WHERE id = v_entry.id
     AND site_id = v_entry.site_id
   RETURNING * INTO v_entry;

  IF v_deposited_amount_minor > 0 THEN
    v_ledger_transaction_id := public.post_settlement_ledger_transaction(
      v_entry.site_id,
      'cod_remittance',
      v_entry.id::text,
      'cod-remittance:' || v_entry.id::text || ':' || p_idempotency_key,
      jsonb_build_array(
        jsonb_build_object(
          'account_code',
          'cod_receivable',
          'side',
          'debit',
          'amount_minor',
          v_deposited_amount_minor,
          'memo',
          'COD remittance received ' || v_entry.id::text
        ),
        jsonb_build_object(
          'account_code',
          'merchant_payable',
          'side',
          'credit',
          'amount_minor',
          v_deposited_amount_minor,
          'memo',
          'Merchant payable COD remittance ' || v_entry.id::text
        )
      ),
      jsonb_build_object(
        'compatibility_table',
        'cod_reconciliation_entries',
        'cod_reconciliation_entry_id',
        v_entry.id,
        'order_id',
        v_entry.order_id,
        'expected_amount_minor',
        v_expected_amount_minor,
        'deposited_amount_minor',
        v_deposited_amount_minor,
        'difference_amount_minor',
        v_deposited_amount_minor - v_expected_amount_minor
      ),
      p_request_id
    );

    UPDATE public.cod_reconciliation_entries
       SET canonical_ledger_transaction_id = v_ledger_transaction_id,
           updated_by = p_actor_id,
           updated_at = now()
     WHERE id = v_entry.id
       AND site_id = v_entry.site_id
     RETURNING * INTO v_entry;

    v_wallet_idempotency_key := 'cod-remittance:' || v_entry.id::text || ':' || p_idempotency_key;
    INSERT INTO public.wallet_ledger_entries (
      site_id,
      entry_type,
      direction,
      status,
      currency,
      amount_minor,
      amount_minor_bigint,
      reference_type,
      reference_id,
      description,
      idempotency_key,
      canonical_ledger_transaction_id,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      v_entry.site_id,
      'cod_remittance_credit',
      'credit',
      'posted',
      COALESCE(v_entry.currency, 'INR'),
      LEAST(v_deposited_amount_minor, 2147483647)::integer,
      v_deposited_amount_minor,
      'cod_reconciliation_entry',
      v_entry.id::text,
      'COD remittance for order ' || v_entry.order_id::text,
      v_wallet_idempotency_key,
      v_ledger_transaction_id,
      jsonb_build_object(
        'order_id',
        v_entry.order_id,
        'difference_amount_minor',
        v_deposited_amount_minor - v_expected_amount_minor,
        'reconciliation_status',
        v_status,
        'compatibility_only',
        true
      ),
      p_actor_id,
      p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL
    DO UPDATE SET
      canonical_ledger_transaction_id = EXCLUDED.canonical_ledger_transaction_id,
      amount_minor_bigint = EXCLUDED.amount_minor_bigint,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();
  END IF;

  RETURN v_entry;
END;
$$;

REVOKE UPDATE, DELETE ON public.ledger_transactions FROM PUBLIC, anon, authenticated, service_role, app_tenant;
REVOKE UPDATE, DELETE ON public.ledger_entries FROM PUBLIC, anon, authenticated, service_role, app_tenant;
