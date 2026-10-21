-- Read-only operational summaries and one globally ordered receipt page.
-- Receipt created_at is the event time recorded by the canonical receive RPCs;
-- neither receipt table has a received_at or notes column.
BEGIN;
CREATE FUNCTION public.read_merchant_supplier_metrics(p_site_id uuid,p_page integer DEFAULT 1,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $supplier$
BEGIN
 IF p_page IS NULL OR p_page<1 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid metric page' USING ERRCODE='22023'; END IF;
 RETURN (
  WITH orders AS MATERIALIZED (
   SELECT id,supplier_id,expected_at,created_at FROM public.purchase_orders
   WHERE site_id=p_site_id AND deleted_at IS NULL
  ), receipts AS (
   SELECT r.purchase_order_id,min(r.created_at) AS received_at
   FROM public.purchase_order_receipts r JOIN orders p ON p.id=r.purchase_order_id
   WHERE r.site_id=p_site_id GROUP BY r.purchase_order_id
  ), metrics AS (
   SELECT p.supplier_id,coalesce(s.name,'No supplier') AS supplier_name,count(*) AS po_count,
    round((count(*) FILTER(WHERE r.received_at<=p.expected_at))::numeric /
      nullif(count(*) FILTER(WHERE r.received_at IS NOT NULL AND p.expected_at IS NOT NULL),0),2) AS on_time_rate,
    round(avg(round(extract(epoch FROM(date_trunc('milliseconds',r.received_at)-date_trunc('milliseconds',p.created_at)))/86400))
      FILTER(WHERE r.received_at>=p.created_at)) AS avg_lead_time_days
   FROM orders p LEFT JOIN receipts r ON r.purchase_order_id=p.id
   LEFT JOIN public.suppliers s ON s.id=p.supplier_id AND s.site_id=p_site_id
   GROUP BY p.supplier_id,s.name
  ), page AS (
   SELECT * FROM metrics ORDER BY po_count DESC,supplier_id NULLS LAST
   LIMIT p_limit OFFSET (p_page::bigint-1)*p_limit
  ), total AS (SELECT count(*) AS quantity FROM metrics)
  SELECT jsonb_build_object('suppliers',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY po_count DESC,supplier_id NULLS LAST) FROM page p),'[]'::jsonb),
   'meta',jsonb_build_object('page',p_page,'per_page',p_limit,'total',quantity,'total_pages',ceil(quantity::numeric/p_limit),
    'has_next',p_page::bigint*p_limit<quantity,'has_prev',p_page>1)) FROM total
 );
END $supplier$;

CREATE FUNCTION public.read_merchant_warehouse_metrics(p_site_id uuid,p_page integer DEFAULT 1,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $warehouse$
BEGIN
 IF p_page IS NULL OR p_page<1 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid metric page' USING ERRCODE='22023'; END IF;
 RETURN (
  WITH metrics AS (
   SELECT l.id AS location_id,l.name AS location_name,l.is_default,count(v.id) AS sku_count,
    coalesce(sum(coalesce(v.available,0)::bigint+coalesce(v.reserved,0)::bigint+coalesce(v.incoming,0)::bigint),0) AS total_units
   FROM public.inventory_locations l LEFT JOIN public.inventory_levels v ON v.location_id=l.id AND v.store_id=p_site_id
   WHERE l.store_id=p_site_id GROUP BY l.id
  ), page AS (
   SELECT * FROM metrics ORDER BY total_units DESC,location_id
   LIMIT p_limit OFFSET (p_page::bigint-1)*p_limit
  ), total AS (SELECT count(*) AS quantity FROM metrics)
  SELECT jsonb_build_object('warehouses',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY total_units DESC,location_id) FROM page p),'[]'::jsonb),
   'meta',jsonb_build_object('page',p_page,'per_page',p_limit,'total',quantity,'total_pages',ceil(quantity::numeric/p_limit),
    'has_next',p_page::bigint*p_limit<quantity,'has_prev',p_page>1)) FROM total
 );
END $warehouse$;

CREATE FUNCTION public.read_merchant_inventory_receipts(p_site_ids uuid[],p_page integer DEFAULT 1,p_limit integer DEFAULT 20,p_po_id uuid DEFAULT NULL,p_transfer_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $receipts$
BEGIN
 IF p_page IS NULL OR p_page<1 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
  OR(p_po_id IS NOT NULL AND p_transfer_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Invalid receipt page' USING ERRCODE='22023'; END IF;
 RETURN (
  WITH receipts AS (
   SELECT r.id,r.purchase_order_id,NULL::uuid AS transfer_id,r.quantity_received,
    CASE WHEN jsonb_typeof(r.metadata->'notes')='string' THEN r.metadata->>'notes' END AS notes,
    r.created_at AS received_at,r.created_at,'purchase_order'::text AS receipt_type,
    jsonb_build_object('id',p.id,'site_id',p.site_id) AS purchase_orders,NULL::jsonb AS inventory_transfers
   FROM public.purchase_order_receipts r JOIN public.purchase_orders p ON p.id=r.purchase_order_id AND p.site_id=r.site_id
   WHERE r.site_id=ANY(p_site_ids) AND p.site_id=ANY(p_site_ids) AND p_transfer_id IS NULL
    AND(p_po_id IS NULL OR r.purchase_order_id=p_po_id)
   UNION ALL
   SELECT r.id,NULL::uuid,r.transfer_id,r.quantity_received,
    CASE WHEN jsonb_typeof(r.metadata->'notes')='string' THEN r.metadata->>'notes' END,
    r.created_at,r.created_at,'transfer'::text,NULL::jsonb,jsonb_build_object('id',t.id,'site_id',t.site_id)
   FROM public.inventory_transfer_receipts r JOIN public.inventory_transfers t ON t.id=r.transfer_id AND t.site_id=r.site_id
   WHERE r.site_id=ANY(p_site_ids) AND t.site_id=ANY(p_site_ids) AND p_po_id IS NULL
    AND(p_transfer_id IS NULL OR r.transfer_id=p_transfer_id)
  ), page AS (
   SELECT * FROM receipts ORDER BY created_at DESC,receipt_type,id
   LIMIT p_limit OFFSET (p_page::bigint-1)*p_limit
  )
  SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY created_at DESC,receipt_type,id) FROM page p),'[]'::jsonb),
    'total',(SELECT count(*) FROM receipts))
 );
END $receipts$;

REVOKE ALL ON FUNCTION public.read_merchant_supplier_metrics(uuid,integer,integer),public.read_merchant_warehouse_metrics(uuid,integer,integer),public.read_merchant_inventory_receipts(uuid[],integer,integer,uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_merchant_supplier_metrics(uuid,integer,integer),public.read_merchant_warehouse_metrics(uuid,integer,integer),public.read_merchant_inventory_receipts(uuid[],integer,integer,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
