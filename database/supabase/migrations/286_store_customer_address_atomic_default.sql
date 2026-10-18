-- Serialize the supported per-store customer-address default mutations.
-- The canonical buyer address book has a separate principal and writer (266);
-- this compatibility writer is for legacy store_customers sessions and the
-- merchant customer-address API over customer_addresses.
BEGIN;

CREATE OR REPLACE FUNCTION public.mutate_store_customer_address(
  p_store_id uuid,
  p_customer_id uuid,
  p_customer_email text,
  p_address_id uuid,
  p_address jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_email text := lower(btrim(p_customer_email));
  v_row public.customer_addresses%ROWTYPE;
  v_fields jsonb;
BEGIN
  IF p_store_id IS NULL OR v_email = '' OR p_address IS NULL OR jsonb_typeof(p_address) <> 'object' THEN
    RAISE EXCEPTION 'store, customer email and address object are required' USING ERRCODE = '22023';
  END IF;

  -- Storefront callers bind their signed session to a live store customer in
  -- this same transaction. Merchant callers pass NULL after their store-owner
  -- permission check and retain the pre-existing merchant address API scope.
  IF p_customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.store_customers
     WHERE id = p_customer_id AND store_id = p_store_id
       AND lower(email) = v_email AND status = 'active' AND deleted_at IS NULL
     FOR NO KEY UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;

  -- Advisory transaction lock covers the no-row-yet case and serializes every
  -- supported create/update for this store/customer pair without changing data.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || v_email, 0));

  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_fields
    FROM jsonb_each(p_address)
   WHERE key = ANY(ARRAY[
     'customer_phone','label','full_name','address_line1','address_line2',
     'city','state','postal_code','country','landmark','is_default','gstin','state_code'
   ]);

  IF p_address_id IS NOT NULL THEN
    SELECT * INTO v_row
      FROM public.customer_addresses
     WHERE id = p_address_id
       AND store_id = p_store_id
       AND lower(customer_email) = v_email
     FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
    v_row := jsonb_populate_record(v_row, v_fields);
  ELSE
    v_row := jsonb_populate_record(NULL::public.customer_addresses,
      jsonb_build_object('label','home','country','IN','is_default',false) || v_fields);
  END IF;

  v_row.label := coalesce(v_row.label, 'home');
  v_row.country := coalesce(v_row.country, 'IN');
  v_row.is_default := coalesce(v_row.is_default, false);

  IF v_row.is_default THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE store_id = p_store_id
       AND lower(customer_email) = v_email
       AND (p_address_id IS NULL OR id <> p_address_id)
       AND is_default;
  END IF;

  IF p_address_id IS NULL THEN
    INSERT INTO public.customer_addresses (
      store_id,customer_email,customer_phone,label,full_name,address_line1,address_line2,
      city,state,postal_code,country,landmark,is_default,gstin,state_code
    ) VALUES (
      p_store_id,v_email,v_row.customer_phone,v_row.label,v_row.full_name,v_row.address_line1,
      v_row.address_line2,v_row.city,v_row.state,v_row.postal_code,v_row.country,
      v_row.landmark,v_row.is_default,v_row.gstin,v_row.state_code
    ) RETURNING * INTO v_row;
  ELSE
    UPDATE public.customer_addresses SET
      customer_phone=v_row.customer_phone,label=v_row.label,full_name=v_row.full_name,
      address_line1=v_row.address_line1,address_line2=v_row.address_line2,city=v_row.city,
      state=v_row.state,postal_code=v_row.postal_code,country=v_row.country,
      landmark=v_row.landmark,is_default=v_row.is_default,gstin=v_row.gstin,state_code=v_row.state_code
     WHERE id=p_address_id AND store_id=p_store_id AND lower(customer_email)=v_email
     RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.mutate_store_customer_address(uuid,uuid,text,uuid,jsonb)
  TO service_role;

COMMIT;
