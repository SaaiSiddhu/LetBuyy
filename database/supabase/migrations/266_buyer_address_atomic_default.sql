-- Canonical buyer address mutation: ownership, default switch and save are one
-- transaction. No new address/identity model. Existing duplicate defaults cause
-- index creation to fail; this migration never chooses or deletes customer data.
BEGIN;

CREATE UNIQUE INDEX buyer_addresses_one_default_idx
  ON public.buyer_addresses (buyer_account_id) WHERE is_default;

CREATE OR REPLACE FUNCTION public.mutate_buyer_address(
  p_buyer_account_id uuid,
  p_address_id uuid,
  p_address jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.buyer_addresses%ROWTYPE;
  v_fields jsonb;
BEGIN
  IF p_buyer_account_id IS NULL OR p_address IS NULL OR jsonb_typeof(p_address) <> 'object' THEN
    RAISE EXCEPTION 'buyer and address object are required' USING ERRCODE = '22023';
  END IF;
  -- Serialize mutations for ONE buyer, including the first address (no address
  -- row exists to lock yet). Lock order is always buyer, then owned address.
  PERFORM id FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'buyer is unavailable' USING ERRCODE = '22023'; END IF;

  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_fields
  FROM jsonb_each(p_address)
  WHERE key = ANY(ARRAY['label','full_name','phone','address_line1','address_line2',
    'city','state','postal_code','country','landmark','is_default','gstin','state_code']);

  IF p_address_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.buyer_addresses
      WHERE id = p_address_id AND buyer_account_id = p_buyer_account_id FOR UPDATE;
    -- No partial default switch when the requested row belongs to someone else.
    IF NOT FOUND THEN RETURN NULL; END IF;
    v_row := jsonb_populate_record(v_row, v_fields);
  ELSE
    v_row := jsonb_populate_record(NULL::public.buyer_addresses,
      jsonb_build_object('label','home','country','IN','is_default',false) || v_fields);
  END IF;

  IF v_row.is_default THEN
    UPDATE public.buyer_addresses SET is_default = false
      WHERE buyer_account_id = p_buyer_account_id AND is_default
        AND (p_address_id IS NULL OR id <> p_address_id);
  END IF;

  IF p_address_id IS NULL THEN
    INSERT INTO public.buyer_addresses (buyer_account_id,label,full_name,phone,
      address_line1,address_line2,city,state,postal_code,country,landmark,is_default,gstin,state_code)
    VALUES (p_buyer_account_id,v_row.label,v_row.full_name,v_row.phone,
      v_row.address_line1,v_row.address_line2,v_row.city,v_row.state,v_row.postal_code,
      v_row.country,v_row.landmark,v_row.is_default,v_row.gstin,v_row.state_code)
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.buyer_addresses SET label=v_row.label,full_name=v_row.full_name,
      phone=v_row.phone,address_line1=v_row.address_line1,address_line2=v_row.address_line2,
      city=v_row.city,state=v_row.state,postal_code=v_row.postal_code,country=v_row.country,
      landmark=v_row.landmark,is_default=v_row.is_default,gstin=v_row.gstin,state_code=v_row.state_code
    WHERE id=p_address_id AND buyer_account_id=p_buyer_account_id RETURNING * INTO v_row;
  END IF;
  -- Let constraint errors escape: PostgREST rolls back the entire switch + save.
  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_buyer_address(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.mutate_buyer_address(uuid,uuid,jsonb) TO service_role;
COMMIT;
