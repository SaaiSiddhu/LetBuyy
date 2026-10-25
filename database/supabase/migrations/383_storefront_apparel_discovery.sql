-- Bounded apparel filters on the canonical product/variant/collection owners.
-- Invoker rights only: no new RLS bypass or anonymous SQL access.
BEGIN;
CREATE OR REPLACE FUNCTION public.browse_storefront_apparel_v1(
  p_store_id uuid, p_page integer DEFAULT 1, p_limit integer DEFAULT 20,
  p_size text DEFAULT NULL, p_color text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL, p_max_price numeric DEFAULT NULL,
  p_sort text DEFAULT 'display_order', p_search text DEFAULT NULL,
  p_category text DEFAULT NULL, p_collection_id uuid DEFAULT NULL,
  p_relational boolean DEFAULT true, p_country_of_origin text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE result jsonb;
BEGIN
  IF p_page < 1 OR p_page > 10000 OR p_limit < 1 OR p_limit > 100
    OR length(p_country_of_origin)>100 OR length(p_size)>100 OR length(p_color)>100 OR length(p_search)>200 OR length(p_category)>100
    OR p_min_price<0 OR p_max_price<0 OR p_min_price>p_max_price
    OR p_sort NOT IN ('display_order','price-asc','price-desc','newest','name') THEN
    RAISE EXCEPTION 'Invalid apparel discovery query' USING ERRCODE='22023';
  END IF;
  WITH matched AS MATERIALIZED (
    SELECT p.id,p.store_id,p.name,p.slug,p.description,p.price,p.compare_price,p.category,p.product_type,p.tags,p.images,p.stock,p.track_inventory,p.is_active,p.is_featured,p.country_of_origin,p.importer_details,p.seo_title,p.seo_description,p.created_at,p.updated_at,p.variants,p.metadata,p.display_order
    FROM public.products p
    WHERE p.store_id=p_store_id AND p.is_active=true AND p.deleted_at IS NULL
      AND (p_min_price IS NULL OR p.price>=p_min_price) AND (p_max_price IS NULL OR p.price<=p_max_price)
      AND (p_search IS NULL OR p.name ILIKE '%'||p_search||'%')
      AND (p_category IS NULL OR p.category=p_category)
      AND (p_country_of_origin IS NULL OR lower(btrim(p.country_of_origin))=lower(btrim(p_country_of_origin)))
      AND (p_collection_id IS NULL OR EXISTS (
        SELECT 1 FROM public.collection_products cp JOIN public.collections c ON c.id=cp.collection_id
        WHERE cp.product_id=p.id AND c.id=p_collection_id AND c.store_id=p_store_id AND c.is_active=true AND c.deleted_at IS NULL))
      AND ((p_size IS NULL AND p_color IS NULL) OR
        (p_relational AND EXISTS (
          SELECT 1 FROM public.product_variants v
          LEFT JOIN public.product_options so ON so.product_id=p.id AND lower(so.name)='size'
          LEFT JOIN public.product_options co ON co.product_id=p.id AND lower(co.name) IN ('color','colour')
          WHERE v.product_id=p.id AND v.inventory_qty>0
            AND (p_size IS NULL OR lower(CASE so.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)=lower(p_size))
            AND (p_color IS NULL OR lower(CASE co.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)=lower(p_color))
        )) OR (NOT p_relational AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.variants)='array' THEN p.variants ELSE '[]'::jsonb END) v
          WHERE CASE WHEN coalesce(v->>'stock',v->>'inventory_qty',v->>'stock_quantity','') ~ '^[0-9]+$' THEN coalesce(v->>'stock',v->>'inventory_qty',v->>'stock_quantity')::numeric ELSE 0 END > 0
            AND (p_size IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(CASE WHEN jsonb_typeof(v->'options')='object' THEN v->'options' ELSE '{}'::jsonb END) o WHERE lower(o.key)='size' AND lower(o.value)=lower(p_size)))
            AND (p_color IS NULL OR EXISTS(SELECT 1 FROM jsonb_each_text(CASE WHEN jsonb_typeof(v->'options')='object' THEN v->'options' ELSE '{}'::jsonb END) o WHERE lower(o.key) IN ('color','colour') AND lower(o.value)=lower(p_color)))
        )))
  ), page_rows AS (
    SELECT * FROM matched ORDER BY
      CASE WHEN p_sort='price-asc' THEN price END ASC,
      CASE WHEN p_sort='price-desc' THEN price END DESC,
      CASE WHEN p_sort='newest' THEN created_at END DESC,
      CASE WHEN p_sort='name' THEN name END ASC,
      CASE WHEN p_sort='display_order' THEN display_order END ASC,
      id ASC LIMIT p_limit OFFSET (p_page-1)*p_limit
  ) SELECT jsonb_build_object('data',coalesce((SELECT jsonb_agg(to_jsonb(r)-'display_order') FROM page_rows r),'[]'::jsonb),'count',(SELECT count(*) FROM matched)) INTO result;
  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text) TO service_role;
COMMENT ON FUNCTION public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text) IS 'Internal transport only. Caller resolves a published site or validated site-bound preview before invocation; invoker RLS remains unchanged. Project public fields before serialization.';
COMMIT;
