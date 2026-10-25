CREATE OR REPLACE FUNCTION public.write_storefront_cart(p_site_id uuid, p_cart_id uuid, p_cart_token text, p_expected_updated_at timestamp with time zone, p_payload jsonb, p_buyer_account_id uuid DEFAULT NULL::uuid, p_buyer_session_epoch integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_cart public.carts%ROWTYPE; v_checkout public.checkout_sessions%ROWTYPE;
  v_buyer_status text; v_buyer_epoch integer;
BEGIN
  IF p_site_id IS NULL OR p_cart_id IS NULL OR nullif(p_cart_token,'') IS NULL OR p_expected_updated_at IS NULL
    OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items')>250 THEN
    RAISE EXCEPTION 'invalid accepted cart write' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_cart_id::text,0));
  IF p_buyer_account_id IS NOT NULL THEN
    SELECT status,session_epoch INTO v_buyer_status,v_buyer_epoch FROM public.buyer_accounts WHERE id=p_buyer_account_id FOR SHARE;
    IF NOT FOUND OR v_buyer_status<>'active' OR v_buyer_epoch IS DISTINCT FROM p_buyer_session_epoch THEN
      RETURN jsonb_build_object('outcome','refused','code','CART_OWNER_CONFLICT');
    END IF;
  END IF;
  SELECT * INTO v_checkout FROM public.checkout_sessions WHERE site_id=p_site_id AND cart_id=p_cart_id AND deleted_at IS NULL FOR UPDATE;
  IF FOUND AND (v_checkout.cart_token IS DISTINCT FROM p_cart_token OR
    (v_checkout.buyer_account_id IS NOT NULL AND v_checkout.buyer_account_id IS DISTINCT FROM p_buyer_account_id)) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_OWNER_CONFLICT');
  END IF;
  IF v_checkout.id IS NOT NULL AND (v_checkout.order_id IS NOT NULL OR coalesce(v_checkout.checkout_state,'') NOT IN ('contact','delivery')
    OR v_checkout.status IS DISTINCT FROM v_checkout.checkout_state OR coalesce(v_checkout.payment_intent,'{}'::jsonb)<>'{}'::jsonb) THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_ALREADY_CHECKING_OUT');
  END IF;
  SELECT * INTO v_cart FROM public.carts WHERE id=p_cart_id AND store_id=p_site_id AND session_id=p_cart_token AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_cart.status<>'active' OR v_cart.sales_origin IS DISTINCT FROM 'storefront' THEN
    RETURN jsonb_build_object('outcome','refused','code','CART_STATE_CONFLICT');
  END IF;
  IF v_cart.updated_at IS DISTINCT FROM p_expected_updated_at THEN RETURN jsonb_build_object('outcome','refused','code','CART_REVISION_CONFLICT'); END IF;
  UPDATE public.carts SET items=p_payload->'items',fact_acceptance_version=1,
    coupon_code=CASE WHEN p_payload ? 'coupon_code' THEN p_payload->>'coupon_code' ELSE coupon_code END,
    customer_id=CASE WHEN p_payload ? 'customer_id' THEN nullif(p_payload->>'customer_id','')::uuid ELSE customer_id END,
    buyer_email=CASE WHEN p_payload ? 'buyer_email' THEN p_payload->>'buyer_email' ELSE buyer_email END,
    channel=coalesce((jsonb_populate_record(v_cart,p_payload)).channel,channel),
    expires_at=CASE WHEN p_payload ? 'expires_at' THEN (p_payload->>'expires_at')::timestamptz ELSE expires_at END
    WHERE id=p_cart_id AND store_id=p_site_id AND session_id=p_cart_token AND status='active'
      AND updated_at=p_expected_updated_at AND deleted_at IS NULL RETURNING * INTO v_cart;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','refused','code','CART_STATE_CONFLICT'); END IF;
  IF v_checkout.id IS NOT NULL THEN
    UPDATE public.checkout_sessions SET checkout_state='contact',status='contact',shipping_address='{}'::jsonb,
      shipping_method=NULL,delivery_quote='{}'::jsonb,payment_method=NULL,payment_intent='{}'::jsonb,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('hosted_delivery_signature',NULL,'hosted_session_revision',gen_random_uuid()::text)
      WHERE id=v_checkout.id AND site_id=p_site_id AND cart_id=p_cart_id;
  END IF;
  RETURN jsonb_build_object('outcome','committed','cart',to_jsonb(v_cart));
END;
$function$
