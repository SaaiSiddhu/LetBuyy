-- Phase 8: provider-confirmed payment-session refund reconciliation.
-- A signed provider event and an authenticated merchant refund request converge
-- on this one atomic writer for attempt state, payment totals and canonical ledger.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Provider webhooks begin with a globally unique provider payment reference, before
-- the owning site is known. Resolve only the minimal payment identity through a
-- service-role-only function; all subsequent table reads are explicitly site-scoped.
CREATE OR REPLACE FUNCTION public.resolve_payment_for_refund_provider_event(
  p_provider text,
  p_provider_payment_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment jsonb;
BEGIN
  IF p_provider IS DISTINCT FROM 'razorpay'
     OR NULLIF(btrim(p_provider_payment_id), '') IS NULL THEN
    RAISE EXCEPTION 'valid provider payment reference is required';
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'site_id', site_id,
    'order_id', order_id,
    'provider', provider,
    'provider_payment_id', provider_payment_id,
    'mode', mode
  ) INTO v_payment
    FROM public.payments
   WHERE provider = p_provider
     AND provider_payment_id = p_provider_payment_id
     AND deleted_at IS NULL;
  RETURN v_payment;
END;
$$;

-- The merchant refund route knows the payment UUID but does not yet know the
-- tenant scope required by the guarded client. Resolve only when the authenticated
-- user currently owns the payment's site; never return another merchant's row.
CREATE OR REPLACE FUNCTION public.load_owned_payment_session(
  p_payment_id uuid,
  p_user_id uuid,
  p_session_store_id uuid DEFAULT NULL
) RETURNS SETOF public.payments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT payment.*
    FROM public.payments AS payment
    JOIN public.sites AS site
      ON site.id = payment.site_id
     AND site.deleted_at IS NULL
   WHERE payment.id = p_payment_id
     AND payment.deleted_at IS NULL
     AND p_user_id IS NOT NULL
     AND (p_session_store_id IS NULL OR p_session_store_id = payment.site_id)
     AND (site.custom_user_id = p_user_id OR site.user_id = p_user_id)
   LIMIT 1;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_refund_idempotency_idx
  ON public.payment_attempts (payment_id, idempotency_key)
  WHERE attempt_type = 'refund'
    AND payment_id IS NOT NULL
    AND idempotency_key IS NOT NULL
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_provider_refund_id_idx
  ON public.payment_attempts (payment_id, (metadata ->> 'provider_refund_id'))
  WHERE attempt_type = 'refund'
    AND payment_id IS NOT NULL
    AND metadata ? 'provider_refund_id'
    AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.reserve_payment_refund_attempt(
  p_payment_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_reserved_minor bigint;
BEGIN
  IF p_payment_id IS NULL OR NULLIF(btrim(p_idempotency_key), '') IS NULL
     OR p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'payment, refund amount and idempotency key are required';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE id = p_payment_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;
  IF v_payment.status <> 'captured' OR p_amount_minor > v_payment.amount_minor THEN
    RAISE EXCEPTION 'payment is not eligible for refund';
  END IF;

  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE payment_id = p_payment_id
     AND idempotency_key = p_idempotency_key
     AND attempt_type = 'refund'
     AND deleted_at IS NULL
   FOR UPDATE;
  IF FOUND THEN
    IF round(v_attempt.amount * 100)::bigint <> p_amount_minor THEN
      RAISE EXCEPTION 'refund idempotency key was reused with a different amount';
    END IF;
    RETURN jsonb_build_object(
      'attempt_id', v_attempt.id,
      'status', v_attempt.status,
      'created', false,
      'amount_minor', p_amount_minor,
      'provider_refund_id', v_attempt.metadata ->> 'provider_refund_id'
    );
  END IF;

  SELECT COALESCE(SUM(round(amount * 100)::bigint), 0)
    INTO v_reserved_minor
    FROM public.payment_attempts
   WHERE payment_id = p_payment_id
     AND attempt_type = 'refund'
     AND status IN ('pending', 'processing')
     AND deleted_at IS NULL;
  v_reserved_minor := COALESCE(v_payment.refunded_amount_minor, 0) + v_reserved_minor;
  IF v_reserved_minor + p_amount_minor > v_payment.amount_minor THEN
    RAISE EXCEPTION 'refund amount exceeds remaining captured payment';
  END IF;

  INSERT INTO public.payment_attempts (
    site_id, order_id, payment_id, provider, attempt_type, status,
    amount, currency, provider_order_id, provider_payment_id,
    idempotency_key, request_id, metadata, created_by, updated_by
  ) VALUES (
    v_payment.site_id, v_payment.order_id, v_payment.id, v_payment.provider,
    'refund', 'pending', p_amount_minor::numeric / 100, v_payment.currency,
    v_payment.provider_order_id, v_payment.provider_payment_id,
    p_idempotency_key, p_request_id,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('refund_amount_minor', p_amount_minor),
    p_actor_id, p_actor_id
  ) RETURNING * INTO v_attempt;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_attempt.status,
    'created', true,
    'amount_minor', p_amount_minor,
    'provider_refund_id', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_payment_refund_attempt(
  p_payment_id uuid,
  p_attempt_id uuid,
  p_provider_refund_id text,
  p_provider_event_id text,
  p_event_type text,
  p_status text,
  p_amount_minor bigint,
  p_currency text DEFAULT 'INR',
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_cumulative_refund_minor bigint;
  v_ledger_transaction_id uuid;
BEGIN
  IF p_payment_id IS NULL OR p_attempt_id IS NULL
     OR NULLIF(btrim(p_provider_refund_id), '') IS NULL
     OR NULLIF(btrim(p_provider_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'payment, attempt, provider refund and event references are required';
  END IF;
  IF p_event_type IS NULL OR p_status IS NULL
     OR p_event_type NOT IN ('refund.created', 'refund.processed', 'refund.failed')
     OR p_status NOT IN ('created', 'processed', 'failed') THEN
    RAISE EXCEPTION 'unsupported provider refund state';
  END IF;
  IF (p_event_type = 'refund.created' AND p_status <> 'created')
     OR (p_event_type = 'refund.processed' AND p_status <> 'processed')
     OR (p_event_type = 'refund.failed' AND p_status <> 'failed') THEN
    RAISE EXCEPTION 'provider refund event and entity status disagree';
  END IF;
  IF p_currency IS DISTINCT FROM 'INR' OR p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'provider refund amount must be positive INR minor units';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE id = p_payment_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;
  IF v_payment.provider <> 'razorpay'
     OR v_payment.status NOT IN ('captured', 'refunded')
     OR v_payment.provider_payment_id IS NULL THEN
    RAISE EXCEPTION 'payment is not eligible for provider refund reconciliation';
  END IF;

  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE id = p_attempt_id
     AND payment_id = p_payment_id
     AND site_id = v_payment.site_id
     AND order_id = v_payment.order_id
     AND provider = v_payment.provider
     AND attempt_type = 'refund'
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund attempt does not belong to payment';
  END IF;
  IF round(v_attempt.amount * 100)::bigint <> p_amount_minor
     OR v_attempt.currency <> p_currency THEN
    RAISE EXCEPTION 'provider refund amount does not match reserved attempt';
  END IF;
  IF v_attempt.metadata ? 'provider_refund_id'
     AND v_attempt.metadata ->> 'provider_refund_id' <> p_provider_refund_id THEN
    RAISE EXCEPTION 'provider refund id does not match reserved attempt';
  END IF;

  IF v_attempt.status = 'succeeded' THEN
    RETURN jsonb_build_object(
      'outcome', 'processed',
      'replayed', true,
      'payment_id', p_payment_id,
      'attempt_id', p_attempt_id,
      'refunded_amount_minor', v_payment.refunded_amount_minor,
      'payment_amount_minor', v_payment.amount_minor,
      'fully_refunded', v_payment.status = 'refunded',
      'ledger_transaction_id', v_attempt.metadata ->> 'canonical_ledger_transaction_id'
    );
  END IF;

  IF p_event_type = 'refund.created' THEN
    UPDATE public.payment_attempts
       SET provider_event_id = p_provider_event_id,
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'provider_refund_id', p_provider_refund_id,
                  'last_provider_event_type', p_event_type,
                  'last_provider_status', p_status
                ),
           updated_at = now()
     WHERE id = p_attempt_id;
    RETURN jsonb_build_object('outcome', 'pending', 'replayed', false, 'attempt_id', p_attempt_id);
  END IF;

  IF p_event_type = 'refund.failed' THEN
    UPDATE public.payment_attempts
       SET status = 'failed',
           provider_event_id = p_provider_event_id,
           failure_reason = 'Provider reported refund failure',
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'provider_refund_id', p_provider_refund_id,
                  'last_provider_event_type', p_event_type,
                  'last_provider_status', p_status
                ),
           updated_at = now()
     WHERE id = p_attempt_id;
    RETURN jsonb_build_object('outcome', 'failed', 'replayed', false, 'attempt_id', p_attempt_id);
  END IF;

  v_cumulative_refund_minor := COALESCE(v_payment.refunded_amount_minor, 0) + p_amount_minor;
  IF v_cumulative_refund_minor > v_payment.amount_minor THEN
    RAISE EXCEPTION 'cumulative provider refunds exceed captured payment';
  END IF;

  v_ledger_transaction_id := public.post_settlement_ledger_transaction(
    v_payment.site_id,
    'refund',
    p_provider_refund_id,
    'payment.refund:' || p_payment_id::text || ':' || p_provider_refund_id,
    jsonb_build_array(
      jsonb_build_object(
        'account_code', 'merchant_payable',
        'side', 'debit',
        'amount_minor', p_amount_minor,
        'memo', 'Merchant payable refund ' || p_payment_id::text
      ),
      jsonb_build_object(
        'account_code', 'refund_clearing',
        'side', 'credit',
        'amount_minor', p_amount_minor,
        'memo', 'Provider refund ' || p_provider_refund_id
      )
    ),
    jsonb_build_object(
      'payment_id', p_payment_id,
      'order_id', v_payment.order_id,
      'provider_refund_id', p_provider_refund_id,
      'provider_event_id', p_provider_event_id,
      'refund_amount_minor', p_amount_minor
    ),
    p_request_id
  );

  UPDATE public.payment_attempts
     SET status = 'succeeded',
         provider_event_id = p_provider_event_id,
         failure_reason = NULL,
         metadata = COALESCE(metadata, '{}'::jsonb)
           || jsonb_build_object(
                'provider_refund_id', p_provider_refund_id,
                'last_provider_event_type', p_event_type,
                'last_provider_status', p_status,
                'canonical_ledger_transaction_id', v_ledger_transaction_id
              ),
         updated_at = now()
   WHERE id = p_attempt_id;

  UPDATE public.payments
     SET status = CASE WHEN v_cumulative_refund_minor = amount_minor THEN 'refunded' ELSE 'captured' END,
         refunded_amount_minor = v_cumulative_refund_minor,
         refunded_at = CASE WHEN v_cumulative_refund_minor = amount_minor THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
         refund_ledger_transaction_id = v_ledger_transaction_id,
         request_id = p_request_id,
         updated_at = now()
   WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'outcome', 'processed',
    'replayed', false,
    'payment_id', p_payment_id,
    'attempt_id', p_attempt_id,
    'refunded_amount_minor', v_cumulative_refund_minor,
    'payment_amount_minor', v_payment.amount_minor,
    'fully_refunded', v_cumulative_refund_minor = v_payment.amount_minor,
    'ledger_transaction_id', v_ledger_transaction_id
  );
END;
$$;

-- Manual/non-Razorpay provider confirmations still need the same serialized,
-- append-only ledger and durable outbox boundary as signed Razorpay webhooks.
CREATE OR REPLACE FUNCTION public.finalize_manual_payment_refund_attempt(
  p_payment_id uuid,
  p_attempt_id uuid,
  p_provider_refund_id text,
  p_amount_minor bigint,
  p_currency text DEFAULT 'INR',
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_cumulative_refund_minor bigint;
  v_ledger_transaction_id uuid;
  v_provider_event_id text;
  v_outbox_idempotency_key text;
  v_fully_refunded boolean;
BEGIN
  IF p_payment_id IS NULL OR p_attempt_id IS NULL
     OR NULLIF(btrim(p_provider_refund_id), '') IS NULL
     OR p_currency IS DISTINCT FROM 'INR'
     OR p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'manual refund requires a payment, attempt, provider reference and positive INR amount';
  END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE id = p_payment_id
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR v_payment.provider = 'razorpay'
     OR v_payment.status NOT IN ('captured', 'refunded') THEN
    RAISE EXCEPTION 'payment is not eligible for manual refund finalization';
  END IF;

  SELECT * INTO v_attempt
    FROM public.payment_attempts
   WHERE id = p_attempt_id
     AND payment_id = p_payment_id
     AND site_id = v_payment.site_id
     AND order_id = v_payment.order_id
     AND provider = v_payment.provider
     AND attempt_type = 'refund'
     AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'manual refund attempt does not belong to payment';
  END IF;
  IF round(v_attempt.amount * 100)::bigint <> p_amount_minor
     OR v_attempt.currency <> p_currency THEN
    RAISE EXCEPTION 'manual refund amount does not match reserved attempt';
  END IF;
  IF v_attempt.metadata ? 'provider_refund_id'
     AND v_attempt.metadata ->> 'provider_refund_id' <> p_provider_refund_id THEN
    RAISE EXCEPTION 'manual refund reference does not match reserved attempt';
  END IF;

  v_provider_event_id := 'manual.refund:' || p_provider_refund_id;
  v_outbox_idempotency_key := 'payment.refund:' || p_payment_id::text || ':' || v_payment.provider || ':' || p_provider_refund_id;
  IF v_attempt.status = 'succeeded' THEN
    IF v_attempt.provider_event_id IS DISTINCT FROM v_provider_event_id THEN
      RAISE EXCEPTION 'manual refund attempt was already finalized with a different provider reference';
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'processed',
      'replayed', true,
      'payment_id', p_payment_id,
      'attempt_id', p_attempt_id,
      'refunded_amount_minor', v_payment.refunded_amount_minor,
      'payment_amount_minor', v_payment.amount_minor,
      'fully_refunded', v_payment.status = 'refunded',
      'ledger_transaction_id', v_attempt.metadata ->> 'canonical_ledger_transaction_id'
    );
  END IF;
  IF v_attempt.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'manual refund attempt is not pending';
  END IF;

  v_cumulative_refund_minor := COALESCE(v_payment.refunded_amount_minor, 0) + p_amount_minor;
  IF v_cumulative_refund_minor > v_payment.amount_minor THEN
    RAISE EXCEPTION 'cumulative manual refunds exceed captured payment';
  END IF;
  v_fully_refunded := v_cumulative_refund_minor = v_payment.amount_minor;

  v_ledger_transaction_id := public.post_settlement_ledger_transaction(
    v_payment.site_id,
    'refund',
    p_provider_refund_id,
    v_outbox_idempotency_key,
    jsonb_build_array(
      jsonb_build_object(
        'account_code', 'merchant_payable',
        'side', 'debit',
        'amount_minor', p_amount_minor,
        'memo', 'Merchant payable refund ' || p_payment_id::text
      ),
      jsonb_build_object(
        'account_code', 'refund_clearing',
        'side', 'credit',
        'amount_minor', p_amount_minor,
        'memo', 'Provider refund ' || p_provider_refund_id
      )
    ),
    jsonb_build_object(
      'payment_id', p_payment_id,
      'order_id', v_payment.order_id,
      'provider', v_payment.provider,
      'provider_refund_id', p_provider_refund_id,
      'refund_amount_minor', p_amount_minor,
      'cumulative_refund_amount_minor', v_cumulative_refund_minor,
      'confirmation_source', 'merchant_step_up'
    ),
    p_request_id
  );

  UPDATE public.payment_attempts
     SET status = 'succeeded',
         provider_event_id = v_provider_event_id,
         failure_reason = NULL,
         metadata = COALESCE(metadata, '{}'::jsonb)
           || jsonb_build_object(
                'provider_refund_id', p_provider_refund_id,
                'last_provider_event_type', 'manual.refund',
                'last_provider_status', 'processed',
                'canonical_ledger_transaction_id', v_ledger_transaction_id
              ),
         request_id = p_request_id,
         updated_by = p_actor_id,
         updated_at = now()
   WHERE id = p_attempt_id;

  UPDATE public.payments
     SET status = CASE WHEN v_fully_refunded THEN 'refunded' ELSE 'captured' END,
         refunded_amount_minor = v_cumulative_refund_minor,
         refunded_at = CASE WHEN v_fully_refunded THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
         refund_ledger_transaction_id = v_ledger_transaction_id,
         request_id = p_request_id,
         updated_by = p_actor_id,
         updated_at = now()
   WHERE id = p_payment_id;

  INSERT INTO public.outbox_events (
    store_id, aggregate_type, aggregate_id, event_type, payload,
    idempotency_key, request_id, actor_id, schema_version
  ) VALUES (
    v_payment.site_id,
    'order',
    v_payment.order_id::text,
    'payment.refunded',
    jsonb_build_object(
      'order_id', v_payment.order_id,
      'payment_id', v_payment.id,
      'provider', v_payment.provider,
      'provider_event_id', v_provider_event_id,
      'payment_status', CASE WHEN v_fully_refunded THEN 'refunded' ELSE 'paid' END
    ),
    v_outbox_idempotency_key,
    p_request_id,
    p_actor_id,
    1
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'outcome', 'processed',
    'replayed', false,
    'payment_id', p_payment_id,
    'attempt_id', p_attempt_id,
    'refunded_amount_minor', v_cumulative_refund_minor,
    'payment_amount_minor', v_payment.amount_minor,
    'fully_refunded', v_fully_refunded,
    'ledger_transaction_id', v_ledger_transaction_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_payment_refund_attempt(uuid, bigint, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_refund_attempt(uuid, bigint, text, text, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_payment_for_refund_provider_event(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_payment_for_refund_provider_event(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.load_owned_payment_session(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_owned_payment_session(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_payment_refund_attempt(uuid, uuid, text, text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_payment_refund_attempt(uuid, uuid, text, text, text, text, bigint, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_manual_payment_refund_attempt(uuid, uuid, text, bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_manual_payment_refund_attempt(uuid, uuid, text, bigint, text, text, uuid) TO service_role;
