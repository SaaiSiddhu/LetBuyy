-- LetBuyy Executable Architecture V1 Task 006 inventory reservation kernel.
-- Builds on the existing inventory tables and adds explicit
-- reserve/commit/release RPCs with tenant GUC checks and row-level locking.

ALTER TABLE public.inventory_levels
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE public.inventory_levels il
   SET store_id = p.store_id
  FROM public.products p
 WHERE p.id = il.product_id
   AND il.store_id IS NULL;

ALTER TABLE public.inventory_reservations
  ADD COLUMN IF NOT EXISTS commit_idempotency_key text,
  ADD COLUMN IF NOT EXISTS release_idempotency_key text;

CREATE INDEX IF NOT EXISTS idx_inventory_levels_store_product_location
  ON public.inventory_levels (store_id, product_id, variant_id, location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expiry_sweeper
  ON public.inventory_reservations (store_id, status, expires_at)
  WHERE deleted_at IS NULL AND status IN ('active', 'hold');

CREATE OR REPLACE FUNCTION public.set_inventory_level_store_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    SELECT store_id INTO NEW.store_id
      FROM public.products
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_levels_store_id_fill ON public.inventory_levels;
CREATE TRIGGER inventory_levels_store_id_fill
  BEFORE INSERT OR UPDATE OF product_id, store_id ON public.inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_level_store_id();

DROP TRIGGER IF EXISTS inventory_levels_increment_version ON public.inventory_levels;
CREATE TRIGGER inventory_levels_increment_version
  BEFORE UPDATE ON public.inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.increment_version();

CREATE OR REPLACE FUNCTION public.require_inventory_site_guc(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF public.current_site_id() IS NULL OR public.current_site_id() <> p_store_id THEN
    RAISE EXCEPTION 'tenant GUC site_id is required for inventory mutation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_store_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_ttl_seconds integer DEFAULT 1200,
  p_idempotency_key text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing public.inventory_reservations%ROWTYPE;
  v_level public.inventory_levels%ROWTYPE;
  v_reservation public.inventory_reservations%ROWTYPE;
  v_expires_at timestamptz;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'inventory reservation quantity must be positive';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'inventory reservation idempotency key is required';
  END IF;

  SELECT * INTO v_existing
    FROM public.inventory_reservations
   WHERE store_id = p_store_id
     AND idempotency_key = p_idempotency_key
     AND deleted_at IS NULL
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reservation_id', v_existing.id,
      'status', v_existing.status,
      'quantity', v_existing.quantity,
      'expires_at', v_existing.expires_at,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_level
    FROM public.inventory_levels
   WHERE store_id = p_store_id
     AND product_id = p_product_id
     AND variant_id IS NOT DISTINCT FROM p_variant_id
     AND location_id = p_location_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory level not found';
  END IF;

  IF (COALESCE(v_level.available, 0) - COALESCE(v_level.reserved, 0)) < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';
  END IF;

  v_expires_at := now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_ttl_seconds, 1200), 60), 86400));

  UPDATE public.inventory_levels
     SET reserved = reserved + p_quantity,
         reserved_quantity = COALESCE(reserved_quantity, reserved) + p_quantity,
         available_quantity = COALESCE(available_quantity, available),
         on_hand_quantity = COALESCE(on_hand_quantity, available + reserved),
         updated_at = now()
   WHERE id = v_level.id;

  INSERT INTO public.inventory_reservations (
    store_id,
    product_id,
    variant_id,
    location_id,
    quantity,
    status,
    idempotency_key,
    expires_at,
    created_by
  ) VALUES (
    p_store_id,
    p_product_id,
    p_variant_id,
    p_location_id,
    p_quantity,
    'active',
    p_idempotency_key,
    v_expires_at,
    p_actor_id
  )
  RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'expires_at', v_reservation.expires_at,
    'idempotent', false,
    'request_id', p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_inventory_reservation(
  p_store_id uuid,
  p_reservation_id uuid,
  p_idempotency_key text,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  SELECT * INTO v_reservation
    FROM public.inventory_reservations
   WHERE id = p_reservation_id
     AND store_id = p_store_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory reservation not found';
  END IF;

  IF v_reservation.status = 'committed' THEN
    RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', 'committed', 'idempotent', true);
  END IF;

  IF v_reservation.status NOT IN ('active', 'hold') THEN
    RAISE EXCEPTION 'inventory reservation cannot be committed from status %', v_reservation.status;
  END IF;

  UPDATE public.inventory_levels
     SET available = GREATEST(available - v_reservation.quantity, 0),
         reserved = GREATEST(reserved - v_reservation.quantity, 0),
         available_quantity = GREATEST(COALESCE(available_quantity, available) - v_reservation.quantity, 0),
         reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
         committed_quantity = COALESCE(committed_quantity, 0) + v_reservation.quantity,
         updated_at = now()
   WHERE store_id = p_store_id
     AND product_id = v_reservation.product_id
     AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
     AND location_id = v_reservation.location_id;

  UPDATE public.inventory_reservations
     SET status = 'committed',
         committed_at = now(),
         commit_idempotency_key = p_idempotency_key,
         updated_at = now()
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'request_id', p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_inventory_reservation(
  p_store_id uuid,
  p_reservation_id uuid,
  p_idempotency_key text,
  p_reason text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  SELECT * INTO v_reservation
    FROM public.inventory_reservations
   WHERE id = p_reservation_id
     AND store_id = p_store_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory reservation not found';
  END IF;

  IF v_reservation.status IN ('released', 'expired', 'cancelled') THEN
    RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', v_reservation.status, 'idempotent', true);
  END IF;

  IF v_reservation.status NOT IN ('active', 'hold') THEN
    RAISE EXCEPTION 'inventory reservation cannot be released from status %', v_reservation.status;
  END IF;

  UPDATE public.inventory_levels
     SET reserved = GREATEST(reserved - v_reservation.quantity, 0),
         reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
         updated_at = now()
   WHERE store_id = p_store_id
     AND product_id = v_reservation.product_id
     AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
     AND location_id = v_reservation.location_id;

  UPDATE public.inventory_reservations
     SET status = 'released',
         released_at = now(),
         release_reason = COALESCE(p_reason, 'released'),
         release_idempotency_key = p_idempotency_key,
         updated_at = now()
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'request_id', p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_inventory_reservations(
  p_limit integer DEFAULT 100,
  p_request_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR v_reservation IN
    SELECT *
      FROM public.inventory_reservations
     WHERE status IN ('active', 'hold')
       AND expires_at <= now()
       AND deleted_at IS NULL
     ORDER BY expires_at ASC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000)
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.inventory_levels
       SET reserved = GREATEST(reserved - v_reservation.quantity, 0),
           reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
           updated_at = now()
     WHERE store_id = v_reservation.store_id
       AND product_id = v_reservation.product_id
       AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
       AND location_id = v_reservation.location_id;

    UPDATE public.inventory_reservations
       SET status = 'expired',
           released_at = now(),
           release_reason = 'ttl_expired',
           updated_at = now()
     WHERE id = v_reservation.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['inventory_levels', 'inventory_locations', 'inventory_reservations']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS inventory_levels_tenant_site_guc ON public.inventory_levels;
CREATE POLICY inventory_levels_tenant_site_guc
  ON public.inventory_levels
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

DROP POLICY IF EXISTS inventory_locations_tenant_site_guc ON public.inventory_locations;
CREATE POLICY inventory_locations_tenant_site_guc
  ON public.inventory_locations
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

DROP POLICY IF EXISTS inventory_reservations_tenant_site_guc ON public.inventory_reservations;
CREATE POLICY inventory_reservations_tenant_site_guc
  ON public.inventory_reservations
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());
