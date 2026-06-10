-- D6 / P8 checkout hardening:
-- - keep create_checkout_order as the only order creation authority,
-- - bind order inventory writes to the reserve -> commit RPC lifecycle,
-- - leave hosted checkout DNS/signing cutover as HUMAN-REQUIRED.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_order_with_inventory_reservations(
  p_store_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text DEFAULT NULL::text,
  p_shipping_address jsonb DEFAULT '{}'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_payment_method text DEFAULT 'cod'::text,
  p_notes text DEFAULT NULL::text,
  p_coupon_code text DEFAULT NULL::text,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_request_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_product record;
  v_variant record;
  v_location_id uuid;
  v_reservation jsonb;
  v_reservation_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_line_total numeric(10,2);
  v_unit_price numeric(10,2);
  v_variant_title text;
  v_sku text;
  v_order_items jsonb := '[]'::jsonb;
  v_order_json jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'store_id is required';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.sites
     WHERE id = p_store_id
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  IF public.current_site_id() IS NULL THEN
    PERFORM set_config('app.site_id', p_store_id::text, true);
  END IF;
  PERFORM public.require_inventory_site_guc(p_store_id);

  v_order_number := 'LB-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_quantity := COALESCE((v_item ->> 'quantity')::integer, 0);

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'invalid quantity for product %', v_product_id;
    END IF;

    SELECT id, name, price, sku, is_active, store_id
      INTO v_product
      FROM public.products
     WHERE id = v_product_id
       AND store_id = p_store_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found: %', v_product_id;
    END IF;

    IF COALESCE(v_product.is_active, false) = false THEN
      RAISE EXCEPTION 'product is not active: %', v_product.name;
    END IF;

    v_unit_price := v_product.price;
    v_variant_title := NULL;
    v_sku := v_product.sku;

    IF v_variant_id IS NOT NULL THEN
      SELECT id, title, price, sku
        INTO v_variant
        FROM public.product_variants
       WHERE id = v_variant_id
         AND product_id = v_product_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'variant not found for product %', v_product_id;
      END IF;

      v_unit_price := COALESCE(NULLIF(v_variant.price, 0), v_product.price);
      v_variant_title := v_variant.title;
      v_sku := COALESCE(v_variant.sku, v_product.sku);
    END IF;

    SELECT il.location_id
      INTO v_location_id
      FROM public.inventory_levels il
      JOIN public.inventory_locations loc ON loc.id = il.location_id
     WHERE il.product_id = v_product_id
       AND il.variant_id IS NOT DISTINCT FROM v_variant_id
       AND COALESCE(il.store_id, loc.store_id) = p_store_id
       AND loc.status = 'active'
       AND loc.deleted_at IS NULL
       AND il.deleted_at IS NULL
     ORDER BY loc.is_default DESC, il.updated_at ASC
     LIMIT 1;

    IF NOT FOUND OR v_location_id IS NULL THEN
      RAISE EXCEPTION 'inventory level not found for product %', v_product_id;
    END IF;

    SELECT public.reserve_inventory(
      p_store_id,
      v_product_id,
      v_variant_id,
      v_location_id,
      v_quantity,
      1200,
      'checkout.reserve:' || COALESCE(p_request_id, v_order_number) || ':' || jsonb_array_length(v_order_items)::text || ':' || v_product_id::text || ':' || COALESCE(v_variant_id::text, 'default'),
      p_actor_id,
      p_request_id
    )
    INTO v_reservation;
    v_reservation_id := (v_reservation ->> 'reservation_id')::uuid;

    v_line_total := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_line_total;

    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'reservation_id', v_reservation_id,
      'location_id', v_location_id,
      'name', v_product.name,
      'variant_title', v_variant_title,
      'sku', v_sku,
      'quantity', v_quantity,
      'price', v_unit_price,
      'total', v_line_total
    ));
  END LOOP;

  INSERT INTO public.orders (
    store_id,
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    items,
    subtotal,
    shipping_cost,
    discount,
    total,
    coupon_code,
    payment_method,
    status,
    payment_status,
    notes,
    inventory_reserved_at,
    created_by
  )
  VALUES (
    p_store_id,
    v_order_number,
    p_customer_name,
    p_customer_email,
    COALESCE(p_customer_phone, ''),
    COALESCE(p_shipping_address, '{}'::jsonb),
    v_order_items,
    v_subtotal,
    0,
    0,
    v_subtotal,
    p_coupon_code,
    p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'confirmed' ELSE 'pending' END,
    'pending',
    COALESCE(p_notes, ''),
    now(),
    p_actor_id
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_location_id := (v_item ->> 'location_id')::uuid;
    v_reservation_id := (v_item ->> 'reservation_id')::uuid;

    UPDATE public.inventory_reservations
       SET order_id = v_order_id,
           updated_at = now()
     WHERE id = v_reservation_id
       AND store_id = p_store_id;

    PERFORM public.commit_inventory_reservation(
      p_store_id,
      v_reservation_id,
      'checkout.commit:' || v_order_id::text || ':' || v_reservation_id::text,
      p_actor_id,
      p_request_id
    );

    INSERT INTO public.inventory_adjustments (
      product_id,
      variant_id,
      location_id,
      quantity_change,
      reason,
      reference_id,
      note,
      created_by
    )
    VALUES (
      v_product_id,
      v_variant_id,
      v_location_id,
      -v_quantity,
      'sale',
      v_order_id,
      'Committed by reserve_inventory -> commit_inventory_reservation',
      p_actor_id
    );

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      sku,
      title,
      variant_title,
      quantity,
      unit_price,
      total,
      product_snapshot
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_item ->> 'sku',
      v_item ->> 'name',
      v_item ->> 'variant_title',
      v_quantity,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'total')::numeric,
      v_item - 'reservation_id' - 'location_id'
    );
  END LOOP;

  INSERT INTO public.outbox_events (
    store_id,
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    idempotency_key,
    request_id,
    actor_id
  )
  VALUES (
    p_store_id,
    'order',
    v_order_id::text,
    'order.created',
    jsonb_build_object(
      'store_id', p_store_id,
      'order_id', v_order_id,
      'order_number', v_order_number,
      'total', v_subtotal,
      'payment_method', p_payment_method
    ),
    'order.created:' || v_order_id::text,
    p_request_id,
    p_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO public.audit_activity_events (
    store_id,
    actor_id,
    actor_type,
    action,
    resource_type,
    resource_id,
    request_id,
    after_state
  )
  VALUES (
    p_store_id,
    p_actor_id,
    'user',
    'order.create',
    'order',
    v_order_id::text,
    p_request_id,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'total', v_subtotal
    )
  );

  SELECT to_jsonb(o)
    INTO v_order_json
    FROM public.orders o
   WHERE o.id = v_order_id;

  RETURN v_order_json;
END;
$$;

COMMIT;
