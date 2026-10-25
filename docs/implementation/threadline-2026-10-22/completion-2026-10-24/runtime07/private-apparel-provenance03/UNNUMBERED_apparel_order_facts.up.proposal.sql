-- PRIVATE UNNUMBERED APPAREL PROPOSAL; NOT APPLIED. No new table, grants, or row rewrites.
-- Baseline: full322/max393 + exact four admitted UPs in SQL_SOURCE_CONSERVATION.json.
-- Order body/profile expectations are pinned-source constraints, not a claimed current native dump.
BEGIN;
DO $apparel_provenance$
DECLARE p pg_catalog.pg_proc%ROWTYPE; old_body text; next_body text; definition text; before_profile jsonb; after_profile jsonb;
BEGIN
  -- edit_storefront_configured_cart_line: replace one product-level whitelist and preserve every other byte.
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.edit_storefront_configured_cart_line(uuid,uuid,text,timestamp with time zone,text,uuid,text,uuid,integer,jsonb)');
  IF NOT FOUND OR pg_catalog.md5(p.prosrc)<>'91e086f9e1cfad35335b949fe3c23a51' OR NOT p.prosecdef OR p.prokind<>'f'
    OR p.pronargs<>10 OR p.pronargdefaults<>1 OR p.proretset OR p.prorettype<>'jsonb'::regtype
    OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proleakproof OR p.prosupport<>0
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_catalog']::text[]
    OR p.proargnames IS DISTINCT FROM ARRAY['p_site_id','p_cart_id','p_cart_token','p_expected_updated_at','p_line_id','p_operation_key','p_request_hash','p_buyer_account_id','p_buyer_session_epoch','p_replacement']::text[] OR p.proargmodes IS NOT NULL
    OR p.provariadic<>0 THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: function definition or source profile'; END IF;
  IF p.proowner<>'postgres'::regrole OR p.proacl IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::aclitem[]
    OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.carts'::regclass)
    THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: saved native configured writer access'; END IF;
  before_profile:=(pg_catalog.to_jsonb(p)-'prosrc'-'proargdefaults') || pg_catalog.jsonb_build_object('argument_defaults',pg_catalog.pg_get_expr(p.proargdefaults,0));
  old_body:=$old_apparel_body$
DECLARE
  v_cart public.carts%ROWTYPE;
  v_checkout public.checkout_sessions%ROWTYPE;
  v_receipt public.idempotency_keys%ROWTYPE;
  v_buyer_status text; v_buyer_epoch integer; v_checkout_id uuid;
  v_scope text := 'cart.configured_line_edit:' || p_cart_id::text;
  v_response jsonb; v_target jsonb; v_items jsonb; v_quantity integer; v_recipient_quantity integer;
  v_product public.products%ROWTYPE; v_variant public.product_variants%ROWTYPE;
  v_product_facts jsonb; v_variant_facts jsonb; v_options jsonb; v_option_names text[];
  v_required record; v_available integer;
BEGIN
  IF p_site_id IS NULL OR p_cart_id IS NULL OR nullif(p_cart_token,'') IS NULL
     OR p_expected_updated_at IS NULL OR nullif(p_line_id,'') IS NULL
     OR p_operation_key IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_buyer_account_id IS NULL OR p_buyer_session_epoch IS NULL THEN
    RAISE EXCEPTION 'invalid configured cart edit' USING ERRCODE='22023';
  END IF;
  -- Same canonical cart lock namespace as hosted buyer binding; no new mutex service.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_cart_id::text,0));
  SELECT status,session_epoch INTO v_buyer_status,v_buyer_epoch FROM public.buyer_accounts
    WHERE id=p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer_status <> 'active' OR v_buyer_epoch <> p_buyer_session_epoch THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_OWNER_CONFLICT');
  END IF;
  SELECT * INTO v_checkout FROM public.checkout_sessions
    WHERE site_id=p_site_id AND cart_id=p_cart_id AND deleted_at IS NULL FOR UPDATE;
  IF FOUND AND (v_checkout.cart_token IS DISTINCT FROM p_cart_token
      OR (v_checkout.buyer_account_id IS NOT NULL AND v_checkout.buyer_account_id<>p_buyer_account_id)) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_OWNER_CONFLICT');
  END IF;
  SELECT * INTO v_cart FROM public.carts WHERE id=p_cart_id AND store_id=p_site_id
    AND session_id=p_cart_token AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_cart.sales_origin IS DISTINCT FROM 'storefront' THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_NOT_FOUND');
  END IF;
  SELECT * INTO v_receipt FROM public.idempotency_keys
    WHERE site_id=p_site_id AND scope=v_scope AND key=p_operation_key::text AND deleted_at IS NULL FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.request_hash IS DISTINCT FROM p_request_hash OR v_receipt.resource_id IS DISTINCT FROM p_cart_id
       OR v_receipt.response_body->>'buyer_account_id' IS DISTINCT FROM p_buyer_account_id::text THEN
      RETURN jsonb_build_object('outcome','refused','code','CART_EDIT_INTENT_CONFLICT');
    END IF;
    IF v_receipt.status='completed' THEN
      -- Receipt first: recover the committed intent even if catalog or cart moved afterwards.
      -- Return current canonical cart, never rewind it to the old receipt's contents.
      RETURN jsonb_build_object('outcome','committed','cart',to_jsonb(v_cart),'receipt',v_receipt.response_body);
    END IF;
    RETURN jsonb_build_object('outcome','refused','code','CART_EDIT_RECONCILIATION_REQUIRED');
  END IF;
  IF v_cart.status <> 'active' THEN RETURN jsonb_build_object('outcome','refused','code','CART_CLOSED'); END IF;
  IF v_cart.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_REVISION_CONFLICT');
  END IF;
  IF (SELECT count(*)<>count(DISTINCT x->>'id') FROM jsonb_array_elements(v_cart.items) x) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_EDIT_RECONCILIATION_REQUIRED');
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v_cart.items) x WHERE x->>'id'=p_line_id
      AND jsonb_typeof(x->'personalization')='object') <> 1 THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_LINE_MISSING');
  END IF;
  IF v_checkout.id IS NOT NULL AND (v_checkout.order_id IS NOT NULL
      OR coalesce(v_checkout.checkout_state,'') NOT IN ('contact','delivery')
      OR v_checkout.status IS DISTINCT FROM v_checkout.checkout_state
      OR v_checkout.confirmed_at IS NOT NULL OR v_checkout.failed_at IS NOT NULL
      OR coalesce(v_checkout.payment_intent,'{}'::jsonb) <> '{}'::jsonb) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_ALREADY_CHECKING_OUT');
  END IF;
  IF p_replacement IS NULL THEN
    RETURN jsonb_build_object('outcome','ready','cart',to_jsonb(v_cart));
  END IF;
  SELECT x INTO v_target FROM jsonb_array_elements(v_cart.items) x WHERE x->>'id'=p_line_id;
  IF jsonb_typeof(p_replacement)<>'object'
     OR p_replacement->>'product_id' IS DISTINCT FROM v_target->>'product_id'
     OR p_replacement->>'quantity' IS DISTINCT FROM v_target->>'quantity'
     OR coalesce(p_replacement->>'configuration_fingerprint','') !~ '^[0-9a-f]{64}$'
     OR p_replacement->>'id' IS DISTINCT FROM (p_replacement->>'product_id' ||
       CASE WHEN nullif(p_replacement->>'variant_id','') IS NULL THEN '' ELSE ':' || (p_replacement->>'variant_id') END ||
       ':' || (p_replacement->>'configuration_fingerprint'))
     OR jsonb_typeof(p_replacement->'personalization') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid accepted replacement' USING ERRCODE='22023';
  END IF;
  v_quantity:=(v_target->>'quantity')::integer;
  SELECT coalesce((x->>'quantity')::integer,0) INTO v_recipient_quantity
    FROM jsonb_array_elements(v_cart.items) x WHERE x->>'id'=p_replacement->>'id' AND x->>'id'<>p_line_id;
  v_quantity:=v_quantity+coalesce(v_recipient_quantity,0);
  IF v_quantity<1 OR v_quantity>99 THEN RETURN jsonb_build_object('outcome','refused','code','INSUFFICIENT_INVENTORY'); END IF;
  p_replacement:=p_replacement || jsonb_build_object('quantity',v_quantity,
    'line_total',(p_replacement->>'unit_price')::numeric * v_quantity);
  -- The database constructs the replacement itself. Every unrelated stored JSON
  -- line survives byte-for-byte; a matching result merges once at its old slot.
  SELECT coalesce(jsonb_agg(CASE
    WHEN x->>'id'=p_replacement->>'id' THEN p_replacement
    WHEN x->>'id'=p_line_id AND coalesce(v_recipient_quantity,0)=0 THEN p_replacement
    ELSE x END ORDER BY ordinal),'[]'::jsonb) INTO v_items
    FROM jsonb_array_elements(v_cart.items) WITH ORDINALITY AS a(x,ordinal)
    WHERE x->>'id'<>p_line_id OR coalesce(v_recipient_quantity,0)=0;
  -- Recheck the existing 388 provenance contract at the atomic acceptance
  -- boundary, rather than trusting an earlier unlocked HTTP/catalog read.
  SELECT * INTO v_product FROM public.products WHERE id=(v_target->>'product_id')::uuid
    AND store_id=p_site_id AND is_active=true AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED'); END IF;
  v_variant_facts:='{}'::jsonb; v_options:='{}'::jsonb;
  IF nullif(p_replacement->>'variant_id','') IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.product_variants WHERE id=(p_replacement->>'variant_id')::uuid
      AND product_id=v_product.id FOR SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED'); END IF;
    v_variant_facts:=coalesce(v_variant.metadata,'{}'::jsonb);
    SELECT array_agg(name ORDER BY position,id) INTO v_option_names FROM public.product_options WHERE product_id=v_product.id;
    v_options:=jsonb_strip_nulls(jsonb_build_object(coalesce(v_option_names[1],'Option 1'),v_variant.option1,
      coalesce(v_option_names[2],'Option 2'),v_variant.option2,coalesce(v_option_names[3],'Option 3'),v_variant.option3));
  ELSIF EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=v_product.id) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED');
  END IF;
  SELECT coalesce(jsonb_object_agg(k,value),'{}'::jsonb) INTO v_product_facts
    FROM jsonb_each(coalesce(v_product.metadata,'{}'::jsonb)) AS f(k,value)
    WHERE k=ANY(ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books']);
  IF p_replacement->'product_version' IS DISTINCT FROM to_jsonb(v_product.version)
    OR p_replacement->'catalog_source'->'product_facts' IS DISTINCT FROM v_product_facts
    OR p_replacement->'catalog_source'->'variant_facts' IS DISTINCT FROM v_variant_facts
    OR p_replacement->'catalog_source'->'selected_options' IS DISTINCT FROM v_options
    OR p_replacement->'catalog_source'->'images' IS DISTINCT FROM coalesce(to_jsonb(v_product.images),'[]'::jsonb)
    OR (p_replacement->>'unit_price')::numeric IS DISTINCT FROM
      (CASE WHEN nullif(p_replacement->>'variant_id','') IS NULL THEN v_product.price ELSE coalesce(v_variant.price,v_product.price) END) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED');
  END IF;
  -- Same default-location selection and available-reserved expression as the
  -- canonical cart source reader. This is acceptance, not a stock reservation.
  FOR v_required IN SELECT (x->>'product_id')::uuid product_id,nullif(x->>'variant_id','')::uuid variant_id,
      sum((x->>'quantity')::integer) quantity FROM jsonb_array_elements(v_items) x
      GROUP BY 1,2 ORDER BY 1,2 LOOP
    SELECT greatest(coalesce(il.available,0)-coalesce(il.reserved,0),0) INTO v_available
      FROM public.inventory_levels il JOIN public.inventory_locations loc ON loc.id=il.location_id
      WHERE il.store_id=p_site_id AND il.product_id=v_required.product_id
        AND il.variant_id IS NOT DISTINCT FROM v_required.variant_id AND il.deleted_at IS NULL
        AND loc.store_id=p_site_id AND loc.status='active' AND loc.deleted_at IS NULL
      ORDER BY loc.is_default DESC,il.updated_at ASC,il.id LIMIT 1 FOR SHARE OF il,loc;
    IF v_available IS NULL OR v_required.quantity>least(99,v_available) THEN
      RETURN jsonb_build_object('outcome','refused','code','INSUFFICIENT_INVENTORY');
    END IF;
  END LOOP;
  -- Canonical existing ownership, not an app-local cart/buyer registry. All effects below
  -- share this transaction and roll back together on any write/receipt failure.
  v_checkout_id := public.bind_hosted_checkout_buyer(p_site_id,p_cart_id,p_cart_token,v_cart.channel::text,
    p_buyer_account_id,p_buyer_session_epoch);
  UPDATE public.checkout_sessions SET checkout_state='contact',status='contact',
    shipping_address='{}'::jsonb,shipping_method=NULL,delivery_quote='{}'::jsonb,
    payment_method=NULL,payment_intent='{}'::jsonb,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('hosted_delivery_signature',NULL,'hosted_session_revision',gen_random_uuid()::text)
    WHERE id=v_checkout_id AND site_id=p_site_id AND cart_id=p_cart_id;
  UPDATE public.carts SET items=v_items,fact_acceptance_version=1
    WHERE id=p_cart_id AND store_id=p_site_id AND session_id=p_cart_token AND status='active'
      AND updated_at=p_expected_updated_at AND deleted_at IS NULL RETURNING * INTO v_cart;
  IF NOT FOUND THEN RAISE EXCEPTION 'cart changed during locked edit' USING ERRCODE='40001'; END IF;
  v_response:=jsonb_build_object('cart_id',p_cart_id,'buyer_account_id',p_buyer_account_id,
    'accepted_updated_at',v_cart.updated_at,'operation_key',p_operation_key);
  INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_body,status,status_code,
    resource_type,resource_id,expires_at)
    VALUES(p_site_id,p_operation_key::text,v_scope,p_request_hash,v_response,'completed',200,
      'cart',p_cart_id,greatest(coalesce(v_cart.expires_at,now()),now())+interval '30 days');
  RETURN jsonb_build_object('outcome','committed','cart',to_jsonb(v_cart),'receipt',v_response);
END;
$old_apparel_body$;
  next_body:=$new_apparel_body$
DECLARE
  v_cart public.carts%ROWTYPE;
  v_checkout public.checkout_sessions%ROWTYPE;
  v_receipt public.idempotency_keys%ROWTYPE;
  v_buyer_status text; v_buyer_epoch integer; v_checkout_id uuid;
  v_scope text := 'cart.configured_line_edit:' || p_cart_id::text;
  v_response jsonb; v_target jsonb; v_items jsonb; v_quantity integer; v_recipient_quantity integer;
  v_product public.products%ROWTYPE; v_variant public.product_variants%ROWTYPE;
  v_product_facts jsonb; v_variant_facts jsonb; v_options jsonb; v_option_names text[];
  v_required record; v_available integer;
BEGIN
  IF p_site_id IS NULL OR p_cart_id IS NULL OR nullif(p_cart_token,'') IS NULL
     OR p_expected_updated_at IS NULL OR nullif(p_line_id,'') IS NULL
     OR p_operation_key IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_buyer_account_id IS NULL OR p_buyer_session_epoch IS NULL THEN
    RAISE EXCEPTION 'invalid configured cart edit' USING ERRCODE='22023';
  END IF;
  -- Same canonical cart lock namespace as hosted buyer binding; no new mutex service.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_cart_id::text,0));
  SELECT status,session_epoch INTO v_buyer_status,v_buyer_epoch FROM public.buyer_accounts
    WHERE id=p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer_status <> 'active' OR v_buyer_epoch <> p_buyer_session_epoch THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_OWNER_CONFLICT');
  END IF;
  SELECT * INTO v_checkout FROM public.checkout_sessions
    WHERE site_id=p_site_id AND cart_id=p_cart_id AND deleted_at IS NULL FOR UPDATE;
  IF FOUND AND (v_checkout.cart_token IS DISTINCT FROM p_cart_token
      OR (v_checkout.buyer_account_id IS NOT NULL AND v_checkout.buyer_account_id<>p_buyer_account_id)) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_OWNER_CONFLICT');
  END IF;
  SELECT * INTO v_cart FROM public.carts WHERE id=p_cart_id AND store_id=p_site_id
    AND session_id=p_cart_token AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_cart.sales_origin IS DISTINCT FROM 'storefront' THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_NOT_FOUND');
  END IF;
  SELECT * INTO v_receipt FROM public.idempotency_keys
    WHERE site_id=p_site_id AND scope=v_scope AND key=p_operation_key::text AND deleted_at IS NULL FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.request_hash IS DISTINCT FROM p_request_hash OR v_receipt.resource_id IS DISTINCT FROM p_cart_id
       OR v_receipt.response_body->>'buyer_account_id' IS DISTINCT FROM p_buyer_account_id::text THEN
      RETURN jsonb_build_object('outcome','refused','code','CART_EDIT_INTENT_CONFLICT');
    END IF;
    IF v_receipt.status='completed' THEN
      -- Receipt first: recover the committed intent even if catalog or cart moved afterwards.
      -- Return current canonical cart, never rewind it to the old receipt's contents.
      RETURN jsonb_build_object('outcome','committed','cart',to_jsonb(v_cart),'receipt',v_receipt.response_body);
    END IF;
    RETURN jsonb_build_object('outcome','refused','code','CART_EDIT_RECONCILIATION_REQUIRED');
  END IF;
  IF v_cart.status <> 'active' THEN RETURN jsonb_build_object('outcome','refused','code','CART_CLOSED'); END IF;
  IF v_cart.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_REVISION_CONFLICT');
  END IF;
  IF (SELECT count(*)<>count(DISTINCT x->>'id') FROM jsonb_array_elements(v_cart.items) x) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_EDIT_RECONCILIATION_REQUIRED');
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v_cart.items) x WHERE x->>'id'=p_line_id
      AND jsonb_typeof(x->'personalization')='object') <> 1 THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_LINE_MISSING');
  END IF;
  IF v_checkout.id IS NOT NULL AND (v_checkout.order_id IS NOT NULL
      OR coalesce(v_checkout.checkout_state,'') NOT IN ('contact','delivery')
      OR v_checkout.status IS DISTINCT FROM v_checkout.checkout_state
      OR v_checkout.confirmed_at IS NOT NULL OR v_checkout.failed_at IS NOT NULL
      OR coalesce(v_checkout.payment_intent,'{}'::jsonb) <> '{}'::jsonb) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_ALREADY_CHECKING_OUT');
  END IF;
  IF p_replacement IS NULL THEN
    RETURN jsonb_build_object('outcome','ready','cart',to_jsonb(v_cart));
  END IF;
  SELECT x INTO v_target FROM jsonb_array_elements(v_cart.items) x WHERE x->>'id'=p_line_id;
  IF jsonb_typeof(p_replacement)<>'object'
     OR p_replacement->>'product_id' IS DISTINCT FROM v_target->>'product_id'
     OR p_replacement->>'quantity' IS DISTINCT FROM v_target->>'quantity'
     OR coalesce(p_replacement->>'configuration_fingerprint','') !~ '^[0-9a-f]{64}$'
     OR p_replacement->>'id' IS DISTINCT FROM (p_replacement->>'product_id' ||
       CASE WHEN nullif(p_replacement->>'variant_id','') IS NULL THEN '' ELSE ':' || (p_replacement->>'variant_id') END ||
       ':' || (p_replacement->>'configuration_fingerprint'))
     OR jsonb_typeof(p_replacement->'personalization') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid accepted replacement' USING ERRCODE='22023';
  END IF;
  v_quantity:=(v_target->>'quantity')::integer;
  SELECT coalesce((x->>'quantity')::integer,0) INTO v_recipient_quantity
    FROM jsonb_array_elements(v_cart.items) x WHERE x->>'id'=p_replacement->>'id' AND x->>'id'<>p_line_id;
  v_quantity:=v_quantity+coalesce(v_recipient_quantity,0);
  IF v_quantity<1 OR v_quantity>99 THEN RETURN jsonb_build_object('outcome','refused','code','INSUFFICIENT_INVENTORY'); END IF;
  p_replacement:=p_replacement || jsonb_build_object('quantity',v_quantity,
    'line_total',(p_replacement->>'unit_price')::numeric * v_quantity);
  -- The database constructs the replacement itself. Every unrelated stored JSON
  -- line survives byte-for-byte; a matching result merges once at its old slot.
  SELECT coalesce(jsonb_agg(CASE
    WHEN x->>'id'=p_replacement->>'id' THEN p_replacement
    WHEN x->>'id'=p_line_id AND coalesce(v_recipient_quantity,0)=0 THEN p_replacement
    ELSE x END ORDER BY ordinal),'[]'::jsonb) INTO v_items
    FROM jsonb_array_elements(v_cart.items) WITH ORDINALITY AS a(x,ordinal)
    WHERE x->>'id'<>p_line_id OR coalesce(v_recipient_quantity,0)=0;
  -- Recheck the existing 388 provenance contract at the atomic acceptance
  -- boundary, rather than trusting an earlier unlocked HTTP/catalog read.
  SELECT * INTO v_product FROM public.products WHERE id=(v_target->>'product_id')::uuid
    AND store_id=p_site_id AND is_active=true AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED'); END IF;
  v_variant_facts:='{}'::jsonb; v_options:='{}'::jsonb;
  IF nullif(p_replacement->>'variant_id','') IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.product_variants WHERE id=(p_replacement->>'variant_id')::uuid
      AND product_id=v_product.id FOR SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED'); END IF;
    v_variant_facts:=coalesce(v_variant.metadata,'{}'::jsonb);
    SELECT array_agg(name ORDER BY position,id) INTO v_option_names FROM public.product_options WHERE product_id=v_product.id;
    v_options:=jsonb_strip_nulls(jsonb_build_object(coalesce(v_option_names[1],'Option 1'),v_variant.option1,
      coalesce(v_option_names[2],'Option 2'),v_variant.option2,coalesce(v_option_names[3],'Option 3'),v_variant.option3));
  ELSIF EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=v_product.id) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED');
  END IF;
  SELECT coalesce(jsonb_object_agg(k,value),'{}'::jsonb) INTO v_product_facts
    FROM jsonb_each(coalesce(v_product.metadata,'{}'::jsonb)) AS f(k,value)
    WHERE k=ANY(ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books','apparel']);
  IF p_replacement->'product_version' IS DISTINCT FROM to_jsonb(v_product.version)
    OR p_replacement->'catalog_source'->'product_facts' IS DISTINCT FROM v_product_facts
    OR p_replacement->'catalog_source'->'variant_facts' IS DISTINCT FROM v_variant_facts
    OR p_replacement->'catalog_source'->'selected_options' IS DISTINCT FROM v_options
    OR p_replacement->'catalog_source'->'images' IS DISTINCT FROM coalesce(to_jsonb(v_product.images),'[]'::jsonb)
    OR (p_replacement->>'unit_price')::numeric IS DISTINCT FROM
      (CASE WHEN nullif(p_replacement->>'variant_id','') IS NULL THEN v_product.price ELSE coalesce(v_variant.price,v_product.price) END) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_FACTS_CHANGED');
  END IF;
  -- Same default-location selection and available-reserved expression as the
  -- canonical cart source reader. This is acceptance, not a stock reservation.
  FOR v_required IN SELECT (x->>'product_id')::uuid product_id,nullif(x->>'variant_id','')::uuid variant_id,
      sum((x->>'quantity')::integer) quantity FROM jsonb_array_elements(v_items) x
      GROUP BY 1,2 ORDER BY 1,2 LOOP
    SELECT greatest(coalesce(il.available,0)-coalesce(il.reserved,0),0) INTO v_available
      FROM public.inventory_levels il JOIN public.inventory_locations loc ON loc.id=il.location_id
      WHERE il.store_id=p_site_id AND il.product_id=v_required.product_id
        AND il.variant_id IS NOT DISTINCT FROM v_required.variant_id AND il.deleted_at IS NULL
        AND loc.store_id=p_site_id AND loc.status='active' AND loc.deleted_at IS NULL
      ORDER BY loc.is_default DESC,il.updated_at ASC,il.id LIMIT 1 FOR SHARE OF il,loc;
    IF v_available IS NULL OR v_required.quantity>least(99,v_available) THEN
      RETURN jsonb_build_object('outcome','refused','code','INSUFFICIENT_INVENTORY');
    END IF;
  END LOOP;
  -- Canonical existing ownership, not an app-local cart/buyer registry. All effects below
  -- share this transaction and roll back together on any write/receipt failure.
  v_checkout_id := public.bind_hosted_checkout_buyer(p_site_id,p_cart_id,p_cart_token,v_cart.channel::text,
    p_buyer_account_id,p_buyer_session_epoch);
  UPDATE public.checkout_sessions SET checkout_state='contact',status='contact',
    shipping_address='{}'::jsonb,shipping_method=NULL,delivery_quote='{}'::jsonb,
    payment_method=NULL,payment_intent='{}'::jsonb,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('hosted_delivery_signature',NULL,'hosted_session_revision',gen_random_uuid()::text)
    WHERE id=v_checkout_id AND site_id=p_site_id AND cart_id=p_cart_id;
  UPDATE public.carts SET items=v_items,fact_acceptance_version=1
    WHERE id=p_cart_id AND store_id=p_site_id AND session_id=p_cart_token AND status='active'
      AND updated_at=p_expected_updated_at AND deleted_at IS NULL RETURNING * INTO v_cart;
  IF NOT FOUND THEN RAISE EXCEPTION 'cart changed during locked edit' USING ERRCODE='40001'; END IF;
  v_response:=jsonb_build_object('cart_id',p_cart_id,'buyer_account_id',p_buyer_account_id,
    'accepted_updated_at',v_cart.updated_at,'operation_key',p_operation_key);
  INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_body,status,status_code,
    resource_type,resource_id,expires_at)
    VALUES(p_site_id,p_operation_key::text,v_scope,p_request_hash,v_response,'completed',200,
      'cart',p_cart_id,greatest(coalesce(v_cart.expires_at,now()),now())+interval '30 days');
  RETURN jsonb_build_object('outcome','committed','cart',to_jsonb(v_cart),'receipt',v_response);
END;
$new_apparel_body$;
  IF p.prosrc IS DISTINCT FROM old_body THEN RAISE EXCEPTION 'APPAREL_BODY_MISMATCH'; END IF;
  definition:=pg_catalog.pg_get_functiondef(p.oid);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'APPAREL_DEFINITION_AMBIGUOUS'; END IF;
  EXECUTE replace(definition,old_body,next_body);
  SELECT (pg_catalog.to_jsonb(q)-'prosrc'-'proargdefaults') || pg_catalog.jsonb_build_object('argument_defaults',pg_catalog.pg_get_expr(q.proargdefaults,0)) INTO after_profile FROM pg_catalog.pg_proc q WHERE q.oid=p.oid;
  IF before_profile IS DISTINCT FROM after_profile OR (SELECT md5(q.prosrc) FROM pg_catalog.pg_proc q WHERE q.oid=p.oid)<>'92d2e7cc7b892f226d559f180c5affd4'
    THEN RAISE EXCEPTION 'APPAREL_METADATA_CONSERVATION_FAILED'; END IF;
  -- create_order_with_inventory_reservations: replace one product-level whitelist and preserve every other byte.
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)');
  IF NOT FOUND OR pg_catalog.md5(p.prosrc)<>'fff80af060ac84b405796811f0e63fd3' OR NOT p.prosecdef OR p.prokind<>'f'
    OR p.pronargs<>11 OR p.pronargdefaults<>8 OR p.proretset OR p.prorettype<>'jsonb'::regtype
    OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proleakproof OR p.prosupport<>0
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
    OR p.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_actor_id','p_request_id']::text[] OR p.proargmodes IS NOT NULL
    OR p.provariadic<>0 THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: function definition or source profile'; END IF;
  IF p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.orders'::regclass)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)
    OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR a.privilege_type<>'EXECUTE' OR (a.grantee<>p.proowner AND a.is_grantable))
    OR NOT pg_catalog.has_function_privilege(p.proowner,p.oid,'EXECUTE')
    OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
    OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
    THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: source-relative order writer access'; END IF;
  before_profile:=(pg_catalog.to_jsonb(p)-'prosrc'-'proargdefaults') || pg_catalog.jsonb_build_object('argument_defaults',pg_catalog.pg_get_expr(p.proargdefaults,0));
  old_body:=$old_apparel_body$
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
$old_apparel_body$;
  next_body:=$new_apparel_body$
DECLARE
  v_item jsonb;
  v_ref jsonb; v_cart public.carts%ROWTYPE; v_cart_line jsonb;
  v_niche jsonb; v_product_facts jsonb; v_variant_facts jsonb;
  v_selected_options jsonb; v_option_names text[]; v_saved_options jsonb;
  v_has_variants boolean; v_names text[] := ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books','apparel'];
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
$new_apparel_body$;
  IF p.prosrc IS DISTINCT FROM old_body THEN RAISE EXCEPTION 'APPAREL_BODY_MISMATCH'; END IF;
  definition:=pg_catalog.pg_get_functiondef(p.oid);
  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'APPAREL_DEFINITION_AMBIGUOUS'; END IF;
  EXECUTE replace(definition,old_body,next_body);
  SELECT (pg_catalog.to_jsonb(q)-'prosrc'-'proargdefaults') || pg_catalog.jsonb_build_object('argument_defaults',pg_catalog.pg_get_expr(q.proargdefaults,0)) INTO after_profile FROM pg_catalog.pg_proc q WHERE q.oid=p.oid;
  IF before_profile IS DISTINCT FROM after_profile OR (SELECT md5(q.prosrc) FROM pg_catalog.pg_proc q WHERE q.oid=p.oid)<>'eed7f1f809c73928fcf00e285d6b80f3'
    THEN RAISE EXCEPTION 'APPAREL_METADATA_CONSERVATION_FAILED'; END IF;
  -- Whole-cart writer is intentionally unchanged. Fail closed on a different current writer.
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.write_storefront_cart(uuid,uuid,text,timestamp with time zone,jsonb,uuid,integer)');
  IF NOT FOUND OR pg_catalog.md5(p.prosrc)<>'245ea1fa888e09b93163b065b07892ca' OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_catalog']::text[] OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proleakproof
    OR p.proacl IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::aclitem[]
    THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: unchanged current whole-cart writer'; END IF;
END;
$apparel_provenance$;
COMMIT;
