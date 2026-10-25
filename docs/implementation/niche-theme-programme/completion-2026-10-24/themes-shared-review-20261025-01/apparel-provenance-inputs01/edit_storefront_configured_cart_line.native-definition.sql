CREATE OR REPLACE FUNCTION public.edit_storefront_configured_cart_line(p_site_id uuid, p_cart_id uuid, p_cart_token text, p_expected_updated_at timestamp with time zone, p_line_id text, p_operation_key uuid, p_request_hash text, p_buyer_account_id uuid, p_buyer_session_epoch integer, p_replacement jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
