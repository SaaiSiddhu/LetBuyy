-- F3.7/F9: bind COD collection to the order, reconciliation row, amount and key
-- in one locked service-role operation. This records collection only; it does
-- not recognize or move money.
BEGIN;

CREATE OR REPLACE FUNCTION public.collect_cod_order_with_lock(
  p_site_id uuid,
  p_order_id uuid,
  p_collected_amount_minor bigint DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS public.cod_reconciliation_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_entry public.cod_reconciliation_entries%ROWTYPE;
  v_replay public.cod_reconciliation_entries%ROWTYPE;
  v_request jsonb;
  v_stored_request jsonb;
  v_expected_minor bigint;
  v_collected_minor bigint;
BEGIN
  IF p_site_id IS NULL OR p_order_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'site_id, order_id, and idempotency_key are required' USING ERRCODE = '22023';
  END IF;
  IF p_collected_amount_minor IS NOT NULL AND (p_collected_amount_minor < 0 OR p_collected_amount_minor > 2147483647) THEN
    RAISE EXCEPTION 'collected_amount_minor is outside the supported range' USING ERRCODE = '22023';
  END IF;

  v_request := jsonb_build_object(
    'order_id', p_order_id,
    'collected_amount_minor', p_collected_amount_minor,
    'notes', p_notes
  );
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_replay
    FROM public.cod_reconciliation_entries
   WHERE site_id = p_site_id
     AND collection_idempotency_key = p_idempotency_key
     AND deleted_at IS NULL
   LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    v_stored_request := v_replay.metadata -> 'cod_collection_request';
    IF v_stored_request IS NOT NULL THEN
      IF v_stored_request IS DISTINCT FROM v_request THEN
        RAISE EXCEPTION 'idempotency key is bound to a different COD collection request' USING ERRCODE = '23505';
      END IF;
    ELSE
      v_expected_minor := COALESCE(v_replay.expected_amount_minor_bigint, v_replay.expected_amount_minor::bigint, 0);
      v_collected_minor := COALESCE(p_collected_amount_minor, v_expected_minor);
      IF v_replay.order_id IS DISTINCT FROM p_order_id
         OR v_collected_minor IS DISTINCT FROM COALESCE(v_replay.collected_amount_minor_bigint, v_replay.collected_amount_minor::bigint)
         OR (p_notes IS NOT NULL AND p_notes IS DISTINCT FROM v_replay.notes) THEN
        RAISE EXCEPTION 'idempotency key is bound to a different COD collection request' USING ERRCODE = '23505';
      END IF;
      UPDATE public.cod_reconciliation_entries
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cod_collection_request', v_request)
       WHERE id = v_replay.id AND site_id = p_site_id
       RETURNING * INTO v_replay;
    END IF;
    RETURN v_replay;
  END IF;

  SELECT * INTO v_order
    FROM public.orders AS order_row
   WHERE order_row.id = p_order_id
     AND order_row.store_id = p_site_id
     AND order_row.payment_method = 'cod'
     AND order_row.deleted_at IS NULL
     AND order_row.status NOT IN ('cancelled', 'refunded')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COD order not found' USING ERRCODE = 'P0002';
  END IF;

  v_expected_minor := round(COALESCE(v_order.total, 0) * 100)::bigint;
  IF v_expected_minor <= 0 OR v_expected_minor > 2147483647 THEN
    RAISE EXCEPTION 'COD order amount is outside the supported reconciliation range' USING ERRCODE = '22023';
  END IF;
  v_collected_minor := COALESCE(p_collected_amount_minor, v_expected_minor);

  INSERT INTO public.cod_reconciliation_entries (
    site_id, order_id, status, currency, expected_amount_minor,
    collected_amount_minor, deposited_amount_minor, difference_amount_minor,
    metadata, created_by, updated_by
  ) VALUES (
    p_site_id, p_order_id, 'pending', COALESCE(v_order.currency, 'INR'),
    v_expected_minor::integer, 0, 0, 0,
    jsonb_build_object('order_number', v_order.order_number,
      'payment_status', v_order.payment_status, 'source', 'mobile_cod_reconciliation'),
    p_actor_id, p_actor_id
  )
  ON CONFLICT (site_id, order_id) WHERE deleted_at IS NULL DO NOTHING;

  SELECT * INTO v_entry
    FROM public.cod_reconciliation_entries
   WHERE site_id = p_site_id AND order_id = p_order_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COD reconciliation entry could not be created' USING ERRCODE = '23514';
  END IF;
  IF v_entry.status NOT IN ('pending', 'collected') THEN
    RAISE EXCEPTION 'COD reconciliation entry is no longer collectible' USING ERRCODE = '23514';
  END IF;
  IF v_entry.collection_idempotency_key IS NOT NULL THEN
    RAISE EXCEPTION 'COD order already has a different collection request' USING ERRCODE = '23505';
  END IF;
  IF v_collected_minor > 2147483647 THEN
    RAISE EXCEPTION 'collected_amount_minor is outside the supported range' USING ERRCODE = '22023';
  END IF;

  UPDATE public.cod_reconciliation_entries
     SET status = 'collected',
         collected_amount_minor = v_collected_minor::integer,
         collected_amount_minor_bigint = v_collected_minor,
         collected_at = COALESCE(collected_at, now()),
         collection_idempotency_key = p_idempotency_key,
         notes = COALESCE(p_notes, notes),
         metadata = COALESCE(metadata, '{}'::jsonb)
           || jsonb_build_object('collected_by', 'merchant_mobile', 'cod_collection_request', v_request),
         updated_by = p_actor_id,
         updated_at = now()
   WHERE id = v_entry.id AND site_id = p_site_id
   RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$function$;

REVOKE ALL ON FUNCTION public.collect_cod_order_with_lock(uuid, uuid, bigint, text, text, uuid)
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT EXECUTE ON FUNCTION public.collect_cod_order_with_lock(uuid, uuid, bigint, text, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.collect_cod_order_with_lock(uuid, uuid, bigint, text, text, uuid) IS
  'Atomic service-role COD collection. Binds the merchant collection report to one tenant COD order and idempotent request; does not post cash or remit funds.';

COMMIT;
