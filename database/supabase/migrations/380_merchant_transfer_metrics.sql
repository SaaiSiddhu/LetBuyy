-- Complete counts over live transfers, with no raw transfer history in REST.
BEGIN;
CREATE FUNCTION public.read_merchant_transfer_metrics(p_site_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  WITH counts AS (
    SELECT t.status, count(*) AS quantity
    FROM public.inventory_transfers AS t
    WHERE t.site_id = p_site_id AND t.deleted_at IS NULL
    GROUP BY t.status
  )
  SELECT jsonb_build_object(
    'by_status', coalesce(jsonb_object_agg(status, quantity), '{}'::jsonb),
    'in_transit_count', coalesce(sum(quantity) FILTER (WHERE status IN ('shipped', 'partially_received')), 0),
    'total_count', coalesce(sum(quantity), 0)
  ) FROM counts
$function$;
REVOKE ALL ON FUNCTION public.read_merchant_transfer_metrics(uuid) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.read_merchant_transfer_metrics(uuid) TO service_role;
COMMENT ON FUNCTION public.read_merchant_transfer_metrics(uuid) IS
  'Backend-only read under existing caller privileges; gateway verifies live store access. Counts nondeleted transfers; shipped and partially_received mean stock still in movement.';
NOTIFY pgrst, 'reload schema';
COMMIT;
