-- Local prototype only while current103 buyer source remains frozen.
-- Existing product/inventory authority; no table, cache, write or security-definer.
CREATE FUNCTION public.catalog_available_quantity(p public.products) RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $function$
 WITH actual AS (
  SELECT id,store_id FROM public.products WHERE id=(p).id AND store_id=(p).store_id AND deleted_at IS NULL
 ), skus AS (
  SELECT v.id AS variant_id FROM public.product_variants v JOIN actual p ON p.id=v.product_id WHERE v.deleted_at IS NULL
  UNION ALL SELECT NULL::uuid FROM actual p WHERE NOT EXISTS(SELECT 1 FROM public.product_variants v WHERE v.product_id=p.id AND v.deleted_at IS NULL)
 ), quantities AS (
  SELECT chosen.available FROM actual p CROSS JOIN skus s LEFT JOIN LATERAL (
   SELECT greatest(i.available::bigint-i.reserved::bigint,0) AS available
   FROM public.inventory_levels i JOIN public.inventory_locations loc ON loc.id=i.location_id
   WHERE i.product_id=p.id AND i.store_id=p.store_id AND i.variant_id IS NOT DISTINCT FROM s.variant_id
    AND i.deleted_at IS NULL AND loc.store_id=p.store_id AND loc.status='active' AND loc.deleted_at IS NULL
   ORDER BY loc.is_default DESC,i.updated_at ASC,i.id LIMIT 1
  ) chosen ON true
 )
 SELECT CASE WHEN count(*)=0 OR count(available)<>count(*) THEN NULL ELSE sum(available)::bigint END FROM quantities;
$function$;
REVOKE ALL ON FUNCTION public.catalog_available_quantity(public.products) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_available_quantity(public.products) TO service_role,app_tenant;
NOTIFY pgrst,'reload schema';
