-- Rollback for 205_merchant_session_jti_consumption.sql.
--
-- Migration 205 is purely additive (new table, new functions, no existing
-- object touched), so a faithful inverse is a full teardown -- there is no
-- prior state to restore anything to.

DROP FUNCTION IF EXISTS public.expire_merchant_session_jti_consumptions(integer);
DROP FUNCTION IF EXISTS public.consume_merchant_session_jti(text, uuid, timestamp with time zone);
DROP POLICY IF EXISTS merchant_session_jti_consumptions_service_all ON public.merchant_session_jti_consumptions;
DROP TABLE IF EXISTS public.merchant_session_jti_consumptions;
