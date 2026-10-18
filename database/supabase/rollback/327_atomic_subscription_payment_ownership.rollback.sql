-- Never reopen reuse of a retained captured subscription payment. No receipt,
-- invoice, subscription or provider reference is deleted by this recovery path.
BEGIN;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.subscriptions WHERE razorpay_payment_id IS NOT NULL) THEN
  RAISE EXCEPTION '327 rollback refuses retained captured subscription payments; preserve guards and use forward recovery';
 END IF;
END $guard$;
DROP FUNCTION IF EXISTS public.activate_merchant_subscription_v1(jsonb);
DROP INDEX IF EXISTS public.subscriptions_razorpay_payment_global_uidx;
NOTIFY pgrst,'reload schema';
COMMIT;
