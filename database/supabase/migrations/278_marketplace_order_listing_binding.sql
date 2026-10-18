-- F8.2: create one seller-bound marketplace order through the canonical order and buyer-ownership
-- paths, while revalidating the approved listing revision in the same transaction.
BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN marketplace_listing_id uuid REFERENCES public.channel_listings(id) ON DELETE RESTRICT,
  ADD COLUMN marketplace_approved_fingerprint text,
  ADD CONSTRAINT order_items_marketplace_listing_fingerprint_pair
    CHECK ((marketplace_listing_id IS NULL) = (marketplace_approved_fingerprint IS NULL)),
  ADD CONSTRAINT order_items_marketplace_fingerprint_format
    CHECK (marketplace_approved_fingerprint IS NULL OR marketplace_approved_fingerprint ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION public.marketplace_order_item_listing_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.marketplace_listing_id IS NOT NULL OR NEW.marketplace_approved_fingerprint IS NOT NULL THEN
      RAISE EXCEPTION 'marketplace order listing identity is bound only by checkout';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.marketplace_listing_id IS DISTINCT FROM OLD.marketplace_listing_id
     OR NEW.marketplace_approved_fingerprint IS DISTINCT FROM OLD.marketplace_approved_fingerprint THEN
    IF OLD.marketplace_listing_id IS NOT NULL
       OR NEW.marketplace_listing_id IS NULL
       OR NEW.marketplace_approved_fingerprint IS NULL
       OR current_setting('app.marketplace_order_creation', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'marketplace order listing identity is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.marketplace_order_item_listing_guard() FROM PUBLIC;

CREATE TRIGGER trg_order_items_marketplace_listing_guard
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_order_item_listing_guard();

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

REVOKE ALL ON FUNCTION public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer)
  TO service_role;

COMMIT;
