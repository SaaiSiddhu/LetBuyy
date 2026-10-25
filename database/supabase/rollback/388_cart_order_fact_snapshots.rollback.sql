--388 DOWN: preserve all historical order snapshots/images. Refuse active capability loss.
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
DO $cart_rollback_typed_abi$
DECLARE expected record; live pg_catalog.pg_proc%ROWTYPE;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_actor_id','p_request_id']::text[]),
 ('public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)',ARRAY['p_store_id','p_product_id','p_actor_id','p_expected_version','p_idempotency_key','p_mutation']::text[]),
 ('public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_gift_card_code','p_shipping_method','p_idempotency_key','p_actor_id','p_request_id','p_shipping_rate_id','p_tax_amount','p_place_of_supply_state','p_tax_lines','p_buyer_account_id','p_buyer_session_epoch']::text[]),
 ('public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,bigint)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_gift_card_code','p_shipping_method','p_idempotency_key','p_actor_id','p_request_id','p_shipping_rate_id','p_tax_amount','p_place_of_supply_state','p_tax_lines','p_buyer_account_id','p_loyalty_points']::text[])
 ) AS bounded(signature,input_names) LOOP
  SELECT * INTO live FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
  IF live.oid IS NULL OR live.prokind<>'f' OR NOT live.prosecdef OR live.proretset
   OR live.prorettype<>'jsonb'::regtype OR live.provariadic<>0
   OR live.proargnames IS DISTINCT FROM expected.input_names
   OR live.proargmodes IS NOT NULL OR live.proallargtypes IS NOT NULL
   OR (SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=live.pronamespace AND other.proname=live.proname)<>1
   OR pg_catalog.has_function_privilege('anon',live.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('authenticated',live.oid,'EXECUTE') THEN
   RAISE EXCEPTION '388 rollback refuses changed typed ABI or API role authority';
  END IF;
 END LOOP;
END $cart_rollback_typed_abi$;

DO $snapshot_rollback_contract$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)'::regprocedure
   AND pg_catalog.md5(p.prosrc)='fff80af060ac84b405796811f0e63fd3' AND p.prosecdef AND p.pronargs=11
   AND p.proconfig=ARRAY['search_path=public']::text[] AND p.prorettype='jsonb'::regtype
   AND p.proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.orders'::regclass))
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)'::regprocedure
   AND pg_catalog.md5(p.prosrc)='6abf85c4c775fb493076a36481b8864e' AND p.prosecdef AND p.pronargs=6
   AND p.proconfig=ARRAY['search_path=pg_catalog, public, pg_temp']::text[] AND p.prorettype='jsonb'::regtype
   AND p.proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.products'::regclass))
 OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer)'::regprocedure AND md5(p.prosrc)='cf2045226f9e4e8137e79c43f779d440' AND p.prosecdef AND p.proowner=(SELECT relowner FROM pg_class WHERE oid='public.orders'::regclass) AND p.proconfig=ARRAY['search_path=pg_catalog, public']::text[])
 OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,bigint)'::regprocedure AND md5(p.prosrc)='e767fab28186e86e523f92a8a9b59898' AND p.prosecdef AND p.proowner=(SELECT relowner FROM pg_class WHERE oid='public.orders'::regclass) AND p.proconfig=ARRAY['search_path=public']::text[]) THEN
   RAISE EXCEPTION '388 refuses changed predecessor/rollback writer contract'; END IF;
END $snapshot_rollback_contract$;
DO $snapshot_rollback_safe$
BEGIN
 IF EXISTS(SELECT 1 FROM public.products WHERE deleted_at IS NULL AND is_active AND metadata ?| ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books'])
 OR EXISTS(SELECT 1 FROM public.products p JOIN public.product_variants v ON v.product_id=p.id
   WHERE p.deleted_at IS NULL AND p.is_active AND (v.metadata<>'{}'::jsonb OR v.option1 IS NOT NULL OR v.option2 IS NOT NULL OR v.option3 IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.products p JOIN public.product_options o ON o.product_id=p.id WHERE p.deleted_at IS NULL AND p.is_active)
 OR EXISTS(SELECT 1 FROM public.carts WHERE deleted_at IS NULL AND status='active' AND fact_acceptance_version=1 AND jsonb_array_length(items)>0) THEN
 RAISE EXCEPTION '388 rollback requires archiving factful products and closing accepted active carts first; historical snapshots are retained'; END IF;
END $snapshot_rollback_safe$;
DO $restore_cart_authority$
DECLARE journal_entry record; target text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal j LEFT JOIN pg_proc p ON p.oid=j.object_oid WHERE j.migration='388' AND j.object_signature NOT LIKE 'public.carts%' AND (p.oid IS NULL OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'))) THEN RAISE EXCEPTION '388 rollback function identity changed'; END IF;
 FOR journal_entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='388' ORDER BY action,object_signature,grantee,privilege LOOP
   IF journal_entry.object_signature LIKE 'public.carts%' THEN
     IF journal_entry.object_oid IS DISTINCT FROM 'public.carts'::regclass::oid OR journal_entry.object_owner IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.carts'::regclass) THEN RAISE EXCEPTION '388 rollback object changed'; END IF;
     target:='TABLE public.carts';
   ELSE
     IF journal_entry.object_oid IS DISTINCT FROM to_regprocedure(journal_entry.object_signature)::oid OR journal_entry.object_owner IS DISTINCT FROM (SELECT proowner FROM pg_proc WHERE oid=journal_entry.object_oid) THEN RAISE EXCEPTION '388 rollback object changed'; END IF;
     target:='FUNCTION '||journal_entry.object_signature;
   END IF;
   IF journal_entry.action='granted' THEN EXECUTE format('REVOKE %s ON %s FROM %I',journal_entry.privilege,target,journal_entry.grantee);
   ELSE EXECUTE format('GRANT %s ON %s TO %s%s',replace(journal_entry.privilege,' WITH GRANT OPTION',''),target,
      CASE WHEN journal_entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(journal_entry.grantee) END,
      CASE WHEN journal_entry.privilege LIKE '% WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END); END IF;
 END LOOP;
 DELETE FROM public.migration_privilege_journal WHERE migration='388';
END $restore_cart_authority$;


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

CREATE OR REPLACE FUNCTION public.create_marketplace_checkout_order(
  p_store_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_gift_card_code text DEFAULT NULL,
  p_shipping_method text DEFAULT 'standard',
  p_idempotency_key text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_shipping_rate_id uuid DEFAULT NULL,
  p_tax_amount numeric DEFAULT NULL,
  p_place_of_supply_state text DEFAULT NULL,
  p_tax_lines jsonb DEFAULT NULL,
  p_buyer_account_id uuid DEFAULT NULL,
  p_buyer_session_epoch integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_line record;
  v_listing record;
  v_fingerprint text;
  v_items jsonb := '[]'::jsonb;
  v_order jsonb;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_purchase_channel text;
  v_expected_count integer := 0;
  v_bound_count integer := 0;
  v_duplicate_count integer := 0;
BEGIN
  IF p_store_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'marketplace checkout identity and items are required' USING ERRCODE = '22023';
  END IF;
  IF p_buyer_account_id IS NULL AND p_buyer_session_epoch IS NOT NULL
     OR p_buyer_account_id IS NOT NULL AND p_buyer_session_epoch IS NULL THEN
    RAISE EXCEPTION 'marketplace buyer session binding is incomplete' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_duplicate_count
    FROM (
      SELECT value ->> 'product_id' AS product_id,
             COALESCE(value ->> 'variant_id', '') AS variant_id
        FROM jsonb_array_elements(p_items)
       GROUP BY value ->> 'product_id', COALESCE(value ->> 'variant_id', '')
      HAVING count(*) > 1
    ) duplicates;
  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'marketplace checkout has duplicate product variants' USING ERRCODE = '22023';
  END IF;

  -- Use the canonical order lock before taking listing locks, matching the storefront writer's
  -- lock order and making origin/listing binding safe under concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 0));
  SELECT order_id INTO v_existing_order_id
    FROM public.checkout_sessions
   WHERE site_id = p_store_id AND idempotency_key = p_idempotency_key AND deleted_at IS NULL
   LIMIT 1;

  FOR v_line IN
    SELECT value, ordinality FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinality)
  LOOP
    v_expected_count := v_expected_count + 1;
    IF jsonb_typeof(v_line.value) IS DISTINCT FROM 'object'
       OR NULLIF(v_line.value ->> 'marketplace_listing_id', '') IS NULL
       OR NULLIF(v_line.value ->> 'product_id', '') IS NULL
       OR COALESCE((v_line.value ->> 'quantity')::integer, 0) < 1 THEN
      RAISE EXCEPTION 'marketplace checkout item is missing listing identity' USING ERRCODE = '22023';
    END IF;

    -- Match product edits' product -> listing lock order. Migration 275 invalidates approval from
    -- an AFTER-product trigger; taking the listing lock first here could deadlock with that writer.
    SELECT p.id, p.site_id, p.is_active, p.deleted_at, s.status AS site_status,
           s.deleted_at AS site_deleted_at
      INTO v_listing
      FROM public.products p
      JOIN public.sites s ON s.id = p.site_id
     WHERE p.id = (v_line.value ->> 'product_id')::uuid
       AND p.store_id = p_store_id
     FOR SHARE OF p, s;

    IF NOT FOUND OR v_listing.site_id <> p_store_id OR v_listing.is_active IS DISTINCT FROM true
       OR v_listing.deleted_at IS NOT NULL OR v_listing.site_status <> 'published'
       OR v_listing.site_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'marketplace listing is unavailable for checkout' USING ERRCODE = '23514';
    END IF;

    SELECT cl.id, cl.site_id, cl.product_id, cl.channel, cl.status, cl.visibility,
           cl.approved_product_fingerprint
      INTO v_listing
      FROM public.channel_listings cl
     WHERE cl.id = (v_line.value ->> 'marketplace_listing_id')::uuid
     FOR SHARE;

    IF NOT FOUND OR v_listing.site_id <> p_store_id OR v_listing.product_id <> (v_line.value ->> 'product_id')::uuid
       OR v_listing.channel <> 'marketplace' OR v_listing.status <> 'approved' OR v_listing.visibility <> 'public'
       OR v_listing.approved_product_fingerprint IS NULL THEN
      RAISE EXCEPTION 'marketplace listing is unavailable for checkout' USING ERRCODE = '23514';
    END IF;

    v_fingerprint := public.marketplace_listing_review_fingerprint(v_listing.id);
    IF v_fingerprint IS NULL OR v_fingerprint IS DISTINCT FROM v_listing.approved_product_fingerprint THEN
      RAISE EXCEPTION 'marketplace listing revision is no longer approved' USING ERRCODE = '23514';
    END IF;

    v_items := v_items || jsonb_build_array(
      jsonb_set(v_line.value, '{marketplace_approved_fingerprint}', to_jsonb(v_fingerprint), true)
    );
  END LOOP;

  IF p_buyer_account_id IS NOT NULL THEN
    v_order := public.create_checkout_order_for_buyer(
      p_buyer_account_id, p_buyer_session_epoch, p_store_id, p_customer_name, p_customer_email,
      p_customer_phone, p_shipping_address, v_items, p_payment_method, p_notes, p_coupon_code,
      p_gift_card_code, p_shipping_method, p_idempotency_key, p_actor_id, p_request_id,
      p_shipping_rate_id, p_tax_amount, p_place_of_supply_state, p_tax_lines, NULL
    );
  ELSE
    v_order := public.create_checkout_order(
      p_store_id, p_customer_name, p_customer_email, p_customer_phone, p_shipping_address,
      v_items, p_payment_method, p_notes, p_coupon_code, p_gift_card_code, p_shipping_method,
      p_idempotency_key, p_actor_id, p_request_id, p_shipping_rate_id, p_tax_amount,
      p_place_of_supply_state, p_tax_lines, NULL, NULL
    );
  END IF;

  v_order_id := NULLIF(v_order ->> 'id', '')::uuid;
  IF v_order_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = v_order_id AND store_id = p_store_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'canonical marketplace checkout returned an invalid order' USING ERRCODE = '23514';
  END IF;

  IF v_existing_order_id IS NOT NULL AND v_existing_order_id <> v_order_id THEN
    RAISE EXCEPTION 'marketplace checkout idempotency binding changed' USING ERRCODE = '23505';
  END IF;

  IF v_existing_order_id IS NOT NULL THEN
    SELECT p.channel INTO v_purchase_channel
      FROM public.orders o JOIN public.purchases p ON p.id = o.purchase_id
     WHERE o.id = v_order_id AND o.store_id = p_store_id;
    IF v_purchase_channel IS DISTINCT FROM 'marketplace' THEN
      RAISE EXCEPTION 'checkout idempotency key is already bound to another sales origin' USING ERRCODE = '23505';
    END IF;
    SELECT count(*) INTO v_bound_count
      FROM public.order_items oi
      JOIN jsonb_to_recordset(v_items) AS item(product_id uuid, variant_id text, quantity integer, marketplace_listing_id uuid, marketplace_approved_fingerprint text)
        ON oi.product_id = item.product_id
       AND oi.variant_id IS NOT DISTINCT FROM item.variant_id
       AND oi.quantity = item.quantity
       AND oi.marketplace_listing_id = item.marketplace_listing_id
       AND oi.marketplace_approved_fingerprint = item.marketplace_approved_fingerprint
     WHERE oi.order_id = v_order_id;
    IF v_bound_count <> v_expected_count THEN
      RAISE EXCEPTION 'marketplace checkout retry item binding conflicts' USING ERRCODE = '23505';
    END IF;
  ELSE
    UPDATE public.purchases SET channel = 'marketplace'
     WHERE id = (SELECT purchase_id FROM public.orders WHERE id = v_order_id)
       AND origin_site_id = p_store_id AND idempotency_key = p_idempotency_key AND channel = 'storefront';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'marketplace checkout purchase origin could not be bound' USING ERRCODE = '23514';
    END IF;

    PERFORM set_config('app.marketplace_order_creation', 'on', true);
    UPDATE public.order_items oi
       SET marketplace_listing_id = item.marketplace_listing_id,
           marketplace_approved_fingerprint = item.marketplace_approved_fingerprint
      FROM jsonb_to_recordset(v_items) AS item(product_id uuid, variant_id text, quantity integer, marketplace_listing_id uuid, marketplace_approved_fingerprint text)
     WHERE oi.order_id = v_order_id
       AND oi.product_id = item.product_id
       AND oi.variant_id IS NOT DISTINCT FROM item.variant_id
       AND oi.quantity = item.quantity;
    GET DIAGNOSTICS v_bound_count = ROW_COUNT;
    PERFORM set_config('app.marketplace_order_creation', '', true);
    IF v_bound_count <> v_expected_count THEN
      RAISE EXCEPTION 'marketplace checkout order lines could not be bound to approved listings' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN v_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_store_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text, p_shipping_address jsonb, p_items jsonb, p_payment_method text, p_notes text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_gift_card_code text DEFAULT NULL::text, p_shipping_method text DEFAULT 'standard'::text, p_idempotency_key text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_shipping_rate_id uuid DEFAULT NULL::uuid, p_tax_amount numeric DEFAULT NULL::numeric, p_place_of_supply_state text DEFAULT NULL::text, p_tax_lines jsonb DEFAULT NULL::jsonb, p_buyer_account_id uuid DEFAULT NULL::uuid, p_loyalty_points bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    -- F-LOY-1: loyalty applied as TENDER. Named for what it is; the amount is subtracted from what
    -- is PAYABLE, never from the taxable total.
    v_loyalty_amount NUMERIC(12,2) := 0;
    v_loyalty_points_applied BIGINT := 0;
    v_loyalty_residual_minor BIGINT := 0;
    v_loyalty_max_points BIGINT := 0;
    v_loyalty_program public.loyalty_programs%ROWTYPE;
    v_loyalty_result JSONB;
    v_existing_order_id UUID;
    v_order_json JSONB;
    v_order_id UUID;
    v_purchase_id UUID;
    v_order RECORD;
    v_shipping_method TEXT := COALESCE(NULLIF(BTRIM(p_shipping_method), ''), 'standard');
    v_shipping_amount NUMERIC(12,2) := 0;
    v_tax_amount NUMERIC(12,2) := 0;
    v_discount_amount NUMERIC(12,2) := 0;
    v_gift_card_amount NUMERIC(12,2) := 0;
    v_gift_card_balance NUMERIC(12,2) := 0;
    v_grand_total NUMERIC(12,2) := 0;
    v_payment_due NUMERIC(12,2) := 0;
    v_promotion JSONB := jsonb_build_object('valid', false, 'discount', 0);
    v_gift_card RECORD;
    v_payment_transaction_id UUID;
    v_rate_row RECORD;
    v_store_has_rates BOOLEAN := false;
    v_tax_line JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_payment_method NOT IN ('razorpay', 'cod') THEN
        RAISE EXCEPTION 'unsupported payment method: %', p_payment_method;
    END IF;

    -- CHK-0: restored from migration 206 (Phase R3). Serialize concurrent callers sharing the
    -- same (site_id, idempotency_key) BEFORE the existence check below and before every row lock
    -- this function transitively takes. Advisory-FIRST is what prevents a deadlock against
    -- reserve_inventory's FOR UPDATE on inventory_levels and this function's own gift-card
    -- FOR UPDATE on gift_card_accounts. Transaction-scoped: released at COMMIT or ROLLBACK.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 0));

    SELECT order_id
      INTO v_existing_order_id
      FROM checkout_sessions
     WHERE site_id = p_store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_order_id IS NOT NULL THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = v_existing_order_id
           AND o.deleted_at IS NULL;

        IF v_order_json IS NOT NULL THEN
            RETURN v_order_json;
        END IF;
    END IF;

    -- (a) Shipping resolution: server-side rate lookup when the store has configured rates.
    SELECT COUNT(*) > 0
      INTO v_store_has_rates
      FROM public.shipping_rates sr
      JOIN public.shipping_zones sz ON sz.id = sr.zone_id
     WHERE sz.site_id = p_store_id
       AND sr.is_active = true
       AND sr.deleted_at IS NULL;

    IF v_store_has_rates AND p_shipping_rate_id IS NOT NULL THEN
        -- Resolve the specific rate; validate it belongs to this store and is active.
        SELECT sr.type, sr.price,
               sr.min_order_amount, sr.max_order_amount,
               sr.min_weight_grams, sr.max_weight_grams
          INTO v_rate_row
          FROM public.shipping_rates sr
          JOIN public.shipping_zones sz ON sz.id = sr.zone_id
         WHERE sr.id = p_shipping_rate_id
           AND sz.site_id = p_store_id
           AND sr.is_active = true
           AND sr.deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'shipping rate not found or does not belong to this store: %', p_shipping_rate_id;
        END IF;

        IF v_rate_row.type = 'free' THEN
            v_shipping_amount := 0;
        ELSE
            -- flat / price_based / weight_based: use the configured price column.
            -- Price/weight range checks are advisory (display-only) in V1; cost comes from price column.
            v_shipping_amount := COALESCE(v_rate_row.price, 0);
        END IF;

    ELSIF v_store_has_rates AND p_shipping_rate_id IS NULL THEN
        -- Store has rates but caller did not pass an ID — use legacy fallback.
        IF v_shipping_method = 'express' THEN
            v_shipping_amount := 99;
        ELSE
            v_shipping_amount := 0;
        END IF;

    ELSE
        -- No configured rates: legacy hardcoded fallback (express=99, standard=0).
        IF v_shipping_method = 'express' THEN
            v_shipping_amount := 99;
        ELSIF v_shipping_method = 'standard' THEN
            v_shipping_amount := 0;
        ELSE
            RAISE EXCEPTION 'unsupported shipping method: %', v_shipping_method;
        END IF;
    END IF;

    -- (b) GST: when the gateway has computed tax server-side, accept it; otherwise 0.
    v_tax_amount := COALESCE(p_tax_amount, 0);

    v_order_json := create_order_with_inventory_reservations(
        p_store_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        COALESCE(p_shipping_address, '{}'::JSONB),
        p_items,
        p_payment_method,
        p_notes,
        NULL,
        p_actor_id,
        p_request_id
    );

    v_order_id := (v_order_json ->> 'id')::UUID;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'created order not found';
    END IF;

    -- CHK-1 (D-3): every checkout gets a parent purchase with exactly one child order, so a
    -- multi-merchant cart later is a constraint change, not a second checkout code path. The
    -- parent deliberately holds no money and no status -- the child order remains the single
    -- source of truth for both (D-PURCHASE-TENANCY, decisions.md 2b). Same transaction as the
    -- order, and downstream of the advisory lock above, so a replayed idempotency key returns
    -- early and can never create a second parent.
    INSERT INTO public.purchases (
        origin_site_id,
        channel,
        customer_email,
        customer_name,
        customer_phone,
        currency,
        idempotency_key
    )
    VALUES (
        p_store_id,
        'storefront',
        p_customer_email,
        p_customer_name,
        p_customer_phone,
        COALESCE(v_order.currency, 'INR'),
        p_idempotency_key
    )
    RETURNING id INTO v_purchase_id;

    UPDATE orders
       SET purchase_id = v_purchase_id
     WHERE id = v_order_id;

    IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        v_promotion := evaluate_checkout_promotion(
            p_store_id,
            p_coupon_code,
            COALESCE(v_order.subtotal, 0),
            v_shipping_amount,
            p_customer_email
        );
        v_discount_amount := COALESCE((v_promotion ->> 'discount')::NUMERIC, 0);
    END IF;

    -- T15/W2: GST is computed on v_grand_total BEFORE the gift card is even looked up below —
    -- a gift card is TENDER (a payment method), never a pre-tax discount. Confirmed correct as
    -- written: v_tax_amount (from p_tax_amount, computed server-side in the gateway before any
    -- gift-card consideration) is folded into v_grand_total here; the gift card only reduces
    -- v_payment_due afterward. No change needed for this ordering.
    v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);

    IF NULLIF(BTRIM(COALESCE(p_gift_card_code, '')), '') IS NOT NULL THEN
        SELECT *
          INTO v_gift_card
          FROM gift_card_accounts gca
         WHERE gca.site_id = p_store_id
           AND gca.code_hash = encode(extensions.digest(p_gift_card_code, 'sha256'), 'hex')
           AND gca.status = 'active'
           AND gca.deleted_at IS NULL
           AND (gca.expires_at IS NULL OR gca.expires_at >= NOW())
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'gift card is invalid or unavailable';
        END IF;

        SELECT COALESCE(
            SUM(
                CASE
                    WHEN entry_type IN ('issued', 'credit', 'refund_credit', 'release') THEN amount
                    WHEN entry_type IN ('debit', 'hold', 'expire', 'fraud_hold') THEN -amount
                    ELSE 0
                END
            ),
            COALESCE(v_gift_card.initial_value, v_gift_card.balance, 0)
        )
          INTO v_gift_card_balance
          FROM gift_card_ledger_entries
         WHERE gift_card_account_id = v_gift_card.id
           AND site_id = p_store_id
           AND deleted_at IS NULL;

        v_gift_card_amount := LEAST(COALESCE(v_gift_card_balance, 0), v_grand_total);

        IF v_gift_card_amount <= 0 THEN
            RAISE EXCEPTION 'gift card has no redeemable balance';
        END IF;

        INSERT INTO gift_card_redemptions (
            site_id,
            gift_card_account_id,
            order_id,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            v_gift_card_amount,
            'committed',
            'gift_card.redemption:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        INSERT INTO gift_card_ledger_entries (
            site_id,
            gift_card_account_id,
            order_id,
            entry_type,
            amount,
            balance_after,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            'debit',
            v_gift_card_amount,
            COALESCE(v_gift_card_balance, 0) - v_gift_card_amount,
            'gift_card.debit:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END IF;

    -- ── F-LOY-1: loyalty points as TENDER ────────────────────────────────────────────────────────
    -- Same rule as the gift card above (T15/W2): GST was computed on v_grand_total and is NOT
    -- touched here. Points reduce what is PAYABLE; they are not a pre-tax discount, so the invoice
    -- and the tax lines are identical whether or not points are used.
    --
    -- Applied AFTER the gift card, on what remains. A gift card is money the buyer already holds and
    -- carries no cap; loyalty is the merchant's marketing spend and does. Spending the buyer's own
    -- balance first means points are never burned on an amount a gift card would have covered.
    IF p_loyalty_points IS NOT NULL AND p_loyalty_points > 0 AND p_buyer_account_id IS NOT NULL THEN
        SELECT * INTO v_loyalty_program FROM public.loyalty_programs WHERE site_id = p_store_id;

        -- A store with no programme, or a paused one, simply applies no points. It is not an error:
        -- a buyer whose client offered points must not have their checkout fail because the merchant
        -- turned the programme off in between.
        IF FOUND AND v_loyalty_program.is_active THEN
            v_loyalty_residual_minor := GREATEST(ROUND((v_grand_total - v_gift_card_amount) * 100), 0)::BIGINT;

            -- REFUSE rather than silently apply fewer points. Probing showed the first version of
            -- this block clamped here while an over-request against the BALANCE raised inside
            -- redeem_loyalty_points — two different answers to the same situation, "the client asked
            -- for more than can be applied". Clamping is the worse of the two: the buyer is shown one
            -- figure by the client and charged another, because the points silently dropped out. One
            -- policy, and it is the explicit one — the caller re-reads the balance and the cap and
            -- offers again. Nothing is debited on this path, so there is no partial state to unwind.
            v_loyalty_max_points := FLOOR(v_loyalty_residual_minor / v_loyalty_program.point_value_minor)::BIGINT;
            IF p_loyalty_points > v_loyalty_max_points THEN
                RAISE EXCEPTION 'loyalty points exceed what this order can apply: % requested, % applicable',
                    p_loyalty_points, v_loyalty_max_points;
            END IF;
            v_loyalty_points_applied := p_loyalty_points;

            IF v_loyalty_points_applied > 0 THEN
                -- The residual is passed as the authoritative payable amount (233): this function
                -- knows it exactly, whereas orders.total is mid-mutation here — it still holds the
                -- pre-adjustment figure and is not rewritten until the UPDATE below.
                --
                -- The idempotency key is DERIVED from the checkout's, mirroring the gift card's
                -- 'gift_card.redemption:' convention, so a replayed checkout cannot debit twice. The
                -- checkout's own replay check returns long before this point; this is the backstop.
                v_loyalty_result := public.redeem_loyalty_points(
                    p_store_id,
                    p_buyer_account_id,
                    v_order_id,
                    v_loyalty_points_applied,
                    'loyalty.redemption:' || v_order_id::TEXT,
                    v_loyalty_residual_minor,
                    p_request_id,
                    p_actor_id
                );
                v_loyalty_amount := COALESCE((v_loyalty_result ->> 'value_minor')::BIGINT, 0)::NUMERIC / 100;
            END IF;
        END IF;
    END IF;

    v_payment_due := GREATEST(v_grand_total - v_gift_card_amount - v_loyalty_amount, 0);

    UPDATE orders
       SET shipping_cost = v_shipping_amount,
           shipping_method = v_shipping_method,
           tax = v_tax_amount,
           place_of_supply_state = COALESCE(p_place_of_supply_state, place_of_supply_state),
           discount = v_discount_amount,
           total = v_payment_due,
           coupon_code = NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), ''),
           coupon_discount = v_discount_amount,
           currency = COALESCE(currency, 'INR'),
           payment_status = CASE WHEN v_payment_due = 0 THEN 'paid' ELSE payment_status END,
           status = CASE WHEN v_payment_due = 0 THEN 'confirmed' ELSE status END,
           updated_at = NOW()
     WHERE id = v_order_id;

    IF p_tax_lines IS NOT NULL AND jsonb_typeof(p_tax_lines) = 'array' AND jsonb_array_length(p_tax_lines) > 0 THEN
        FOR v_tax_line IN SELECT * FROM jsonb_array_elements(p_tax_lines)
        LOOP
            INSERT INTO order_tax_lines (
                site_id,
                order_id,
                title,
                rate,
                amount,
                jurisdiction,
                metadata,
                created_by
            )
            VALUES (
                p_store_id,
                v_order_id,
                v_tax_line ->> 'title',
                COALESCE((v_tax_line ->> 'rate')::NUMERIC, 0),
                COALESCE((v_tax_line ->> 'amount')::NUMERIC, 0),
                COALESCE(v_tax_line -> 'jurisdiction', '{}'::JSONB),
                jsonb_build_object('source', 'create_checkout_order'),
                p_actor_id
            );
        END LOOP;
    END IF;

    INSERT INTO checkout_sessions (
        site_id,
        order_id,
        customer_email,
        status,
        idempotency_key,
        subtotal,
        shipping_total,
        tax_total,
        discount_total,
        gift_card_total,
        grand_total,
        currency,
        shipping_method,
        payment_method,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        p_customer_email,
        'completed',
        p_idempotency_key,
        COALESCE(v_order.subtotal, 0),
        v_shipping_amount,
        v_tax_amount,
        v_discount_amount,
        v_gift_card_amount,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        v_shipping_method,
        p_payment_method,
        p_request_id,
        jsonb_build_object('source', 'create_checkout_order', 'payment_due', v_payment_due, 'promotion', v_promotion),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO order_shipping_lines (
        site_id,
        order_id,
        title,
        method,
        amount,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        CASE WHEN v_shipping_method = 'express' THEN 'Express Shipping' ELSE 'Standard Shipping' END,
        v_shipping_method,
        v_shipping_amount,
        jsonb_build_object('computed_by', 'create_checkout_order', 'shipping_rate_id', p_shipping_rate_id),
        p_actor_id
    );

    IF v_discount_amount > 0 THEN
        INSERT INTO order_line_adjustments (
            site_id,
            order_id,
            adjustment_type,
            source_type,
            source_id,
            title,
            amount,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_order_id,
            'promotion',
            CASE WHEN (v_promotion ->> 'promotion_id') IS NOT NULL THEN 'promotion' ELSE 'coupon' END,
            COALESCE(NULLIF(v_promotion ->> 'promotion_id', '')::UUID, NULLIF(v_promotion ->> 'coupon_id', '')::UUID),
            COALESCE(v_promotion ->> 'title', 'Promotion'),
            v_discount_amount,
            v_promotion,
            p_actor_id
        );

        INSERT INTO promotion_redemptions (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            order_id,
            customer_email,
            code,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            v_order_id,
            p_customer_email,
            v_promotion ->> 'code',
            v_discount_amount,
            'committed',
            'promotion.redemption:' || v_order_id::TEXT || ':' || COALESCE(v_promotion ->> 'code', 'unknown'),
            p_request_id,
            v_promotion,
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        UPDATE promotion_codes
           SET usage_count = usage_count + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID;

        UPDATE coupons
           SET usage_count = COALESCE(usage_count, 0) + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'coupon_id', '')::UUID;

        INSERT INTO promotion_usage_counters (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            customer_email,
            usage_count
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            LOWER(p_customer_email),
            1
        )
        ON CONFLICT (site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
        DO UPDATE SET usage_count = promotion_usage_counters.usage_count + 1,
                      updated_at = NOW();
    END IF;

    INSERT INTO payment_transactions (
        order_id,
        store_id,
        site_id,
        gateway,
        amount,
        currency,
        status,
        payment_method,
        metadata,
        request_id,
        idempotency_key,
        created_by,
        captured_at
    )
    VALUES (
        v_order_id,
        p_store_id,
        p_store_id,
        p_payment_method,
        v_payment_due,
        COALESCE(v_order.currency, 'INR'),
        CASE WHEN v_payment_due = 0 THEN 'captured' ELSE 'pending' END,
        p_payment_method,
        jsonb_build_object('source', 'checkout', 'gift_card_total', v_gift_card_amount),
        p_request_id,
        p_idempotency_key || ':payment',
        p_actor_id,
        CASE WHEN v_payment_due = 0 THEN NOW() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_transaction_id;

    INSERT INTO inventory_events (
        site_id,
        inventory_level_id,
        location_id,
        product_id,
        variant_id,
        order_id,
        reservation_id,
        event_type,
        quantity_delta,
        on_hand_quantity,
        available_quantity,
        committed_quantity,
        unavailable_quantity,
        incoming_quantity,
        reserved_quantity,
        safety_stock_quantity,
        source_type,
        source_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        p_store_id,
        il.id,
        r.location_id,
        oi.product_id,
        NULLIF(oi.variant_id, '')::UUID,
        v_order_id,
        r.id,
        'sale_committed',
        -oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        oi.quantity,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        v_order_id,
        'checkout.sale_committed:' || v_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('checkout_session_idempotency_key', p_idempotency_key),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND (
            (r.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
            OR r.variant_id = NULLIF(oi.variant_id, '')::UUID
       )
       AND r.deleted_at IS NULL
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
            (il.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
            OR il.variant_id = NULLIF(oi.variant_id, '')::UUID
       )
     WHERE oi.order_id = v_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        p_store_id,
        p_store_id,
        'checkout',
        v_order_id::TEXT,
        'checkout.completed',
        jsonb_build_object(
            'site_id', p_store_id,
            'order_id', v_order_id,
            'payment_transaction_id', v_payment_transaction_id,
            'subtotal', COALESCE(v_order.subtotal, 0),
            'shipping_total', v_shipping_amount,
            'tax_total', v_tax_amount,
            'discount_total', v_discount_amount,
            'gift_card_total', v_gift_card_amount,
        'loyalty_total', v_loyalty_amount,
        'loyalty_points_applied', v_loyalty_points_applied,
            'grand_total', v_grand_total,
            'payment_due', v_payment_due,
            'schema_version', 1
        ),
        'checkout.completed:' || v_order_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$function$;ALTER TABLE public.carts DROP COLUMN fact_acceptance_version;
COMMIT;
