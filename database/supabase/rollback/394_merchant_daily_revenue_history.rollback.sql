BEGIN;
DROP FUNCTION public.merchant_daily_revenue_history(uuid,integer);
NOTIFY pgrst,'reload schema';
COMMIT;
