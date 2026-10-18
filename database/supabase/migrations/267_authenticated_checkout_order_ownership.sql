-- Phase 2: create an order and its authenticated buyer ownership in one Postgres transaction.
-- The worker verifies the signed site-bound session and passes its principal/epoch here. This
-- backend-only wrapper rechecks live account state under a row lock, delegates all order creation
-- to the canonical RPC, and refuses to claim an earlier guest/other-buyer's idempotent order.
BEGIN;

CREATE FUNCTION public.create_checkout_order_for_buyer(
  p_buyer_account_id uuid,
  p_buyer_session_epoch integer,
  p_store_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_payment_method text,
  p_notes text,
  p_coupon_code text,
  p_gift_card_code text,
  p_shipping_method text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_request_id text,
  p_shipping_rate_id uuid,
  p_tax_amount numeric,
  p_place_of_supply_state text,
  p_tax_lines jsonb,
  p_loyalty_points bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_status text;
  v_session_epoch integer;
  v_existing_order_id uuid;
  v_order jsonb;
  v_order_id uuid;
  v_order_site_id uuid;
  v_link public.buyer_order_links%ROWTYPE;
BEGIN
  IF p_buyer_account_id IS NULL OR p_buyer_session_epoch IS NULL OR p_store_id IS NULL
     OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'authenticated checkout identity is incomplete' USING ERRCODE = '22023';
  END IF;

  -- Match create_checkout_order's idempotency lock. Holding it across the preflight, canonical
  -- RPC and ownership insert prevents guest/authenticated or cross-buyer races on one order key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 0));

  SELECT status, session_epoch INTO v_status, v_session_epoch
    FROM public.buyer_accounts
   WHERE id = p_buyer_account_id
   FOR SHARE;
  IF NOT FOUND OR v_status <> 'active' OR v_session_epoch <> p_buyer_session_epoch THEN
    RAISE EXCEPTION 'buyer session is no longer active' USING ERRCODE = '28000';
  END IF;

  -- An existing guest order must not become owned merely because a buyer later reuses its key.
  -- An existing authenticated order may be replayed only by its original recorded owner.
  SELECT order_id INTO v_existing_order_id
    FROM public.checkout_sessions
   WHERE site_id = p_store_id AND idempotency_key = p_idempotency_key
   FOR SHARE;
  IF v_existing_order_id IS NOT NULL THEN
    SELECT * INTO v_link FROM public.buyer_order_links WHERE order_id = v_existing_order_id FOR SHARE;
    IF NOT FOUND OR v_link.buyer_account_id <> p_buyer_account_id OR v_link.site_id <> p_store_id
       OR v_link.link_basis <> 'authenticated_checkout' THEN
      RAISE EXCEPTION 'checkout idempotency key is already bound to another checkout' USING ERRCODE = '23505';
    END IF;
  END IF;

  v_order := public.create_checkout_order(
    p_store_id, p_customer_name, p_customer_email, p_customer_phone, p_shipping_address,
    p_items, p_payment_method, p_notes, p_coupon_code, p_gift_card_code, p_shipping_method,
    p_idempotency_key, p_actor_id, p_request_id, p_shipping_rate_id, p_tax_amount,
    p_place_of_supply_state, p_tax_lines, p_buyer_account_id, p_loyalty_points
  );
  v_order_id := NULLIF(v_order ->> 'id', '')::uuid;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'canonical checkout did not return an order id' USING ERRCODE = 'P0001';
  END IF;

  SELECT store_id INTO v_order_site_id FROM public.orders WHERE id = v_order_id FOR SHARE;
  IF NOT FOUND OR v_order_site_id <> p_store_id THEN
    RAISE EXCEPTION 'canonical checkout returned an order for another site' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.buyer_order_links (order_id, buyer_account_id, site_id, link_basis)
  VALUES (v_order_id, p_buyer_account_id, p_store_id, 'authenticated_checkout')
  ON CONFLICT (order_id) DO NOTHING;
  SELECT * INTO v_link FROM public.buyer_order_links WHERE order_id = v_order_id FOR SHARE;
  IF NOT FOUND OR v_link.buyer_account_id <> p_buyer_account_id OR v_link.site_id <> p_store_id
     OR v_link.link_basis <> 'authenticated_checkout' THEN
    RAISE EXCEPTION 'checkout order ownership conflicts with an existing owner' USING ERRCODE = '23505';
  END IF;

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_checkout_order_for_buyer(uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,bigint) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.create_checkout_order_for_buyer(uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,bigint) TO service_role;

COMMIT;
