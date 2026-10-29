-- One GST quote for browser review and the existing canonical order transaction.
-- No rate seed, historical order rewrite, provider activation or registration inference.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tax_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.shipping_zones ADD CONSTRAINT shipping_zone_profile_same_site_v1
  FOREIGN KEY(profile_id,site_id) REFERENCES public.shipping_profiles(id,site_id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rate_reviewed_ranges_v1 CHECK (
  (min_weight_grams IS NULL OR max_weight_grams IS NULL OR min_weight_grams<=max_weight_grams)
  AND (min_order_amount IS NULL OR max_order_amount IS NULL OR min_order_amount<=max_order_amount)
  AND (estimated_days_min IS NULL OR estimated_days_max IS NULL OR estimated_days_min<=estimated_days_max)
) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_checkout_tax_snapshot_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.tax_snapshot IS DISTINCT FROM NEW.tax_snapshot AND
     (OLD.tax_snapshot<>'{}'::jsonb OR current_user NOT IN ('postgres','service_role')) THEN
    RAISE EXCEPTION 'Committed tax facts are immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_order_tax_snapshot BEFORE UPDATE OF tax_snapshot ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_tax_snapshot_v1();
CREATE TRIGGER guard_order_item_tax_snapshot BEFORE UPDATE OF tax_snapshot ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_tax_snapshot_v1();

CREATE OR REPLACE FUNCTION public.checkout_gst_state_code_v1(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
  SELECT CASE lower(btrim(value))
    WHEN '01' THEN '01'
    WHEN 'jammu & kashmir' THEN '01'
    WHEN 'jk' THEN '01'
    WHEN '02' THEN '02'
    WHEN 'himachal pradesh' THEN '02'
    WHEN 'hp' THEN '02'
    WHEN '03' THEN '03'
    WHEN 'punjab' THEN '03'
    WHEN 'pb' THEN '03'
    WHEN '04' THEN '04'
    WHEN 'chandigarh' THEN '04'
    WHEN 'ch' THEN '04'
    WHEN '05' THEN '05'
    WHEN 'uttarakhand' THEN '05'
    WHEN 'uk' THEN '05'
    WHEN '06' THEN '06'
    WHEN 'haryana' THEN '06'
    WHEN 'hr' THEN '06'
    WHEN '07' THEN '07'
    WHEN 'delhi' THEN '07'
    WHEN 'dl' THEN '07'
    WHEN '08' THEN '08'
    WHEN 'rajasthan' THEN '08'
    WHEN 'rj' THEN '08'
    WHEN '09' THEN '09'
    WHEN 'uttar pradesh' THEN '09'
    WHEN 'up' THEN '09'
    WHEN '10' THEN '10'
    WHEN 'bihar' THEN '10'
    WHEN 'br' THEN '10'
    WHEN '11' THEN '11'
    WHEN 'sikkim' THEN '11'
    WHEN 'sk' THEN '11'
    WHEN '12' THEN '12'
    WHEN 'arunachal pradesh' THEN '12'
    WHEN 'ar' THEN '12'
    WHEN '13' THEN '13'
    WHEN 'nagaland' THEN '13'
    WHEN 'nl' THEN '13'
    WHEN '14' THEN '14'
    WHEN 'manipur' THEN '14'
    WHEN 'mn' THEN '14'
    WHEN '15' THEN '15'
    WHEN 'mizoram' THEN '15'
    WHEN 'mz' THEN '15'
    WHEN '16' THEN '16'
    WHEN 'tripura' THEN '16'
    WHEN 'tr' THEN '16'
    WHEN '17' THEN '17'
    WHEN 'meghalaya' THEN '17'
    WHEN 'ml' THEN '17'
    WHEN '18' THEN '18'
    WHEN 'assam' THEN '18'
    WHEN 'as' THEN '18'
    WHEN '19' THEN '19'
    WHEN 'west bengal' THEN '19'
    WHEN 'wb' THEN '19'
    WHEN '20' THEN '20'
    WHEN 'jharkhand' THEN '20'
    WHEN 'jh' THEN '20'
    WHEN '21' THEN '21'
    WHEN 'odisha' THEN '21'
    WHEN 'or' THEN '21'
    WHEN '22' THEN '22'
    WHEN 'chhattisgarh' THEN '22'
    WHEN 'cg' THEN '22'
    WHEN '23' THEN '23'
    WHEN 'madhya pradesh' THEN '23'
    WHEN 'mp' THEN '23'
    WHEN '24' THEN '24'
    WHEN 'gujarat' THEN '24'
    WHEN 'gj' THEN '24'
    WHEN '26' THEN '26'
    WHEN 'dadra & nagar haveli and daman & diu' THEN '26'
    WHEN 'dn' THEN '26'
    WHEN '27' THEN '27'
    WHEN 'maharashtra' THEN '27'
    WHEN 'mh' THEN '27'
    WHEN '29' THEN '29'
    WHEN 'karnataka' THEN '29'
    WHEN 'ka' THEN '29'
    WHEN '30' THEN '30'
    WHEN 'goa' THEN '30'
    WHEN 'ga' THEN '30'
    WHEN '31' THEN '31'
    WHEN 'lakshadweep' THEN '31'
    WHEN 'ld' THEN '31'
    WHEN '32' THEN '32'
    WHEN 'kerala' THEN '32'
    WHEN 'kl' THEN '32'
    WHEN '33' THEN '33'
    WHEN 'tamil nadu' THEN '33'
    WHEN 'tn' THEN '33'
    WHEN '34' THEN '34'
    WHEN 'puducherry' THEN '34'
    WHEN 'py' THEN '34'
    WHEN '35' THEN '35'
    WHEN 'andaman & nicobar islands' THEN '35'
    WHEN 'an' THEN '35'
    WHEN '36' THEN '36'
    WHEN 'telangana' THEN '36'
    WHEN 'ts' THEN '36'
    WHEN '37' THEN '37'
    WHEN 'andhra pradesh' THEN '37'
    WHEN 'ap' THEN '37'
    WHEN '38' THEN '38'
    WHEN 'ladakh' THEN '38'
    WHEN 'la' THEN '38'
    WHEN '97' THEN '97'
    WHEN 'other territory' THEN '97'
    WHEN 'ot' THEN '97'
    ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.checkout_gst_state_code_v1(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.resolve_checkout_gst_v1(
  p_site_id uuid, p_lines jsonb, p_address jsonb,
  p_discount_minor bigint, p_shipping_minor bigint, p_shipping_discount_minor bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  s public.sites%ROWTYPE; l record; selected public.tax_rates%ROWTYPE; hsn public.hsn_rates%ROWTYPE;
  result_lines jsonb:='[]'; components jsonb:='[]'; q jsonb;
  subtotal bigint:=0; product_discount bigint; shipping_discount bigint;
  net bigint; taxable bigint; amount bigint; rate_bps integer;
  total_tax bigint:=0; added_tax bigint:=0; cgst bigint:=0; sgst bigint:=0; igst bigint:=0;
  c bigint; g bigint; shipping_cgst bigint:=0; shipping_sgst bigint:=0; shipping_igst bigint:=0;
  shipping_rate_bps integer:=0; state_code text; registered boolean; collection_status text; state_component text;
  product_taxable boolean; shipping_net bigint; shipping_tax bigint:=0;
BEGIN
  IF p_site_id IS NULL OR jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)>100
     OR p_discount_minor<0 OR p_shipping_minor<0 OR p_shipping_discount_minor<0 THEN
    RAISE EXCEPTION 'CHECKOUT_QUOTE_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_SITE_UNAVAILABLE' USING ERRCODE='23514'; END IF;
  IF coalesce(s.currency,'INR')<>'INR' THEN RAISE EXCEPTION 'CHECKOUT_CURRENCY_UNSUPPORTED'; END IF;
  registered:=nullif(btrim(s.gstin),'') IS NOT NULL;
  IF registered AND (s.gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    OR left(s.gstin,2) IS DISTINCT FROM s.gst_state_code
    OR public.checkout_gst_state_code_v1(s.gst_state_code) IS NULL
    OR nullif(btrim(s.legal_name),'') IS NULL
    OR jsonb_typeof(s.invoice_address) IS DISTINCT FROM 'object'
    OR nullif(btrim(s.invoice_address->>'line1'),'') IS NULL
    OR nullif(btrim(s.invoice_address->>'city'),'') IS NULL
    OR coalesce(s.invoice_address->>'postal_code',s.invoice_address->>'zip',s.invoice_address->>'pincode','') !~ '^[1-9][0-9]{5}$') THEN
    RAISE EXCEPTION 'GST_SUPPLIER_DETAILS_REQUIRED' USING ERRCODE='23514';
  END IF;
  state_code:=nullif(btrim(coalesce(p_address->>'state_code','')),'');
  state_component:=CASE WHEN s.gst_state_code IN ('04','25','26','31','35','38') THEN 'UTGST' ELSE 'SGST' END;
  SELECT coalesce(sum((value->>'amount_minor')::bigint),0),
         coalesce(bool_or(coalesce((value->>'charge_tax')::boolean,true)),false)
    INTO subtotal,product_taxable FROM jsonb_array_elements(p_lines);
  shipping_discount:=least(p_shipping_discount_minor,p_shipping_minor,p_discount_minor);
  product_discount:=least(subtotal,p_discount_minor-shipping_discount);
  IF p_discount_minor>subtotal+p_shipping_minor THEN RAISE EXCEPTION 'CHECKOUT_DISCOUNT_INVALID'; END IF;
  IF NOT registered AND (EXISTS(SELECT 1 FROM public.tax_rates WHERE store_id=p_site_id
      AND is_active AND deleted_at IS NULL AND rate>0) OR EXISTS(
      SELECT 1 FROM public.hsn_rates WHERE site_id=p_site_id AND deleted_at IS NULL
      AND effective_from<=CURRENT_DATE AND (effective_to IS NULL OR effective_to>=CURRENT_DATE) AND gst_rate_bps>0)) THEN
    RAISE EXCEPTION 'GST_REGISTRATION_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF registered AND (s.gst_state_code IS NULL OR s.gst_state_code !~ '^[0-9]{2}$'
      OR state_code IS NULL OR state_code !~ '^[0-9]{2}$') THEN
    RAISE EXCEPTION 'GST_PLACE_OF_SUPPLY_REQUIRED' USING ERRCODE='23514';
  END IF;
  collection_status:=CASE WHEN registered THEN 'configured' ELSE 'not_collecting' END;

  -- Largest remainder: exactly the reviewed product discount, including paise ties.
  FOR l IN
    WITH lines AS (
      SELECT value AS line, ordinality AS n, (value->>'amount_minor')::bigint AS gross
      FROM jsonb_array_elements(p_lines) WITH ORDINALITY
    ), shares AS (
      SELECT *, CASE WHEN subtotal=0 THEN 0 ELSE floor(gross::numeric*product_discount/subtotal)::bigint END AS base,
        CASE WHEN subtotal=0 THEN 0 ELSE mod(gross::numeric*product_discount,subtotal) END AS remainder
      FROM lines
    ), ranked AS (
      SELECT *, row_number() OVER(ORDER BY remainder DESC,n) AS allocation_rank,
        sum(base) OVER() AS allocated FROM shares
    ) SELECT *,base+CASE WHEN allocation_rank<=product_discount-allocated THEN 1 ELSE 0 END AS discount
      FROM ranked ORDER BY n
  LOOP
    IF l.gross<0 OR l.discount<0 OR l.discount>l.gross THEN RAISE EXCEPTION 'CHECKOUT_AMOUNT_INVALID'; END IF;
    net:=l.gross-l.discount; amount:=0; taxable:=net; rate_bps:=0; selected:=NULL; hsn:=NULL;
    IF registered AND coalesce((l.line->>'charge_tax')::boolean,true) THEN
      SELECT tr.* INTO selected FROM public.tax_rates tr
       WHERE tr.store_id=p_site_id AND tr.is_active AND tr.deleted_at IS NULL
         AND upper(tr.country)='IN' AND NOT tr.is_shipping AND tr.applies_to IN ('all','products')
         AND (nullif(btrim(tr.state),'') IS NULL OR public.checkout_gst_state_code_v1(tr.state)=state_code)
         AND (nullif(btrim(tr.hsn_code),'') IS NULL OR tr.hsn_code=l.line->>'hsn_code')
       ORDER BY (nullif(btrim(tr.hsn_code),'') IS NOT NULL) DESC,
         (nullif(btrim(tr.state),'') IS NOT NULL) DESC,tr.priority DESC,tr.id
       LIMIT 1 FOR SHARE;
      -- The canonical effective-dated HSN schedule supplies category defaults.
      -- Existing Merchant tax_rates are explicit manual jurisdiction overrides;
      -- both are consumed here, never by a second calculator or client fallback.
      IF selected.id IS NULL THEN
        SELECT hr.* INTO hsn FROM public.hsn_rates hr WHERE hr.site_id=p_site_id
          AND hr.hsn_code=l.line->>'hsn_code' AND hr.deleted_at IS NULL
          AND hr.effective_from<=CURRENT_DATE AND (hr.effective_to IS NULL OR hr.effective_to>=CURRENT_DATE)
          ORDER BY hr.effective_from DESC,hr.id LIMIT 1 FOR SHARE;
        IF hsn.id IS NULL THEN RAISE EXCEPTION 'GST_RATE_REQUIRED' USING ERRCODE='23514'; END IF;
        IF EXISTS(SELECT 1 FROM public.hsn_rates other WHERE other.site_id=p_site_id
          AND other.hsn_code=hsn.hsn_code AND other.deleted_at IS NULL
          AND other.effective_from<=CURRENT_DATE AND (other.effective_to IS NULL OR other.effective_to>=CURRENT_DATE)
          AND other.gst_rate_bps<>hsn.gst_rate_bps) THEN RAISE EXCEPTION 'GST_RATE_AMBIGUOUS'; END IF;
      END IF;
      IF selected.id IS NOT NULL AND EXISTS(SELECT 1 FROM tax_rates other WHERE other.store_id=p_site_id AND other.is_active AND other.deleted_at IS NULL AND upper(other.country)='IN' AND NOT other.is_shipping AND other.applies_to IN ('all','products') AND public.checkout_gst_state_code_v1(nullif(btrim(other.state),'')) IS NOT DISTINCT FROM public.checkout_gst_state_code_v1(nullif(btrim(selected.state),'')) AND nullif(btrim(other.hsn_code),'') IS NOT DISTINCT FROM nullif(btrim(selected.hsn_code),'') AND other.priority=selected.priority AND other.rate<>selected.rate) THEN RAISE EXCEPTION 'GST_RATE_AMBIGUOUS'; END IF;
      IF selected.is_compound THEN RAISE EXCEPTION 'GST_COMPOUND_RATE_UNSUPPORTED' USING ERRCODE='23514'; END IF;
      rate_bps:=coalesce(round(selected.rate*10000)::integer,hsn.gst_rate_bps);
      IF rate_bps<0 OR rate_bps>10000 THEN RAISE EXCEPTION 'GST_RATE_INVALID'; END IF;
      IF coalesce(s.tax_inclusive,false) THEN
        taxable:=round(net::numeric*10000/(10000+rate_bps))::bigint; amount:=net-taxable;
      ELSE
        amount:=round(net::numeric*rate_bps/10000)::bigint; added_tax:=added_tax+amount;
      END IF;
    END IF;
    c:=CASE WHEN s.gst_state_code=state_code THEN amount/2 ELSE 0 END;
    g:=CASE WHEN s.gst_state_code=state_code THEN amount-c ELSE 0 END;
    cgst:=cgst+c; sgst:=sgst+g; igst:=igst+amount-c-g; total_tax:=total_tax+amount;
    result_lines:=result_lines||jsonb_build_array(l.line||jsonb_build_object(
      'discount_minor',l.discount,'taxable_minor',taxable,'tax_minor',amount,'gst_rate_bps',rate_bps,
      'tax_rate_id',selected.id,'hsn_rate_id',hsn.id,'tax_inclusive',coalesce(s.tax_inclusive,false),
      'cgst_minor',c,'sgst_minor',g,'igst_minor',amount-c-g));
  END LOOP;

  -- Shipping is a distinct, explicit Merchant rate scope. No invented delivery tax.
  shipping_net:=p_shipping_minor-shipping_discount; selected:=NULL;
  IF registered AND shipping_net>0 THEN
    SELECT tr.* INTO selected FROM public.tax_rates tr
     WHERE tr.store_id=p_site_id AND tr.is_active AND tr.deleted_at IS NULL
       AND upper(tr.country)='IN' AND (tr.is_shipping OR tr.applies_to='shipping')
       AND (nullif(btrim(tr.state),'') IS NULL OR public.checkout_gst_state_code_v1(tr.state)=state_code)
       AND nullif(btrim(tr.hsn_code),'') IS NULL
     ORDER BY (nullif(btrim(tr.state),'') IS NOT NULL) DESC,tr.priority DESC,tr.id
     LIMIT 1 FOR SHARE;
    IF selected.id IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.tax_rates other WHERE other.store_id=p_site_id
        AND other.is_active AND other.deleted_at IS NULL AND upper(other.country)='IN'
        AND (other.is_shipping OR other.applies_to='shipping') AND nullif(btrim(other.hsn_code),'') IS NULL
        AND public.checkout_gst_state_code_v1(nullif(btrim(other.state),'')) IS NOT DISTINCT FROM public.checkout_gst_state_code_v1(nullif(btrim(selected.state),''))
        AND other.priority=selected.priority AND other.rate<>selected.rate) THEN RAISE EXCEPTION 'GST_RATE_AMBIGUOUS'; END IF;
      IF selected.is_compound THEN RAISE EXCEPTION 'GST_COMPOUND_RATE_UNSUPPORTED' USING ERRCODE='23514'; END IF;
      shipping_tax:=round(shipping_net::numeric*selected.rate)::bigint;
      c:=CASE WHEN s.gst_state_code=state_code THEN shipping_tax/2 ELSE 0 END;
      g:=CASE WHEN s.gst_state_code=state_code THEN shipping_tax-c ELSE 0 END;
      shipping_cgst:=c; shipping_sgst:=g; shipping_igst:=shipping_tax-c-g;
      shipping_rate_bps:=round(selected.rate*10000)::integer;
      cgst:=cgst+c; sgst:=sgst+g; igst:=igst+shipping_tax-c-g;
      total_tax:=total_tax+shipping_tax; added_tax:=added_tax+shipping_tax;
    END IF;
  END IF;
  -- Group real line components by effective rate; never label mixed HSN totals
  -- with an unrelated default percentage. Union-territory tax is explicit.
  IF registered THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('title',title,'rate',bps::numeric/100,
      'amount',minor::numeric/100,'jurisdiction',jsonb_build_object('supplier_state_code',s.gst_state_code,
       'recipient_state_code',state_code)) ORDER BY title,bps),'[]') INTO components
    FROM (
      SELECT title,bps,sum(minor)::bigint AS minor FROM (
        SELECT component_value.title,component_value.bps,component_value.minor
        FROM jsonb_array_elements(result_lines) component_entry(line)
        CROSS JOIN LATERAL (VALUES
          ('CGST',(component_entry.line->>'gst_rate_bps')::numeric/2,(component_entry.line->>'cgst_minor')::bigint),
          (state_component,(component_entry.line->>'gst_rate_bps')::numeric/2,(component_entry.line->>'sgst_minor')::bigint),
          ('IGST',(component_entry.line->>'gst_rate_bps')::numeric,(component_entry.line->>'igst_minor')::bigint)
        ) component_value(title,bps,minor)
        UNION ALL SELECT * FROM (VALUES ('CGST',shipping_rate_bps::numeric/2,shipping_cgst),
          (state_component,shipping_rate_bps::numeric/2,shipping_sgst),('IGST',shipping_rate_bps::numeric,shipping_igst)) c
      ) all_components WHERE minor>0 GROUP BY title,bps
    ) summed;
  END IF;
  q:=jsonb_build_object('version',1,'currency','INR','site_id',p_site_id,
    'collection_status',collection_status,'price_includes_tax',coalesce(s.tax_inclusive,false),
    'place_of_supply_state',state_code,'supplier_state',s.gst_state_code,
    'supplier',jsonb_build_object('name',coalesce(s.legal_name,s.name),'gstin',s.gstin,'state_code',s.gst_state_code,
      'address',coalesce(to_jsonb(s)->'invoice_address','{}'::jsonb)),
    'subtotal_minor',subtotal,'discount_minor',product_discount+shipping_discount,
    'shipping_minor',p_shipping_minor,'shipping_discount_minor',shipping_discount,
    'shipping_taxable_minor',shipping_net,'shipping_tax_minor',shipping_tax,'shipping_tax_rate_id',selected.id,
    'tax_minor',total_tax,'added_tax_minor',added_tax,'included_tax_minor',total_tax-added_tax,
    'total_minor',subtotal-product_discount+shipping_net+added_tax,
    'lines',result_lines,'tax_lines',components,
    'components',(SELECT coalesce(jsonb_agg(jsonb_build_object('title',value->>'title',
      'rate_percent',(value->>'rate')::numeric,'amount_minor',round((value->>'amount')::numeric*100)::bigint)),'[]')
      FROM jsonb_array_elements(components)));
  RETURN q;
END; $$;
REVOKE ALL ON FUNCTION public.resolve_checkout_gst_v1(uuid,jsonb,jsonb,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;

-- Shared delivery authority for options, review and final order validation.
CREATE OR REPLACE FUNCTION public.resolve_storefront_shipping_v1(
  p_site_id uuid,p_items jsonb,p_address jsonb,p_rate_id uuid,p_cod boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; item record; grams numeric:=0; subtotal numeric:=0; profile uuid; profile_set boolean:=false;
  item_profile uuid; default_profile uuid; fee bigint:=0; profile_cod boolean:=true; n integer:=0; amount bigint;
BEGIN
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'CHECKOUT_ITEMS_INVALID';
  END IF;
  PERFORM 1 FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL FOR SHARE;
  SELECT sr.*,sz.countries,sz.states,sz.zip_codes,sz.profile_id,sz.cod_enabled AS zone_cod
    INTO r FROM shipping_rates sr JOIN shipping_zones sz ON sz.id=sr.zone_id
    WHERE sr.id=p_rate_id AND sr.site_id=p_site_id AND sz.site_id=p_site_id AND sz.store_id=p_site_id
    AND sr.is_active AND sr.deleted_at IS NULL AND sz.deleted_at IS NULL FOR SHARE OF sr,sz;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_SHIPPING_CHANGED'; END IF;
  SELECT id INTO default_profile FROM public.shipping_profiles WHERE site_id=p_site_id
    AND is_default AND deleted_at IS NULL FOR SHARE;
  IF lower(coalesce(p_address->>'country','')) NOT IN ('in','india')
    OR coalesce(p_address->>'zip',p_address->>'pincode','') !~ '^[1-9][0-9]{5}$'
    OR NOT EXISTS(SELECT 1 FROM unnest(r.countries) c WHERE lower(btrim(c)) IN ('in','india'))
    OR (cardinality(r.states)>0 AND NOT EXISTS (
      SELECT 1 FROM unnest(r.states) st
      WHERE lower(btrim(st)) IN (lower(p_address->>'state'),lower(p_address->>'state_code'))
        OR public.checkout_gst_state_code_v1(st)=public.checkout_gst_state_code_v1(coalesce(p_address->>'state_code',p_address->>'state'))
    ))
    OR (cardinality(r.zip_codes)>0 AND NOT(coalesce(p_address->>'zip',p_address->>'pincode')=ANY(r.zip_codes))) THEN
    RAISE EXCEPTION 'CHECKOUT_SHIPPING_CHANGED';
  END IF;
  FOR item IN SELECT p.price AS product_price,p.shipping_profile_id,p.is_physical,
      p.weight AS product_weight,p.weight_unit AS product_unit,v.price AS variant_price,v.weight AS variant_weight,v.weight_unit AS variant_unit,
      (i.value->>'quantity')::integer AS qty FROM jsonb_array_elements(p_items) i(value)
      JOIN products p ON p.id=(i.value->>'product_id')::uuid AND p.store_id=p_site_id AND p.deleted_at IS NULL AND p.is_active
      LEFT JOIN product_variants v ON v.id=nullif(i.value->>'variant_id','')::uuid AND v.product_id=p.id
      WHERE (nullif(i.value->>'variant_id','') IS NULL OR v.id IS NOT NULL)
  LOOP
    n:=n+1;
    IF item.qty NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'CHECKOUT_ITEMS_INVALID'; END IF;
    subtotal:=subtotal+coalesce(nullif(item.variant_price,0),item.product_price)*item.qty;
    IF item.is_physical IS DISTINCT FROM false THEN
      item_profile:=coalesce(item.shipping_profile_id,default_profile);
      IF profile_set AND item_profile IS DISTINCT FROM profile THEN RAISE EXCEPTION 'CHECKOUT_SHIPPING_PROFILE_SPLIT_REQUIRED'; END IF;
      profile:=item_profile; profile_set:=true;
      IF r.type='weight_based' OR r.min_weight_grams IS NOT NULL OR r.max_weight_grams IS NOT NULL THEN
        IF coalesce(item.variant_weight,item.product_weight,0)<=0
          OR lower(coalesce(item.variant_unit,item.product_unit,'kg')) NOT IN ('g','kg','lb','oz') THEN
          RAISE EXCEPTION 'CHECKOUT_SHIPPING_WEIGHT_REQUIRED';
        END IF;
        grams:=grams+coalesce(item.variant_weight,item.product_weight)*item.qty*
          CASE lower(coalesce(item.variant_unit,item.product_unit,'kg')) WHEN 'g' THEN 1 WHEN 'lb' THEN 453.59237 WHEN 'oz' THEN 28.349523125 ELSE 1000 END;
      END IF;
    END IF;
  END LOOP;
  IF n<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'CHECKOUT_ITEM_UNAVAILABLE'; END IF;
  IF profile IS DISTINCT FROM coalesce(r.profile_id,default_profile) THEN RAISE EXCEPTION 'CHECKOUT_SHIPPING_PROFILE_MISMATCH'; END IF;
  IF profile IS NOT NULL THEN
    SELECT handling_fee_minor,cod_enabled INTO fee,profile_cod FROM shipping_profiles
      WHERE id=profile AND site_id=p_site_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_SHIPPING_PROFILE_MISMATCH'; END IF;
  END IF;
  IF (r.min_order_amount IS NOT NULL AND subtotal<r.min_order_amount) OR (r.max_order_amount IS NOT NULL AND subtotal>r.max_order_amount)
    OR (r.min_weight_grams IS NOT NULL AND grams<r.min_weight_grams) OR (r.max_weight_grams IS NOT NULL AND grams>r.max_weight_grams)
    OR r.type NOT IN ('flat','free','price_based','weight_based') THEN RAISE EXCEPTION 'CHECKOUT_SHIPPING_CHANGED'; END IF;
  IF p_cod AND NOT(coalesce(r.cod_enabled,false) AND coalesce(r.zone_cod,false) AND coalesce(profile_cod,false)) THEN
    RAISE EXCEPTION 'CHECKOUT_COD_UNAVAILABLE';
  END IF;
  amount:=CASE WHEN r.type='free' THEN 0 ELSE round(r.price*100)::bigint END+coalesce(fee,0);
  RETURN jsonb_build_object('id',r.id,'name',r.name,'type',r.type,'currency','INR','amount_minor',amount,
    'profile_id',profile,'handling_fee_minor',coalesce(fee,0),'fulfillment_mode','manual',
    'estimated_days_min',r.estimated_days_min,'estimated_days_max',r.estimated_days_max,
    'cod_available',coalesce(r.cod_enabled,false) AND coalesce(r.zone_cod,false) AND coalesce(profile_cod,false),
    'source','seller_zone_configuration','carrier_confirmed',false);
END; $$;
REVOKE ALL ON FUNCTION public.resolve_storefront_shipping_v1(uuid,jsonb,jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.list_storefront_shipping_options(p_store_id uuid,p_items jsonb,p_address jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE rate record; option jsonb; options jsonb:='[]';
BEGIN
  -- Bounded list. Configuration overflow is visible, never a silently truncated quote.
  IF (SELECT count(*) FROM shipping_rates WHERE site_id=p_store_id AND is_active AND deleted_at IS NULL)>100 THEN
    RAISE EXCEPTION 'CHECKOUT_SHIPPING_CONFIGURATION_LIMIT';
  END IF;
  FOR rate IN SELECT id FROM shipping_rates WHERE site_id=p_store_id AND is_active AND deleted_at IS NULL ORDER BY name,id LOOP
    BEGIN
      option:=resolve_storefront_shipping_v1(p_store_id,p_items,p_address,rate.id,false);
      options:=options||jsonb_build_array(option);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT IN ('CHECKOUT_SHIPPING_CHANGED','CHECKOUT_SHIPPING_PROFILE_MISMATCH') THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN options;
END; $$;
REVOKE ALL ON FUNCTION public.list_storefront_shipping_options(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_storefront_shipping_options(uuid,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.quote_storefront_checkout_totals(
  p_store_id uuid,p_items jsonb,p_shipping_address jsonb,p_shipping_rate_id uuid,
  p_coupon_code text DEFAULT NULL,p_customer_email text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  lines jsonb; subtotal bigint; count_valid integer; shipping_minor bigint:=0;
  discount_minor bigint:=0; shipping_discount bigint:=0; promo jsonb; q jsonb; delivery_snapshot jsonb;
BEGIN
  IF p_store_id IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'CHECKOUT_ITEMS_INVALID' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.sites WHERE id=p_store_id AND deleted_at IS NULL FOR SHARE;
  -- A review may read a cart capability but never revive a consumed/foreign one.
  -- Full line/fact validation and consumption remain in the canonical writer.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref'
    AND NOT EXISTS(SELECT 1 FROM public.carts c WHERE c.id=(i->'cart_fact_ref'->>'cart_id')::uuid
      AND c.store_id=p_store_id AND c.session_id=i->'cart_fact_ref'->>'cart_token'
      AND c.status='active' AND c.deleted_at IS NULL AND c.fact_acceptance_version=1
      AND (c.expires_at IS NULL OR c.expires_at>now()))) THEN
    RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('ordinal',i.n,'product_id',p.id,'variant_id',v.id,
    'cart_line_id',i.value->'cart_fact_ref'->>'line_id',
    'quantity',(i.value->>'quantity')::integer,'hsn_code',p.hsn_code,'charge_tax',p.charge_tax,
    'amount_minor',round(coalesce(nullif(v.price,0),p.price)*100)::bigint*(i.value->>'quantity')::integer)
    ORDER BY i.n),count(*) INTO lines,count_valid
  FROM jsonb_array_elements(p_items) WITH ORDINALITY i(value,n)
  JOIN public.products p ON p.id=(i.value->>'product_id')::uuid AND p.store_id=p_store_id
    AND p.deleted_at IS NULL AND p.is_active
  LEFT JOIN public.product_variants v ON v.id=nullif(i.value->>'variant_id','')::uuid AND v.product_id=p.id
  WHERE (i.value->>'quantity')::integer BETWEEN 1 AND 1000
    AND (nullif(i.value->>'variant_id','') IS NULL OR v.id IS NOT NULL);
  IF count_valid<>jsonb_array_length(p_items) THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref') THEN
      RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID' USING ERRCODE='23514';
    END IF;
    RAISE EXCEPTION 'CHECKOUT_ITEM_UNAVAILABLE' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i JOIN public.products p
    ON p.id=(i->>'product_id')::uuid AND p.store_id=p_store_id
    WHERE i ? 'cart_fact_ref' AND (i->'cart_fact_ref'->>'product_version')::integer IS DISTINCT FROM p.version) THEN
    RAISE EXCEPTION 'CART_FACTS_CHANGED' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(lines) x GROUP BY x->>'product_id',x->>'variant_id',x->>'cart_line_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'CHECKOUT_DUPLICATE_LINE'; END IF;
  SELECT sum((value->>'amount_minor')::bigint) INTO subtotal FROM jsonb_array_elements(lines);
  IF p_shipping_rate_id IS NOT NULL THEN
    delivery_snapshot:=public.resolve_storefront_shipping_v1(p_store_id,p_items,p_shipping_address,p_shipping_rate_id,false);
    shipping_minor:=(delivery_snapshot->>'amount_minor')::bigint;
  END IF;
  IF nullif(btrim(p_coupon_code),'') IS NOT NULL THEN
    promo:=public.evaluate_checkout_promotion(p_store_id,p_coupon_code,subtotal::numeric/100,shipping_minor::numeric/100,p_customer_email);
    IF NOT coalesce((promo->>'valid')::boolean,false) THEN RAISE EXCEPTION 'CHECKOUT_DISCOUNT_INVALID'; END IF;
    discount_minor:=round((promo->>'discount')::numeric*100)::bigint;
    shipping_discount:=CASE WHEN promo->>'effect_type'='free_shipping' THEN least(discount_minor,shipping_minor)
      ELSE greatest(discount_minor-subtotal,0) END;
  END IF;
  q:=public.resolve_checkout_gst_v1(p_store_id,lines,p_shipping_address,discount_minor,shipping_minor,shipping_discount)
    ||jsonb_build_object('shipping_rate_id',p_shipping_rate_id,'delivery_snapshot',delivery_snapshot,'coupon_code',upper(nullif(btrim(p_coupon_code),'')));
  RETURN q||jsonb_build_object('fingerprint',encode(extensions.digest(q::text,'sha256'),'hex'));
END; $$;
REVOKE ALL ON FUNCTION public.quote_storefront_checkout_totals(uuid,jsonb,jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quote_storefront_checkout_totals(uuid,jsonb,jsonb,uuid,text,text) TO service_role;

-- Preserve the existing writer, idempotency, inventory, tender, purchase and outbox.
-- Do not create a second order implementation. Fail if the qualified predecessor moved.
DO $$
DECLARE f regprocedure:='public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,bigint)'::regprocedure;
  definition text; original text;
BEGIN
  SELECT pg_get_functiondef(f) INTO definition; original:=definition;
  IF position('v_tax_amount := COALESCE(p_tax_amount, 0);' IN definition)=0
     OR position('v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);' IN definition)=0 THEN
    RAISE EXCEPTION 'GST predecessor body differs; review before migration';
  END IF;
  definition:=replace(definition,'    -- (a) Shipping resolution:', '    PERFORM 1 FROM public.sites WHERE id=p_store_id FOR UPDATE; -- one store lock before stock/tax/invoice locks
    -- Match the canonical configured-cart writer: cart -> inventory -> variants -> options -> product.
    PERFORM c.id FROM public.carts c WHERE c.store_id=p_store_id AND c.id IN
      (SELECT (i->''cart_fact_ref''->>''cart_id'')::uuid FROM jsonb_array_elements(p_items) i WHERE i ? ''cart_fact_ref'') ORDER BY c.id FOR UPDATE;
    PERFORM il.id FROM public.inventory_levels il WHERE il.store_id=p_store_id AND il.product_id IN
      (SELECT (i->>''product_id'')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY il.id FOR UPDATE;
    PERFORM v.id FROM public.product_variants v JOIN public.products p ON p.id=v.product_id WHERE p.store_id=p_store_id AND v.product_id IN
      (SELECT (i->>''product_id'')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY v.id FOR UPDATE OF v;
    PERFORM o.id FROM public.product_options o JOIN public.products p ON p.id=o.product_id WHERE p.store_id=p_store_id AND o.product_id IN
      (SELECT (i->>''product_id'')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY o.id FOR UPDATE OF o;
    PERFORM p.id FROM public.products p WHERE p.store_id=p_store_id AND p.id IN
      (SELECT (i->>''product_id'')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY p.id FOR UPDATE;
    -- Validate reviewed cart versions before this writer changes stock mirrors.
    -- Hold product prices stable through canonical inventory/order creation.
    v_authoritative_quote := public.quote_storefront_checkout_totals(p_store_id,p_items,p_shipping_address,p_shipping_rate_id,p_coupon_code,p_customer_email);
    -- (a) Shipping resolution:');
  definition:=replace(definition,'    v_tax_line JSONB;','    v_tax_line JSONB; v_authoritative_quote JSONB;');
  definition:=replace(definition, '-- (b) GST: when the gateway has computed tax server-side, accept it; otherwise 0.',
    'IF p_shipping_rate_id IS NOT NULL THEN v_shipping_amount := (public.resolve_storefront_shipping_v1(p_store_id,p_items,p_shipping_address,p_shipping_rate_id,p_payment_method=''cod'')->>''amount_minor'')::numeric/100; END IF;');
  definition:=replace(definition,'v_tax_amount := COALESCE(p_tax_amount, 0);','v_tax_amount := 0; -- resolved after canonical inventory pricing and discount');
  definition:=replace(definition,
    'v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);',
    $patch$IF round(v_order.subtotal*100)::bigint IS DISTINCT FROM (v_authoritative_quote->>'subtotal_minor')::bigint
       OR round(v_discount_amount*100)::bigint IS DISTINCT FROM (v_authoritative_quote->>'discount_minor')::bigint THEN
      RAISE EXCEPTION 'CHECKOUT_QUOTE_CHANGED' USING ERRCODE='23514';
    END IF;
    v_shipping_amount := (v_authoritative_quote->>'shipping_minor')::numeric/100;
    v_tax_amount := (v_authoritative_quote->>'tax_minor')::numeric/100;
    p_place_of_supply_state := v_authoritative_quote->>'place_of_supply_state';
    p_tax_lines := v_authoritative_quote->'tax_lines';
    v_grand_total := (v_authoritative_quote->>'total_minor')::numeric/100;
    UPDATE public.orders SET tax_snapshot=v_authoritative_quote WHERE id=v_order_id AND store_id=p_store_id;
    UPDATE public.order_items oi SET tax_snapshot=ql.line
      FROM jsonb_array_elements(v_authoritative_quote->'lines') ql(line)
      WHERE oi.order_id=v_order_id AND oi.site_id=p_store_id
        AND oi.product_id=(ql.line->>'product_id')::uuid
        AND nullif(oi.variant_id,'')::uuid IS NOT DISTINCT FROM nullif(ql.line->>'variant_id','')::uuid
        AND oi.product_snapshot->>'cart_line_id' IS NOT DISTINCT FROM ql.line->>'cart_line_id';
    $patch$);
  IF definition=original THEN RAISE EXCEPTION 'GST order cutover was not applied'; END IF;
  EXECUTE definition;
END; $$;

DO $$
DECLARE f regprocedure:='public.create_storefront_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric)'::regprocedure;
  d text;
BEGIN
  SELECT pg_get_functiondef(f) INTO d;
  d:=regexp_replace(d, E'\nBEGIN\n', E'\nBEGIN\n  PERFORM 1 FROM public.sites WHERE id=p_store_id FOR UPDATE;\n');
  d:=replace(d, '(''flat'', ''free'', ''price_based'')', '(''flat'', ''free'', ''price_based'', ''weight_based'')');
  d:=replace(d,'v_shipping_amount := CASE WHEN v_rate.type = ''free'' THEN 0 ELSE coalesce(v_rate.price, 0) END;',
    'v_shipping_amount := (public.resolve_storefront_shipping_v1(p_store_id,p_items,p_shipping_address,p_shipping_rate_id,p_payment_method=''cod'')->>''amount_minor'')::numeric/100;');
  EXECUTE d;
END; $$;

-- The marketplace wrapper already owns cart and inventory locks before it calls
-- the common writer. Acquire the same store lock first to avoid a SHARE->UPDATE
-- upgrade race, preserving all listing, cart and buyer admission checks.
DO $$
DECLARE f regprocedure; d text;
BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('create_marketplace_checkout_order','create_marketplace_checkout_order_with_delivery_rate')
 LOOP
   SELECT pg_get_functiondef(f) INTO d;
   d:=regexp_replace(d, E'\nBEGIN\n', E'\nBEGIN\n  PERFORM 1 FROM public.sites WHERE id=p_store_id FOR UPDATE;\n');
   EXECUTE d;
 END LOOP;
END; $$;

-- Reviewed quote is a comparison, never a client price or tax authority. Replays
-- return the original immutable receipt; a new action checks current configuration.
CREATE OR REPLACE FUNCTION public.create_storefront_checkout_order_with_quote(
  p_store_id uuid,p_command jsonb,p_expected_quote_fingerprint text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; original_quote jsonb; existing_order uuid;
BEGIN
  IF p_expected_quote_fingerprint IS NULL OR p_expected_quote_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'CHECKOUT_TAX_REVIEW_REQUIRED' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text||':'||(p_command->>'p_idempotency_key'),0));
  SELECT order_id INTO existing_order FROM public.checkout_sessions
    WHERE site_id=p_store_id AND idempotency_key=p_command->>'p_idempotency_key' AND deleted_at IS NULL LIMIT 1;
  -- A committed retry still traverses the canonical buyer/receipt guards, but
  -- does not require a rate that may legitimately have been retired afterward.
  IF existing_order IS NOT NULL THEN
    IF nullif(p_command->>'p_buyer_account_id','') IS NOT NULL THEN
      result:=public.create_checkout_order_for_buyer(
        (p_command->>'p_buyer_account_id')::uuid,(p_command->>'p_buyer_session_epoch')::integer,p_store_id,
        p_command->>'p_customer_name',p_command->>'p_customer_email',p_command->>'p_customer_phone',
        p_command->'p_shipping_address',p_command->'p_items',p_command->>'p_payment_method',p_command->>'p_notes',
        p_command->>'p_coupon_code',p_command->>'p_gift_card_code',p_command->>'p_shipping_method',p_command->>'p_idempotency_key',
        nullif(p_command->>'p_actor_id','')::uuid,p_command->>'p_request_id',nullif(p_command->>'p_shipping_rate_id','')::uuid,
        NULL,NULL,NULL,NULL);
    ELSE
      result:=public.create_checkout_order(p_store_id,
        p_command->>'p_customer_name',p_command->>'p_customer_email',p_command->>'p_customer_phone',
        p_command->'p_shipping_address',p_command->'p_items',p_command->>'p_payment_method',p_command->>'p_notes',
        p_command->>'p_coupon_code',p_command->>'p_gift_card_code',p_command->>'p_shipping_method',p_command->>'p_idempotency_key',
        nullif(p_command->>'p_actor_id','')::uuid,p_command->>'p_request_id',nullif(p_command->>'p_shipping_rate_id','')::uuid,
        NULL,NULL,NULL,NULL,NULL);
    END IF;
  ELSE
    result:=public.create_storefront_checkout_order_with_delivery_rate(p_store_id,
    p_command->>'p_customer_name',p_command->>'p_customer_email',p_command->>'p_customer_phone',
    p_command->'p_shipping_address',p_command->'p_items',p_command->>'p_payment_method',p_command->>'p_notes',
    p_command->>'p_coupon_code',p_command->>'p_gift_card_code',p_command->>'p_shipping_method',p_command->>'p_idempotency_key',
    nullif(p_command->>'p_actor_id','')::uuid,p_command->>'p_request_id',nullif(p_command->>'p_shipping_rate_id','')::uuid,
    NULL,NULL,NULL,
    nullif(p_command->>'p_buyer_account_id','')::uuid,nullif(p_command->>'p_buyer_session_epoch','')::integer,
    (p_command->>'p_expected_shipping_amount')::numeric);
  END IF;
  SELECT tax_snapshot INTO original_quote FROM public.orders WHERE id=(result->>'id')::uuid AND store_id=p_store_id;
  IF original_quote->>'fingerprint' IS DISTINCT FROM p_expected_quote_fingerprint THEN
    RAISE EXCEPTION 'CHECKOUT_QUOTE_CHANGED' USING ERRCODE='23514';
  END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.create_storefront_checkout_order_with_quote(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_storefront_checkout_order_with_quote(uuid,jsonb,text) TO service_role;
COMMIT;
