-- Bind a buyer-reviewed seller delivery quote to the canonical storefront order transaction.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_storefront_checkout_order_with_delivery_rate(
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
  p_buyer_account_id uuid,
  p_buyer_session_epoch integer,
  p_expected_shipping_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_rate record;
  v_shipping_amount numeric(10,2);
  v_subtotal numeric(12,2);
  v_country text := lower(btrim(coalesce(p_shipping_address ->> 'country', '')));
  v_state text := lower(btrim(coalesce(p_shipping_address ->> 'state', '')));
  v_state_code text := lower(btrim(coalesce(p_shipping_address ->> 'state_code', '')));
  v_pincode text := btrim(coalesce(p_shipping_address ->> 'zip', p_shipping_address ->> 'pincode', ''));
BEGIN
  IF p_shipping_rate_id IS NULL OR p_expected_shipping_amount IS NULL
     OR p_expected_shipping_amount < 0 OR round(p_expected_shipping_amount, 2) <> p_expected_shipping_amount THEN
    RAISE EXCEPTION 'storefront delivery rate quote is incomplete' USING ERRCODE = '22023';
  END IF;
  IF v_country NOT IN ('in', 'india') OR v_pincode !~ '^[1-9][0-9]{5}$' OR v_state = '' THEN
    RAISE EXCEPTION 'storefront delivery address is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT sr.type, sr.price, sr.min_order_amount, sr.max_order_amount,
         sr.cod_enabled AS rate_cod_enabled,
         sz.countries, sz.states, sz.zip_codes, sz.cod_enabled AS zone_cod_enabled
    INTO v_rate
    FROM public.shipping_rates sr
    JOIN public.shipping_zones sz ON sz.id = sr.zone_id
   WHERE sr.id = p_shipping_rate_id
     AND sr.site_id = p_store_id
     AND sz.store_id = p_store_id
     AND sz.site_id = p_store_id
     AND sr.is_active IS TRUE
     AND sr.deleted_at IS NULL
     AND sz.deleted_at IS NULL
   FOR SHARE OF sr, sz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'storefront delivery rate is no longer available' USING ERRCODE = '23514';
  END IF;

  IF (p_payment_method = 'cod'
      AND (v_rate.rate_cod_enabled IS DISTINCT FROM true OR v_rate.zone_cod_enabled IS DISTINCT FROM true)) THEN
    RAISE EXCEPTION 'storefront delivery rate does not support COD' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(v_rate.countries, ARRAY[]::text[])) AS country(value)
        WHERE lower(btrim(country.value)) IN ('in', 'india')
     )
     OR (coalesce(cardinality(v_rate.states), 0) > 0 AND NOT EXISTS (
       SELECT 1 FROM unnest(v_rate.states) AS state(value)
        WHERE lower(btrim(state.value)) IN (v_state, v_state_code)
     ))
     OR (coalesce(cardinality(v_rate.zip_codes), 0) > 0 AND NOT (v_pincode = ANY(v_rate.zip_codes))) THEN
    RAISE EXCEPTION 'storefront delivery rate does not cover this address' USING ERRCODE = '23514';
  END IF;
  IF v_rate.type IS NULL OR v_rate.type NOT IN ('flat', 'free', 'price_based') THEN
    RAISE EXCEPTION 'storefront delivery rate type is unsupported' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(sum(
      coalesce(nullif(pv.price, 0), p.price, 0) * (item.value ->> 'quantity')::numeric
    ), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) AS item(value)
    JOIN public.products p
      ON p.id = (item.value ->> 'product_id')::uuid
     AND p.store_id = p_store_id
     AND p.deleted_at IS NULL
    LEFT JOIN public.product_variants pv
      ON pv.id = nullif(item.value ->> 'variant_id', '')::uuid
     AND pv.product_id = p.id;
  IF (v_rate.min_order_amount IS NOT NULL AND v_subtotal < v_rate.min_order_amount)
     OR (v_rate.max_order_amount IS NOT NULL AND v_subtotal > v_rate.max_order_amount) THEN
    RAISE EXCEPTION 'storefront delivery rate subtotal range changed' USING ERRCODE = '23514';
  END IF;

  v_shipping_amount := CASE WHEN v_rate.type = 'free' THEN 0 ELSE coalesce(v_rate.price, 0) END;
  IF round(v_shipping_amount, 2) IS DISTINCT FROM round(p_expected_shipping_amount, 2) THEN
    RAISE EXCEPTION 'storefront delivery rate quote changed before order creation' USING ERRCODE = '23514';
  END IF;

  IF p_buyer_account_id IS NOT NULL THEN
    IF p_buyer_session_epoch IS NULL THEN
      RAISE EXCEPTION 'buyer session epoch is required' USING ERRCODE = '22023';
    END IF;
    RETURN public.create_checkout_order_for_buyer(
      p_buyer_account_id, p_buyer_session_epoch, p_store_id,
      p_customer_name, p_customer_email, p_customer_phone, p_shipping_address,
      p_items, p_payment_method, p_notes, p_coupon_code, p_gift_card_code,
      p_shipping_method, p_idempotency_key, p_actor_id, p_request_id,
      p_shipping_rate_id, p_tax_amount, p_place_of_supply_state, p_tax_lines, NULL
    );
  END IF;

  RETURN public.create_checkout_order(
    p_store_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_items, p_payment_method, p_notes, p_coupon_code,
    p_gift_card_code, p_shipping_method, p_idempotency_key, p_actor_id,
    p_request_id, p_shipping_rate_id, p_tax_amount, p_place_of_supply_state,
    p_tax_lines
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_storefront_checkout_order_with_delivery_rate(
  uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric
) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.create_storefront_checkout_order_with_delivery_rate(
  uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric
) TO service_role;

COMMIT;
