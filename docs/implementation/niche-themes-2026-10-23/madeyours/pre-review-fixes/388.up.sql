--388 Canonical persisted-cart fulfillment snapshots. Existing money/reservation/receipt semantics remain in the same writer.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
 ELSE
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=pg_catalog.to_regprocedure('letbuyy_maintenance.lock_catalogs_v1()')
 AND n.nspname='letbuyy_maintenance' AND n.nspowner='supabase_admin'::regrole
 AND p.proowner='supabase_admin'::regrole AND p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='pg_catalog.void'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.proargnames IS NULL AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.prosupport=0 AND p.provolatile='v' AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
 AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc'
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a
  WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR (a.grantee<>p.proowner AND a.is_grantable))
 AND pg_catalog.has_function_privilege('postgres',p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner)))a
  WHERE a.grantor<>n.nspowner OR a.grantee NOT IN(n.nspowner,'postgres'::regrole)
   OR(a.grantee<>n.nspowner AND (a.is_grantable OR a.privilege_type<>'USAGE')))
 AND pg_catalog.has_schema_privilege('postgres',n.oid,'USAGE')
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=n.oid AND x.proname=p.proname)=1) THEN
   RAISE EXCEPTION 'LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED' USING ERRCODE='42501';END IF;
  PERFORM letbuyy_maintenance.lock_catalogs_v1();
  -- Prove actual backend-held relation locks, including cluster-shared catalogs.
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
LOCK TABLE public.carts,public.products,public.product_variants,public.product_options IN ACCESS EXCLUSIVE MODE;
DO $snapshot_predecessors$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)'::regprocedure
   AND pg_catalog.md5(p.prosrc)='a800e8bde1bd2f148cefa2109157b9d2' AND p.prosecdef AND p.pronargs=11
   AND p.proconfig=ARRAY['search_path=public']::text[] AND p.prorettype='jsonb'::regtype
   AND p.proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.orders'::regclass))
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure
   AND pg_catalog.md5(p.prosrc)='5e7247c39839bdaa723c795bf98ed859' AND p.prosecdef AND p.pronargs=6
   AND p.proconfig=ARRAY['search_path=pg_catalog, public, pg_temp']::text[] AND p.prorettype='jsonb'::regtype
   AND p.proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.products'::regclass)) THEN
   RAISE EXCEPTION '388 refuses changed predecessor/rollback writer contract'; END IF;
END $snapshot_predecessors$;
ALTER TABLE public.carts ADD COLUMN fact_acceptance_version smallint NOT NULL DEFAULT 0 CHECK(fact_acceptance_version IN(0,1));
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
    IF v_has_variants AND v_variant_id IS NULL THEN RAISE EXCEPTION 'CART_VARIANT_REQUIRED'; END IF;
    SELECT coalesce(jsonb_object_agg(k,value),'{}'::jsonb) INTO v_product_facts
      FROM jsonb_each(coalesce(v_product.metadata,'{}'::jsonb)) AS facts(k,value) WHERE k=ANY(v_names);
    v_variant_facts := CASE WHEN v_variant_id IS NULL THEN '{}'::jsonb ELSE coalesce(v_variant.metadata,'{}'::jsonb) END;
    SELECT array_agg(name ORDER BY position,id) INTO v_option_names FROM public.product_options WHERE product_id=v_product_id;
    v_selected_options := CASE WHEN v_variant_id IS NULL THEN '{}'::jsonb ELSE
      jsonb_strip_nulls(jsonb_build_object(coalesce(v_option_names[1],'Option 1'),v_variant.option1,
        coalesce(v_option_names[2],'Option 2'),v_variant.option2,coalesce(v_option_names[3],'Option 3'),v_variant.option3)) END;
    v_ref := v_item->'cart_fact_ref';
    v_niche := NULL;
    IF v_ref IS NOT NULL THEN
      SELECT * INTO v_cart FROM public.carts WHERE id=(v_ref->>'cart_id')::uuid AND store_id=p_store_id
        AND session_id=v_ref->>'cart_token' AND status='active' AND deleted_at IS NULL
        AND fact_acceptance_version=1 AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
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
    ) || CASE WHEN v_niche IS NOT NULL THEN jsonb_build_object('niche',v_niche) ELSE '{}'::jsonb END);
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

CREATE OR REPLACE FUNCTION public.apply_product_edit_v1(
    p_store_id uuid, p_product_id uuid, p_actor_id uuid, p_expected_version integer,
    p_idempotency_key uuid, p_mutation jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE
    p public.products%ROWTYPE; before_product jsonb; receipt public.product_edit_receipts%ROWTYPE;
    fields jsonb; item jsonb; existing public.product_variants%ROWTYPE; v_variant_id uuid;
    retained uuid[] := ARRAY[]::uuid[]; removed uuid[]; option_names text[]; option_values text[];
    gift jsonb; roles jsonb; role_name text; old_index integer; new_index integer; source_url text; match_count integer;
    idx integer := 0; options jsonb; current_options jsonb; response jsonb; request_id text := nullif(current_setting('app.request_id', true), '');
BEGIN
    -- service_role inherits app_tenant's EXECUTE grant in164. An inherited grant
    -- must not turn the administrative REST role into this tenant transaction.
    IF current_setting('role', true) IS DISTINCT FROM 'app_tenant' THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_expected_version IS NULL OR p_expected_version <= 0 OR p_idempotency_key IS NULL
       OR p_product_id IS NULL OR jsonb_typeof(p_mutation) IS DISTINCT FROM 'object'
       OR octet_length(p_mutation::text) > 1048576
       OR jsonb_typeof(p_mutation->'fields') IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_mutation) k WHERE k NOT IN ('fields','stock','product_options','variants')) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
    END IF;
    fields := p_mutation->'fields';
    IF fields = '{}'::jsonb AND NOT (p_mutation ?| ARRAY['stock','product_options','variants']) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
    END IF;
    -- This allowlist is the DB immutability fence for the commerce-core plan. No identity,
    -- tenant, audit, version or raw variants cache column is writable from a mutation payload.
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(fields) k WHERE k NOT IN (
        'name','description','price','compare_price','cost_per_item','images','category','product_type','vendor',
        'track_inventory','sku','barcode','sell_when_oos','is_physical','weight','weight_unit','country_of_origin',
        'importer_details','hs_code','hsn_code','url_handle','seo_title','seo_description','charge_tax',
        'shipping_profile_id','is_active','is_featured','tags','metadata','display_order','status')) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
    END IF;
    PERFORM public.assert_product_edit_actor_v1(p_store_id, p_actor_id, 'products:write');
    PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:product-edit:' || p_idempotency_key::text, 0));
    -- Match the canonical inventory writer's level -> variant -> parent order.
    -- The decisive version comparison remains on the final locked parent row.
    PERFORM il.id FROM public.inventory_levels il WHERE il.product_id=p_product_id AND il.store_id=p_store_id ORDER BY il.id FOR UPDATE;
    PERFORM pv.id FROM public.product_variants pv JOIN public.products target_product ON target_product.id=pv.product_id
        WHERE pv.product_id=p_product_id AND target_product.store_id=p_store_id ORDER BY pv.id FOR UPDATE OF pv;
    PERFORM po.id FROM public.product_options po JOIN public.products target_product ON target_product.id=po.product_id
        WHERE po.product_id=p_product_id AND target_product.store_id=p_store_id ORDER BY po.id FOR UPDATE OF po;
    SELECT * INTO p FROM public.products WHERE id = p_product_id AND store_id = p_store_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_NOT_FOUND'; END IF;
    SELECT * INTO receipt FROM public.product_edit_receipts WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF receipt.operation <> 'product.update.v1' OR receipt.actor_id IS DISTINCT FROM p_actor_id
           OR receipt.store_id IS DISTINCT FROM p_store_id OR receipt.product_id IS DISTINCT FROM p_product_id
           OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.mutation IS DISTINCT FROM p_mutation THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_KEY_CONFLICT';
        END IF;
        RETURN receipt.response;
    END IF;
    IF p.version <= 0 OR p.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'PRODUCT_EDIT_VERSION_CONFLICT'; END IF;
    -- Receipt replay returned above. Compare capability meaning only while holding
    -- the SAME decisive product lock; an unrelated no-effect resave keeps revision.
    IF fields ? 'metadata' AND (fields->'metadata') ? 'personalization' THEN
      IF NOT public.storefront_discovery_facts_valid_v1(fields->'metadata'->'personalization','personalization',false)
        OR jsonb_typeof(fields->'metadata'->'personalization') IS DISTINCT FROM 'object'
        OR jsonb_typeof(fields->'metadata'->'personalization'->'revision') IS DISTINCT FROM 'number'
        OR (fields->'metadata'->'personalization'->>'revision') !~ '^[1-9][0-9]{0,9}$'
        OR (fields->'metadata'->'personalization'->>'revision')::numeric>2147483647 THEN
        RAISE EXCEPTION 'PRODUCT_PERSONALIZATION_INVALID'; END IF;
      IF public.storefront_discovery_facts_valid_v1(p.metadata->'personalization','personalization',false) THEN
        IF (fields->'metadata'->'personalization'->>'revision')::numeric < (p.metadata->'personalization'->>'revision')::numeric THEN
          RAISE EXCEPTION 'PRODUCT_PERSONALIZATION_REVISION_DECREASED'; END IF;
        IF (fields->'metadata'->'personalization'-'revision') IS DISTINCT FROM (p.metadata->'personalization'-'revision')
          AND (fields->'metadata'->'personalization'->>'revision')::numeric <= (p.metadata->'personalization'->>'revision')::numeric THEN
          RAISE EXCEPTION 'PRODUCT_PERSONALIZATION_REVISION_REQUIRED'; END IF;
      END IF;
    END IF;
    before_product := public.product_edit_snapshot_v1(p_product_id);
    IF (fields ? 'status' OR fields ? 'is_active') AND (
        jsonb_typeof(fields->'status') IS DISTINCT FROM 'string'
        OR fields->>'status' NOT IN ('active', 'draft', 'archived')
        OR fields->'is_active' IS DISTINCT FROM to_jsonb((fields->>'status') = 'active')
    ) THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;

    -- An image-only edit follows the previous URL identity while holding the
    -- product version lock. Retrying the original intent still matches its receipt.
    IF fields ? 'images' AND NOT (fields ? 'metadata') AND jsonb_typeof(p.metadata->'gifts') = 'object' THEN
        gift := p.metadata->'gifts'; roles := '{}'::jsonb;
        FOREACH role_name IN ARRAY ARRAY['openBox','closedBox'] LOOP
            IF jsonb_typeof(gift->'mediaRoles'->role_name) = 'number'
                AND (gift->'mediaRoles'->>role_name) ~ '^[0-9]+$' THEN
                old_index := (gift->'mediaRoles'->>role_name)::integer;
                IF old_index BETWEEN 0 AND 19 AND old_index < coalesce(array_length(p.images,1),0) THEN
                    source_url := p.images[old_index+1];
                    SELECT count(*), min(n-1)::integer INTO match_count,new_index
                        FROM jsonb_array_elements_text(fields->'images') WITH ORDINALITY AS images(url,n)
                        WHERE url=source_url AND nullif(btrim(url),'') IS NOT NULL;
                    IF match_count=1 AND new_index BETWEEN 0 AND 19 THEN roles := roles || jsonb_build_object(role_name,new_index); END IF;
                END IF;
            END IF;
        END LOOP;
        IF roles->'openBox' IS NOT NULL AND roles->'openBox'=roles->'closedBox' THEN roles := '{}'::jsonb; END IF;
        gift := gift-'mediaRoles';
        IF roles <> '{}'::jsonb THEN gift := gift || jsonb_build_object('mediaRoles',roles); END IF;
        IF roles='{}'::jsonb AND NOT (
            coalesce(jsonb_array_length(gift->'occasions'),0)>0 OR coalesce(jsonb_array_length(gift->'recipients'),0)>0
            OR nullif(btrim(gift->>'suitabilityNote'),'') IS NOT NULL OR coalesce(jsonb_array_length(gift->'contents'),0)>0
        ) THEN fields := fields || jsonb_build_object('metadata',p.metadata-'gifts');
        ELSE fields := fields || jsonb_build_object('metadata',jsonb_set(p.metadata,'{gifts}',gift)); END IF;
    END IF;

    -- Typed merge preserves omitted fields. Any later exception rolls this UPDATE back too.
    IF fields <> '{}'::jsonb THEN
        p := jsonb_populate_record(p, fields);
        IF length(btrim(p.name)) = 0 OR p.price < 0 OR
            ((fields ? 'price' OR fields ? 'compare_price') AND p.compare_price IS NOT NULL AND p.compare_price <= p.price) THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
        END IF;
        IF jsonb_typeof(p.metadata->'gifts'->'mediaRoles')='object' AND EXISTS (
            SELECT 1 FROM jsonb_each(p.metadata->'gifts'->'mediaRoles') r
            WHERE r.key NOT IN ('openBox','closedBox') OR jsonb_typeof(r.value)<>'number'
               OR r.value::text !~ '^[0-9]+$' OR length(r.value::text)>2
               OR (r.value::text)::integer >= coalesce(array_length(p.images,1),0)
        ) THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID_GIFT_MEDIA'; END IF;
        UPDATE public.products target SET
            name=p.name, description=p.description, price=p.price, compare_price=p.compare_price,
            cost_per_item=p.cost_per_item, images=p.images, category=p.category, product_type=p.product_type,
            vendor=p.vendor, track_inventory=p.track_inventory, sku=p.sku, barcode=p.barcode,
            sell_when_oos=p.sell_when_oos, is_physical=p.is_physical, weight=p.weight, weight_unit=p.weight_unit,
            country_of_origin=p.country_of_origin, importer_details=p.importer_details, hs_code=p.hs_code, hsn_code=p.hsn_code,
            url_handle=p.url_handle, seo_title=p.seo_title, seo_description=p.seo_description, charge_tax=p.charge_tax,
            shipping_profile_id=p.shipping_profile_id, is_active=p.is_active, is_featured=p.is_featured,
            tags=p.tags, metadata=p.metadata, display_order=p.display_order, status=p.status,
            updated_by=p_actor_id, updated_at=clock_timestamp()
        WHERE target.id=p_product_id AND target.store_id=p_store_id;
    END IF;

    IF jsonb_typeof(p.metadata->'gifts'->'mediaRoles')='object' AND EXISTS (
        SELECT 1 FROM jsonb_each(p.metadata->'gifts'->'mediaRoles') r
        WHERE r.key NOT IN ('openBox','closedBox') OR jsonb_typeof(r.value)<>'number'
           OR r.value::text !~ '^[0-9]+$' OR length(r.value::text)>2
           OR (r.value::text)::integer >= coalesce(array_length(p.images,1),0)
    ) THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID_GIFT_MEDIA'; END IF;

    IF p_mutation ? 'product_options' THEN
        options := p_mutation->'product_options';
        IF jsonb_typeof(options) IS DISTINCT FROM 'array' OR jsonb_array_length(options)>10
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(options) o WHERE jsonb_typeof(o) <> 'object'
                OR nullif(btrim(o->>'name'),'') IS NULL OR jsonb_typeof(o->'values') IS DISTINCT FROM 'array')
           OR (SELECT count(*) FROM jsonb_array_elements(options)) <>
              (SELECT count(DISTINCT lower(btrim(o->>'name'))) FROM jsonb_array_elements(options) o) THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
        END IF;
        SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'position',position,'values',values) ORDER BY position,id),'[]'::jsonb)
            INTO current_options FROM public.product_options WHERE product_id=p_product_id;
        SELECT coalesce(jsonb_agg(jsonb_build_object('name',o->>'name','position',n-1,'values',o->'values') ORDER BY n),'[]'::jsonb)
            INTO options FROM jsonb_array_elements(options) WITH ORDINALITY AS entries(o,n);
        -- A full form often resends unchanged options. Replacing them would transiently
        -- invalidate an approved listing's material fingerprint even for a stock-only edit.
        IF current_options IS DISTINCT FROM options THEN
            DELETE FROM public.product_options WHERE product_id=p_product_id;
            INSERT INTO public.product_options(product_id,name,position,values)
                SELECT p_product_id, o->>'name', (n-1)::integer, o->'values'
                FROM jsonb_array_elements(options) WITH ORDINALITY AS entries(o,n);
        END IF;
    END IF;
    SELECT array_agg(name ORDER BY position,id) INTO option_names FROM public.product_options WHERE product_id=p_product_id;

    IF jsonb_typeof(p.metadata->'beauty')='object' AND jsonb_array_length(coalesce(p.metadata->'beauty'->'shades','[]'::jsonb))>0
        AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.metadata->'beauty'->'shades') shade
            WHERE NOT EXISTS(SELECT 1 FROM public.product_options po WHERE po.product_id=p_product_id
                AND po.name=coalesce(p.metadata->'beauty'->>'shadeOptionName','Shade') AND po.values ? (shade->>'value'))) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID_BEAUTY_OPTION';
    END IF;

    IF p_mutation ? 'variants' THEN
        IF jsonb_typeof(p_mutation->'variants') IS DISTINCT FROM 'array' OR jsonb_array_length(p_mutation->'variants')>100 THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
        END IF;
        FOR item IN SELECT value FROM jsonb_array_elements(p_mutation->'variants') LOOP
            IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR nullif(btrim(item->>'title'),'') IS NULL
               OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','title','price','price_override','compare_price','sku','barcode','stock','options','metadata')) THEN
                RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
            END IF;
            IF item ? 'metadata' AND (
                jsonb_typeof(item->'metadata') IS DISTINCT FROM 'object'
                OR octet_length((item->'metadata')::text)>131072
                OR (item->'metadata')-ARRAY['toys','food','furniture','sports','books']::text[] <> '{}'::jsonb
                OR EXISTS(SELECT 1 FROM jsonb_each(item->'metadata') f WHERE jsonb_typeof(f.value) NOT IN ('object','null'))
            ) THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID_VARIANT_METADATA'; END IF;
            existing := NULL;
            IF item ? 'id' THEN
                v_variant_id := (item->>'id')::uuid;
                IF v_variant_id IS NULL OR v_variant_id = ANY(retained) THEN RAISE EXCEPTION 'PRODUCT_EDIT_VARIANT_ID'; END IF;
                SELECT * INTO existing FROM public.product_variants WHERE id=v_variant_id AND product_id=p_product_id FOR UPDATE;
                IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_VARIANT_ID'; END IF;
            ELSE
                v_variant_id := gen_random_uuid();
            END IF;
            retained := array_append(retained,v_variant_id);
            option_values := ARRAY[existing.option1,existing.option2,existing.option3];
            IF item ? 'options' THEN
                IF jsonb_typeof(item->'options') IS DISTINCT FROM 'object' OR
                    (SELECT count(*) FROM jsonb_object_keys(item->'options'))>3 THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;
                -- Canonical option positions, including explicit legacy unnamed slots. Do not
                -- depend on JSON key iteration order or truncate additional option dimensions.
                IF option_names IS NULL THEN
                    SELECT array_agg(key ORDER BY key) INTO option_names FROM jsonb_each(item->'options');
                END IF;
                IF EXISTS (SELECT 1 FROM jsonb_object_keys(item->'options') k WHERE NOT k=ANY(coalesce(option_names,ARRAY[]::text[])))
                    OR coalesce(array_length(option_names,1),0)>3 THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;
                option_values := ARRAY[item->'options'->>option_names[1],item->'options'->>option_names[2],item->'options'->>option_names[3]];
            END IF;
            IF existing.id IS NULL THEN
                INSERT INTO public.product_variants(id,product_id,title,price,compare_price,sku,barcode,inventory_qty,option1,option2,option3,position,metadata)
                    VALUES(v_variant_id,p_product_id,item->>'title',coalesce((item->>'price')::numeric,(item->>'price_override')::numeric,p.price),
                        (item->>'compare_price')::numeric,item->>'sku',item->>'barcode',0,option_values[1],option_values[2],option_values[3],idx,coalesce(item->'metadata','{}'::jsonb));
            ELSE
                UPDATE public.product_variants SET title=item->>'title',
                    price=CASE WHEN item ? 'price' OR item ? 'price_override' THEN coalesce((item->>'price')::numeric,(item->>'price_override')::numeric,p.price) ELSE existing.price END,
                    compare_price=CASE WHEN item ? 'compare_price' THEN (item->>'compare_price')::numeric ELSE existing.compare_price END,
                    sku=CASE WHEN item ? 'sku' THEN item->>'sku' ELSE existing.sku END,
                    barcode=CASE WHEN item ? 'barcode' THEN item->>'barcode' ELSE existing.barcode END,
                    metadata=CASE WHEN item ? 'metadata' THEN item->'metadata' ELSE existing.metadata END,
                    option1=option_values[1], option2=option_values[2], option3=option_values[3], position=idx, updated_at=clock_timestamp()
                    WHERE id=v_variant_id AND product_id=p_product_id;
            END IF;
            IF item ? 'stock' OR existing.id IS NULL THEN
                IF item ? 'stock' AND (jsonb_typeof(item->'stock') <> 'number' OR (item->>'stock') !~ '^[0-9]+$') THEN
                    RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
                END IF;
                PERFORM public.set_inventory_level_available(p_product_id,v_variant_id,NULL,coalesce((item->>'stock')::integer,0),
                    p_actor_id,'adjustment','product.update',p_idempotency_key::text||':'||v_variant_id::text);
            END IF;
            idx := idx+1;
        END LOOP;
        SELECT array_agg(id) INTO removed FROM public.product_variants WHERE product_id=p_product_id AND NOT id=ANY(retained);
        -- Stable stock/history/reservation references cannot be destroyed by an omitted ID.
        IF EXISTS (SELECT 1 FROM public.inventory_levels WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.product_price_observations WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_reservations WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_adjustments WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_events WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.fulfillment_order_lines WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_transfer_lines WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_transfer_receipts WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.purchase_order_lines WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.purchase_order_receipts WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.restock_events WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.return_lines WHERE variant_id=ANY(removed)) THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_VARIANT_REMOVAL';
        END IF;
        DELETE FROM public.product_variants WHERE product_id=p_product_id AND id=ANY(removed);
    END IF;
    IF p_mutation ? 'stock' THEN
        IF jsonb_typeof(p_mutation->'stock') <> 'number' OR (p_mutation->>'stock') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;
        PERFORM public.set_inventory_level_available(p_product_id,NULL,NULL,(p_mutation->>'stock')::integer,
            p_actor_id,'adjustment','product.update',p_idempotency_key::text||':default');
    END IF;
    -- Existing trigger semantics may advance the version several times inside this atomic
    -- transaction. Return the exact final token; a client must never calculate its next version.
    UPDATE public.products SET variants=public.product_edit_snapshot_v1(p_product_id)->'variants',
        updated_by=p_actor_id,updated_at=clock_timestamp() WHERE id=p_product_id AND store_id=p_store_id;
    response := public.product_edit_snapshot_v1(p_product_id);
    INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
        VALUES(p_store_id,p_store_id,'product',p_product_id::text,'product.updated',
            jsonb_build_object('site_id',p_store_id,'product_id',p_product_id,'handle',coalesce(response->>'url_handle',response->>'slug'),
                'status',coalesce(response->>'status','draft')),
            'product.updated:'||p_idempotency_key::text,request_id,p_actor_id,1);
    INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
        VALUES(p_store_id,p_actor_id,'user','product.updated','product',p_product_id::text,request_id,before_product,response,
            jsonb_build_object('idempotency_key',p_idempotency_key,'expected_version',p_expected_version,'version',response->'version'));
    INSERT INTO public.product_edit_receipts(idempotency_key,operation,store_id,product_id,actor_id,expected_version,mutation,response)
        VALUES(p_idempotency_key,'product.update.v1',p_store_id,p_product_id,p_actor_id,p_expected_version,p_mutation,response);
    RETURN response;
END $fn$;

DO $close_cart_authority$
DECLARE obj record; a record; role_name text; target text; privilege_name text;
BEGIN
 FOR obj IN SELECT p.oid,p.proowner,'FUNCTION '||p.oid::regprocedure::text AS target,
   p.oid::regprocedure::text AS signature,coalesce(p.proacl,acldefault('f',p.proowner)) acl,
   p.proname<>'create_order_with_inventory_reservations' AS backend
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN
   ('create_order_with_inventory_reservations','create_checkout_order','create_checkout_order_for_buyer',
    'create_marketplace_checkout_order','create_marketplace_checkout_order_with_delivery_rate','create_storefront_checkout_order_with_delivery_rate')
 LOOP
   IF obj.backend AND NOT EXISTS(SELECT 1 FROM aclexplode(obj.acl) a WHERE a.grantee='service_role'::regrole AND a.privilege_type='EXECUTE') THEN
     INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner)
       VALUES('388',obj.signature,'service_role','EXECUTE','granted',obj.oid,obj.proowner);
     EXECUTE format('GRANT EXECUTE ON %s TO service_role',obj.target);
   END IF;
   FOR a IN SELECT * FROM aclexplode(obj.acl) WHERE grantee IN (0,'anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole)
     OR (NOT obj.backend AND grantee='service_role'::regrole) LOOP
     role_name:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE (SELECT rolname FROM pg_roles WHERE oid=a.grantee) END;
     INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner)
       VALUES('388',obj.signature,role_name,a.privilege_type||CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END,'revoked',obj.oid,obj.proowner);
     EXECUTE format('REVOKE ALL ON %s FROM %s',obj.target,CASE WHEN role_name='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(role_name) END);
   END LOOP;
   IF has_function_privilege('anon',obj.oid,'EXECUTE') OR has_function_privilege('authenticated',obj.oid,'EXECUTE') OR has_function_privilege('app_tenant',obj.oid,'EXECUTE') OR (NOT obj.backend AND has_function_privilege('service_role',obj.oid,'EXECUTE')) THEN RAISE EXCEPTION '388 refuses inherited direct order authority'; END IF;
 END LOOP;
 FOR obj IN
   SELECT c.oid,c.relowner owner,'TABLE public.carts' target,'public.carts' signature,
     coalesce(c.relacl,acldefault('r',c.relowner)) acl FROM pg_class c WHERE c.oid='public.carts'::regclass
   UNION ALL SELECT c.oid,c.relowner,'TABLE public.carts', 'public.carts.'||a.attname,a.attacl
     FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE a.attrelid='public.carts'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
 LOOP
   FOR a IN SELECT * FROM aclexplode(obj.acl) WHERE grantee IN (0,'anon'::regrole,'authenticated'::regrole,'app_tenant'::regrole)
     AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE') LOOP
     role_name:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE (SELECT rolname FROM pg_roles WHERE oid=a.grantee) END;
     privilege_name:=a.privilege_type;
     IF obj.signature<>'public.carts' THEN privilege_name:=privilege_name||' ('||quote_ident(substr(obj.signature,length('public.carts.')+1))||')'; END IF;
     INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner)
       VALUES('388',obj.signature,role_name,privilege_name||CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END,'revoked',obj.oid,obj.owner);
     EXECUTE format('REVOKE %s ON %s FROM %s',privilege_name,obj.target,CASE WHEN role_name='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(role_name) END);
   END LOOP;
 END LOOP;
 -- service_role must retain its own write grants, never just inherited app_tenant grants.
 FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
     WHERE c.oid='public.carts'::regclass AND a.grantee='service_role'::regrole AND a.privilege_type=privilege_name) THEN
     INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner)
       SELECT '388','public.carts','service_role',privilege_name,'granted',oid,relowner FROM pg_class WHERE oid='public.carts'::regclass;
     EXECUTE format('GRANT %s ON TABLE public.carts TO service_role',privilege_name);
   END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.carts','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege('anon','public.carts','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege('app_tenant','public.carts','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_any_column_privilege('authenticated','public.carts','INSERT,UPDATE')
   OR has_any_column_privilege('anon','public.carts','INSERT,UPDATE')
   OR has_any_column_privilege('app_tenant','public.carts','INSERT,UPDATE') THEN
   RAISE EXCEPTION '388 refuses inherited untrusted cart write authority'; END IF;
UPDATE public.migration_privilege_journal j SET object_definition_hash=encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE j.migration='388' AND j.object_oid=p.oid AND j.object_signature NOT LIKE 'public.carts%';
END $close_cart_authority$;

COMMIT;
