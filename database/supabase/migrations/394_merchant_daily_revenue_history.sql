-- Bounded, tenant-specific daily reporting from canonical orders. No money writes.
BEGIN;
CREATE FUNCTION public.merchant_daily_revenue_history(p_site_id uuid, p_days integer)
RETURNS TABLE(report_date date, revenue numeric, orders bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
  v_from date;
BEGIN
  IF p_site_id IS NULL OR p_days IS NULL OR p_days NOT IN (7,30,90,365) THEN
    RAISE EXCEPTION 'Invalid revenue reporting window' USING ERRCODE='22023';
  END IF;
  IF public.current_site_id() IS NOT NULL AND public.current_site_id() <> p_site_id THEN
    RAISE EXCEPTION 'Revenue tenant mismatch' USING ERRCODE='42501';
  END IF;
  v_from := v_today - (p_days * 2 - 1);
  RETURN QUERY
    WITH totals AS (
      SELECT (o.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
        SUM(o.total)::numeric AS revenue, COUNT(*) AS orders
      FROM public.orders o
      WHERE o.site_id=p_site_id AND o.deleted_at IS NULL AND o.payment_status='paid'
        AND o.created_at >= (v_from::timestamp AT TIME ZONE 'Asia/Kolkata')
        AND o.created_at < ((v_today+1)::timestamp AT TIME ZONE 'Asia/Kolkata')
      GROUP BY 1
    )
    SELECT d::date, COALESCE(t.revenue,0)::numeric, COALESCE(t.orders,0)::bigint
    FROM generate_series(v_from::timestamp,v_today::timestamp,interval '1 day') d
    LEFT JOIN totals t ON t.day=d::date
    ORDER BY d;
END;
$$;
REVOKE ALL ON FUNCTION public.merchant_daily_revenue_history(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_daily_revenue_history(uuid,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
