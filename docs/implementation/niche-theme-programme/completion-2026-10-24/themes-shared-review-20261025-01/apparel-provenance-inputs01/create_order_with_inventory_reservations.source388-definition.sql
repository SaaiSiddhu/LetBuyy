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
  v_ref jsonb; v_cart public.carts%ROWTYPE; v_cart_line jsonb;
  v_niche jsonb; v_product_facts jsonb; v_variant_facts jsonb;
  v_selected_options jsonb; v_option_names text[]; v_saved_options jsonb;
  v_has_variants boolean; v_names text[] := ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books'];
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_product record;
  v_variant public.product_variants%ROWTYPE;
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

  -- Preserve234's idempotency/advisory-first boundary. Align385/inventory lock order
  -- across ALL products before accepting any line, so distinct configurations share stock.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'niche' OR i ? 'niche_snapshot'
    OR i ? 'catalog_source' OR i ? 'personalization') THEN RAISE EXCEPTION 'CART_FACT_INPUT_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref'
    GROUP BY i->'cart_fact_ref'->>'cart_id',i->'cart_fact_ref'->>'line_id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'CART_FACT_REFERENCE_DUPLICATED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref') AND (
    EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE NOT i ? 'cart_fact_ref')
    OR (SELECT count(DISTINCT i->'cart_fact_ref'->>'cart_id') FROM jsonb_array_elements(p_items) i)>1) THEN RAISE EXCEPTION 'CART_FACT_INPUT_INVALID'; END IF;
  -- Lock cart capabilities in deterministic order before product/inventory locks.
  PERFORM c.id FROM public.carts c WHERE c.store_id=p_store_id AND c.id IN
    (SELECT (i->'cart_fact_ref'->>'cart_id')::uuid FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref')
    ORDER BY c.id FOR UPDATE;
  PERFORM il.id FROM public.inventory_levels il WHERE il.store_id=p_store_id AND il.product_id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY il.id FOR UPDATE;
  PERFORM pv.id FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id
    WHERE p.store_id=p_store_id AND pv.product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i)
    ORDER BY pv.id FOR UPDATE OF pv;
  PERFORM po.id FROM public.product_options po JOIN public.products p ON p.id=po.product_id
    WHERE p.store_id=p_store_id AND po.product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i)
    ORDER BY po.id FOR UPDATE OF po;
  PERFORM p.id FROM public.products p WHERE p.store_id=p_store_id AND p.id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY p.id FOR UPDATE;

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

    SELECT id, name, price, sku, is_active, store_id, version, metadata, images
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
      SELECT *
        INTO v_variant
        FROM public.product_variants
       WHERE id = v_variant_id
         AND product_id = v_product_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'variant not found for product %', v_product_id;
      END IF;

      v_unit_price := COALESCE(NULLIF(v_variant.price, 0), v_product.price);
      v_variant_title := v_variant.title;
      v_sku := COALESCE(v_variant.sku, v_product.sku);
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=v_product_id) INTO v_has_variants;

    SELECT coalesce(jsonb_object_agg(k,value),'{}'::jsonb) INTO v_product_facts
      FROM jsonb_each(coalesce(v_product.metadata,'{}'::jsonb)) AS facts(k,value) WHERE k=ANY(v_names);
    v_variant_facts := CASE WHEN v_variant_id IS NULL THEN '{}'::jsonb ELSE coalesce(v_variant.metadata,'{}'::jsonb) END;
    SELECT array_agg(name ORDER BY position,id) INTO v_option_names FROM public.product_options WHERE product_id=v_product_id;
    v_selected_options := CASE WHEN v_variant_id IS NULL THEN '{}'::jsonb ELSE
      jsonb_strip_nulls(jsonb_build_object(coalesce(v_option_names[1],'Option 1'),v_variant.option1,
        coalesce(v_option_names[2],'Option 2'),v_variant.option2,coalesce(v_option_names[3],'Option 3'),v_variant.option3)) END;
    IF v_has_variants AND v_variant_id IS NULL AND (v_item ? 'cart_fact_ref' OR v_product_facts<>'{}'::jsonb
      OR EXISTS(SELECT 1 FROM public.product_variants pv WHERE pv.product_id=v_product_id AND (pv.metadata<>'{}'::jsonb OR pv.option1 IS NOT NULL OR pv.option2 IS NOT NULL OR pv.option3 IS NOT NULL))
      OR EXISTS(SELECT 1 FROM public.product_options po WHERE po.product_id=v_product_id)) THEN RAISE EXCEPTION 'CART_VARIANT_REQUIRED'; END IF;
    v_ref := v_item->'cart_fact_ref';
    v_niche := NULL;
    IF v_ref IS NOT NULL THEN
      SELECT * INTO v_cart FROM public.carts WHERE id=(v_ref->>'cart_id')::uuid AND store_id=p_store_id
        AND session_id=v_ref->>'cart_token' AND status='active' AND deleted_at IS NULL
        AND fact_acceptance_version=1 AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE;
      IF NOT FOUND OR jsonb_array_length(v_cart.items)<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
      IF (SELECT count(*) FROM jsonb_array_elements(v_cart.items) line WHERE line->>'id'=v_ref->>'line_id')<>1 THEN
        RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
      SELECT line INTO v_cart_line FROM jsonb_array_elements(v_cart.items) line WHERE line->>'id'=v_ref->>'line_id';
      IF v_cart_line->>'product_id' IS DISTINCT FROM v_product_id::text
        OR nullif(v_cart_line->>'variant_id','') IS DISTINCT FROM v_variant_id::text
        OR nullif(v_cart_line->>'marketplace_listing_id','') IS DISTINCT FROM nullif(v_item->>'marketplace_listing_id','')
        OR (v_cart_line->>'quantity')::integer IS DISTINCT FROM v_quantity
        OR v_cart_line->'product_version' IS DISTINCT FROM to_jsonb(v_product.version)
        OR v_ref->'product_version' IS DISTINCT FROM v_cart_line->'product_version'
        OR v_ref->'configuration_fingerprint' IS DISTINCT FROM v_cart_line->'configuration_fingerprint'
        OR v_ref->'snapshot_fingerprint' IS DISTINCT FROM v_cart_line->'snapshot_fingerprint'
        OR coalesce(v_cart_line->>'snapshot_fingerprint','') !~ '^[0-9a-f]{64}$'
        OR v_cart_line->'catalog_source'->'product_facts' IS DISTINCT FROM v_product_facts
        OR v_cart_line->'catalog_source'->'variant_facts' IS DISTINCT FROM v_variant_facts
        OR v_cart_line->'catalog_source'->'selected_options' IS DISTINCT FROM v_selected_options
        OR v_cart_line->'catalog_source'->'images' IS DISTINCT FROM coalesce(to_jsonb(v_product.images),'[]'::jsonb)
        THEN RAISE EXCEPTION 'CART_FACTS_CHANGED'; END IF;
      v_niche := v_cart_line->'niche_snapshot';
      IF jsonb_typeof(v_niche) IS DISTINCT FROM 'object' OR v_niche->'version' IS DISTINCT FROM '1'::jsonb
        OR jsonb_typeof(v_niche->'facts') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
      SELECT coalesce(jsonb_object_agg(o->>'name',o->'value'),'{}'::jsonb) INTO v_saved_options
        FROM jsonb_array_elements(coalesce(v_niche->'selected_options','[]'::jsonb)) o;
      IF v_saved_options IS DISTINCT FROM v_selected_options THEN RAISE EXCEPTION 'CART_FACTS_CHANGED'; END IF;
    ELSIF v_product_facts<>'{}'::jsonb OR v_variant_facts<>'{}'::jsonb OR v_selected_options<>'{}'::jsonb THEN
      -- Existing non-niche direct order clients remain compatible. Factful/configured
      -- items must go through the same server cart, never a second snapshot writer.
      RAISE EXCEPTION 'CART_FACT_REFERENCE_REQUIRED';
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
      'total', v_line_total,
      'images', coalesce(to_jsonb(v_product.images),'[]'::jsonb)
    ) || CASE WHEN v_niche IS NOT NULL THEN jsonb_build_object('niche',v_niche,'cart_id',v_cart.id,'cart_line_id',v_cart_line->>'id',
        'product_version',v_cart_line->'product_version','configuration_fingerprint',v_cart_line->'configuration_fingerprint',
        'snapshot_fingerprint',v_cart_line->'snapshot_fingerprint') ELSE '{}'::jsonb END);
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

  IF v_ref IS NOT NULL THEN
    UPDATE public.carts SET status='converted',checkout_handoff=coalesce(checkout_handoff,'{}'::jsonb)||jsonb_build_object('order_id',v_order_id),updated_at=now()
      WHERE id=v_cart.id AND store_id=p_store_id AND status='active';
    IF NOT FOUND THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
  END IF;
  RETURN v_order_json;
END;
$$;
